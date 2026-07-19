"use client";

import { errorMessage } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPromotionCandidates,
  promoteGrade,
} from "@/app/actions/promotion-actions";
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
import { ArrowUpCircle } from "lucide-react";
import { GRADES, gradeLabel } from "@/lib/grades";

type PromotionResult = Awaited<ReturnType<typeof promoteGrade>>;

export function PromotionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sourceGrade, setSourceGrade] = useState("Pre");
  const [sourceYear, setSourceYear] = useState("2025-2026");
  const [targetGrade, setTargetGrade] = useState("KG1");
  const [targetYear, setTargetYear] = useState("2026-2027");
  const [candidates, setCandidates] = useState<{ id: number; firstName: string; lastName: string }[] | null>(null);
  const [results, setResults] = useState<PromotionResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCandidates(null);
    setResults(null);
    setError(null);
  }

  async function handlePreview() {
    setError(null);
    setPending(true);
    try {
      const list = await getPromotionCandidates(sourceGrade, sourceYear);
      setCandidates(list);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function handleConfirm() {
    setError(null);
    setPending(true);
    try {
      const res = await promoteGrade(sourceGrade, sourceYear, targetGrade, targetYear);
      setResults(res);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <ArrowUpCircle className="me-2 size-4" />
            ترقية صف
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ترقية صف إلى السنة الدراسية الجديدة</DialogTitle>
        </DialogHeader>

        {!results && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>الصف الحالي</Label>
                <Select value={sourceGrade} onValueChange={(v) => v && setSourceGrade(v)}>
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
                <Label htmlFor="source-year">السنة الحالية</Label>
                <Input id="source-year" value={sourceYear} onChange={(e) => setSourceYear(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>الصف الجديد</Label>
                <Select value={targetGrade} onValueChange={(v) => v && setTargetGrade(v)}>
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
                <Label htmlFor="target-year">السنة الجديدة</Label>
                <Input id="target-year" value={targetYear} onChange={(e) => setTargetYear(e.target.value)} />
              </div>
            </div>

            {!candidates && (
              <Button onClick={handlePreview} disabled={pending} className="w-full">
                {pending ? "جارٍ البحث..." : "معاينة الطلاب"}
              </Button>
            )}

            {candidates && (
              <div className="space-y-3">
                {candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    لا يوجد طلاب نشطون في هذا الصف لهذه السنة.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      سيتم ترقية {candidates.length} طالب:
                    </p>
                    <ul className="max-h-40 overflow-y-auto rounded-lg border p-2 text-sm">
                      {candidates.map((c) => (
                        <li key={c.id}>{c.firstName} {c.lastName}</li>
                      ))}
                    </ul>
                  </>
                )}
                {error && (
                  <p className="text-sm text-destructive" role="alert">{error}</p>
                )}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setCandidates(null)} disabled={pending}>
                    تراجع
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={pending || candidates.length === 0}
                  >
                    {pending ? "جارٍ الترقية..." : "تأكيد الترقية"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {results && (
          <div className="space-y-3">
            <p className="text-sm">
              تمت ترقية {results.filter((r) => !r.error).length} من {results.length} طالب بنجاح.
            </p>
            {results.some((r) => r.error) && (
              <ul className="max-h-40 overflow-y-auto rounded-lg border border-destructive/30 p-2 text-sm text-destructive">
                {results.filter((r) => r.error).map((r) => (
                  <li key={r.oldStudentId}>#{r.oldStudentId}: {r.error}</li>
                ))}
              </ul>
            )}
            <Button className="w-full" onClick={() => setOpen(false)}>
              إغلاق
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
