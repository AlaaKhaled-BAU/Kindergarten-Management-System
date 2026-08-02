"use server";

import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { requireAdmin, validatePositiveNumber, validateRequiredString } from "./validation";
import { roundMoney } from "@/lib/utils";

interface ProcessRefundInput {
  studentId: number;
  amount: number;
  reason: string;
  notes?: string;
}

/**
 * Cash refund to a parent (e.g. withdrawal mid-year, correcting an
 * overpayment). Posts a positive ledger Adjustment -- from the student's
 * account perspective a refund reduces their credit / increases what they
 * owe, the same direction as a Charge, even though it isn't tuition.
 * Admin-gated: an irreversible cash outflow with no receipt of its own to
 * later reconcile against, unlike cancelReceipt which ties back to one.
 */
export async function processRefund(input: ProcessRefundInput) {
  const actor = await requireAdmin();

  validatePositiveNumber(input.amount, "المبلغ");
  validateRequiredString(input.reason, "السبب");

  return prisma.$transaction(async (tx) => {
    await tx.student.findUniqueOrThrow({ where: { id: input.studentId } });

    const amount = roundMoney(input.amount);

    const paidRows = await tx.transaction.groupBy({
      by: ["studentId"],
      where: { studentId: input.studentId, transactionType: "Payment" },
      _sum: { amount: true },
    });
    const totalPaid = Math.abs(paidRows[0]?._sum.amount ?? 0);
    if (amount > totalPaid + 0.001) {
      throw new Error("لا يمكن استرداد مبلغ أكبر من إجمالي المدفوعات");
    }

    const refund = await tx.refund.create({
      data: {
        studentId: input.studentId,
        amount,
        refundDate: new Date(),
        reason: input.reason,
        notes: input.notes ?? null,
        createdBy: actor,
      },
    });

    await tx.transaction.create({
      data: {
        studentId: input.studentId,
        transactionType: "Adjustment",
        amount,
        transactionDate: new Date(),
        description: `استرداد نقدي: ${input.reason}`,
        referenceId: `Refund:${refund.id}`,
        createdBy: actor,
      },
    });

    const refundDate = new Date();
    await tx.revenue.create({
      data: {
        year: refundDate.getFullYear(),
        month: refundDate.getMonth() + 1,
        category: "استرداد",
        amount: -amount,
        description: `استرداد نقدي: ${input.reason}`,
        recordDate: new Date(),
        source: "Refund",
      },
    });

    await logEvent("refund_processed", { refundId: refund.id, studentId: input.studentId });
    return refund;
  });
}

export async function getRefunds(studentId: number) {
  await requireAdmin();
  return prisma.refund.findMany({
    where: { studentId },
    orderBy: { refundDate: "desc" },
  });
}
