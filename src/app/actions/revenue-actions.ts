"use server";

import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { requireAuth, requireAdmin, validatePositiveNumber, validateRequiredString } from "./validation";
import { roundMoney } from "@/lib/utils";

const DERIVED_SOURCES = ["Payment", "Cancellation"];

/**
 * Payment/Cancellation revenue rows are written automatically by
 * processPayment/cancelReceipt and must stay in lockstep with their
 * originating receipt -- editing or deleting one here would desync the
 * revenue ledger from what the receipts actually show.
 */
function assertNotDerived(source: string | null, action: string): void {
  if (source && DERIVED_SOURCES.includes(source)) {
    throw new Error(
      `لا يمكن ${action} هذا السجل لأنه ناتج تلقائياً عن عملية دفع أو إلغاء إيصال`
    );
  }
}

interface CreateRevenueInput {
  year: number;
  month: number;
  category: string;
  amount: number;
  description?: string;
  recordDate: Date;
}

export async function createRevenue(input: CreateRevenueInput) {
  await requireAuth();

  validatePositiveNumber(input.amount, "المبلغ");
  validateRequiredString(input.category, "الفئة");

  const revenue = await prisma.revenue.create({
    data: {
      year: input.year,
      month: input.month,
      category: input.category,
      amount: input.amount,
      description: input.description ?? null,
      recordDate: new Date(input.recordDate),
      source: "Manual",
    },
  });

  return revenue;
}

export async function updateRevenue(
  id: number,
  input: Partial<CreateRevenueInput>
) {
  await requireAuth();

  const existing = await prisma.revenue.findUniqueOrThrow({ where: { id } });
  assertNotDerived(existing.source, "تعديل");

  const revenue = await prisma.revenue.update({
    where: { id },
    data: {
      ...(input.year !== undefined && { year: input.year }),
      ...(input.month !== undefined && { month: input.month }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.recordDate !== undefined && { recordDate: new Date(input.recordDate) }),
    },
  });

  return revenue;
}

export async function deleteRevenue(id: number) {
  const actor = await requireAuth();

  const existing = await prisma.revenue.findUniqueOrThrow({ where: { id } });
  assertNotDerived(existing.source, "حذف");

  await prisma.revenue.delete({ where: { id } });
  await logEvent("revenue_deleted", { revenueId: id, actor });
}

export async function getRevenues(filters?: {
  year?: number;
  month?: number;
  category?: string;
}) {
  await requireAuth();

  return prisma.revenue.findMany({
    where: {
      ...(filters?.year !== undefined && { year: filters.year }),
      ...(filters?.month !== undefined && { month: filters.month }),
      ...(filters?.category && { category: filters.category }),
    },
    orderBy: { recordDate: "desc" },
  });
}

export async function getRevenueSummary(year: number) {
  await requireAuth();

  return prisma.revenue.groupBy({
    by: ["month", "category"],
    where: { year },
    _sum: { amount: true },
    orderBy: { month: "asc" },
  });
}

export async function getDashboardStats() {
  // Admin-only: this is the school-wide financial KPI surface. proxy.ts already
  // redirects non-admins away from "/", but gating the action too keeps the
  // data safe even if the action is ever imported onto a teacher-facing page.
  await requireAdmin();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // "Current academic year" isn't a stored setting -- derive it from
  // whichever academicYear the currently-active students belong to (a
  // promotion batch keeps this in sync by construction). Falls back to no
  // filter (all-time) if there are no active students yet, e.g. a fresh
  // install before any student has been created.
  const academicYearGroups = await prisma.student.groupBy({
    by: ["academicYear"],
    where: { isActive: true },
    _count: { academicYear: true },
    orderBy: { _count: { academicYear: "desc" } },
    take: 1,
  });
  const currentAcademicYear = academicYearGroups[0]?.academicYear;

  const yearStudentFilter = currentAcademicYear
    ? { student: { academicYear: currentAcademicYear } }
    : {};

  const [
    totalExpected,
    receivedThisMonth,
    collectedThisYear,
    outstandingResult,
    expensesThisMonth,
  ] = await Promise.all([
    // Expected income is a forward-looking, per-period metric -- scope it to
    // this year so it doesn't grow forever by including students who
    // finished paying off and left years ago. Includes Adjustment (fee
    // edits, refunds) alongside Charge -- without it, a refund raises
    // outstandingBalance (unscoped, all types) but not expectedIncome, so
    // "expected minus collected" silently stops matching the real
    // receivable. Verified live: a 50 JOD refund created exactly a 50 JOD
    // gap (349.95 actual vs 299.95 computed) until Adjustment was included.
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        transactionType: { in: ["Charge", "Adjustment"] },
        ...yearStudentFilter,
      },
    }),
    // "Received this month" -- net of same-month cancellations. A payment taken
    // and canceled in the same month writes a +Payment and a -Cancellation
    // revenue row; counting only "Payment" would overstate the month's intake.
    prisma.revenue.aggregate({
      _sum: { amount: true },
      where: {
        year: currentYear,
        month: currentMonth,
        source: { in: ["Payment", "Cancellation"] },
      },
    }),
    // Collected FOR THE YEAR (payments net of reversals), same student scope as
    // totalExpected, so collectionRate compares like with like. Payments are
    // stored negative and reversals positive, so their sum is negated below.
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        transactionType: { in: ["Payment", "Reversal"] },
        ...yearStudentFilter,
      },
    }),
    // Outstanding balance is total receivables right now, from anyone --
    // including a withdrawn student who left still owing money -- so this
    // one intentionally stays unscoped by year.
    prisma.transaction.aggregate({
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        year: currentYear,
        month: currentMonth,
      },
    }),
  ]);

  const expectedIncome = roundMoney(totalExpected._sum.amount ?? 0);
  const receivedIncome = roundMoney(receivedThisMonth._sum.amount ?? 0);
  const collectedThisYearAmount = roundMoney(-(collectedThisYear._sum.amount ?? 0));
  // Not clamped to 0: a negative balance is a real net credit (prepaid
  // families), and hiding it as "0.00" would misrepresent the school's
  // actual receivables on a KPI meant to be trusted at a glance.
  const outstandingBalance = roundMoney(outstandingResult._sum.amount ?? 0);
  // Collection rate = collected / charged for the current year (both same
  // scope). The old form divided this-month revenue by the whole year's
  // charges, so it always read as a tiny fraction of the true rate.
  const collectionRate = expectedIncome > 0 ? (collectedThisYearAmount / expectedIncome) * 100 : 0;
  const totalExpenses = roundMoney(expensesThisMonth._sum.amount ?? 0);

  return {
    expectedIncome,
    receivedIncome,
    outstandingBalance,
    collectionRate: Math.round(collectionRate * 100) / 100,
    expensesThisMonth: totalExpenses,
    academicYear: currentAcademicYear ?? null,
  };
}
