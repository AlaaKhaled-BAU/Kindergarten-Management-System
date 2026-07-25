import { getReceipts } from "@/app/actions/payment-actions";
import { getAllStudents } from "@/app/actions/student-actions";
import { PaymentsPageClient } from "@/components/payments/payments-client";
import { getAuthRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const [receipts, students, role] = await Promise.all([
    getReceipts(),
    getAllStudents({ isActive: true }),
    getAuthRole(),
  ]);

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
      }))}
      canCancel={role === "admin"}
    />
  );
}
