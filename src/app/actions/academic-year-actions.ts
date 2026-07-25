"use server";

import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { getSetting, setSetting } from "@/lib/settings";
import { requireAuth, requireAdmin } from "./validation";
import { nextAcademicYear, sortAcademicYearsDesc } from "@/lib/academic-year";

// Matches db-init.ts's DEFAULT_FEES seed year -- the sensible fallback for
// an install that hasn't explicitly set a current year yet.
const FALLBACK_YEAR = "2025-2026";

export async function getCurrentAcademicYear(): Promise<string> {
  return (await getSetting("currentAcademicYear")) ?? FALLBACK_YEAR;
}

/**
 * The "open" years -- every year with real data (a student or a fee row)
 * plus whichever year is currently marked active, so a fresh install with
 * no data yet still has one selectable year. Pass includeNext for
 * forward-looking pickers (new fees, promotion targets) where the admin
 * needs to set something up before any student actually exists in that
 * year yet.
 */
export async function getAcademicYears(options?: { includeNext?: boolean }): Promise<{
  years: string[];
  current: string;
}> {
  await requireAuth();

  const [studentYears, feeYears, current] = await Promise.all([
    prisma.student.findMany({ distinct: ["academicYear"], select: { academicYear: true } }),
    prisma.fee.findMany({
      where: { academicYear: { not: null } },
      distinct: ["academicYear"],
      select: { academicYear: true },
    }),
    getCurrentAcademicYear(),
  ]);

  const set = new Set<string>();
  for (const s of studentYears) set.add(s.academicYear);
  for (const f of feeYears) if (f.academicYear) set.add(f.academicYear);
  set.add(current);
  if (options?.includeNext) set.add(nextAcademicYear(current));

  return { years: sortAcademicYearsDesc([...set]), current };
}

/**
 * The manual trigger the admin uses to roll over: advances the stored
 * "current" year by one. Doesn't touch any Student/Fee rows itself --
 * promoting a grade cohort and pricing next year's fees are separate,
 * deliberate actions; this only changes which year new pickers default to
 * and which year the dashboard KPIs scope to.
 */
export async function startNewAcademicYear(): Promise<string> {
  const actor = await requireAdmin();
  const current = await getCurrentAcademicYear();
  const next = nextAcademicYear(current);
  await setSetting("currentAcademicYear", next);
  await logEvent("academic_year_started", { actor, from: current, to: next });
  return next;
}
