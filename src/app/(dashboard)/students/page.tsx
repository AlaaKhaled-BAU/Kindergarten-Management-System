import { getAllStudents, getStudentBalances } from "@/app/actions/student-actions";
import { StudentsTable } from "@/components/students/students-table";
import { PromotionDialog } from "@/components/students/promotion-dialog";
import { ExportBalancesButton } from "@/components/students/export-balances-button";
import { getAuthRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const [students, role] = await Promise.all([getAllStudents(), getAuthRole()]);

  const balances = await getStudentBalances(students.map((s) => s.id));
  const studentsWithBalance = students.map((student) => ({
    ...student,
    balance: balances.get(student.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">الطلاب</h1>
        {role === "admin" && (
          <div className="flex flex-wrap items-center gap-2">
            <ExportBalancesButton />
            <PromotionDialog />
          </div>
        )}
      </div>
      <StudentsTable students={studentsWithBalance} />
    </div>
  );
}
