"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, validatePositiveNumber, validateRequiredString } from "./validation";

interface CreateExpenseInput {
  year: number;
  month: number;
  category: string;
  amount: number;
  description?: string;
  expenseDate: Date;
  vendor?: string;
  referenceNumber?: string;
}

export async function createExpense(input: CreateExpenseInput) {
  await requireAuth();

  validatePositiveNumber(input.amount, "المبلغ");
  validateRequiredString(input.category, "الفئة");

  const expense = await prisma.expense.create({
    data: {
      year: input.year,
      month: input.month,
      category: input.category,
      amount: input.amount,
      description: input.description ?? null,
      expenseDate: new Date(input.expenseDate),
      vendor: input.vendor ?? null,
      referenceNumber: input.referenceNumber ?? null,
      source: "Manual",
    },
  });

  return expense;
}

export async function updateExpense(
  id: number,
  input: Partial<CreateExpenseInput>
) {
  await requireAuth();

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...(input.year !== undefined && { year: input.year }),
      ...(input.month !== undefined && { month: input.month }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.expenseDate !== undefined && { expenseDate: new Date(input.expenseDate) }),
      ...(input.vendor !== undefined && { vendor: input.vendor }),
      ...(input.referenceNumber !== undefined && { referenceNumber: input.referenceNumber }),
    },
  });

  return expense;
}

export async function deleteExpense(id: number) {
  await requireAuth();

  await prisma.expense.delete({ where: { id } });
}

export async function getExpenses(filters?: {
  year?: number;
  month?: number;
  category?: string;
}) {
  await requireAuth();

  return prisma.expense.findMany({
    where: {
      ...(filters?.year !== undefined && { year: filters.year }),
      ...(filters?.month !== undefined && { month: filters.month }),
      ...(filters?.category && { category: filters.category }),
    },
    orderBy: { expenseDate: "desc" },
  });
}

export async function getExpenseSummary(year: number) {
  await requireAuth();

  return prisma.expense.groupBy({
    by: ["month", "category"],
    where: { year },
    _sum: { amount: true },
    orderBy: { month: "asc" },
  });
}
