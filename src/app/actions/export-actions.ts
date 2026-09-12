"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/actions/validation";
import { roundMoney } from "@/lib/utils";
import { academicYearPrismaFilter } from "@/lib/academic-year";
import { MONTH_NAMES } from "@/lib/months";
import {
  exportRevenuesToExcel,
  exportExpensesToExcel,
  exportFinancialsToExcel,
  exportStudentBalancesToExcel,
} from "@/lib/excel-utils";

export type FinancialExportFilter =
  | { type: "month"; year: number; months: number[] }
  | { type: "academicYear"; academicYear: string };

function normalizeMonths(months: number[]): number[] {
  const unique = [...new Set(months)].filter(
    (m) => Number.isInteger(m) && m >= 1 && m <= 12
  );
  if (unique.length === 0) {
    throw new Error("اختر شهراً واحداً على الأقل");
  }
  return unique.sort((a, b) => a - b);
}

function financialWhere(filter: FinancialExportFilter) {
  if (filter.type === "month") {
    if (!Number.isInteger(filter.year) || filter.year < 2000 || filter.year > 2100) {
      throw new Error("السنة غير صحيحة");
    }
    const months = normalizeMonths(filter.months);
    return { year: filter.year, month: { in: months } };
  }
  return academicYearPrismaFilter(filter.academicYear);
}

function exportFilename(
  kind: "الإيرادات" | "المصروفات" | "الإيرادات_والمصروفات",
  filter: FinancialExportFilter
): string {
  if (filter.type === "month") {
    const months = normalizeMonths(filter.months);
    if (months.length === 12) {
      return `${kind}_${filter.year}.xlsx`;
    }
    const labels = months.map((m) => MONTH_NAMES[m - 1] ?? m).join("_");
    return `${kind}_${labels}_${filter.year}.xlsx`;
  }
  return `${kind}_${filter.academicYear}.xlsx`;
}

function exportRevenueDescription(description: string | null): string | null {
  if (!description) return null;
  const cleaned = description.replace(/^دفعة من الطالب:\s*/, "").trim();
  return cleaned || null;
}

async function loadRevenues(filter: FinancialExportFilter) {
  const revenues = await prisma.revenue.findMany({
    where: { isActive: true, ...financialWhere(filter) },
    include: { receipt: { select: { receiptNumber: true } } },
    orderBy: [{ recordDate: "asc" }, { id: "asc" }],
  });
  return revenues.map((r) => ({
    year: r.recordDate.getFullYear(),
    month: r.recordDate.getMonth() + 1,
    category: r.category,
    amount: r.amount,
    description: exportRevenueDescription(r.description),
    receiptNumber: r.receipt?.receiptNumber ?? null,
    date: r.recordDate,
  }));
}

async function loadExpenses(filter: FinancialExportFilter) {
  const expenses = await prisma.expense.findMany({
    where: { isActive: true, ...financialWhere(filter) },
    orderBy: [{ year: "asc" }, { month: "asc" }, { expenseDate: "asc" }],
  });
  return expenses.map((e) => ({
    receiptNumber: e.referenceNumber,
    year: e.expenseDate.getFullYear(),
    month: e.expenseDate.getMonth() + 1,
    category: e.category,
    amount: e.amount,
    description: e.description,
    vendor: e.vendor,
    date: e.expenseDate,
  }));
}

export async function exportRevenues(filter: FinancialExportFilter, includeExpenses = false) {
  await requireAdmin();

  if (includeExpenses) {
    const [revenues, expenses] = await Promise.all([loadRevenues(filter), loadExpenses(filter)]);
    const buffer = await exportFinancialsToExcel(revenues, expenses);
    return {
      base64: buffer.toString("base64"),
      filename: exportFilename("الإيرادات_والمصروفات", filter),
    };
  }

  const data = await loadRevenues(filter);
  const buffer = await exportRevenuesToExcel(data);
  return {
    base64: buffer.toString("base64"),
    filename: exportFilename("الإيرادات", filter),
  };
}

export async function exportExpenses(filter: FinancialExportFilter, includeRevenues = false) {
  await requireAdmin();

  if (includeRevenues) {
    const [revenues, expenses] = await Promise.all([loadRevenues(filter), loadExpenses(filter)]);
    const buffer = await exportFinancialsToExcel(revenues, expenses);
    return {
      base64: buffer.toString("base64"),
      filename: exportFilename("الإيرادات_والمصروفات", filter),
    };
  }

  const data = await loadExpenses(filter);
  const buffer = await exportExpensesToExcel(data);
  return {
    base64: buffer.toString("base64"),
    filename: exportFilename("المصروفات", filter),
  };
}

export async function exportStudentBalances(grade?: string, year?: string) {
  await requireAdmin();

  const students = await prisma.student.findMany({
    where: {
      isActive: true,
      ...(grade ? { grade } : {}),
      ...(year ? { academicYear: year } : {}),
    },
    orderBy: [{ grade: "asc" }, { lastName: "asc" }],
  });

  const balances = await Promise.all(
    students.map(async (s) => {
      const result = await prisma.transaction.aggregate({
        where: { studentId: s.id },
        _sum: { amount: true },
      });
      return {
        name: `${s.firstName} ${s.lastName}`,
        grade: s.grade,
        academicYear: s.academicYear,
        balance: roundMoney(result._sum.amount ?? 0),
      };
    })
  );

  const buffer = await exportStudentBalancesToExcel(balances);
  return {
    base64: buffer.toString("base64"),
    filename: "أرصدة_الطلاب.xlsx",
  };
}
