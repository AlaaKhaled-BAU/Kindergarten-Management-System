"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { getSetting } from "@/lib/settings";
import { requireAuth, requireAdmin, assertValidFinancialDate, validatePositiveNumber } from "./validation";
import { roundMoney } from "@/lib/utils";
import { toProcessPaymentDto } from "@/lib/payment-balances";

interface ProcessPaymentInput {
  studentId: number;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  /** Optional explicit VouNo. Defaults to MAX(existing)+1 when omitted. */
  receiptNumber?: number;
}

interface UpdateReceiptInput {
  receiptId: number;
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

/**
 * Two staff issuing receipts at the same moment can both read the same
 * MAX(receiptNumber) before either commits -- whichever writes second hits
 * Receipt.receiptNumber's unique constraint. Retrying with a fresh MAX read
 * is simpler and just as effective as a dedicated counter table for the
 * handful of concurrent users a kindergarten office actually has.
 */
const MAX_RECEIPT_ATTEMPTS = 3;

function isReceiptNumberCollision(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    String((err.meta?.target as string[] | string | undefined) ?? "").includes("receiptNumber")
  );
}

export async function processPayment(input: ProcessPaymentInput) {
  const actor = await requireAuth();

  validatePositiveNumber(input.amount, "المبلغ");
  assertValidFinancialDate(new Date(input.paymentDate), "تاريخ الدفع");

  if (input.receiptNumber !== undefined) {
    if (
      !Number.isInteger(input.receiptNumber) ||
      input.receiptNumber <= 0 ||
      input.receiptNumber > 2_147_483_647
    ) {
      throw new Error("رقم الوصل يجب أن يكون رقماً صحيحاً موجباً");
    }
    const existing = await prisma.receipt.findUnique({
      where: { receiptNumber: input.receiptNumber },
      select: { id: true },
    });
    if (existing) {
      throw new Error(`رقم الوصل ${input.receiptNumber} مستخدم مسبقاً`);
    }
  }

  const maxPaymentAmount = Number((await getSetting("maxPaymentAmount")) ?? 0);
  if (maxPaymentAmount > 0 && input.amount > maxPaymentAmount) {
    throw new Error(`لا يمكن أن يتجاوز مبلغ الدفع ${maxPaymentAmount} ديناراً`);
  }

  const kgName = (await getSetting("kindergartenName")) ?? "الروضة";

  for (let attempt = 1; attempt <= MAX_RECEIPT_ATTEMPTS; attempt++) {
    try {
      return await attemptProcessPayment(input, actor, kgName);
    } catch (err) {
      if (isReceiptNumberCollision(err) && attempt < MAX_RECEIPT_ATTEMPTS) continue;
      throw err;
    }
  }
  // Unreachable: the loop above always either returns or throws.
  throw new Error("تعذر إصدار الإيصال، الرجاء المحاولة مرة أخرى");
}

/** Next suggested VouNo: MAX(existing, active or canceled) + 1. */
export async function getNextReceiptNumber(): Promise<number> {
  await requireAuth();
  const max = await prisma.receipt.aggregate({ _max: { receiptNumber: true } });
  return (max._max.receiptNumber ?? 0) + 1;
}

async function attemptProcessPayment(
  input: ProcessPaymentInput,
  actor: string,
  kgName: string,
) {
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUniqueOrThrow({
      where: { id: input.studentId },
    });

    if (!student.isActive) {
      throw new Error("لا يمكن تسجيل دفعة لطالب غير نشط");
    }

    const amount = roundMoney(input.amount);

    let nextReceiptNumber = input.receiptNumber;
    if (nextReceiptNumber === undefined) {
      const maxReceipt = await tx.receipt.aggregate({
        _max: { receiptNumber: true },
      });
      nextReceiptNumber = (maxReceipt._max.receiptNumber ?? 0) + 1;
    }

    const payment = await tx.payment.create({
      data: {
        studentId: input.studentId,
        amount,
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
        amount,
        studentName: `${student.firstName} ${student.lastName}`,
        kindergartenName: kgName,
      },
    });

    await tx.transaction.create({
      data: {
        studentId: input.studentId,
        transactionType: "Payment",
        amount: -amount,
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
        amount,
        description: `دفعة من الطالب: ${student.firstName} ${student.lastName}`,
        recordDate: paymentDate,
        source: "Payment",
        sourceId: receipt.id,
      },
    });

    await logEvent("receipt_created", { receiptId: receipt.id, studentId: input.studentId });
    return toProcessPaymentDto({ payment, receipt });
  });
}

