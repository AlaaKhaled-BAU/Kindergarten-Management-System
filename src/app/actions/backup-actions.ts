"use server";

import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { requireAdmin } from "./validation";

const MAX_BACKUPS = 30;

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

export async function createBackup(): Promise<{
  success: boolean;
  filePath?: string;
  error?: string;
}> {
  try {
    await requireAdmin();

    const dbPath = resolveDbPath();
    // Same reasoning as logger.ts: install directory can be read-only.
    const backupsDir = path.join(process.env.KG_DATA_DIR ?? process.cwd(), "Backups");

    await fs.mkdir(backupsDir, { recursive: true });

    try {
      await fs.access(dbPath);
    } catch {
      return { success: false, error: "ملف قاعدة البيانات غير موجود" };
    }

    const backupFileName = `backup_${formatTimestamp()}.db`;
    const backupPath = path.join(backupsDir, backupFileName);

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

    await logEvent("backup_created", { fileName: backupFileName });

    return { success: true, filePath: backupFileName };
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
