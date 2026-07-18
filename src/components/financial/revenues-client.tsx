"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRevenue, updateRevenue, deleteRevenue } from "@/app/actions/revenue-actions";
import { exportRevenues } from "@/app/actions/export-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { format } from "date-fns";
import { ImportDialog } from "@/components/financial/import-dialog";
import { triggerDownload } from "@/lib/download-utils";

interface Revenue {
  id: number;
  year: number;
  month: number;
  category: string;
  amount: number;
  description: string | null;
  recordDate: string;
  source: string | null;
}

export function RevenuesPageClient({
  revenues: initialRevenues,
}: {
  revenues: Revenue[];
}) {
  const router = useRouter();
  const [revenues, setRevenues] = useState(initialRevenues);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Revenue | null>(null);

  async function handleSubmit(formData: FormData) {
    const data = {
      year: parseInt(formData.get("year") as string),
      month: parseInt(formData.get("month") as string),
      category: formData.get("category") as string,
      amount: parseFloat(formData.get("amount") as string),
      description: (formData.get("description") as string) || undefined,
      recordDate: new Date(formData.get("recordDate") as string),
    };

    if (editing) {
      const updated = await updateRevenue(editing.id, data);
      setRevenues((prev) =>
        prev.map((r) => (r.id === editing.id ? { ...r, ...updated, recordDate: updated.recordDate.toISOString() } : r))
      );
    } else {
      const created = await createRevenue(data);
      setRevenues((prev) => [{
        ...created,
        recordDate: created.recordDate.toISOString(),
      } as Revenue, ...prev]);
    }

    setOpen(false);
    setEditing(null);
    router.refresh();
  }

  async function handleDelete(id: number) {
    await deleteRevenue(id);
    setRevenues((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

  async function handleExport() {
    const result = await exportRevenues();
    triggerDownload(result.base64, result.filename);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الإيرادات</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="me-2 size-4" />
            تصدير إلى Excel
          </Button>
          <ImportDialog type="revenue" onSuccess={() => router.refresh()} />
          <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger
            render={
              <Button onClick={() => setEditing(null)}>
                <Plus className="me-2 size-4" />
                إضافة إيراد
              </Button>
            }
          />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل إيراد" : "إضافة إيراد"}</DialogTitle>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="year">السنة *</Label>
                  <Input
                    id="year"
                    name="year"
                    type="number"
                    required
                    defaultValue={editing?.year ?? new Date().getFullYear()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="month">الشهر *</Label>
                  <Input
                    id="month"
                    name="month"
                    type="number"
                    min="1"
                    max="12"
                    required
                    defaultValue={editing?.month ?? new Date().getMonth() + 1}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">الفئة *</Label>
                <Input
                  id="category"
                  name="category"
                  required
                  defaultValue={editing?.category ?? "رسوم دراسية"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">المبلغ *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  defaultValue={editing?.amount ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recordDate">التاريخ *</Label>
                <Input
                  id="recordDate"
                  name="recordDate"
                  type="date"
                  required
                  defaultValue={editing ? format(new Date(editing.recordDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">وصف</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={2}
                  defaultValue={editing?.description ?? ""}
                />
              </div>
              <Button type="submit" className="w-full">
                {editing ? "حفظ التعديلات" : "إضافة الإيراد"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="py-3 px-4 text-end">#</th>
              <th className="py-3 px-4 text-start">التاريخ</th>
              <th className="py-3 px-4 text-start">الفئة</th>
              <th className="py-3 px-4 text-start">الوصف</th>
              <th className="py-3 px-4 text-start">المصدر</th>
              <th className="py-3 px-4 text-end">المبلغ</th>
              <th className="py-3 px-4 text-end">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {revenues.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  لا توجد إيرادات
                </td>
              </tr>
            ) : (
              revenues.map((r, i) => (
                <tr key={r.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4 text-end">{i + 1}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {format(new Date(r.recordDate), "dd/MM/yyyy")}
                  </td>
                  <td className="py-3 px-4">{r.category}</td>
                  <td className="py-3 px-4 max-w-xs truncate">
                    {r.description ?? "—"}
                  </td>
                  <td className="py-3 px-4">{r.source ?? "—"}</td>
                  <td className="py-3 px-4 text-end font-medium">
                    {r.amount.toFixed(2)} د.أ
                  </td>
                  <td className="py-3 px-4 text-end">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
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
