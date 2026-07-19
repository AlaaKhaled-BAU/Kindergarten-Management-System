"use server";

import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { requireAdmin, validatePositiveNumber, validateRequiredString } from "./validation";

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

    const refund = await tx.refund.create({
      data: {
        studentId: input.studentId,
        amount: input.amount,
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
        amount: input.amount,
        transactionDate: new Date(),
        description: `استرداد نقدي: ${input.reason}`,
        referenceId: `Refund:${refund.id}`,
        createdBy: actor,
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
