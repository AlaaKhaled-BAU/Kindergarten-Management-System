"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/app/actions/validation";
import {
  exportRevenuesToExcel,
  exportExpensesToExcel,
  exportStudentBalancesToExcel,
} from "@/lib/excel-utils";

export async function exportRevenues(year?: number) {
  await requireAuth();

  const revenues = await prisma.revenue.findMany({
    where: year ? { year } : undefined,
    orderBy: { recordDate: "desc" },
  });

  const data = revenues.map((r) => ({
    year: r.year,
    month: r.month,
    category: r.category,
    amount: r.amount,
    description: r.description,
    source: r.source,
    date: r.recordDate,
  }));

  const buffer = await exportRevenuesToExcel(data);
  return {
    base64: buffer.toString("base64"),
    filename: "الإيرادات.xlsx",
  };
}

export async function exportExpenses(year?: number) {
  await requireAuth();

  const expenses = await prisma.expense.findMany({
    where: year ? { year } : undefined,
    orderBy: { expenseDate: "desc" },
  });

  const data = expenses.map((e) => ({
    year: e.year,
    month: e.month,
    category: e.category,
    amount: e.amount,
    description: e.description,
    vendor: e.vendor,
    date: e.expenseDate,
  }));

  const buffer = await exportExpensesToExcel(data);
  return {
    base64: buffer.toString("base64"),
    filename: "المصروفات.xlsx",
  };
}

export async function exportStudentBalances(grade?: string, year?: string) {
  await requireAuth();

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
        balance: result._sum.amount ?? 0,
      };
    })
  );

  const buffer = await exportStudentBalancesToExcel(balances);
  return {
    base64: buffer.toString("base64"),
    filename: "أرصدة_الطلاب.xlsx",
  };
}
