"use client";

import { useActionState } from "react";
import { completeSetup } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

const initialState: { error?: string } = {};

export default function SetupPage() {
  const [state, formAction, isPending] = useActionState(completeSetup, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">إعداد النظام لأول مرة</CardTitle>
          <p className="text-muted-foreground text-sm">
            قبل البدء، الرجاء تحديد اسم الروضة وكلمة مرور المسؤول
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kindergartenName">اسم الروضة</Label>
              <Input
                id="kindergartenName"
                name="kindergartenName"
                placeholder="مثال: روضة الأزهار"
                disabled={isPending}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة مرور المسؤول</Label>
              <Input
                id="password"
                name="password"
                type="password"
                disabled={isPending}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                disabled={isPending}
                required
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive font-medium" role="alert">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              <Sparkles className="me-2 size-4" />
              {isPending ? "جاري الإعداد..." : "بدء الاستخدام"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
