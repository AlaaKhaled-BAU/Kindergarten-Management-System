import type { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

export const DEFAULT_FEES = [
  {
    name: "رسوم Pre",
    amount: 350,
    feeType: "Monthly",
    applicableGrade: "Pre",
    academicYear: "2025-2026",
  },
  {
    name: "رسوم KG1",
    amount: 400,
    feeType: "Monthly",
    applicableGrade: "KG1",
    academicYear: "2025-2026",
  },
  {
    name: "رسوم KG2",
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
  // Online-first (Postgres) mode: the schema is created by `prisma migrate
  // deploy` at deploy time -- the SQLite-era custom runner below is gone.
  // This hook now only seeds default fees on a fresh database.
  await seedDefaultFees(prisma);
}
