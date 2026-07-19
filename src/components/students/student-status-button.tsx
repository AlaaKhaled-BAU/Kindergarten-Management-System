"use client";

import { errorMessage } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setStudentActive } from "@/app/actions/student-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function StudentStatusButton({
  studentId,
  isActive,
}: {
  studentId: number;
  isActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setPending(true);
    try {
      await setStudentActive(studentId, !isActive);
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
      <div className="flex items-center gap-2">
        <Badge variant={isActive ? "default" : "secondary"}>
          {isActive ? "نشط" : "غير نشط"}
        </Badge>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {isActive ? "إلغاء تفعيل" : "إعادة تفعيل"}
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isActive ? "إلغاء تفعيل الطالب" : "إعادة تفعيل الطالب"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isActive
                ? "سيتم نقل الطالب إلى غير نشط. يبقى رصيده وسجل معاملاته كما هو ويمكن إعادة تفعيله لاحقاً."
                : "سيتم إعادة تفعيل الطالب وظهوره في القوائم النشطة مجدداً."}
            </p>
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
                variant={isActive ? "destructive" : "default"}
                onClick={handleConfirm}
                disabled={pending}
              >
                {pending ? "جارٍ التنفيذ..." : isActive ? "تأكيد إلغاء التفعيل" : "تأكيد إعادة التفعيل"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
