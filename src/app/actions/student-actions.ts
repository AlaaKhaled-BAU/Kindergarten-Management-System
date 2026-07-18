"use server";

import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { requireAuth, validateRequiredString } from "./validation";
import { roundMoney } from "@/lib/utils";

interface CreateStudentInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  grade: string;
  academicYear: string;
  enrollmentDate?: Date;
  notes?: string;
  busFees?: number;
  additionalFees?: number;
  discountValue?: number;
  discountIsPercent?: boolean;
  exitStatus?: number;
  tuitionOverride?: number;
  allergies?: string;
  medicalNotes?: string;
  siblingGlobalId?: string;
  parents?: { fullName: string; phone: string; alternatePhone?: string; email?: string; address?: string; relationship?: string }[];
  pickupPersons?: { fullName: string; relationship?: string; phone?: string; notes?: string }[];
}

interface UpdateStudentInput {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date | null;
  grade?: string;
  academicYear?: string;
  notes?: string | null;
  busFees?: number;
  additionalFees?: number;
  discountValue?: number;
  discountIsPercent?: boolean;
  exitStatus?: number;
  tuitionOverride?: number | null;
  allergies?: string | null;
  medicalNotes?: string | null;
  siblingGlobalId?: string | null;
}

export async function createStudent(input: CreateStudentInput) {
  const actor = await requireAuth();

  validateRequiredString(input.firstName, "الاسم الأول");
  validateRequiredString(input.lastName, "الاسم الأخير");
  validateRequiredString(input.grade, "الصف");
  validateRequiredString(input.academicYear, "السنة الدراسية");

  const busFees = input.busFees ?? 0;
  const additionalFees = input.additionalFees ?? 0;
  const discountValue = input.discountValue ?? 0;
  const discountIsPercent = input.discountIsPercent ?? false;
  const tuitionOverride = input.tuitionOverride ?? null;

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        grade: input.grade,
        academicYear: input.academicYear,
        enrollmentDate: input.enrollmentDate ? new Date(input.enrollmentDate) : new Date(),
        notes: input.notes ?? null,
        busFees,
        additionalFees,
        discountValue,
        discountIsPercent,
        exitStatus: input.exitStatus ?? 0,
        tuitionOverride,
        allergies: input.allergies ?? null,
        medicalNotes: input.medicalNotes ?? null,
        siblingGlobalId: input.siblingGlobalId ?? null,
      },
    });

    if (input.parents && input.parents.length > 0) {
      for (const p of input.parents) {
        const parent = await tx.parent.create({
          data: {
            fullName: p.fullName,
            phone: p.phone,
            alternatePhone: p.alternatePhone ?? null,
            email: p.email ?? null,
            address: p.address ?? null,
          },
        });
        await tx.studentParent.create({
          data: {
            studentId: student.id,
            parentId: parent.id,
            relationship: p.relationship ?? null,
          },
        });
      }
    }

    if (input.pickupPersons && input.pickupPersons.length > 0) {
      for (const p of input.pickupPersons) {
        await tx.authorizedPickupPerson.create({
          data: {
            studentId: student.id,
            fullName: p.fullName,
            relationship: p.relationship ?? null,
            phone: p.phone ?? null,
            notes: p.notes ?? null,
          },
        });
      }
    }

    const tuitionAmount = tuitionOverride ?? await getDefaultTuition(tx, input.grade);
    if (tuitionAmount > 0) {
      await tx.transaction.create({
        data: {
          studentId: student.id,
          transactionType: "Charge",
          amount: tuitionAmount,
          transactionDate: new Date(),
          description: "رسوم دراسية",
          referenceId: "Fee:Tuition",
          createdBy: actor,
        },
      });
    }

    const extraFees = busFees + additionalFees;
    if (extraFees > 0) {
      await tx.transaction.create({
        data: {
          studentId: student.id,
          transactionType: "Charge",
          amount: extraFees,
          transactionDate: new Date(),
          description: "رسوم إضافية (باص + إضافات)",
          referenceId: "Fee:Extra",
          createdBy: actor,
        },
      });
    }

    if (discountValue > 0) {
      const effectiveDiscount = discountIsPercent
        ? (tuitionAmount + extraFees) * (discountValue / 100)
        : discountValue;
      if (effectiveDiscount > 0) {
        await tx.transaction.create({
          data: {
            studentId: student.id,
            transactionType: "Charge",
            amount: -effectiveDiscount,
            transactionDate: new Date(),
            description: discountIsPercent ? `خصم ${discountValue}%` : "خصم",
            referenceId: "Fee:Discount",
            createdBy: actor,
          },
        });
      }
    }

    logEvent("student_created", { studentId: student.id });
    return student;
  });
}

