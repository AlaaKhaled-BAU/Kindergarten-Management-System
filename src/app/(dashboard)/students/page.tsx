import { getAllStudents, getStudentBalance } from "@/app/actions/student-actions";
import { StudentsTable } from "@/components/students/students-table";
import { PromotionDialog } from "@/components/students/promotion-dialog";
import { getAuthRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const [students, role] = await Promise.all([getAllStudents(), getAuthRole()]);

  const studentsWithBalance = await Promise.all(
    students.map(async (student) => ({
      ...student,
      balance: await getStudentBalance(student.id),
    }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الطلاب</h1>
        {role === "admin" && <PromotionDialog />}
      </div>
      <StudentsTable students={studentsWithBalance} />
    </div>
  );
}
