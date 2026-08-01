"use client";

import { errorMessage } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createExpense, updateExpense, deleteExpense } from "@/app/actions/expense-actions";
import { exportExpenses } from "@/app/actions/export-actions";
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

interface Expense {
  id: number;
  year: number;
  month: number;
  category: string;
  amount: number;
  description: string | null;
  expenseDate: string;
  vendor: string | null;
  referenceNumber: string | null;
}

export function ExpensesPageClient({
  expenses: initialExpenses,
}: {
  expenses: Expense[];
}) {
  const router = useRouter();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      const data = {
        year: parseInt(formData.get("year") as string),
        month: parseInt(formData.get("month") as string),
        category: formData.get("category") as string,
        amount: parseFloat(formData.get("amount") as string),
        description: (formData.get("description") as string) || undefined,
        expenseDate: new Date(formData.get("expenseDate") as string),
        vendor: (formData.get("vendor") as string) || undefined,
        referenceNumber: (formData.get("referenceNumber") as string) || undefined,
      };

      if (editing) {
        const updated = await updateExpense(editing.id, data);
        setExpenses((prev) =>
          prev.map((e) => (e.id === editing.id ? { ...e, ...updated, expenseDate: updated.expenseDate.toISOString() } : e))
        );
      } else {
        const created = await createExpense(data);
        setExpenses((prev) => [{
          ...created,
          expenseDate: created.expenseDate.toISOString(),
        } as Expense, ...prev]);
      }

      setOpen(false);
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    setPending(true);
    try {
      await deleteExpense(deleteTarget.id);
      setExpenses((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function handleExport() {
    const result = await exportExpenses();
    triggerDownload(result.base64, result.filename);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">المصروفات</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="me-2 size-4" />
            تصدير إلى Excel
          </Button>
          <ImportDialog type="expense" onSuccess={() => router.refresh()} />
          <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setEditing(null);
              setError(null);
            }
          }}
        >
          <DialogTrigger
            render={
              <Button
                onClick={() => setEditing(null)}
              >
                <Plus className="me-2 size-4" />
                إضافة مصروف
              </Button>
            }
          />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل مصروف" : "إضافة مصروف"}</DialogTitle>
            </DialogHeader>
            <form
              action={handleSubmit}
              className="space-y-4"
            >
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
                  defaultValue={editing?.category ?? ""}
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
                <Label htmlFor="expenseDate">التاريخ *</Label>
                <Input
                  id="expenseDate"
                  name="expenseDate"
                  type="date"
                  required
                  defaultValue={editing ? format(new Date(editing.expenseDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">البائع</Label>
                <Input
                  id="vendor"
                  name="vendor"
                  defaultValue={editing?.vendor ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="referenceNumber">رقم مرجعي</Label>
                <Input
                  id="referenceNumber"
                  name="referenceNumber"
                  defaultValue={editing?.referenceNumber ?? ""}
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
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "جارٍ الحفظ..." : editing ? "حفظ التعديلات" : "إضافة المصروف"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="py-3 px-4 text-end">#</th>
              <th className="py-3 px-4 text-start">التاريخ</th>
              <th className="py-3 px-4 text-start">الفئة</th>
              <th className="py-3 px-4 text-start">الوصف</th>
              <th className="py-3 px-4 text-start">البائع</th>
              <th className="py-3 px-4 text-end">المبلغ</th>
              <th className="py-3 px-4 text-end">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  لا توجد مصروفات
                </td>
              </tr>
            ) : (
              expenses.map((e, i) => (
                <tr key={e.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4 text-end">{i + 1}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {format(new Date(e.expenseDate), "dd/MM/yyyy")}
                  </td>
                  <td className="py-3 px-4">{e.category}</td>
                  <td className="py-3 px-4 max-w-xs truncate">
                    {e.description ?? "—"}
                  </td>
                  <td className="py-3 px-4">{e.vendor ?? "—"}</td>
                  <td className="py-3 px-4 text-end font-medium">
                    {e.amount.toFixed(2)} د.أ
                  </td>
                  <td className="py-3 px-4 text-end">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="تعديل"
                        onClick={() => {
                          setEditing(e);
                          setError(null);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="حذف"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(e);
                        }}
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

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف المصروف</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                سيتم حذف مصروف <strong>{deleteTarget.category}</strong> بمبلغ{" "}
                <strong>{deleteTarget.amount.toFixed(2)} د.أ</strong> نهائياً. هذا
                الإجراء لا يمكن التراجع عنه.
              </p>
              {deleteError && (
                <p className="text-sm text-destructive" role="alert">
                  {deleteError}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={pending}
                >
                  تراجع
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={pending}
                >
                  {pending ? "جارٍ الحذف..." : "تأكيد الحذف"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
