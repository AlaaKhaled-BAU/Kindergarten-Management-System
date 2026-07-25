"use client";

import { errorMessage } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateStudent } from "@/app/actions/student-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Pencil } from "lucide-react";
import { GRADES, gradeLabel } from "@/lib/grades";
import { AcademicYearSelect } from "@/components/shared/academic-year-select";

interface StudentEditData {
  id: number;
  firstName: string;
  lastName: string;
  grade: string;
  academicYear: string;
  dateOfBirth: string | null;
  busFees: number;
  additionalFees: number;
  discountValue: number;
  discountIsPercent: boolean;
  allergies: string | null;
  medicalNotes: string | null;
  notes: string | null;
}

export function StudentEditButton({ student }: { student: StudentEditData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await updateStudent(student.id, {
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        grade: formData.get("grade") as string,
        academicYear: formData.get("academicYear") as string,
        dateOfBirth: formData.get("dateOfBirth")
          ? new Date(formData.get("dateOfBirth") as string)
          : null,
        busFees: parseFloat((formData.get("busFees") as string) || "0"),
        additionalFees: parseFloat((formData.get("additionalFees") as string) || "0"),
        discountValue: parseFloat((formData.get("discountValue") as string) || "0"),
        discountIsPercent: formData.get("discountIsPercent") === "on",
        allergies: (formData.get("allergies") as string) || null,
        medicalNotes: (formData.get("medicalNotes") as string) || null,
        notes: (formData.get("notes") as string) || null,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null); }}>
      <DialogTrigger render={<Button variant="outline"><Pencil className="me-2 size-4" />تعديل</Button>} />
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل بيانات الطالب</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-firstName">الاسم الأول *</Label>
              <Input id="edit-firstName" name="firstName" defaultValue={student.firstName} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lastName">الاسم الأخير *</Label>
              <Input id="edit-lastName" name="lastName" defaultValue={student.lastName} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-grade">الصف *</Label>
              <Select name="grade" defaultValue={student.grade} required>
                <SelectTrigger>
                  <SelectValue>{(value: string) => gradeLabel(value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-academicYear">السنة الدراسية *</Label>
              <AcademicYearSelect name="academicYear" defaultValue={student.academicYear} includeNext required className="w-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-dateOfBirth">تاريخ الميلاد</Label>
            <Input id="edit-dateOfBirth" name="dateOfBirth" type="date" defaultValue={student.dateOfBirth ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="edit-busFees">رسوم الباص</Label>
              <Input id="edit-busFees" name="busFees" type="number" min="0" step="0.01" defaultValue={student.busFees} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-additionalFees">رسوم إضافية</Label>
              <Input id="edit-additionalFees" name="additionalFees" type="number" min="0" step="0.01" defaultValue={student.additionalFees} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-discountValue">الخصم</Label>
              <Input id="edit-discountValue" name="discountValue" type="number" min="0" step="0.01" defaultValue={student.discountValue} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="edit-discountIsPercent" name="discountIsPercent" defaultChecked={student.discountIsPercent} />
            <Label htmlFor="edit-discountIsPercent">الخصم نسبة مئوية</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            أي تغيير في الرسوم أو الخصم أو الصف يضيف تسوية بالفرق إلى كشف الحساب تلقائياً.
          </p>
          <div className="space-y-2">
            <Label htmlFor="edit-allergies">الحساسية</Label>
            <Input id="edit-allergies" name="allergies" defaultValue={student.allergies ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-medicalNotes">ملاحظات طبية</Label>
            <Input id="edit-medicalNotes" name="medicalNotes" defaultValue={student.medicalNotes ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">ملاحظات</Label>
            <Input id="edit-notes" name="notes" defaultValue={student.notes ?? ""} />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
