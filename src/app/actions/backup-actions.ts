"use server";

import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { requireAdmin } from "./validation";

const MAX_BACKUPS = 30;

function isPostgres(): boolean {
  return /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
}

/**
 * Resolves the live SQLite file from DATABASE_URL rather than assuming
 * "kindergarten.db" sits at cwd -- main.js overrides DATABASE_URL to an
 * absolute path outside the (possibly read-only) install directory, and
 * backing up the wrong file would be a silent, undetectable data-loss bug.
 */
function resolveDbPath(): string {
  const url = process.env.DATABASE_URL ?? "";
  const raw = url.replace(/^file:/, "");
  if (raw && path.isAbsolute(raw)) return raw;
  if (raw) return path.resolve(process.cwd(), "prisma", raw);
  return path.join(process.cwd(), "kindergarten.db");
}

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// Postgres dump (Cloudflare Workers / Neon)
// ---------------------------------------------------------------------------

const PG_TYPES: Record<string, string> = {
  int2: "smallint",
  int4: "integer",
  int8: "bigint",
  float4: "real",
  float8: "double precision",
  numeric: "numeric",
  bool: "boolean",
  text: "text",
  bpchar: "character",
  varchar: "character varying",
  date: "date",
  timestamp: "timestamp(3)",
  timestamptz: "timestamptz(3)",
  time: "time",
  timetz: "timetz",
  json: "json",
  jsonb: "jsonb",
  uuid: "uuid",
  bytea: "bytea",
  interval: "interval",
};

function pgType(udtName: string, maxLength: number | null): string {
  const base = PG_TYPES[udtName];
  if (!base) return udtName;
  if (
    (udtName === "varchar" || udtName === "bpchar") &&
    typeof maxLength === "number" &&
    maxLength > 0
  ) {
    return `${base}(${maxLength})`;
  }
  return base;
}

function pgValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }
  if (typeof value === "bigint") return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "object") {
    if (typeof (value as { toString?: () => string }).toString === "function") {
      const s = String(value);
      if (s !== "[object Object]") return `'${s.replace(/'/g, "''")}'`;
    }
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function buildPostgresDump(): Promise<string> {
  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name::text AS table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );

  const columns = await prisma.$queryRawUnsafe<
    {
      table_name: string;
      column_name: string;
      udt_name: string;
      character_maximum_length: number | null;
      is_nullable: string;
    }[]
  >(
    `SELECT table_name::text AS table_name, column_name::text AS column_name,
            udt_name::text AS udt_name,
            character_maximum_length::int4 AS character_maximum_length,
            is_nullable::text AS is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`
  );

  const pks = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
    `SELECT tc.table_name::text AS table_name, kcu.column_name::text AS column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
     WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY tc.table_name, kcu.ordinal_position`
  );

  // Sequence-backed columns (serial/identity), via the catalog: names are
  // exact and the query never errors for non-serial columns (unlike
  // pg_get_serial_sequence, which throws for columns without a sequence).
  const seqs = await prisma.$queryRawUnsafe<
    {
      table_name: string;
      column_name: string;
      seq_name: string;
      data_type: string;
      start_value: number;
      increment_by: number;
      min_value: number;
      max_value: number;
      cache_size: number;
      cycle: boolean;
    }[]
  >(
    `SELECT c.relname::text AS table_name, a.attname::text AS column_name,
            s.relname::text AS seq_name, ps.data_type::text AS data_type,
            ps.start_value, ps.increment_by, ps.min_value, ps.max_value,
            ps.cache_size, ps.cycle
     FROM pg_class c
     JOIN pg_attribute a ON a.attrelid = c.oid
     JOIN pg_depend d ON d.refobjid = c.oid AND d.refobjsubid = a.attnum
        AND d.deptype IN ('a', 'i')
     JOIN pg_class s ON s.oid = d.objid AND s.relkind = 'S'
     JOIN pg_sequences ps ON ps.schemaname = s.relnamespace::regnamespace::text
        AND ps.sequencename = s.relname
     WHERE c.relkind = 'r' AND c.relname NOT LIKE 'pg_%'
     ORDER BY c.relname, a.attnum`
  );

  const colsByTable = new Map<string, typeof columns>();
  for (const c of columns) {
    const list = colsByTable.get(c.table_name) ?? [];
    list.push(c);
    colsByTable.set(c.table_name, list);
  }
  const pkByTable = new Map<string, string[]>();
  for (const p of pks) {
    const list = pkByTable.get(p.table_name) ?? [];
    list.push(p.column_name);
    pkByTable.set(p.table_name, list);
  }
  const seqByTable = new Map<
    string,
    {
      column_name: string;
      seq_name: string;
      data_type: string;
      start_value: number;
      increment_by: number;
      min_value: number;
      max_value: number;
      cache_size: number;
      cycle: boolean;
    }
  >();
  for (const s of seqs) {
    seqByTable.set(s.table_name, {
      column_name: s.column_name,
      seq_name: s.seq_name,
      data_type: s.data_type,
      start_value: s.start_value,
      increment_by: s.increment_by,
      min_value: s.min_value,
      max_value: s.max_value,
      cache_size: s.cache_size,
      cycle: s.cycle,
    });
  }

  const lines: string[] = [
    "-- Kindergarten ERP backup",
    "-- Generated: " + new Date().toISOString(),
    "-- Restore: psql \"$DATABASE_URL\" < " + `backup_${formatTimestamp()}.sql`,
    "",
    "BEGIN;",
    "",
  ];

  for (const t of tables) {
    const name = t.table_name;
    const cols = colsByTable.get(name) ?? [];
    const pk = pkByTable.get(name) ?? [];
    if (cols.length === 0) continue;

    const colDefs = cols.map((c) => {
      const type = pgType(c.udt_name, c.character_maximum_length);
      const notNull = c.is_nullable === "NO" ? " NOT NULL" : "";
      return `  "${c.column_name}" ${type}${notNull}`;
    });
    if (pk.length > 0) {
      colDefs.push(`  PRIMARY KEY (${pk.map((p) => `"${p}"`).join(", ")})`);
    }
    lines.push(`CREATE TABLE IF NOT EXISTS "${name}" (`);
    lines.push(colDefs.join(",\n"));
    lines.push(");");
    lines.push("");

    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${name}"`
    );
    if (rows.length > 0) {
      const colNames = cols.map((c) => `"${c.column_name}"`).join(", ");
      const values = rows.map(
        (r) => `(${cols.map((c) => pgValue(r[c.column_name])).join(", ")})`
      );
      lines.push(
        `INSERT INTO "${name}" (${colNames}) VALUES\n  ${values.join(",\n  ")};`
      );
      lines.push("");
    }

    const seq = seqByTable.get(name);
    if (seq) {
      lines.push(
        `CREATE SEQUENCE IF NOT EXISTS "${seq.seq_name}" AS ${seq.data_type}` +
          (seq.cycle ? " CYCLE" : " NO CYCLE") +
          ` INCREMENT BY ${seq.increment_by} MINVALUE ${seq.min_value} MAXVALUE ${seq.max_value}` +
          ` START WITH ${seq.start_value} CACHE ${seq.cache_size};`
      );
      lines.push(
        `ALTER TABLE "${name}" ALTER COLUMN "${seq.column_name}" SET DEFAULT nextval('"${seq.seq_name}"'::regclass);`
      );
      lines.push(
        `SELECT setval('"${seq.seq_name}"', ` +
          `(SELECT COALESCE(MAX("${seq.column_name}"), 1) FROM "${name}"), ` +
          `(SELECT MAX("${seq.column_name}") FROM "${name}") IS NOT NULL);`
      );
      lines.push("");
    }
  }

  lines.push("COMMIT;");
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createBackup(): Promise<{
  success: boolean;
  fileName?: string;
  download?: { mime: string; text?: string; base64?: string };
  error?: string;
}> {
  try {
    await requireAdmin();

    const fileName = `backup_${formatTimestamp()}`;

    if (isPostgres()) {
      // Cloudflare Workers / Neon: no local filesystem. Generate a portable
      // SQL dump and hand it to the browser as a download.
      const dump = await buildPostgresDump();
      await logEvent("backup_created", {
        fileName: fileName + ".sql",
        bytes: dump.length,
      });
      return {
        success: true,
        fileName: fileName + ".sql",
        download: { mime: "application/sql", text: dump },
      };
    }

    // Local SQLite (Electron / standalone): atomic VACUUM INTO snapshot.
    const dbPath = resolveDbPath();
    // Same reasoning as logger.ts: install directory can be read-only.
    const backupsDir = path.join(process.env.KG_DATA_DIR ?? process.cwd(), "Backups");

    await fs.mkdir(backupsDir, { recursive: true });

    try {
      await fs.access(dbPath);
    } catch {
      return { success: false, error: "ملف قاعدة البيانات غير موجود" };
    }

    const backupPath = path.join(backupsDir, `${fileName}.db`);

    // VACUUM INTO takes a consistent, defragmented snapshot atomically at
    // the SQLite level -- unlike fs.copyFile, which can race a concurrent
    // write and copy a torn/partial file.
    await prisma.$executeRawUnsafe(`VACUUM INTO ?`, backupPath);

    // Cleanup: keep only last MAX_BACKUPS
    const files = await fs.readdir(backupsDir);
    const dbFiles = files
      .filter((f) => f.startsWith("backup_") && f.endsWith(".db"))
      .map((f) => ({ name: f, fullPath: path.join(backupsDir, f) }));

    const sorted = dbFiles.sort((a, b) => a.name.localeCompare(b.name));

    if (sorted.length > MAX_BACKUPS) {
      const toDelete = sorted.slice(0, sorted.length - MAX_BACKUPS);
      await Promise.all(
        toDelete.map((f) => fs.unlink(f.fullPath).catch(() => {}))
      );
    }

    const buffer = await fs.readFile(backupPath);

    await logEvent("backup_created", {
      fileName: `${fileName}.db`,
      bytes: buffer.length,
    });

    return {
      success: true,
      fileName: `${fileName}.db`,
      download: {
        mime: "application/vnd.sqlite3",
        base64: buffer.toString("base64"),
      },
    };
  } catch (error) {
    await logEvent("error", {
      action: "createBackup",
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "فشل إنشاء النسخة الاحتياطية",
    };
  }
}
