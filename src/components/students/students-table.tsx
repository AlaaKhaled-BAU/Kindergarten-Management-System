"use client";

import { errorMessage } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { createStudent } from "@/app/actions/student-actions";
import { AcademicYearSelect } from "@/components/shared/academic-year-select";
import { Plus, Search } from "lucide-react";
import { GRADES, gradeLabel } from "@/lib/grades";

interface Student {
  id: number;
  firstName: string;
  lastName: string;
  grade: string;
  academicYear: string;
  isActive: boolean;
  balance: number;
}

export function StudentsTable({
  students: initialStudents,
}: {
  students: Student[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [students, setStudents] = useState(initialStudents);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = students.filter((s) => {
    if (gradeFilter !== "all" && s.grade !== gradeFilter) return false;
    if (yearFilter !== "all" && s.academicYear !== yearFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${s.firstName} ${s.lastName}`.toLowerCase();
      if (!name.includes(q)) return false;
    }
    return true;
  });

  async function handleCreate(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      const busFees = parseFloat((formData.get("busFees") as string) || "0");
      const additionalFees = parseFloat(
        (formData.get("additionalFees") as string) || "0"
      );
      const discountValue = parseFloat(
        (formData.get("discountValue") as string) || "0"
      );
      const discountIsPercent = formData.get("discountIsPercent") === "on";

      const parentName = formData.get("parentName") as string;
      const parentPhone = formData.get("parentPhone") as string;
      const pickupName = formData.get("pickupName") as string;

      const student = await createStudent({
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        grade: formData.get("grade") as string,
        academicYear: formData.get("academicYear") as string,
        dateOfBirth: formData.get("dateOfBirth")
          ? new Date(formData.get("dateOfBirth") as string)
          : undefined,
        notes: (formData.get("notes") as string) || undefined,
        busFees,
        additionalFees,
        discountValue,
        discountIsPercent,
        allergies: (formData.get("allergies") as string) || undefined,
        medicalNotes: (formData.get("medicalNotes") as string) || undefined,
        parents: parentName && parentPhone ? [{
          fullName: parentName,
          phone: parentPhone,
          relationship: (formData.get("parentRelationship") as string) || undefined,
        }] : undefined,
        pickupPersons: pickupName ? [{
          fullName: pickupName,
          relationship: (formData.get("pickupRelationship") as string) || undefined,
          phone: (formData.get("pickupPhone") as string) || undefined,
        }] : undefined,
      });

      setStudents((prev) => [{ ...student, balance: 0 }, ...prev]);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن طالب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pe-9"
            />
          </div>
          <Select value={gradeFilter} onValueChange={(v) => setGradeFilter(v ?? "all")}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="الصف">
                {(value: string) => (!value ? "الصف" : value === "all" ? "الكل" : gradeLabel(value))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              {GRADES.map((g) => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AcademicYearSelect
            value={yearFilter}
            onValueChange={(v) => setYearFilter(v ?? "all")}
            showAll
            className="w-full sm:w-36"
            placeholder="السنة"
          />
        </div>

        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setError(null);
          }}
        >
          <DialogTrigger
            render={
              <Button variant="default">
                <Plus className="me-2 size-4" />
                إضافة طالب
              </Button>
            }
          />
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إضافة طالب جديد</DialogTitle>
            </DialogHeader>
            <form
              action={handleCreate}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">الاسم الأول *</Label>
                  <Input id="firstName" name="firstName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">الاسم الأخير *</Label>
                  <Input id="lastName" name="lastName" required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="grade">الصف *</Label>
                  <Select name="grade" required>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الصف">
                        {(value: string) => (value ? gradeLabel(value) : "اختر الصف")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {GRADES.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="academicYear">السنة الدراسية *</Label>
                  <AcademicYearSelect name="academicYear" includeNext required className="w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">تاريخ الميلاد</Label>
                <Input id="dateOfBirth" name="dateOfBirth" type="date" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="busFees">رسوم الباص</Label>
                  <Input
                    id="busFees"
                    name="busFees"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="additionalFees">رسوم إضافية</Label>
                  <Input
                    id="additionalFees"
                    name="additionalFees"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountValue">الخصم</Label>
                  <Input
                    id="discountValue"
                    name="discountValue"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="discountIsPercent" name="discountIsPercent" />
                <Label htmlFor="discountIsPercent">الخصم نسبة مئوية</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="allergies">الحساسية</Label>
                <Input id="allergies" name="allergies" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medicalNotes">ملاحظات طبية</Label>
                <Input id="medicalNotes" name="medicalNotes" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Input id="notes" name="notes" />
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">ولي الأمر</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="parentName">الاسم</Label>
                    <Input id="parentName" name="parentName" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentPhone">رقم الهاتف</Label>
                    <Input id="parentPhone" name="parentPhone" type="tel" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentRelationship">الصلة</Label>
                  <Input id="parentRelationship" name="parentRelationship" placeholder="الأب / الأم / ولي الأمر" />
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">مخول بالاستلام (اختياري)</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pickupName">الاسم</Label>
                    <Input id="pickupName" name="pickupName" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pickupPhone">رقم الهاتف</Label>
                    <Input id="pickupPhone" name="pickupPhone" type="tel" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupRelationship">الصلة</Label>
                  <Input id="pickupRelationship" name="pickupRelationship" />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "جارٍ الإضافة..." : "إضافة الطالب"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="py-3 px-4 text-start">#</th>
              <th className="py-3 px-4 text-start">الاسم</th>
              <th className="py-3 px-4 text-start">الصف</th>
              <th className="py-3 px-4 text-start">السنة</th>
              <th className="py-3 px-4 text-end">الرصيد</th>
              <th className="py-3 px-4 text-center">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  لا يوجد طلاب
                </td>
              </tr>
            ) : (
              filtered.map((s, i) => (
                <tr
                  key={s.id}
                  className="border-b hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`/students/${s.id}`)}
                >
                  <td className="py-3 px-4">{i + 1}</td>
                  <td className="py-3 px-4 font-medium">
                    {s.firstName} {s.lastName}
                  </td>
                  <td className="py-3 px-4">{gradeLabel(s.grade)}</td>
                  <td className="py-3 px-4">{s.academicYear}</td>
                  <td
                    className={`py-3 px-4 text-end font-medium ${
                      s.balance > 0 ? "text-orange-600" : "text-green-600"
                    }`}
                  >
                    {s.balance.toFixed(2)} د.أ
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={s.isActive ? "default" : "secondary"}>
                      {s.isActive ? "نشط" : "غير نشط"}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
