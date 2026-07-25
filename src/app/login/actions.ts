"use server";

import { setAuthCookie } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logEvent } from "@/lib/logger";
import { getSetting } from "@/lib/settings";
import { verifyPassword } from "@/lib/password";

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

  const storedHash = await getSetting("adminPasswordHash");
  if (!storedHash) {
    return { error: "خطأ في إعدادات النظام: لم يتم إعداد كلمة مرور المسؤول بعد" };
  }

  if (!verifyPassword(password, storedHash)) {
    return { error: "كلمة المرور غير صحيحة" };
  }

  await setAuthCookie("admin");
  await logEvent("login", { role: "admin" });
  redirect("/");
}

export async function teacherLogin(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = formData.get("password") as string;

  if (!password || password.trim() === "") {
    return { error: "الرجاء إدخال كلمة المرور" };
  }

  const storedHash = await getSetting("teacherPasswordHash");
  if (!storedHash) {
    return { error: "لم يتم تفعيل حساب المعلم بعد. الرجاء التواصل مع المسؤول" };
  }

  if (!verifyPassword(password, storedHash)) {
    return { error: "كلمة المرور غير صحيحة" };
  }

  await setAuthCookie("teacher");
  await logEvent("login", { role: "teacher" });
  redirect("/students");
}
