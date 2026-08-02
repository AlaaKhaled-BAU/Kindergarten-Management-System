"use client";

import { errorMessage } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFee, deleteFee, copyFeesToYear } from "@/app/actions/fee-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy } from "lucide-react";
import { GRADES, gradeLabel } from "@/lib/grades";
import { AcademicYearSelect } from "@/components/shared/academic-year-select";

interface Fee {
  id: number;
  name: string;
  amount: number;
  applicableGrade: string | null;
  academicYear: string | null;
  isActive: boolean;
}

export function FeesClient({ fees: initialFees }: { fees: Fee[] }) {
  const router = useRouter();
  const [fees, setFees] = useState(initialFees);
  const [open, setOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Fee | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      const fee = await createFee({
        name: formData.get("name") as string,
        amount: parseFloat(formData.get("amount") as string),
        applicableGrade: formData.get("applicableGrade") as string,
        academicYear: formData.get("academicYear") as string,
      });
      setFees((prev) => [fee, ...prev]);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setPending(true);
    try {
      await deleteFee(deleteTarget.id);
      setFees((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function handleCopy(formData: FormData) {
    setError(null);
    setCopyResult(null);
    setPending(true);
    try {
      const fromYear = formData.get("fromYear") as string;
      const toYear = formData.get("toYear") as string;
      const result = await copyFeesToYear(fromYear, toYear);
      setCopyResult(`تم نسخ ${result.copied} رسم${result.skipped > 0 ? ` (تم تخطي ${result.skipped} موجود مسبقاً)` : ""}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Dialog open={copyOpen} onOpenChange={(v) => { setCopyOpen(v); if (!v) { setError(null); setCopyResult(null); } }}>
          <DialogTrigger render={<Button variant="outline"><Copy className="me-2 size-4" />نسخ إلى سنة جديدة</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>نسخ الرسوم إلى سنة دراسية جديدة</DialogTitle>
            </DialogHeader>
            <form action={handleCopy} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fromYear">من السنة</Label>
                <AcademicYearSelect name="fromYear" required className="w-full" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toYear">إلى السنة</Label>
                <AcademicYearSelect name="toYear" includeNext required className="w-full" />
              </div>
              {copyResult && <p className="text-sm text-success">{copyResult}</p>}
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "جارٍ النسخ..." : "نسخ الرسوم"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null); }}>
          <DialogTrigger render={<Button><Plus className="me-2 size-4" />إضافة رسم</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة رسم جديد</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم الرسم</Label>
                <Input id="name" name="name" placeholder="رسوم KG1" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="applicableGrade">الصف</Label>
                  <Select name="applicableGrade" required>
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
                  <Label htmlFor="academicYear">السنة الدراسية</Label>
                  <AcademicYearSelect name="academicYear" includeNext required className="w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">المبلغ الشهري (د.أ)</Label>
                <Input id="amount" name="amount" type="number" min="0.01" step="0.01" required />
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "جارٍ الإضافة..." : "إضافة"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="py-3 px-4 text-start">الاسم</th>
              <th className="py-3 px-4 text-start">الصف</th>
              <th className="py-3 px-4 text-start">السنة الدراسية</th>
              <th className="py-3 px-4 text-end">المبلغ الشهري</th>
              <th className="py-3 px-4 text-center">الحالة</th>
              <th className="py-3 px-4 text-end">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {fees.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  لا توجد رسوم مضافة
                </td>
              </tr>
            ) : (
              fees.map((f) => (
                <tr key={f.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4 font-medium">{f.name}</td>
                  <td className="py-3 px-4">{f.applicableGrade ? gradeLabel(f.applicableGrade) : "—"}</td>
                  <td className="py-3 px-4">{f.academicYear ?? "—"}</td>
                  <td className="py-3 px-4 text-end font-medium">{f.amount.toFixed(2)} د.أ</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={f.isActive ? "default" : "secondary"}>
                      {f.isActive ? "نشط" : "غير نشط"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="حذف"
                      className="text-destructive hover:text-destructive h-auto px-2"
                      onClick={() => setDeleteTarget(f)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف الرسم</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                هل أنت متأكد من حذف رسم <strong>{deleteTarget.name}</strong>؟
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={pending}>
                  تراجع
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={pending}>
                  {pending ? "جارٍ الحذف..." : "حذف"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
