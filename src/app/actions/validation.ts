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
  if (typeof value !== "number" || isNaN(value) || !isFinite(value) || value <= 0) {
    throw new Error(`الحقل "${fieldName}" يجب أن يكون رقماً موجباً`);
  }
  if (Math.round(value * 1000) / 1000 === 0) {
    throw new Error(`الحقل "${fieldName}" أصغر من فلس واحد`);
  }
  if (value > MAX_AMOUNT) {
    throw new Error(`الحقل "${fieldName}" كبير جداً (الحد الأقصى ${MAX_AMOUNT} د.أ)`);
  }
}

export function validateNonNegativeNumber(
  value: unknown,
  fieldName: string
): asserts value is number {
  if (typeof value !== "number" || isNaN(value) || !isFinite(value) || value < 0) {
    throw new Error(`الحقل "${fieldName}" يجب أن يكون رقماً غير سالب`);
  }
  if (value > MAX_AMOUNT) {
    throw new Error(`الحقل "${fieldName}" كبير جداً (الحد الأقصى ${MAX_AMOUNT} د.أ)`);
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

const MIN_FIN_YEAR = 2000;
const MAX_AMOUNT = 1_000_000;
const MAX_FUTURE_MS = 366 * 24 * 60 * 60 * 1000;

export function assertValidFinancialDate(date: Date, fieldName: string): void {
  if (isNaN(date.getTime()) || date.getFullYear() < MIN_FIN_YEAR) {
    throw new Error(`تاريخ غير صالح في "${fieldName}"`);
  }
  if (date.getTime() > Date.now() + MAX_FUTURE_MS) {
    throw new Error(`تاريخ العملية في "${fieldName}" بعيد جداً في المستقبل`);
  }
}

export function assertMonthYear(month: number, year: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("الشهر يجب أن يكون رقماً صحيحاً بين 1 و 12");
  }
  if (!Number.isInteger(year) || year < MIN_FIN_YEAR || year > 2100) {
    throw new Error("السنة غير صالحة");
  }
}
