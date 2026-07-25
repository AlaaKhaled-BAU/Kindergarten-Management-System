"use server";

import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { getSetting } from "@/lib/settings";
import { requireAuth, validatePositiveNumber } from "./validation";

interface ProcessPaymentInput {
  studentId: number;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
}

interface CancelReceiptInput {
  receiptId: number;
  reason: string;
}

export async function processPayment(input: ProcessPaymentInput) {
  const actor = await requireAuth();

  validatePositiveNumber(input.amount, "المبلغ");

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUniqueOrThrow({
      where: { id: input.studentId },
    });

    const kgName = (await getSetting("kindergartenName")) ?? "الروضة";

    const maxReceipt = await tx.receipt.aggregate({
      _max: { receiptNumber: true },
    });
    const nextReceiptNumber = (maxReceipt._max.receiptNumber ?? 0) + 1;

    const payment = await tx.payment.create({
      data: {
        studentId: input.studentId,
        amount: input.amount,
        paymentDate: new Date(input.paymentDate),
        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber ?? null,
        notes: input.notes ?? null,
      },
    });

    const receipt = await tx.receipt.create({
      data: {
        receiptNumber: nextReceiptNumber,
        paymentId: payment.id,
        issueDate: new Date(input.paymentDate),
        amount: input.amount,
        studentName: `${student.firstName} ${student.lastName}`,
        kindergartenName: kgName,
      },
    });

    await tx.transaction.create({
      data: {
        studentId: input.studentId,
        transactionType: "Payment",
        amount: -input.amount,
        transactionDate: new Date(input.paymentDate),
        description: "دفعة نقدية",
        referenceId: `Receipt:${nextReceiptNumber}`,
        createdBy: actor,
      },
    });

    const paymentDate = new Date(input.paymentDate);
    await tx.revenue.create({
      data: {
        year: paymentDate.getFullYear(),
        month: paymentDate.getMonth() + 1,
        category: "رسوم دراسية",
        amount: input.amount,
        description: `دفعة من الطالب: ${student.firstName} ${student.lastName}`,
        recordDate: new Date(),
        source: "Payment",
      },
    });

    await logEvent("receipt_created", { receiptId: receipt.id, studentId: input.studentId });
    return { payment, receipt };
  });
}

export async function cancelReceipt(input: CancelReceiptInput) {
  const actor = await requireAuth();

  return prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findUniqueOrThrow({
      where: { id: input.receiptId },
      include: { payment: true },
    });

    if (receipt.isCanceled) {
      throw new Error("هذا الإيصال ملغي مسبقاً");
    }

    await tx.receipt.update({
      where: { id: input.receiptId },
      data: {
        isCanceled: true,
        cancelDate: new Date(),
        cancelReason: input.reason,
      },
    });

    await tx.transaction.create({
      data: {
        studentId: receipt.payment.studentId,
        transactionType: "Reversal",
        amount: receipt.amount,
        transactionDate: new Date(),
        description: `إلغاء إيصال رقم ${receipt.receiptNumber}: ${input.reason}`,
        referenceId: `Receipt:${receipt.receiptNumber}`,
        createdBy: actor,
      },
    });

    // Reverse into the same year/month as the original payment (issueDate),
    // not the cancellation date -- otherwise the original month's revenue
    // stays overstated and an unrelated month gets an orphaned negative line.
    await tx.revenue.create({
      data: {
        year: receipt.issueDate.getFullYear(),
        month: receipt.issueDate.getMonth() + 1,
        category: "رسوم دراسية",
        amount: -receipt.amount,
        description: `إلغاء إيصال رقم ${receipt.receiptNumber}`,
        recordDate: new Date(),
        source: "Cancellation",
      },
    });

    await logEvent("receipt_canceled", { receiptId: receipt.id });
    return receipt;
  });
}

export async function getReceipts(filters?: {
  startDate?: Date;
  endDate?: Date;
  studentId?: number;
  isCanceled?: boolean;
}) {
  await requireAuth();

  return prisma.receipt.findMany({
    where: {
      ...(filters?.startDate && filters?.endDate && {
        issueDate: {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate),
        },
      }),
      ...(filters?.studentId && {
        payment: { studentId: filters.studentId },
      }),
      ...(filters?.isCanceled !== undefined && {
        isCanceled: filters.isCanceled,
      }),
    },
    include: {
      payment: { include: { student: true } },
    },
    orderBy: { receiptNumber: "desc" },
  });
}
