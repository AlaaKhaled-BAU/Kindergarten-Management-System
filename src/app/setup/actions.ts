"use server";

import { setAuthCookie } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logEvent } from "@/lib/logger";
import { getSetting, setSetting } from "@/lib/settings";
import { hashPassword } from "@/lib/password";

interface SetupState {
  error?: string;
}

export async function completeSetup(
  _prevState: SetupState,
  formData: FormData
): Promise<SetupState> {
  // Defense in depth -- proxy.ts already makes /setup unreachable once
  // configured, but a direct POST to the action shouldn't be able to
  // reset an already-configured install's password either.
  if (await getSetting("adminPasswordHash")) {
    redirect("/login");
  }

  const kindergartenName = (formData.get("kindergartenName") as string)?.trim();
  const password = formData.get("password") as string;
  const confirm = formData.get("confirmPassword") as string;

  if (!kindergartenName) {
    return { error: "الرجاء إدخال اسم الروضة" };
  }
  if (!password || password.length < 4) {
    return { error: "كلمة المرور يجب أن تتكون من 4 أحرف على الأقل" };
  }
  if (password !== confirm) {
    return { error: "كلمتا المرور غير متطابقتين" };
  }

  await setSetting("kindergartenName", kindergartenName);
  await setSetting("adminPasswordHash", hashPassword(password));

  await setAuthCookie("admin");
  await logEvent("setup_completed", { kindergartenName });
  redirect("/");
}
