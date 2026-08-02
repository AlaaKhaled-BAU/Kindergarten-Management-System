"use client";

import { errorMessage } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { withdrawStudent } from "@/app/actions/student-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogOut } from "lucide-react";

export function WithdrawButton({
  studentId,
  currentBalance,
}: {
  studentId: number;
  currentBalance: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(
    currentBalance > 0 ? currentBalance.toFixed(2) : "0"
  );

  async function handleConfirm() {
    setError(null);
    setPending(true);
    try {
      await withdrawStudent(studentId, parseFloat(remaining));
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <LogOut className="me-2 size-4" />
        تسجيل انسحاب
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل انسحاب الطالب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              الرصيد الحالي:{" "}
              <strong>
                {currentBalance > 0
                  ? `${currentBalance.toFixed(2)} د.أ (عليه)`
                  : "رصيد دائن / صفر"}
              </strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="remaining">المبلغ المتبقي على الطالب *</Label>
              <Input
                id="remaining"
                type="number"
                min="0"
                step="0.01"
                value={remaining}
                onChange={(e) => setRemaining(e.target.value)}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                أدخل المبلغ الذي سيبقى مستحقاً على الطالب بعد الانسحاب. المبلغ
                الأقل من الرصيد الحالي يُعفى.
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                تراجع
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirm}
                disabled={pending}
              >
                {pending ? "جارٍ التنفيذ..." : "تأكيد الانسحاب"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
