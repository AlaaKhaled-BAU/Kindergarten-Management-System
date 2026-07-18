import { getAuthRole } from "@/lib/auth";

export async function requireAuth(): Promise<"admin" | "teacher"> {
  const role = await getAuthRole();
  if (!role) {
    throw new Error("غير مصرح: الرجاء تسجيل الدخول");
  }
  return role;
}

export async function requireAdmin(): Promise<"admin"> {
  const role = await requireAuth();
  if (role !== "admin") {
    throw new Error("غير مصرح: يتطلب صلاحيات المسؤول");
  }
  return role;
}

export function validatePositiveNumber(
  value: unknown,
  fieldName: string
): asserts value is number {
  if (typeof value !== "number" || isNaN(value) || value <= 0) {
    throw new Error(`الحقل "${fieldName}" يجب أن يكون رقماً موجباً`);
  }
}

export function validateRequiredString(
  value: unknown,
  fieldName: string
): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`الحقل "${fieldName}" مطلوب`);
  }
}
