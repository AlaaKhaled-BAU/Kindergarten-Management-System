"use server";

import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { requireAuth, requireAdmin, validateNonNegativeNumber, validateRequiredString } from "./validation";
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

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface EnrolmentChargeInput {
  tuitionAmount: number;
  busFees: number;
  additionalFees: number;
  discountValue: number;
  discountIsPercent: boolean;
}

/**
 * Posts the tuition + extra-fees + discount ledger entries for a student's
 * enrolment. Shared by createStudent and promoteStudents so they can never
 * drift apart again -- promoteStudents used to duplicate only the tuition
 * charge and silently skip extras/discount, under-billing every promoted
 * student by whatever their bus fee and discount were.
 */
export async function postEnrolmentCharges(
  tx: Tx,
  studentId: number,
  input: EnrolmentChargeInput,
  actor: string,
  isPromotion = false
): Promise<void> {
  const { tuitionAmount, busFees, additionalFees, discountValue, discountIsPercent } = input;
  const suffix = isPromotion ? " - ترقية" : "";
  const refSuffix = isPromotion ? ":Promotion" : "";

  if (tuitionAmount > 0) {
    await tx.transaction.create({
      data: {
        studentId,
        transactionType: "Charge",
        amount: roundMoney(tuitionAmount),
        transactionDate: new Date(),
        description: `رسوم دراسية${suffix}`,
        referenceId: `Fee:Tuition${refSuffix}`,
        createdBy: actor,
      },
    });
  }

  const extraFees = roundMoney(busFees + additionalFees);
  if (extraFees > 0) {
    await tx.transaction.create({
      data: {
        studentId,
        transactionType: "Charge",
        amount: extraFees,
        transactionDate: new Date(),
        description: "رسوم إضافية (باص + إضافات)",
        referenceId: `Fee:Extra${refSuffix}`,
        createdBy: actor,
      },
    });
  }

  if (discountValue > 0) {
    const effectiveDiscount = roundMoney(
      discountIsPercent ? (tuitionAmount + extraFees) * (discountValue / 100) : discountValue
    );
    if (effectiveDiscount > 0) {
      await tx.transaction.create({
        data: {
          studentId,
          transactionType: "Charge",
          amount: -effectiveDiscount,
          transactionDate: new Date(),
          description: discountIsPercent ? `خصم ${discountValue}%` : "خصم",
          referenceId: `Fee:Discount${refSuffix}`,
          createdBy: actor,
        },
      });
    }
  }
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

  validateNonNegativeNumber(busFees, "رسوم الباص");
  validateNonNegativeNumber(additionalFees, "رسوم إضافية");
  validateNonNegativeNumber(discountValue, "الخصم");
  if (tuitionOverride !== null) validateNonNegativeNumber(tuitionOverride, "الرسوم الدراسية");
  if (discountIsPercent && discountValue > 100) {
    throw new Error("الخصم بالنسبة المئوية لا يمكن أن يتجاوز 100%");
  }

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

    const tuitionAmount = tuitionOverride ?? await getDefaultTuition(tx, input.grade, input.academicYear);
    await postEnrolmentCharges(
      tx,
      student.id,
      { tuitionAmount, busFees, additionalFees, discountValue, discountIsPercent },
      actor
    );

    await logEvent("student_created", { studentId: student.id });
    return student;
  });
}

