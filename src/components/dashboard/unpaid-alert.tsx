"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { UnpaidStudent } from "@/app/actions/student-actions";
import { format } from "date-fns";
import { gradeLabel } from "@/lib/grades";

export function UnpaidAlert({ students }: { students: UnpaidStudent[] }) {
  if (students.length === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-600" />
        <span className="text-sm font-medium">
          يوجد {students.length} طالب{" "}
          {students.length === 1 ? "لم يسدد" : "لم يسددوا"} هذا الشهر
        </span>
      </div>

      <Dialog>
        <DialogTrigger
          render={<Button variant="outline">عرض التفاصيل</Button>}
        />
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>الطلاب المتأخرون عن الدفع</DialogTitle>
          </DialogHeader>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-start">
                  <th className="pb-2 text-start font-medium text-muted-foreground">
                    الاسم
                  </th>
                  <th className="pb-2 text-start font-medium text-muted-foreground">
                    الصف
                  </th>
                  <th className="pb-2 text-start font-medium text-muted-foreground">
                    الرصيد المستحق
                  </th>
                  <th className="pb-2 text-start font-medium text-muted-foreground">
                    آخر دفعة
                  </th>
                  <th className="pb-2 text-start font-medium text-muted-foreground">
                    الحالة
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2">{gradeLabel(s.grade)}</td>
                    <td className="py-2">{s.balance.toFixed(2)} د.أ</td>
                    <td className="py-2">
                      {s.lastPaymentDate
                        ? format(new Date(s.lastPaymentDate), "dd/MM/yyyy")
                        : "—"}
                    </td>
                    <td className="py-2">
                      {s.hasPaidThisMonth ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-700"
                        >
                          مدفوع جزئياً
                        </Badge>
                      ) : (
                        <Badge variant="destructive">متأخر</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
