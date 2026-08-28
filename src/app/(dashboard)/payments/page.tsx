import { getCurrentAcademicYear } from "@/app/actions/academic-year-actions";
import { getReceipts, getNextReceiptNumber } from "@/app/actions/payment-actions";
import { getAllStudents, getStudentBalances } from "@/app/actions/student-actions";
import { PaymentsPageClient } from "@/components/payments/payments-client";
import { getAuthRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const [receipts, students, role, nextReceiptNumber, currentAcademicYear] =
    await Promise.all([
      getReceipts(),
      getAllStudents({ isActive: true }),
      getAuthRole(),
      getNextReceiptNumber(),
      getCurrentAcademicYear(),
    ]);

  const balances = await getStudentBalances(students.map((s) => s.id));

  return (
    <PaymentsPageClient
      receipts={receipts.map((r) => ({
        ...r,
        issueDate: r.issueDate.toISOString(),
        isCanceled: r.isCanceled,
        cancelReason: r.cancelReason,
      }))}
      students={students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        grade: s.grade,
        academicYear: s.academicYear,
      }))}
      balances={Object.fromEntries(balances)}
      canCancel={role === "admin"}
      nextReceiptNumber={nextReceiptNumber}
      currentAcademicYear={currentAcademicYear}
    />
  );
}
