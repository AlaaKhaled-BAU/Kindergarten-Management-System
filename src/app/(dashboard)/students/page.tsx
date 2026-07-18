import { getAllStudents, getStudentBalance } from "@/app/actions/student-actions";
import { StudentsTable } from "@/components/students/students-table";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const students = await getAllStudents();

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
      </div>
      <StudentsTable students={studentsWithBalance} />
    </div>
  );
}
