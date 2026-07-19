"use client";

import { errorMessage } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { processRefund } from "@/app/actions/refund-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RefundButton({ studentId }: { studentId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await processRefund({
        studentId,
        amount: parseFloat(formData.get("amount") as string),
        reason: formData.get("reason") as string,
        notes: (formData.get("notes") as string) || undefined,
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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setError(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline">استرداد نقدي</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>استرداد نقدي</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refund-amount">المبلغ *</Label>
            <Input
              id="refund-amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-reason">السبب *</Label>
            <Textarea id="refund-reason" name="reason" required rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-notes">ملاحظات</Label>
            <Textarea id="refund-notes" name="notes" rows={2} />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "جارٍ التنفيذ..." : "تأكيد الاسترداد"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
