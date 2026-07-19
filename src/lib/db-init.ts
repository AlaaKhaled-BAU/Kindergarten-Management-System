import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

export const DEFAULT_FEES = [
  {
    name: "رسوم صف البستان",
    amount: 350,
    feeType: "Monthly",
    applicableGrade: "Pre",
    academicYear: "2025-2026",
  },
  {
    name: "رسوم صف الروضة الأولى",
    amount: 400,
    feeType: "Monthly",
    applicableGrade: "KG1",
    academicYear: "2025-2026",
  },
  {
    name: "رسوم صف الروضة الثانية",
    amount: 500,
    feeType: "Monthly",
    applicableGrade: "KG2",
    academicYear: "2025-2026",
  },
];

export async function seedDefaultFees(client: PrismaClient = prisma): Promise<void> {
  for (const fee of DEFAULT_FEES) {
    const existing = await client.fee.findFirst({
      where: {
        name: fee.name,
        applicableGrade: fee.applicableGrade,
        academicYear: fee.academicYear,
      },
    });
    if (!existing) {
      await client.fee.create({ data: fee });
    }
  }
}

/**
 * A fresh install has no migrated database -- SQLite/Prisma won't error on
 * connecting to a missing file, it silently creates an empty, table-less
 * one. Applies every bundled migration in prisma/migrations, in order, that
 * hasn't been applied yet, then seeds default fees. Called once from
 * instrumentation.ts on server boot.
 *
 * Applied migrations are tracked in "_kg_migrations" so up-to-date boots do
 * no work, and each statement swallows "already exists" so a re-run (e.g.
 * after an interrupted first boot, or against a DB already migrated by
 * `prisma migrate` in dev) is a safe no-op instead of a crash. This is what
 * makes it correct to apply ALL migrations rather than just the init one --
 * the previous version hardcoded the init migration and silently skipped
 * every later migration (indexes, future columns) on packaged installs.
 */
export async function ensureDatabaseReady(): Promise<void> {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  // Timestamp-prefixed names (Prisma's convention) sort chronologically.
  const migrations = fs
    .readdirSync(migrationsDir)
    .filter((d) => fs.existsSync(path.join(migrationsDir, d, "migration.sql")))
    .sort();

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "_kg_migrations" ("name" TEXT PRIMARY KEY, "appliedAt" TEXT NOT NULL)`
  );
  const appliedRows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT "name" FROM "_kg_migrations"`
  );
  const applied = new Set(appliedRows.map((r) => r.name));

  for (const name of migrations) {
    if (applied.has(name)) continue;

    const sql = fs.readFileSync(
      path.join(migrationsDir, name, "migration.sql"),
      "utf-8"
    );
    const statements = sql
      .replace(/--[^\n]*/g, "") // strip SQL line comments, wherever they sit
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement);
      } catch (err) {
        // "already exists" => this DDL was applied by an earlier interrupted
        // run or by `prisma migrate` in dev. Idempotent skip; re-throw a real
        // DDL failure so a broken migration surfaces instead of silently
        // half-applying.
        if (!/already exists|duplicate column/i.test(String(err))) throw err;
      }
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "_kg_migrations" ("name", "appliedAt") VALUES (?, ?)`,
      name,
      new Date().toISOString()
    );
  }

  await seedDefaultFees(prisma);
}
