"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";
import {
  importRevenues,
  importExpenses,
  previewRevenueImport,
  previewExpenseImport,
} from "@/app/actions/import-actions";

interface ImportResult {
  success: number;
  errors: string[];
}

interface ImportDialogProps {
  type: "revenue" | "expense";
  onSuccess: () => void;
}

export function ImportDialog({ type, onSuccess }: ImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setFile(f);
      setError(null);
      setResult(null);
      setPreview([]);
      setHeaders([]);

      const formData = new FormData();
      formData.append("file", f);

      try {
        const previewFn = type === "revenue" ? previewRevenueImport : previewExpenseImport;
        const res = await previewFn(formData);
        setHeaders(res.headers);
        setPreview(res.preview);
        setTotalRows(res.totalRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "حدث خطأ أثناء معاينة الملف");
      }
    },
    [type]
  );

  const handleImport = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const importFn = type === "revenue" ? importRevenues : importExpenses;
      const res = await importFn(formData);
      setResult(res);
      if (res.errors.length === 0 && res.success > 0) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء الاستيراد");
    } finally {
      setLoading(false);
    }
  }, [file, type, onSuccess]);

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v);
    if (!v) {
      setFile(null);
      setPreview([]);
      setHeaders([]);
      setResult(null);
      setError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  const label = type === "revenue" ? "استيراد من Excel" : "استيراد من Excel";
  const title =
    type === "revenue"
      ? "استيراد الإيرادات من ملف Excel"
      : "استيراد المصروفات من ملف Excel";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Upload className="me-2 size-4" />
            {label}
          </Button>
        }
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              اختر ملف Excel (.xlsx)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="block w-full text-sm file:me-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:text-sm file:font-medium file:cursor-pointer"
            />
          </div>

          {preview.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                معاينة ({preview.length} من {totalRows} صف)
              </p>
              <div className="border rounded-lg overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      {headers.map((h) => (
                        <th
                          key={h}
                          className="py-2 px-3 text-start border-b whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        {headers.map((h) => (
                          <td
                            key={h}
                            className="py-2 px-3 whitespace-nowrap"
                          >
                            {String(row[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2 text-sm">
              {result.success > 0 && (
                <div className="rounded-lg border border-green-500/50 bg-green-50 dark:bg-green-950/20 p-3 text-green-700 dark:text-green-400">
                  تم استيراد {result.success} سجل بنجاح
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                  <p className="font-medium mb-1">أخطاء:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button onClick={handleImport} disabled={!file || loading}>
              {loading ? "جاري الاستيراد..." : "استيراد"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
