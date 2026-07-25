"use server";

import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { requireAdmin, validateRequiredString } from "./validation";
import { roundMoney } from "@/lib/utils";
import { gradeLabel } from "@/lib/grades";
import { getDefaultTuition, hasFeeForYear, postEnrolmentCharges } from "./student-actions";

interface PromotionResult {
  oldStudentId: number;
  newStudentId: number | null;
  oldBalance: number;
  error?: string;
}

export async function promoteStudents(
  studentIds: number[],
  newAcademicYear: string,
  newGrade: string
): Promise<PromotionResult[]> {
  const actor = await requireAdmin();

  validateRequiredString(newAcademicYear, "السنة الدراسية الجديدة");
  validateRequiredString(newGrade, "الصف الجديد");

  // Refuse the whole batch upfront if nobody has priced this grade for the
  // target year yet -- getDefaultTuition's fallback-to-any-year is fine for
  // a single manual entry, but silently reusing last year's rate across an
  // entire promoted cohort is exactly how B5 mis-billed every student.
  const priced = await hasFeeForYear(prisma, newGrade, newAcademicYear);
  if (!priced) {
    const error = `لا توجد رسوم محددة لصف "${gradeLabel(newGrade)}" للسنة الدراسية ${newAcademicYear}. الرجاء إضافة الرسوم من صفحة "الرسوم" أولاً.`;
    return studentIds.map((id) => ({ oldStudentId: id, newStudentId: null, oldBalance: 0, error }));
  }

  const results: PromotionResult[] = [];

  for (const studentId of studentIds) {
    try {
      const result = await prisma.$transaction(async (tx): Promise<PromotionResult> => {
        const oldStudent = await tx.student.findUniqueOrThrow({
          where: { id: studentId },
          include: {
            parents: { include: { parent: true } },
            pickups: true,
          },
        });

        const existing = await tx.student.findFirst({
          where: {
            firstName: oldStudent.firstName,
            lastName: oldStudent.lastName,
            dateOfBirth: oldStudent.dateOfBirth,
            grade: newGrade,
            academicYear: newAcademicYear,
          },
        });

        if (existing) {
          return {
            oldStudentId: studentId,
            newStudentId: null,
            oldBalance: 0,
            error: `الطالب موجود مسبقاً في ${gradeLabel(newGrade)} - ${newAcademicYear}`,
          };
        }

        const balanceResult = await tx.transaction.aggregate({
          where: { studentId: oldStudent.id },
          _sum: { amount: true },
        });
        const oldBalance = roundMoney(balanceResult._sum.amount ?? 0);

        const newStudent = await tx.student.create({
          data: {
            firstName: oldStudent.firstName,
            lastName: oldStudent.lastName,
            dateOfBirth: oldStudent.dateOfBirth,
            grade: newGrade,
            academicYear: newAcademicYear,
            enrollmentDate: new Date(),
            isActive: true,
            notes: oldStudent.notes,
            busFees: oldStudent.busFees,
            additionalFees: oldStudent.additionalFees,
            discountValue: oldStudent.discountValue,
            discountIsPercent: oldStudent.discountIsPercent,
            exitStatus: oldStudent.exitStatus,
            tuitionOverride: oldStudent.tuitionOverride,
            globalId: oldStudent.globalId,
            allergies: oldStudent.allergies,
            medicalNotes: oldStudent.medicalNotes,
            siblingGlobalId: oldStudent.siblingGlobalId,
          },
        });

        for (const sp of oldStudent.parents) {
          await tx.studentParent.create({
            data: {
              studentId: newStudent.id,
              parentId: sp.parentId,
              relationship: sp.relationship,
            },
          });
        }

        for (const pickup of oldStudent.pickups) {
          await tx.authorizedPickupPerson.create({
            data: {
              studentId: newStudent.id,
              fullName: pickup.fullName,
              relationship: pickup.relationship,
              phone: pickup.phone,
              notes: pickup.notes,
            },
          });
        }

        const tuitionAmount = oldStudent.tuitionOverride ?? await getDefaultTuition(tx, newGrade, newAcademicYear);
        await postEnrolmentCharges(
          tx,
          newStudent.id,
          {
            tuitionAmount,
            busFees: oldStudent.busFees,
            additionalFees: oldStudent.additionalFees,
            discountValue: oldStudent.discountValue,
            discountIsPercent: oldStudent.discountIsPercent,
          },
          actor,
          true
        );

        if (oldBalance !== 0) {
          await tx.transaction.create({
            data: {
              studentId: oldStudent.id,
              transactionType: "BalanceTransferOut",
              amount: -oldBalance,
              transactionDate: new Date(),
              description: `ترقية إلى ${gradeLabel(newGrade)} - ${newAcademicYear}`,
              referenceId: `Promotion:To:${newStudent.id}`,
              createdBy: actor,
            },
          });

          await tx.transaction.create({
            data: {
              studentId: newStudent.id,
              transactionType: "BalanceTransferIn",
              amount: oldBalance,
              transactionDate: new Date(),
              description: `رصيد مرحل من ${gradeLabel(oldStudent.grade)} - ${oldStudent.academicYear}`,
              referenceId: `Promotion:From:${oldStudent.id}`,
              createdBy: actor,
            },
          });
        }

        await tx.student.update({
          where: { id: oldStudent.id },
          data: { isActive: false },
        });

        return {
          oldStudentId: studentId,
          newStudentId: newStudent.id,
          oldBalance,
        };
      });

      results.push(result);
    } catch (error) {
      results.push({
        oldStudentId: studentId,
        newStudentId: null,
        oldBalance: 0,
        error: error instanceof Error ? error.message : "خطأ غير معروف",
      });
    }
  }

  await logEvent("students_promoted", {
    newGrade,
    newAcademicYear,
    actor,
    total: studentIds.length,
    succeeded: results.filter((r) => !r.error).length,
  });

  return results;
}

/**
 * Active students matching a grade+year, for previewing a batch promotion
 * before running it (promoteStudents itself has no UI entry point without
 * this -- a kindergarten has no way to promote a whole grade cohort at
 * year-end otherwise).
 */
export async function getPromotionCandidates(grade: string, academicYear: string) {
  await requireAdmin();
  return prisma.student.findMany({
    where: { grade, academicYear, isActive: true },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { lastName: "asc" },
  });
}

export async function promoteGrade(
  sourceGrade: string,
  sourceAcademicYear: string,
  newGrade: string,
  newAcademicYear: string
): Promise<PromotionResult[]> {
  await requireAdmin();
  const candidates = await getPromotionCandidates(sourceGrade, sourceAcademicYear);
  return promoteStudents(candidates.map((s) => s.id), newAcademicYear, newGrade);
}
