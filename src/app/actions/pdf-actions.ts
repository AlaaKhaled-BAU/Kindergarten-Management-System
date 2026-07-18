"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/app/actions/validation";

export interface ReceiptPdfData {
  receiptNumber: number;
  issueDate: string;
  studentName: string;
  amount: number;
  paymentMethod: string;
  paymentReason?: string;
  kindergartenName: string;
}

export interface LedgerTransactionEntry {
  id: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  receiptNumber?: string;
}

export interface LedgerPdfData {
  studentName: string;
  grade: string;
  section?: string;
  academicYear: string;
  transactions: LedgerTransactionEntry[];
  totalDue: number;
  discount: number;
  netAmount: number;
}

export interface ReceiptRowData {
  studentName: string;
  receiptNumber: number;
  amount: number;
  remainingBalance: number;
  notes: string;
}

export interface MonthlyReceiptsReportPdfData {
  month: number;
  year: number;
  receipts: ReceiptRowData[];
  totalAmount: number;
}

export async function generateReceiptPdf(
  receiptId: number
): Promise<ReceiptPdfData> {
  await requireAuth();

  const receipt = await prisma.receipt.findUniqueOrThrow({
    where: { id: receiptId },
    include: { payment: true },
  });

  return {
    receiptNumber: receipt.receiptNumber,
    issueDate: receipt.issueDate.toISOString().split("T")[0],
    studentName: receipt.studentName,
    amount: receipt.amount,
    paymentMethod: receipt.payment.paymentMethod,
    paymentReason: receipt.payment.notes ?? undefined,
    kindergartenName: receipt.kindergartenName,
  };
}

export async function generateLedgerPdf(
  studentId: number
): Promise<LedgerPdfData> {
  await requireAuth();

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
  });

  const transactions = await prisma.transaction.findMany({
    where: { studentId },
    orderBy: { transactionDate: "asc" },
  });

  let runningBalance = 0;
  const ledgerEntries: LedgerTransactionEntry[] = transactions.map((t) => {
    const isDebit = t.amount > 0;
    const isCredit = t.amount < 0;
    runningBalance += t.amount;

    let receiptNumber: string | undefined;
    if (t.referenceId?.startsWith("Receipt:")) {
      receiptNumber = t.referenceId.replace("Receipt:", "");
    }

    return {
      id: t.id,
      date: t.transactionDate.toISOString().split("T")[0],
      description: t.description ?? "",
      debit: isDebit ? t.amount : 0,
      credit: isCredit ? Math.abs(t.amount) : 0,
      balance: runningBalance,
      receiptNumber,
    };
  });

  const totalDue = transactions
    .filter((t) => t.transactionType === "Charge" && t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDiscount = transactions
    .filter(
      (t) =>
        (t.transactionType === "Charge" && t.amount < 0) ||
        t.transactionType === "Adjustment"
    )
    .reduce(
      (sum, t) => sum + (t.amount < 0 ? Math.abs(t.amount) : 0),
      0
    );

  const netAmount = Math.max(0, runningBalance);

  return {
    studentName: `${student.firstName} ${student.lastName}`,
    grade: student.grade,
    academicYear: student.academicYear,
    transactions: ledgerEntries,
    totalDue,
    discount: totalDiscount,
    netAmount,
  };
}

export async function generateMonthlyReceiptsPdf(
  year: number,
  month: number
): Promise<MonthlyReceiptsReportPdfData> {
  await requireAuth();

  const receipts = await prisma.receipt.findMany({
    where: {
      issueDate: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      },
      isCanceled: false,
    },
    include: {
      payment: { include: { student: true } },
    },
    orderBy: { receiptNumber: "asc" },
  });

  const rows: ReceiptRowData[] = [];

  for (const r of receipts) {
    const balance = await prisma.transaction.aggregate({
      where: { studentId: r.payment.studentId },
      _sum: { amount: true },
    });

    rows.push({
      studentName: r.studentName,
      receiptNumber: r.receiptNumber,
      amount: r.amount,
      remainingBalance: Math.max(0, balance._sum.amount ?? 0),
      notes: r.payment.notes ?? "",
    });
  }

  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  return {
    month,
    year,
    receipts: rows,
    totalAmount,
  };
}