/**
 * Correcting a mis-keyed receipt. A payment is spread over four tables --
 * Payment (the event), Receipt (the printed document), Transaction (the
 * ledger that drives the balance) and Revenue (what the reports read) -- so
 * all four move together or none do.
 */
export async function updateReceipt(input: UpdateReceiptInput) {
  // Rewrites a posted ledger entry, same weight as a cancellation.
  const actor = await requireAdmin();

  validatePositiveNumber(input.amount, "المبلغ");
  assertValidFinancialDate(new Date(input.paymentDate), "تاريخ الدفع");

  const maxPaymentAmount = Number((await getSetting("maxPaymentAmount")) ?? 0);
  if (maxPaymentAmount > 0 && input.amount > maxPaymentAmount) {
    throw new Error(`لا يمكن أن يتجاوز مبلغ الدفع ${maxPaymentAmount} ديناراً`);
  }

  return prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findUniqueOrThrow({
      where: { id: input.receiptId },
      include: { payment: { include: { student: true } } },
    });

    if (receipt.isCanceled) {
      throw new Error("لا يمكن تعديل إيصال ملغي");
    }

    const amount = roundMoney(input.amount);
    const paymentDate = new Date(input.paymentDate);

    const payment = await tx.payment.update({
      where: { id: receipt.paymentId },
      data: {
        amount,
        paymentDate,
        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber ?? null,
        notes: input.notes ?? null,
      },
    });

    const updatedReceipt = await tx.receipt.update({
      where: { id: receipt.id },
      data: { amount, issueDate: paymentDate },
    });

    await tx.transaction.updateMany({
      where: {
        transactionType: "Payment",
        referenceId: `Receipt:${receipt.receiptNumber}`,
      },
      data: { amount: -amount, transactionDate: paymentDate },
    });

    const revenueData = {
      amount,
      recordDate: paymentDate,
      year: paymentDate.getFullYear(),
      month: paymentDate.getMonth() + 1,
    };
    const { count } = await tx.revenue.updateMany({
      where: { source: "Payment", sourceId: receipt.id, isActive: true },
      data: revenueData,
    });
    // Payments issued before revenue rows carried a sourceId can be missing
    // one entirely; write it now rather than leave the reports short.
    if (count === 0) {
      await tx.revenue.create({
        data: {
          ...revenueData,
          category: "رسوم دراسية",
          description: `دفعة من الطالب: ${receipt.payment.student.firstName} ${receipt.payment.student.lastName}`,
          source: "Payment",
          sourceId: receipt.id,
        },
      });
    }

    await logEvent("receipt_updated", {
      receiptId: receipt.id,
      actor,
      before: {
        amount: receipt.amount,
        issueDate: receipt.issueDate.toISOString(),
      },
      after: { amount, issueDate: paymentDate.toISOString() },
    });

    return toProcessPaymentDto({ payment, receipt: updatedReceipt });
  });
}

export async function cancelReceipt(input: CancelReceiptInput) {
  // A financial reversal, unlike issuing a receipt -- admin-only.
  const actor = await requireAdmin();

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

    // If the student was promoted after this payment, the credit now lives
    // on the transferred balance -- post the Reversal there, not on the
    // old (inactive) student where it would be invisible.
    const transfer = await tx.transaction.findFirst({
      where: {
        studentId: receipt.payment.studentId,
        transactionType: "BalanceTransferOut",
        transactionDate: { gt: receipt.payment.paymentDate },
      },
      orderBy: { transactionDate: "asc" },
    });
    let reversalStudentId = receipt.payment.studentId;
    if (transfer?.referenceId) {
      const targetId = Number(transfer.referenceId.replace("Promotion:To:", ""));
      if (!Number.isNaN(targetId)) reversalStudentId = targetId;
    }

    await tx.transaction.create({
      data: {
        studentId: reversalStudentId,
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
        recordDate: receipt.issueDate,
        source: "Cancellation",
        sourceId: receipt.id,
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
