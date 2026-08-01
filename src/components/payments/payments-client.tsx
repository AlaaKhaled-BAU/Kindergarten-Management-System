"use client";

import { errorMessage } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { processPayment, cancelReceipt } from "@/app/actions/payment-actions";
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
import { Textarea } from "@/components/ui/textarea";
import { XCircle, Search } from "lucide-react";
import { format } from "date-fns";

interface Receipt {
  id: number;
  receiptNumber: number;
  amount: number;
  issueDate: string;
  studentName: string;
  isCanceled: boolean;
  cancelReason?: string | null;
  payment: {
    id: number;
    studentId: number;
    paymentMethod: string;
    referenceNumber?: string | null;
    notes?: string | null;
  };
}

interface Student {
  id: number;
  firstName: string;
  lastName: string;
}

export function PaymentsPageClient({
  receipts: initialReceipts,
  students,
  canCancel,
}: {
  receipts: Receipt[];
  students: Student[];
  canCancel: boolean;
}) {
  const router = useRouter();
  const [receipts, setReceipts] = useState(initialReceipts);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [pending, setPending] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const filtered = receipts.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.studentName.toLowerCase().includes(q) ||
      r.receiptNumber.toString().includes(q)
    );
  });

  async function handlePayment(formData: FormData) {
    setPaymentError(null);
    setPending(true);
    try {
      const result = await processPayment({
        studentId: parseInt(formData.get("studentId") as string),
        amount: parseFloat(formData.get("amount") as string),
        paymentDate: new Date(formData.get("paymentDate") as string),
        paymentMethod: formData.get("paymentMethod") as string,
        referenceNumber: (formData.get("referenceNumber") as string) || undefined,
        notes: (formData.get("notes") as string) || undefined,
      });

      setReceipts((prev) => [
        {
          ...result.receipt,
          issueDate: result.receipt.issueDate.toISOString(),
          isCanceled: false,
          cancelReason: null,
          payment: result.payment,
        },
        ...prev,
      ]);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setPaymentError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function handleCancel(formData: FormData) {
    if (!selectedReceipt) return;
    const reason = formData.get("reason") as string;

    setCancelError(null);
    setPending(true);
    try {
      await cancelReceipt({
        receiptId: selectedReceipt.id,
        reason,
      });

      setReceipts((prev) =>
        prev.map((r) =>
          r.id === selectedReceipt.id
            ? { ...r, isCanceled: true, cancelReason: reason }
            : r
        )
      );
      setCancelOpen(false);
      setSelectedReceipt(null);
      router.refresh();
    } catch (err) {
      setCancelError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const paymentMethods = ["نقداً", "شيك", "تحويل بنكي", "بطاقة ائتمان"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">المدفوعات والإيصالات</h1>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setPaymentError(null);
          }}
        >
          <DialogTrigger
            render={<Button className="w-full sm:w-auto">إصدار سند قبض جديد</Button>}
          />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>إصدار سند قبض</DialogTitle>
            </DialogHeader>
            <form action={handlePayment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="studentId">الطالب *</Label>
                <Select name="studentId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الطالب" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.firstName} {s.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentDate">تاريخ الدفع *</Label>
                <Input
                  id="paymentDate"
                  name="paymentDate"
                  type="date"
                  defaultValue={format(new Date(), "yyyy-MM-dd")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">طريقة الدفع</Label>
                <Select name="paymentMethod" defaultValue="نقداً">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="referenceNumber">رقم مرجعي</Label>
                <Input id="referenceNumber" name="referenceNumber" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
              {paymentError && (
                <p className="text-sm text-destructive" role="alert">
                  {paymentError}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "جارٍ الإصدار..." : "إصدار الإيصال"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="بحث..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pe-9"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="py-3 px-4 text-start">رقم الإيصال</th>
              <th className="py-3 px-4 text-start">الطالب</th>
              <th className="py-3 px-4 text-end">المبلغ</th>
              <th className="py-3 px-4 text-start">التاريخ</th>
              <th className="py-3 px-4 text-start">طريقة الدفع</th>
              <th className="py-3 px-4 text-center">الحالة</th>
              <th className="py-3 px-4 text-end">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  لا توجد إيصالات
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4 font-medium">{r.receiptNumber}</td>
                  <td className="py-3 px-4">{r.studentName}</td>
                  <td className="py-3 px-4 text-end font-medium">
                    {r.amount.toFixed(2)} د.أ
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {format(new Date(r.issueDate), "dd/MM/yyyy")}
                  </td>
                  <td className="py-3 px-4">{r.payment.paymentMethod}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.isCanceled
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {r.isCanceled ? "ملغي" : "ساري"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-end">
                    {!r.isCanceled && canCancel && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="إلغاء الإيصال"
                        className="text-destructive hover:text-destructive h-auto px-2"
                        onClick={() => {
                          setCancelError(null);
                          setSelectedReceipt(r);
                          setCancelOpen(true);
                        }}
                      >
                        <XCircle className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إلغاء الإيصال</DialogTitle>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                سيتم إلغاء الإيصال رقم{" "}
                <strong>{selectedReceipt.receiptNumber}</strong> — المبلغ:{" "}
                <strong>{selectedReceipt.amount.toFixed(2)} د.أ</strong> —
                الطالب: <strong>{selectedReceipt.studentName}</strong>
              </p>
              <form action={handleCancel} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reason">سبب الإلغاء *</Label>
                  <Textarea id="reason" name="reason" required rows={3} />
                </div>
                {cancelError && (
                  <p className="text-sm text-destructive" role="alert">
                    {cancelError}
                  </p>
                )}
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCancelOpen(false)}
                    disabled={pending}
                  >
                    تراجع
                  </Button>
                  <Button type="submit" variant="destructive" disabled={pending}>
                    {pending ? "جارٍ الإلغاء..." : "تأكيد الإلغاء"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
