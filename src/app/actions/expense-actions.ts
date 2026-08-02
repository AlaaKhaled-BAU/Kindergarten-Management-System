"use server";

import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { requireAdmin, assertMonthYear, assertValidFinancialDate, validatePositiveNumber, validateRequiredString } from "./validation";
import { roundMoney } from "@/lib/utils";
import { FIXED_EXPENSE_CATEGORIES } from "@/lib/fixed-expenses";

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

export async function createFixedExpenses(input: {
  expenseDate: Date;
  amounts: Record<string, number>;
}) {
  const actor = await requireAdmin();

  const date = new Date(input.expenseDate);
  assertValidFinancialDate(date, "التاريخ");

  const rows = FIXED_EXPENSE_CATEGORIES.map((category, i) => ({
    category,
    amount: input.amounts[i],
  })).filter((r) => r.amount > 0);

  if (rows.length === 0) {
    throw new Error("أدخل مبلغاً واحداً على الأقل");
  }

  for (const r of rows) validatePositiveNumber(r.amount, r.category);

  const created = await prisma.$transaction(
    rows.map((r) =>
      prisma.expense.create({
        data: {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          category: r.category,
          amount: roundMoney(r.amount),
          expenseDate: date,
          source: "Fixed",
          description: "مصروف ثابت شهري",
        },
      })
    )
  );

  await logEvent("fixed_expenses_created", { count: created.length, actor });
  return created.map((e) => ({ ...e, expenseDate: e.expenseDate.toISOString() }));
}

export async function createExpense(input: CreateExpenseInput) {
  await requireAdmin();

  validatePositiveNumber(input.amount, "المبلغ");
  validateRequiredString(input.category, "الفئة");
  assertMonthYear(input.month, input.year);
  assertValidFinancialDate(new Date(input.expenseDate), "التاريخ");

  const expense = await prisma.expense.create({
    data: {
      year: input.year,
      month: input.month,
      category: input.category,
      amount: roundMoney(input.amount),
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
  await requireAdmin();

  if (input.month !== undefined || input.year !== undefined) {
    assertMonthYear(input.month ?? 1, input.year ?? 2000);
  }
  if (input.expenseDate !== undefined) {
    assertValidFinancialDate(new Date(input.expenseDate), "التاريخ");
  }
  if (input.amount !== undefined) validatePositiveNumber(input.amount, "المبلغ");

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...(input.year !== undefined && { year: input.year }),
      ...(input.month !== undefined && { month: input.month }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.amount !== undefined && { amount: roundMoney(input.amount) }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.expenseDate !== undefined && { expenseDate: new Date(input.expenseDate) }),
      ...(input.vendor !== undefined && { vendor: input.vendor }),
      ...(input.referenceNumber !== undefined && { referenceNumber: input.referenceNumber }),
    },
  });

  return expense;
}

export async function deleteExpense(id: number) {
  const actor = await requireAdmin();

  await prisma.expense.update({
    where: { id },
    data: { isActive: false },
  });
  await logEvent("expense_soft_deleted", { expenseId: id, actor });
}

export async function getExpenses(filters?: {
  year?: number;
  month?: number;
  category?: string;
}) {
  await requireAdmin();

  return prisma.expense.findMany({
    where: {
      isActive: true,
      ...(filters?.year !== undefined && { year: filters.year }),
      ...(filters?.month !== undefined && { month: filters.month }),
      ...(filters?.category && { category: filters.category }),
    },
    orderBy: { expenseDate: "desc" },
  });
}

export async function getExpenseSummary(year: number) {
  await requireAdmin();

  return prisma.expense.groupBy({
    by: ["month", "category"],
    where: { year, isActive: true },
    _sum: { amount: true },
    orderBy: { month: "asc" },
  });
}
