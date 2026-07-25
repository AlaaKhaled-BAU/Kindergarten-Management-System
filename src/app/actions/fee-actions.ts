"use server";

import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { requireAdmin, validatePositiveNumber, validateRequiredString } from "./validation";

interface FeeInput {
  name: string;
  amount: number;
  applicableGrade: string;
  academicYear: string;
  feeType?: string;
  description?: string;
}

export async function getFees(filters?: { academicYear?: string; isActive?: boolean }) {
  await requireAdmin();
  return prisma.fee.findMany({
    where: {
      ...(filters?.academicYear && { academicYear: filters.academicYear }),
      ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
    },
    orderBy: [{ academicYear: "desc" }, { applicableGrade: "asc" }],
  });
}

export async function createFee(input: FeeInput) {
  await requireAdmin();

  validateRequiredString(input.name, "اسم الرسم");
  validateRequiredString(input.applicableGrade, "الصف");
  validateRequiredString(input.academicYear, "السنة الدراسية");
  validatePositiveNumber(input.amount, "المبلغ");

  const fee = await prisma.fee.create({
    data: {
      name: input.name,
      amount: input.amount,
      applicableGrade: input.applicableGrade,
      academicYear: input.academicYear,
      feeType: input.feeType ?? "Monthly",
      description: input.description ?? null,
    },
  });

  await logEvent("fee_created", { feeId: fee.id });
  return fee;
}

export async function updateFee(id: number, input: Partial<FeeInput> & { isActive?: boolean }) {
  await requireAdmin();

  const fee = await prisma.fee.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.applicableGrade !== undefined && { applicableGrade: input.applicableGrade }),
      ...(input.academicYear !== undefined && { academicYear: input.academicYear }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  await logEvent("fee_updated", { feeId: id });
  return fee;
}

export async function deleteFee(id: number) {
  await requireAdmin();
  await prisma.fee.delete({ where: { id } });
  await logEvent("fee_deleted", { feeId: id });
}

/**
 * Copies every active Monthly fee from one academic year to another,
 * skipping any grade that already has a fee row for the target year. The
 * one-click fix for the yearly rollover: without it, an admin has to
 * re-type every grade's tuition by hand each year, and a grade promotion
 * into a year nobody priced gets refused (see hasFeeForYear in
 * student-actions.ts) until this is run.
 */
export async function copyFeesToYear(fromYear: string, toYear: string) {
  await requireAdmin();

  validateRequiredString(fromYear, "السنة المصدر");
  validateRequiredString(toYear, "السنة الهدف");

  const sourceFees = await prisma.fee.findMany({
    where: { academicYear: fromYear, isActive: true, feeType: "Monthly" },
  });

  let copied = 0;
  for (const fee of sourceFees) {
    const existing = await prisma.fee.findFirst({
      where: { applicableGrade: fee.applicableGrade, academicYear: toYear, feeType: "Monthly" },
    });
    if (existing) continue;

    await prisma.fee.create({
      data: {
        name: fee.name,
        amount: fee.amount,
        applicableGrade: fee.applicableGrade,
        academicYear: toYear,
        feeType: fee.feeType,
        description: fee.description,
      },
    });
    copied++;
  }

  await logEvent("fees_copied", { fromYear, toYear, copied });
  return { copied, skipped: sourceFees.length - copied };
}
