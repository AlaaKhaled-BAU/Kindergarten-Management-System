"use client";

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
import { Plus, Search } from "lucide-react";

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
  const [students, setStudents] = useState(initialStudents);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gradeMap: Record<string, string> = {
    Pre: "بستان",
    KG1: "روضة أولى",
    KG2: "روضة ثانية",
  };

  const filtered = students.filter((s) => {
    if (gradeFilter !== "all" && s.grade !== gradeFilter) return false;
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
      });

      setStudents((prev) => [{ ...student, balance: 0 }, ...prev]);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن طالب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pe-9"
            />
          </div>
          <Select value={gradeFilter} onValueChange={(v) => setGradeFilter(v ?? "all")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="الصف" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="Pre">بستان</SelectItem>
              <SelectItem value="KG1">روضة أولى</SelectItem>
              <SelectItem value="KG2">روضة ثانية</SelectItem>
            </SelectContent>
          </Select>
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
                      <SelectValue placeholder="اختر الصف" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pre">بستان</SelectItem>
                      <SelectItem value="KG1">روضة أولى</SelectItem>
                      <SelectItem value="KG2">روضة ثانية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="academicYear">السنة الدراسية *</Label>
                  <Input
                    id="academicYear"
                    name="academicYear"
                    defaultValue="2025-2026"
                    required
                  />
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

      <div className="rounded-lg border">
        <table className="w-full text-sm">
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
                  <td className="py-3 px-4">{gradeMap[s.grade] ?? s.grade}</td>
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
