"use client";

import { errorMessage } from "@/lib/utils";
import { useState } from "react";
import { setTeacherPassword } from "@/app/actions/account-actions";
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
import { KeyRound } from "lucide-react";

export function TeacherPasswordButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      const password = formData.get("password") as string;
      const confirm = formData.get("confirmPassword") as string;
      if (password !== confirm) {
        throw new Error("كلمتا المرور غير متطابقتين");
      }
      await setTeacherPassword(password);
      setSuccess(true);
      setTimeout(() => setOpen(false), 1200);
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
        if (!v) {
          setError(null);
          setSuccess(false);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          >
            <KeyRound className="size-4" />
            كلمة مرور المعلم
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعيين كلمة مرور المعلم</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="teacher-password">كلمة المرور الجديدة</Label>
            <Input id="teacher-password" name="password" type="password" required minLength={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teacher-password-confirm">تأكيد كلمة المرور</Label>
            <Input id="teacher-password-confirm" name="confirmPassword" type="password" required minLength={4} />
          </div>
          {success && <p className="text-sm text-success">تم الحفظ بنجاح</p>}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "جارٍ الحفظ..." : "حفظ"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
