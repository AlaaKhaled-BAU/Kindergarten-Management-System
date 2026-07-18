"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "./validation";
import { MONTH_INDEX } from "@/lib/excel-utils";
import { logEvent } from "@/lib/logger";
import ExcelJS from "exceljs";

function parseMonth(raw: unknown): number {
  if (typeof raw === "number" && raw >= 1 && raw <= 12) return raw;
  const str = String(raw ?? "").trim();
  const num = parseInt(str);
  if (!isNaN(num) && num >= 1 && num <= 12) return num;
  const idx = MONTH_INDEX[str];
  if (idx) return idx;
  throw new Error(`اسم الشهر غير معروف: "${str}"`);
}

function parseAmount(raw: unknown): number {
  if (typeof raw === "number") {
    if (isNaN(raw)) throw new Error("المبلغ غير صالح");
    return raw;
  }
  const str = String(raw ?? "").trim();
  const val = parseFloat(str);
  if (isNaN(val)) throw new Error(`المبلغ غير صالح: "${str}"`);
  return val;
}

function parseDate(raw: unknown): Date {
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) throw new Error("التاريخ غير صالح");
    return raw;
  }
  const str = String(raw ?? "").trim();
  const d = new Date(str);
  if (isNaN(d.getTime())) throw new Error(`التاريخ غير صالح: "${str}"`);
  return d;
}

function parseYear(raw: unknown): number {
  if (typeof raw === "number") {
    const year = Math.floor(raw);
    if (year < 2000 || year > 2100) throw new Error(`السنة غير صالحة: ${year}`);
    return year;
  }
  const str = String(raw ?? "").trim();
  const year = parseInt(str);
  if (isNaN(year) || year < 2000 || year > 2100) throw new Error(`السنة غير صالحة: "${str}"`);
  return year;
}

export async function importRevenues(formData: FormData) {
  await requireAuth();

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("لم يتم اختيار ملف");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("الملف لا يحتوي على بيانات");

  const errors: string[] = [];
  const rows: {
    year: number;
    month: number;
    category: string;
    amount: number;
    description: string | null;
    recordDate: Date;
    source: string | null;
  }[] = [];

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const yearCell = row.getCell(1).value;
    if (yearCell === null || yearCell === undefined || String(yearCell).trim() === "") continue;

    try {
      const year = parseYear(yearCell);
      const month = parseMonth(row.getCell(2).value);
      const category = String(row.getCell(3).value ?? "").trim();
      const amount = parseAmount(row.getCell(4).value);
      if (amount <= 0) throw new Error("المبلغ يجب أن يكون موجباً");
      if (!category) throw new Error("الفئة مطلوبة");
      const description = row.getCell(5).value
        ? String(row.getCell(5).value).trim()
        : null;
      const source = row.getCell(6).value
        ? String(row.getCell(6).value).trim()
        : null;
      const recordDate = parseDate(row.getCell(7).value);

      rows.push({ year, month, category, amount, description, recordDate, source });
    } catch (err) {
      errors.push(`صف ${i}: ${err instanceof Error ? err.message : "بيانات غير صالحة"}`);
    }
  }

  if (rows.length === 0) {
    throw new Error("لا توجد بيانات صالحة للاستيراد");
  }

  const inserted = await prisma.$transaction(
    rows.map((r) =>
      prisma.revenue.create({
        data: {
          year: r.year,
          month: r.month,
          category: r.category,
          amount: r.amount,
          description: r.description,
          recordDate: r.recordDate,
          source: r.source ?? "Import",
        },
      })
    )
  );

  await logEvent("import", { type: "revenue", inserted: inserted.length, errors: errors.length });
  return { success: inserted.length, errors };
}

export async function importExpenses(formData: FormData) {
  await requireAuth();

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("لم يتم اختيار ملف");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("الملف لا يحتوي على بيانات");

  const errors: string[] = [];
  const rows: {
    year: number;
    month: number;
    category: string;
    amount: number;
    description: string | null;
    vendor: string | null;
    expenseDate: Date;
  }[] = [];

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const yearCell = row.getCell(1).value;
    if (yearCell === null || yearCell === undefined || String(yearCell).trim() === "") continue;

    try {
      const year = parseYear(yearCell);
      const month = parseMonth(row.getCell(2).value);
      const category = String(row.getCell(3).value ?? "").trim();
      const amount = parseAmount(row.getCell(4).value);
      if (amount <= 0) throw new Error("المبلغ يجب أن يكون موجباً");
      if (!category) throw new Error("الفئة مطلوبة");
      const description = row.getCell(5).value
        ? String(row.getCell(5).value).trim()
        : null;
      const vendor = row.getCell(6).value
        ? String(row.getCell(6).value).trim()
        : null;
      const expenseDate = parseDate(row.getCell(7).value);

      rows.push({ year, month, category, amount, description, vendor, expenseDate });
    } catch (err) {
      errors.push(`صف ${i}: ${err instanceof Error ? err.message : "بيانات غير صالحة"}`);
    }
  }

  if (rows.length === 0) {
    throw new Error("لا توجد بيانات صالحة للاستيراد");
  }

  const inserted = await prisma.$transaction(
    rows.map((r) =>
      prisma.expense.create({
        data: {
          year: r.year,
          month: r.month,
          category: r.category,
          amount: r.amount,
          description: r.description,
          vendor: r.vendor,
          expenseDate: r.expenseDate,
          source: "Import",
        },
      })
    )
  );

  await logEvent("import", { type: "expense", inserted: inserted.length, errors: errors.length });
  return { success: inserted.length, errors };
}

export async function previewRevenueImport(formData: FormData) {
  await requireAuth();

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("لم يتم اختيار ملف");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("الملف لا يحتوي على بيانات");

  const headers: string[] = [];
  const headerRow = sheet.getRow(1);
  for (let c = 1; c <= headerRow.cellCount; c++) {
    headers.push(String(headerRow.getCell(c).value ?? ""));
  }

  const preview: Record<string, unknown>[] = [];
  const maxPreview = Math.min(sheet.rowCount, 6);
  for (let i = 2; i <= maxPreview; i++) {
    const row = sheet.getRow(i);
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = row.getCell(idx + 1).value;
    });
    preview.push(obj);
  }

  return { headers, preview, totalRows: Math.max(0, sheet.rowCount - 1) };
}

export async function previewExpenseImport(formData: FormData) {
  await requireAuth();

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("لم يتم اختيار ملف");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("الملف لا يحتوي على بيانات");

  const headers: string[] = [];
  const headerRow = sheet.getRow(1);
  for (let c = 1; c <= headerRow.cellCount; c++) {
    headers.push(String(headerRow.getCell(c).value ?? ""));
  }

  const preview: Record<string, unknown>[] = [];
  const maxPreview = Math.min(sheet.rowCount, 6);
  for (let i = 2; i <= maxPreview; i++) {
    const row = sheet.getRow(i);
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = row.getCell(idx + 1).value;
    });
    preview.push(obj);
  }

  return { headers, preview, totalRows: Math.max(0, sheet.rowCount - 1) };
}
