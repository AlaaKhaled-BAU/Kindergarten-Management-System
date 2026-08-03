"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/app/actions/validation";
import { roundMoney } from "@/lib/utils";

export interface ReceiptPdfData {
  receiptNumber: number;
  issueDate: string;
  studentName: string;
  amount: number;
  paymentMethod: string;
  paymentReason?: string;
  kindergartenName: string;
  isCanceled: boolean;
  cancelDate?: string;
  cancelReason?: string;
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
  await requireAdmin();

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
    isCanceled: receipt.isCanceled,
    cancelDate: receipt.cancelDate ? receipt.cancelDate.toISOString().split("T")[0] : undefined,
    cancelReason: receipt.cancelReason ?? undefined,
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
    runningBalance = roundMoney(runningBalance + t.amount);

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

  const totalDue = roundMoney(
    transactions
      .filter((t) => t.transactionType === "Charge" && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)
  );

  const totalDiscount = roundMoney(
    transactions
      .filter((t) => t.transactionType === "Charge" && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  );

  // Not clamped to 0: a negative balance is a real credit (the family
  // prepaid), not "nothing due" -- ledger-pdf.tsx labels the sign for print.
  const netAmount = runningBalance;

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
  await requireAdmin();

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
      // Not clamped to 0: negative means this student is in credit, not
      // "nothing remaining" -- monthly-summary-pdf.tsx labels the sign.
      remainingBalance: roundMoney(balance._sum.amount ?? 0),
      notes: r.payment.notes ?? "",
    });
  }

  const totalAmount = roundMoney(rows.reduce((sum, row) => sum + row.amount, 0));

  return {
    month,
    year,
    receipts: rows,
    totalAmount,
  };
}
