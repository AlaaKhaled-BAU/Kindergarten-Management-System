"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, validateRequiredString } from "./validation";
import { roundMoney } from "@/lib/utils";

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
            grade: newGrade,
            academicYear: newAcademicYear,
          },
        });

        if (existing) {
          return {
            oldStudentId: studentId,
            newStudentId: null,
            oldBalance: 0,
            error: `الطالب موجود مسبقاً في ${newGrade} - ${newAcademicYear}`,
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

        const newTuition = await tx.fee.findFirst({
          where: {
            applicableGrade: newGrade,
            isActive: true,
            feeType: "Monthly",
          },
          orderBy: { amount: "asc" },
        });
        const tuitionAmount = oldStudent.tuitionOverride ?? newTuition?.amount ?? 0;

        if (tuitionAmount > 0) {
          await tx.transaction.create({
            data: {
              studentId: newStudent.id,
              transactionType: "Charge",
              amount: tuitionAmount,
              transactionDate: new Date(),
              description: "رسوم دراسية - ترقية",
              referenceId: "Fee:Tuition:Promotion",
              createdBy: actor,
            },
          });
        }

        if (oldBalance !== 0) {
          await tx.transaction.create({
            data: {
              studentId: oldStudent.id,
              transactionType: "BalanceTransferOut",
              amount: -oldBalance,
              transactionDate: new Date(),
              description: `ترقية إلى ${newGrade} - ${newAcademicYear}`,
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
              description: `رصيد مرحل من ${oldStudent.grade} - ${oldStudent.academicYear}`,
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

  return results;
}
