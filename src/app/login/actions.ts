"use server";

import { setAuthCookie } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logEvent } from "@/lib/logger";
import { timingSafeEqual } from "node:crypto";

function timingSafePasswordEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

interface LoginState {
  error?: string;
}

export async function adminLogin(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = formData.get("password") as string;

  if (!password || password.trim() === "") {
    return { error: "الرجاء إدخال كلمة المرور" };
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return { error: "خطأ في إعدادات النظام: كلمة مرور المسؤول غير معرفة" };
  }

  if (!timingSafePasswordEqual(password, adminPassword)) {
    return { error: "كلمة المرور غير صحيحة" };
  }

  await setAuthCookie("admin");
  await logEvent("login", { role: "admin" });
  redirect("/");
}

export async function teacherLogin(): Promise<never> {
  await setAuthCookie("teacher");
  await logEvent("login", { role: "teacher" });
  redirect("/students");
}
