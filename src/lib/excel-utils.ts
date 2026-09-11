import ExcelJS from "exceljs";
import { MONTH_NAMES } from "@/lib/months";
import { roundMoney } from "@/lib/utils";

export const MONTH_INDEX: Record<string, number> = {
  "يناير": 1, "فبراير": 2, "مارس": 3, "إبريل": 4,
  "مايو": 5, "يونيو": 6, "يوليو": 7, "أغسطس": 8,
  "سبتمبر": 9, "أكتوبر": 10, "نوفمبر": 11, "ديسمبر": 12,
};

export interface RevenueRow {
  year: number;
  month: number;
  category: string;
  amount: number;
  description: string | null;
  source: string | null;
  date: Date;
}

export interface ExpenseRow {
  year: number;
  month: number;
  category: string;
  amount: number;
  description: string | null;
  vendor: string | null;
  date: Date;
}

export interface StudentBalanceRow {
  name: string;
  grade: string;
  academicYear: string;
  balance: number;
}

function applyRtlSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ rightToLeft: true }];
}

/** Right-aligns every data cell -- rightToLeft only flips column order and
 * reading direction, it doesn't change individual cells' text alignment,
 * which otherwise defaults to left for numbers and General for text. */
function rightAlignColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    col.alignment = { horizontal: "right" };
  });
}

/**
 * Prefixes a leading apostrophe (Excel's "treat as text" escape) on any
 * value starting with =, +, -, or @ before writing it into a cell.
 * Without this, a student/vendor/category name typed as e.g.
 * "=HYPERLINK(...)" gets written as a live formula and executes when the
 * exported file is opened in Excel/LibreOffice -- classic CSV/XLSX
 * formula-injection risk on any free-text field that reaches an export.
 */
function sanitizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function styleHeader(sheet: ExcelJS.Worksheet, colCount: number) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center" };
  for (let c = 1; c <= colCount; c++) {
    headerRow.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
  }
}

function monthLabel(month: number): string {
  return MONTH_NAMES[month - 1] || String(month);
}

function sortRows<T extends { year: number; month: number; date: Date }>(data: T[]): T[] {
  return [...data].sort(
    (a, b) => a.year - b.year || a.month - b.month || a.date.getTime() - b.date.getTime()
  );
}

function monthlyTotals(data: Array<{ year: number; month: number; amount: number }>) {
  const totals = new Map<string, { year: number; month: number; count: number; total: number }>();
  for (const row of data) {
    const key = `${row.year}-${row.month}`;
    const current = totals.get(key) ?? { year: row.year, month: row.month, count: 0, total: 0 };
    current.count += 1;
    current.total = roundMoney(current.total + row.amount);
    totals.set(key, current);
  }
  return [...totals.values()].sort((a, b) => a.year - b.year || a.month - b.month);
}

function addMonthlySummarySheet(
  workbook: ExcelJS.Workbook,
  data: Array<{ year: number; month: number; amount: number }>,
  sheetName = "المجموع الشهري"
) {
  const sheet = workbook.addWorksheet(sheetName);
  applyRtlSheet(sheet);

  sheet.columns = [
    { header: "السنة", key: "year", width: 12 },
    { header: "الشهر", key: "month", width: 16 },
    { header: "عدد القيود", key: "count", width: 14 },
    { header: "المجموع", key: "total", width: 16 },
  ];

  rightAlignColumns(sheet);
  styleHeader(sheet, 4);

  const months = monthlyTotals(data);
  let grandTotal = 0;
  let grandCount = 0;

  for (const row of months) {
    grandTotal = roundMoney(grandTotal + row.total);
    grandCount += row.count;
    sheet.addRow({
      year: row.year,
      month: monthLabel(row.month),
      count: row.count,
      total: row.total,
    });
  }

  const totalRow = sheet.addRow({
    year: "",
    month: "الإجمالي",
    count: grandCount,
    total: grandTotal,
  });
  totalRow.font = { bold: true };

  sheet.getColumn("total").numFmt = "#,##0.000";
}

function addRevenueDetailSheet(workbook: ExcelJS.Workbook, data: RevenueRow[]) {
  const sheet = workbook.addWorksheet("الإيرادات");
  applyRtlSheet(sheet);

  sheet.columns = [
    { header: "السنة", key: "year", width: 10 },
    { header: "الشهر", key: "month", width: 14 },
    { header: "الفئة", key: "category", width: 22 },
    { header: "المبلغ", key: "amount", width: 14 },
    { header: "الوصف", key: "description", width: 32 },
    { header: "المصدر", key: "source", width: 18 },
    { header: "التاريخ", key: "date", width: 16 },
  ];

  rightAlignColumns(sheet);
  styleHeader(sheet, 7);

  for (const row of sortRows(data)) {
    sheet.addRow({
      year: row.year,
      month: monthLabel(row.month),
      category: sanitizeCell(row.category),
      amount: row.amount,
      description: sanitizeCell(row.description ?? ""),
      source: sanitizeCell(row.source ?? ""),
      date: row.date.toLocaleDateString("ar"),
    });
  }

  sheet.getColumn("amount").numFmt = "#,##0.000";
}

