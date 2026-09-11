"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AcademicYearSelect } from "@/components/shared/academic-year-select";
import { getAcademicYears } from "@/app/actions/academic-year-actions";
import { MONTH_NAMES } from "@/lib/months";
import type { FinancialExportFilter } from "@/app/actions/export-actions";
import { errorMessage } from "@/lib/utils";
import { triggerDownload } from "@/lib/download-utils";

export function FinancialExportDialog({
  title,
  includeOtherLabel,
  onExport,
}: {
  title: string;
  includeOtherLabel: string;
  onExport: (
    filter: FinancialExportFilter,
    includeOther: boolean
  ) => Promise<{ base64: string; filename: string }>;
}) {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"month" | "academicYear">("month");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [months, setMonths] = useState<number[]>([now.getMonth() + 1]);
  const [academicYear, setAcademicYear] = useState<string | null>(null);
  const [includeOther, setIncludeOther] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAcademicYears().then(({ current }) => {
      setAcademicYear((prev) => prev ?? current);
    });
  }, []);

  async function handleExport() {
    setError(null);
    setPending(true);
    try {
      const filter: FinancialExportFilter =
        scope === "month"
          ? { type: "month", year: parseInt(year, 10), months }
          : { type: "academicYear", academicYear: academicYear ?? "" };

      if (filter.type === "month" && months.length === 0) {
        throw new Error("اختر شهراً واحداً على الأقل");
      }
      if (filter.type === "academicYear" && !filter.academicYear) {
        throw new Error("اختر السنة الدراسية");
      }

      const result = await onExport(filter, includeOther);
      triggerDownload(result.base64, result.filename);
      setOpen(false);
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
        if (!v) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <Download className="me-2 size-4" />
            تصدير إلى Excel
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>نطاق التصدير</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as "month" | "academicYear")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">شهر أو أشهر محددة</SelectItem>
                <SelectItem value="academicYear">السنة الدراسية كاملة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "month" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="export-year">السنة</Label>
                <Input
                  id="export-year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label>الأشهر</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
                  >
                    الكل
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMonths([])}
                  >
                    مسح
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {MONTH_NAMES.map((name, i) => {
                  const value = i + 1;
                  const checked = months.includes(value);
                  return (
                    <label
                      key={name}
                      className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setMonths((prev) =>
                            v ? [...prev, value].sort((a, b) => a - b) : prev.filter((m) => m !== value)
                          );
                        }}
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>السنة الدراسية</Label>
              <p className="text-xs text-muted-foreground">
                من سبتمبر حتى أغسطس
              </p>
              <AcademicYearSelect
                className="w-full"
                value={academicYear ?? undefined}
                onValueChange={setAcademicYear}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={includeOther}
              onCheckedChange={(v) => setIncludeOther(v === true)}
            />
            {includeOtherLabel}
          </label>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button className="w-full" onClick={handleExport} disabled={pending}>
            {pending ? "جارٍ التصدير..." : "تصدير"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
