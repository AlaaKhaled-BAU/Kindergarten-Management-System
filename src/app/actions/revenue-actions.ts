"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, validatePositiveNumber, validateRequiredString } from "./validation";

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
  await requireAuth();

  await prisma.revenue.delete({ where: { id } });
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
  await requireAuth();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [
    totalExpected,
    receivedThisMonth,
    outstandingResult,
    expensesThisMonth,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        transactionType: "Charge",
      },
    }),
    prisma.revenue.aggregate({
      _sum: { amount: true },
      where: {
        year: currentYear,
        month: currentMonth,
        source: "Payment",
      },
    }),
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

  const expectedIncome = totalExpected._sum.amount ?? 0;
  const receivedIncome = receivedThisMonth._sum.amount ?? 0;
  const netBalance = Math.max(0, outstandingResult._sum.amount ?? 0);
  const collectionRate = expectedIncome > 0 ? (receivedIncome / expectedIncome) * 100 : 0;
  const totalExpenses = expensesThisMonth._sum.amount ?? 0;

  return {
    expectedIncome,
    receivedIncome,
    outstandingBalance: netBalance,
    collectionRate: Math.round(collectionRate * 100) / 100,
    expensesThisMonth: totalExpenses,
  };
}
