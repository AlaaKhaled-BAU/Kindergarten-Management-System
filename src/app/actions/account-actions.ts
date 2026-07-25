"use server";

import { logEvent } from "@/lib/logger";
import { setSetting } from "@/lib/settings";
import { hashPassword } from "@/lib/password";
import { requireAdmin, validateRequiredString } from "./validation";

export async function setTeacherPassword(password: string): Promise<void> {
  const actor = await requireAdmin();

  validateRequiredString(password, "كلمة المرور");
  if (password.length < 4) {
    throw new Error("كلمة المرور يجب أن تتكون من 4 أحرف على الأقل");
  }

  await setSetting("teacherPasswordHash", hashPassword(password));
  await logEvent("teacher_password_set", { actor });
}