export async function updateStudent(id: number, input: UpdateStudentInput) {
  const actor = await requireAuth();

  return prisma.$transaction(async (tx) => {
    const current = await tx.student.findUniqueOrThrow({ where: { id } });

    const newBusFees = input.busFees ?? current.busFees;
    const newAdditionalFees = input.additionalFees ?? current.additionalFees;
    const newDiscountValue = input.discountValue ?? current.discountValue;
    const newDiscountIsPercent = input.discountIsPercent ?? current.discountIsPercent;
    const newGrade = input.grade ?? current.grade;
    const newTuitionOverride = input.tuitionOverride !== undefined ? input.tuitionOverride : current.tuitionOverride;

    const oldTuition = current.tuitionOverride ?? await getDefaultTuition(tx, current.grade);
    const newTuition = newTuitionOverride ?? await getDefaultTuition(tx, newGrade);

    const oldEffectiveDiscount = getEffectiveDiscount(
      current.discountValue,
      current.discountIsPercent,
      oldTuition + current.busFees + current.additionalFees
    );
    const newEffectiveDiscount = getEffectiveDiscount(
      newDiscountValue,
      newDiscountIsPercent,
      newTuition + newBusFees + newAdditionalFees
    );

    const oldTotal = oldTuition + current.busFees + current.additionalFees - oldEffectiveDiscount;
    const newTotal = newTuition + newBusFees + newAdditionalFees - newEffectiveDiscount;

    const netChange = newTotal - oldTotal;

    if (netChange !== 0) {
      const changes: string[] = [];
      if (current.busFees !== newBusFees) changes.push("رسوم الباص");
      if (current.additionalFees !== newAdditionalFees) changes.push("رسوم إضافية");
      if (current.discountValue !== newDiscountValue || current.discountIsPercent !== newDiscountIsPercent) changes.push("الخصم");
      if (current.grade !== newGrade) changes.push("الصف");
      if (current.tuitionOverride !== newTuitionOverride) changes.push("الرسوم الدراسية");

      await tx.transaction.create({
        data: {
          studentId: id,
          transactionType: "Adjustment",
          amount: netChange,
          transactionDate: new Date(),
          description: `تعديل: ${changes.join("، ")}`,
          referenceId: `Adjustment:${Date.now()}`,
          createdBy: actor,
        },
      });
    }

    const updated = await tx.student.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
        ...(input.dateOfBirth !== undefined && { dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null }),
        ...(input.grade !== undefined && { grade: input.grade }),
        ...(input.academicYear !== undefined && { academicYear: input.academicYear }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.busFees !== undefined && { busFees: input.busFees }),
        ...(input.additionalFees !== undefined && { additionalFees: input.additionalFees }),
        ...(input.discountValue !== undefined && { discountValue: input.discountValue }),
        ...(input.discountIsPercent !== undefined && { discountIsPercent: input.discountIsPercent }),
        ...(input.exitStatus !== undefined && { exitStatus: input.exitStatus }),
        ...(input.tuitionOverride !== undefined && { tuitionOverride: input.tuitionOverride }),
        ...(input.allergies !== undefined && { allergies: input.allergies }),
        ...(input.medicalNotes !== undefined && { medicalNotes: input.medicalNotes }),
        ...(input.siblingGlobalId !== undefined && { siblingGlobalId: input.siblingGlobalId }),
      },
    });

    logEvent("student_updated", { studentId: id, actor });
    return updated;
  });
}

export type UnpaidStudent = {
  id: number;
  name: string;
  grade: string;
  balance: number;
  hasPaidThisMonth: boolean;
  lastPaymentDate: Date | null;
};

export async function getUnpaidStudents(): Promise<UnpaidStudent[]> {
  await requireAuth();

  const students = await prisma.student.findMany({
    where: { isActive: true },
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const result: UnpaidStudent[] = [];

  for (const student of students) {
    const balanceAgg = await prisma.transaction.aggregate({
      where: { studentId: student.id },
      _sum: { amount: true },
    });

    const balance = roundMoney(balanceAgg._sum.amount ?? 0);

    if (balance <= 0) continue;

    const paymentThisMonth = await prisma.payment.findFirst({
      where: {
        studentId: student.id,
        paymentDate: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth,
        },
      },
    });

    const lastPayment = await prisma.payment.findFirst({
      where: { studentId: student.id },
      orderBy: { paymentDate: "desc" },
    });

    result.push({
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      grade: student.grade,
      balance,
      hasPaidThisMonth: !!paymentThisMonth,
      lastPaymentDate: lastPayment?.paymentDate ?? null,
    });
  }

  return result;
}

export async function getStudentBalance(studentId: number): Promise<number> {
  await requireAuth();

  const result = await prisma.transaction.aggregate({
    where: { studentId },
    _sum: { amount: true },
  });

  return roundMoney(result._sum.amount ?? 0);
}

export async function getStudentLedger(studentId: number) {
  await requireAuth();

  const transactions = await prisma.transaction.findMany({
    where: { studentId },
    orderBy: { transactionDate: "desc" },
  });

  let runningBalance = 0;
  const ledger = transactions.reverse().map((t) => {
    runningBalance = roundMoney(runningBalance + t.amount);
    return { ...t, runningBalance };
  });

  return ledger.reverse();
}

export async function getStudentById(id: number) {
  await requireAuth();

  return prisma.student.findUnique({
    where: { id },
    include: {
      parents: { include: { parent: true } },
      pickups: true,
      fees: { include: { fee: true } },
    },
  });
}

export async function getAllStudents(filters?: {
  grade?: string;
  academicYear?: string;
  isActive?: boolean;
  search?: string;
}) {
  await requireAuth();

  return prisma.student.findMany({
    where: {
      ...(filters?.grade && { grade: filters.grade }),
      ...(filters?.academicYear && { academicYear: filters.academicYear }),
      ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters?.search && {
        OR: [
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
        ],
      }),
    },
    orderBy: [{ grade: "asc" }, { lastName: "asc" }],
  });
}

export async function deactivateStudent(id: number) {
  await requireAuth();

  return prisma.student.update({
    where: { id },
    data: { isActive: false },
  });
}

function getEffectiveDiscount(
  value: number,
  isPercent: boolean,
  baseAmount: number
): number {
  if (value <= 0) return 0;
  return isPercent ? baseAmount * (value / 100) : value;
}

async function getDefaultTuition(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  grade: string
): Promise<number> {
  const fee = await tx.fee.findFirst({
    where: {
      applicableGrade: grade,
      isActive: true,
      feeType: "Monthly",
    },
    orderBy: { amount: "asc" },
  });
  return fee?.amount ?? 0;
}