export async function updateStudent(id: number, input: UpdateStudentInput) {
  const actor = await requireAdmin();

  return prisma.$transaction(async (tx) => {
    const current = await tx.student.findUniqueOrThrow({ where: { id } });

    const newBusFees = input.busFees ?? current.busFees;
    const newAdditionalFees = input.additionalFees ?? current.additionalFees;
    const newDiscountValue = input.discountValue ?? current.discountValue;
    const newDiscountIsPercent = input.discountIsPercent ?? current.discountIsPercent;
    const newGrade = input.grade ?? current.grade;
    const newAcademicYear = input.academicYear ?? current.academicYear;
    const newTuitionOverride = input.tuitionOverride !== undefined ? input.tuitionOverride : current.tuitionOverride;

    validateNonNegativeNumber(newBusFees, "رسوم الباص");
    validateNonNegativeNumber(newAdditionalFees, "رسوم إضافية");
    validateNonNegativeNumber(newDiscountValue, "الخصم");
    if (newTuitionOverride !== null) validateNonNegativeNumber(newTuitionOverride, "الرسوم الدراسية");
    if (newDiscountIsPercent && newDiscountValue > 100) {
      throw new Error("الخصم بالنسبة المئوية لا يمكن أن يتجاوز 100%");
    }

    const oldTuition = current.tuitionOverride ?? await getDefaultTuition(tx, current.grade, current.academicYear);
    const newTuition = newTuitionOverride ?? await getDefaultTuition(tx, newGrade, newAcademicYear);

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

    const netChange = roundMoney(newTotal - oldTotal);

    // Float subtraction can leave e.g. 0.00000000001 instead of exactly 0 --
    // roundMoney() alone doesn't guarantee that lands on 0, so compare
    // against half a fils instead of exact equality.
    if (Math.abs(netChange) >= 0.0005) {
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

    await logEvent("student_updated", { studentId: id, actor });
    return updated;
  });
}

export type UnpaidStudent = {
  id: number;
  name: string;
  grade: string;
  balance: number;
  lastPaymentDate: Date | null;
};

const UNPAID_WINDOW_DAYS = 30;

/**
 * Students who owe money AND haven't paid anything -- not even a partial
 * payment -- in the last 30 days. A rolling window rather than "this
 * calendar month" so it doesn't reset to showing nobody on the 1st even
 * though the last payment might have been 3 weeks ago, and doesn't miss
 * someone who paid on the 1st of last month and hasn't since.
 *
 * 3 queries total regardless of student count -- one balance-per-student
 * groupBy and one max-paymentDate-per-student groupBy, instead of three
 * round-trips inside a per-student loop.
 */
export async function getUnpaidStudents(): Promise<UnpaidStudent[]> {
  await requireAuth();

  const students = await prisma.student.findMany({ where: { isActive: true } });
  if (students.length === 0) return [];

  const ids = students.map((s) => s.id);
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - UNPAID_WINDOW_DAYS);

  const [balanceRows, lastPayRows] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["studentId"],
      where: { studentId: { in: ids } },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["studentId"],
      where: {
        studentId: { in: ids },
        receipts: { none: { isCanceled: true } },
      },
      _max: { paymentDate: true },
    }),
  ]);

  const balanceById = new Map(balanceRows.map((r) => [r.studentId, roundMoney(r._sum.amount ?? 0)]));
  const lastPayById = new Map(lastPayRows.map((r) => [r.studentId, r._max.paymentDate ?? null]));

  const result: UnpaidStudent[] = [];
  for (const student of students) {
    const balance = balanceById.get(student.id) ?? 0;
    if (balance <= 0) continue;
    const lastPaymentDate = lastPayById.get(student.id) ?? null;
    if (lastPaymentDate && lastPaymentDate >= windowStart) continue;
    result.push({
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      grade: student.grade,
      balance,
      lastPaymentDate,
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

/**
 * Batched balance lookup: one groupBy instead of one aggregate per student
 * (used by /students, which previously ran getStudentBalance in a
 * Promise.all loop -- N round-trips, each re-verifying the auth cookie).
 * Students with no transactions simply don't appear in the map; callers
 * default them to 0.
 */
export async function getStudentBalances(studentIds: number[]): Promise<Map<number, number>> {
  await requireAuth();

  if (studentIds.length === 0) return new Map();

  const grouped = await prisma.transaction.groupBy({
    by: ["studentId"],
    where: { studentId: { in: studentIds } },
    _sum: { amount: true },
  });

  return new Map(grouped.map((g) => [g.studentId, roundMoney(g._sum.amount ?? 0)]));
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

export async function setStudentActive(id: number, isActive: boolean) {
  // Deactivating/reactivating changes who shows up as an active enrollment
  // across every report -- admin-only.
  const actor = await requireAdmin();

  const updated = await prisma.student.update({
    where: { id },
    data: { isActive },
  });
  await logEvent(isActive ? "student_reactivated" : "student_deactivated", { studentId: id, actor });
  return updated;
}

/**
 * Withdrawal: marks the student inactive + exitStatus=1 and settles the
 * ledger to the agreed remaining amount. The parent may be excused part of
 * the fees, so the delta between the current balance and the agreed
 * remaining is posted as a negative Adjustment (write-off). Refuses a
 * remaining amount that exceeds the current balance (can't owe MORE by
 * leaving).
 */
export async function withdrawStudent(id: number, remainingAmount: number) {
  const actor = await requireAdmin();

  validateNonNegativeNumber(remainingAmount, "المبلغ المتبقي");

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUniqueOrThrow({ where: { id } });
    if (!student.isActive) {
      throw new Error("الطالب غير نشط مسبقاً");
    }

    const balance = await tx.transaction.aggregate({
      where: { studentId: id },
      _sum: { amount: true },
    });
    const currentBalance = roundMoney(balance._sum.amount ?? 0);

    if (remainingAmount > currentBalance + 0.001) {
      throw new Error(
        `المبلغ المتبقي لا يمكن أن يتجاوز الرصيد الحالي (${currentBalance.toFixed(2)} د.أ)`
      );
    }

    const writeOff = roundMoney(currentBalance - remainingAmount);
    if (writeOff > 0) {
      await tx.transaction.create({
        data: {
          studentId: id,
          transactionType: "Adjustment",
          amount: -writeOff,
          transactionDate: new Date(),
          description: `تسوية انسحاب: إعفاء ${writeOff.toFixed(2)} د.أ`,
          referenceId: `Withdrawal:${id}`,
          createdBy: actor,
        },
      });
    }

    await tx.student.update({
      where: { id },
      data: { isActive: false, exitStatus: 1 },
    });

    await logEvent("student_withdrawn", { studentId: id, remaining: remainingAmount, writeOff, actor });
    return { remaining: remainingAmount, writeOff, previousBalance: currentBalance };
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

/**
 * Looks up the default Monthly tuition for a grade, preferring an exact
 * academicYear match. Fee.academicYear exists precisely so a tuition
 * increase for a new year can coexist with the old year's rate, but the
 * original lookup ignored it and tie-broke by cheapest amount -- as soon
 * as a second fee row existed for a grade, it could silently pick the
 * wrong (older/cheaper) one. Falls back to any active fee for the grade
 * if no row matches the exact year yet, rather than silently charging 0.
 */
export async function getDefaultTuition(
  tx: Tx,
  grade: string,
  academicYear: string
): Promise<number> {
  const exact = await tx.fee.findFirst({
    where: {
      applicableGrade: grade,
      academicYear,
      isActive: true,
      feeType: "Monthly",
    },
    orderBy: { amount: "asc" },
  });
  if (exact) return exact.amount;

  const fallback = await tx.fee.findFirst({
    where: {
      applicableGrade: grade,
      isActive: true,
      feeType: "Monthly",
    },
    orderBy: { amount: "asc" },
  });
  return fallback?.amount ?? 0;
}

/**
 * True only if this exact grade+year has its own Monthly fee row --
 * unlike getDefaultTuition, does NOT fall back to another year's rate.
 * Used to refuse a grade promotion into a year nobody has priced yet,
 * rather than silently billing every promoted student last year's tuition.
 */
export async function hasFeeForYear(
  tx: Tx,
  grade: string,
  academicYear: string
): Promise<boolean> {
  const exact = await tx.fee.findFirst({
    where: {
      applicableGrade: grade,
      academicYear,
      isActive: true,
      feeType: "Monthly",
    },
  });
  return !!exact;
}