function addExpenseDetailSheet(workbook: ExcelJS.Workbook, data: ExpenseRow[]) {
  const sheet = workbook.addWorksheet("المصروفات");
  applyRtlSheet(sheet);

  sheet.columns = [
    { header: "السنة", key: "year", width: 10 },
    { header: "الشهر", key: "month", width: 14 },
    { header: "الفئة", key: "category", width: 22 },
    { header: "المبلغ", key: "amount", width: 14 },
    { header: "الوصف", key: "description", width: 32 },
    { header: "البائع", key: "vendor", width: 20 },
    { header: "التاريخ", key: "date", width: 16 },
  ];

  rightAlignColumns(sheet);
  styleHeader(sheet, 7);

  for (const row of sortRows(data)) {
    sheet.addRow({
      year: row.year,
      month: monthLabel(row.month),
      category: sanitizeCell(row.category),
      amount: row.amount,
      description: sanitizeCell(row.description ?? ""),
      vendor: sanitizeCell(row.vendor ?? ""),
      date: row.date.toLocaleDateString("ar"),
    });
  }

  sheet.getColumn("amount").numFmt = "#,##0.000";
}

function addCombinedTotalsSheet(
  workbook: ExcelJS.Workbook,
  revenues: RevenueRow[],
  expenses: ExpenseRow[]
) {
  const sheet = workbook.addWorksheet("الإجمالي");
  applyRtlSheet(sheet);

  sheet.columns = [
    { header: "السنة", key: "year", width: 12 },
    { header: "الشهر", key: "month", width: 16 },
    { header: "الإيرادات", key: "revenue", width: 16 },
    { header: "المصروفات", key: "expense", width: 16 },
    { header: "الصافي", key: "net", width: 16 },
  ];

  rightAlignColumns(sheet);
  styleHeader(sheet, 5);

  const combined = new Map<string, { year: number; month: number; revenue: number; expense: number }>();
  for (const row of monthlyTotals(revenues)) {
    combined.set(`${row.year}-${row.month}`, {
      year: row.year,
      month: row.month,
      revenue: row.total,
      expense: 0,
    });
  }
  for (const row of monthlyTotals(expenses)) {
    const key = `${row.year}-${row.month}`;
    const current = combined.get(key) ?? { year: row.year, month: row.month, revenue: 0, expense: 0 };
    current.expense = row.total;
    combined.set(key, current);
  }

  const months = [...combined.values()].sort((a, b) => a.year - b.year || a.month - b.month);
  let totalRevenue = 0;
  let totalExpense = 0;

  for (const row of months) {
    totalRevenue = roundMoney(totalRevenue + row.revenue);
    totalExpense = roundMoney(totalExpense + row.expense);
    sheet.addRow({
      year: row.year,
      month: monthLabel(row.month),
      revenue: row.revenue,
      expense: row.expense,
      net: roundMoney(row.revenue - row.expense),
    });
  }

  const totalRow = sheet.addRow({
    year: "",
    month: "الإجمالي",
    revenue: totalRevenue,
    expense: totalExpense,
    net: roundMoney(totalRevenue - totalExpense),
  });
  totalRow.font = { bold: true };

  sheet.getColumn("revenue").numFmt = "#,##0.000";
  sheet.getColumn("expense").numFmt = "#,##0.000";
  sheet.getColumn("net").numFmt = "#,##0.000";
}

async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportRevenuesToExcel(data: RevenueRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  addRevenueDetailSheet(workbook, data);
  addMonthlySummarySheet(workbook, data);
  return workbookToBuffer(workbook);
}

export async function exportExpensesToExcel(data: ExpenseRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  addExpenseDetailSheet(workbook, data);
  addMonthlySummarySheet(workbook, data);
  return workbookToBuffer(workbook);
}

export async function exportFinancialsToExcel(
  revenues: RevenueRow[],
  expenses: ExpenseRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  addRevenueDetailSheet(workbook, revenues);
  addMonthlySummarySheet(workbook, revenues, "مجموع الإيرادات");
  addExpenseDetailSheet(workbook, expenses);
  addMonthlySummarySheet(workbook, expenses, "مجموع المصروفات");
  addCombinedTotalsSheet(workbook, revenues, expenses);
  return workbookToBuffer(workbook);
}

export async function exportStudentBalancesToExcel(data: StudentBalanceRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("أرصدة الطلاب");
  applyRtlSheet(sheet);

  sheet.columns = [
    { header: "الاسم", key: "name", width: 28 },
    { header: "الصف", key: "grade", width: 16 },
    { header: "السنة الدراسية", key: "academicYear", width: 18 },
    { header: "الرصيد", key: "balance", width: 14 },
  ];

  rightAlignColumns(sheet);
  styleHeader(sheet, 4);

  for (const row of data) {
    sheet.addRow({
      name: sanitizeCell(row.name),
      grade: row.grade,
      academicYear: row.academicYear,
      balance: row.balance,
    });
  }

  sheet.getColumn("balance").numFmt = "#,##0.000";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
