import { getReceipts } from "@/app/actions/payment-actions";
import { getAllStudents } from "@/app/actions/student-actions";
import { PaymentsPageClient } from "@/components/payments/payments-client";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const [receipts, students] = await Promise.all([
    getReceipts(),
    getAllStudents({ isActive: true }),
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
    />
  );
}
