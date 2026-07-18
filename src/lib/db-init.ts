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
 * one, so a missing-tables check has to be explicit. Applies the bundled
 * init migration (idempotent DDL -- CREATE TABLE/INDEX only, safe to run
 * once) and seeds default fees. Called once from instrumentation.ts on
 * server boot.
 */
export async function ensureDatabaseReady(): Promise<void> {
  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM "Fee" LIMIT 1`);
    return; // already migrated
  } catch {
    // fall through and migrate
  }

  const migrationPath = path.join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260510142052_init",
    "migration.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf-8");
  const statements = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  await seedDefaultFees(prisma);
}
