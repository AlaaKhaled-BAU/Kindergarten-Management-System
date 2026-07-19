import { getStudentById, getStudentLedger } from "@/app/actions/student-actions";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentStatusButton } from "@/components/students/student-status-button";
import { RefundButton } from "@/components/students/refund-button";
import { getAuthRole } from "@/lib/auth";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const studentId = parseInt(id);

  if (isNaN(studentId)) notFound();

  const student = await getStudentById(studentId);
  if (!student) notFound();

  const [ledger, role] = await Promise.all([
    getStudentLedger(studentId),
    getAuthRole(),
  ]);

  const gradeMap: Record<string, string> = {
    Pre: "بستان",
    KG1: "روضة أولى",
    KG2: "روضة ثانية",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {student.firstName} {student.lastName}
          </h1>
          <p className="text-muted-foreground">
            {gradeMap[student.grade] ?? student.grade} — {student.academicYear}
          </p>
        </div>
        <StudentStatusButton studentId={student.id} isActive={student.isActive} />
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">المعلومات الشخصية</TabsTrigger>
          <TabsTrigger value="ledger">كشف الحساب</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">بيانات الطالب</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="الاسم الكامل" value={`${student.firstName} ${student.lastName}`} />
              <InfoRow label="الصف" value={gradeMap[student.grade] ?? student.grade} />
              <InfoRow label="السنة الدراسية" value={student.academicYear} />
              <InfoRow
                label="تاريخ الميلاد"
                value={student.dateOfBirth ? format(new Date(student.dateOfBirth), "dd/MM/yyyy") : "—"}
              />
              <InfoRow label="تاريخ التسجيل" value={format(new Date(student.enrollmentDate), "dd/MM/yyyy")} />
              <InfoRow label="رسوم الباص" value={`${student.busFees} د.أ`} />
              <InfoRow label="رسوم إضافية" value={`${student.additionalFees} د.أ`} />
              <InfoRow
                label="الخصم"
                value={
                  student.discountValue > 0
                    ? student.discountIsPercent
                      ? `${student.discountValue}%`
                      : `${student.discountValue} د.أ`
                    : "لا يوجد"
                }
              />
              <InfoRow label="ملاحظات" value={student.notes ?? "—"} />
              <InfoRow label="الحساسية" value={student.allergies ?? "—"} />
              <InfoRow label="ملاحظات طبية" value={student.medicalNotes ?? "—"} />
            </CardContent>
          </Card>

          {student.parents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">أولياء الأمور</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {student.parents.map((sp) => (
                    <div key={sp.parentId} className="rounded-lg border p-3">
                      <p className="font-medium">{sp.parent.fullName}</p>
                      <p className="text-sm text-muted-foreground">{sp.parent.phone}</p>
                      {sp.relationship && (
                        <p className="text-xs text-muted-foreground">الصلة: {sp.relationship}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {student.pickups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">المخولون بالاستلام</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {student.pickups.map((p) => (
                    <div key={p.id} className="rounded-lg border p-3">
                      <p className="font-medium">{p.fullName}</p>
                      {p.relationship && (
                        <p className="text-sm text-muted-foreground">الصلة: {p.relationship}</p>
                      )}
                      {p.phone && (
                        <p className="text-sm text-muted-foreground">{p.phone}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">كشف الحساب</CardTitle>
              {role === "admin" && <RefundButton studentId={student.id} />}
            </CardHeader>
            <CardContent>
              {ledger.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  لا توجد معاملات لهذا الطالب
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-start">
                        <th className="py-2 px-3 text-start">التاريخ</th>
                        <th className="py-2 px-3 text-start">النوع</th>
                        <th className="py-2 px-3 text-start">البيان</th>
                        <th className="py-2 px-3 text-end">مدين</th>
                        <th className="py-2 px-3 text-end">دائن</th>
                        <th className="py-2 px-3 text-end">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((t) => (
                        <tr key={t.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3 whitespace-nowrap">
                            {format(new Date(t.transactionDate), "dd/MM/yyyy")}
                          </td>
                          <td className="py-2 px-3">
                            <TypeBadge type={t.transactionType} />
                          </td>
                          <td className="py-2 px-3">{t.description}</td>
                          <td className="py-2 px-3 text-end">
                            {t.amount > 0 ? `${t.amount.toFixed(2)} د.أ` : "—"}
                          </td>
                          <td className="py-2 px-3 text-end">
                            {t.amount < 0 ? `${Math.abs(t.amount).toFixed(2)} د.أ` : "—"}
                          </td>
                          <td
                            className={`py-2 px-3 text-end font-medium ${
                              t.runningBalance > 0 ? "text-orange-600" : "text-green-600"
                            }`}
                          >
                            {t.runningBalance.toFixed(2)} د.أ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    Charge: "رسوم",
    Payment: "دفعة",
    Adjustment: "تسوية",
    Reversal: "إلغاء",
    BalanceTransferOut: "تحويل (من)",
    BalanceTransferIn: "تحويل (إلى)",
  };
  return (
    <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs">
      {labels[type] ?? type}
    </span>
  );
}
