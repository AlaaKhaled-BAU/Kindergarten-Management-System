"use client";

import { useActionState } from "react";
import { adminLogin, teacherLogin } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, User } from "lucide-react";

const initialState: { error?: string } = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(adminLogin, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">تسجيل الدخول</CardTitle>
          <p className="text-muted-foreground text-sm">
            نظام إدارة الروضة
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور (للمسؤول)</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="أدخل كلمة مرور المسؤول"
                disabled={isPending}
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive font-medium">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              <LogIn className="me-2 size-4" />
              {isPending ? "جاري الدخول..." : "دخول كمسؤول"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">أو</span>
            </div>
          </div>

          <form action={teacherLogin}>
            <Button
              type="submit"
              variant="outline"
              className="w-full"
            >
              <User className="me-2 size-4" />
              دخول كمعلم
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
