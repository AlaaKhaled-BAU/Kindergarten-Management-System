import ExcelJS from "exceljs";
import { MONTH_NAMES } from "@/lib/months";

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

const SUM_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFF00" },
};

function styleSumCells(row: ExcelJS.Row, columnKeys: string[], bold = false) {
  for (const key of columnKeys) {
    const cell = row.getCell(key);
    cell.fill = SUM_ROW_FILL;
    if (bold) cell.font = { bold: true };
  }
}

const MONTHLY_SUM_COLUMNS = ["count", "total"] as const;
const COMBINED_SUM_COLUMNS = ["revenue", "expense", "net"] as const;

function monthLabel(month: number): string {
  return MONTH_NAMES[month - 1] || String(month);
}

function sortRows<T extends { year: number; month: number; date: Date }>(data: T[]): T[] {
  return [...data].sort(
    (a, b) => a.year - b.year || a.month - b.month || a.date.getTime() - b.date.getTime()
  );
}

function uniqueYearMonths(data: Array<{ year: number; month: number }>) {
  const map = new Map<string, { year: number; month: number }>();
  for (const row of data) {
    map.set(`${row.year}-${row.month}`, { year: row.year, month: row.month });
  }
  return [...map.values()].sort((a, b) => a.year - b.year || a.month - b.month);
}

/** Fixed ranges on detail sheets — users can add rows within these rows and formulas update. */
const DETAIL_FIRST_ROW = 2;
const DETAIL_LAST_ROW = 501;

function detailColumnRange(sheetName: string, column: string): string {
  return `'${sheetName}'!$${column}$${DETAIL_FIRST_ROW}:$${column}$${DETAIL_LAST_ROW}`;
}

function sumifsFormula(
  amountColumn: string,
  sheetName: string,
  summaryRow: number
): string {
  const amount = detailColumnRange(sheetName, amountColumn);
  const year = detailColumnRange(sheetName, "A");
  const month = detailColumnRange(sheetName, "B");
  return `SUMIFS(${amount},${year},A${summaryRow},${month},B${summaryRow})`;
}

function countifsFormula(sheetName: string, summaryRow: number): string {
  const year = detailColumnRange(sheetName, "A");
  const month = detailColumnRange(sheetName, "B");
  return `COUNTIFS(${year},A${summaryRow},${month},B${summaryRow})`;
}

const REVENUE_SHEET = "الإيرادات";
const EXPENSE_SHEET = "المصروفات";
const AMOUNT_COLUMN = "D";

function addMonthlySummarySheet(
  workbook: ExcelJS.Workbook,
  data: Array<{ year: number; month: number }>,
  options: {
    sheetName?: string;
    detailSheetName: string;
  }
) {
  const sheetName = options.sheetName ?? "المجموع الشهري";
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

  const months = uniqueYearMonths(data);
  const firstDataRow = 2;
  const lastDataRow = months.length > 0 ? firstDataRow + months.length - 1 : firstDataRow;

  for (const row of months) {
    const excelRow = sheet.addRow({
      year: row.year,
      month: monthLabel(row.month),
    });
    const r = excelRow.number;
    excelRow.getCell("count").value = {
      formula: countifsFormula(options.detailSheetName, r),
    };
    excelRow.getCell("total").value = {
      formula: sumifsFormula(AMOUNT_COLUMN, options.detailSheetName, r),
    };
    styleSumCells(excelRow, [...MONTHLY_SUM_COLUMNS]);
  }

  const totalRow = sheet.addRow({
    year: "",
    month: "الإجمالي",
  });
  if (months.length > 0) {
    totalRow.getCell("count").value = { formula: `SUM(C${firstDataRow}:C${lastDataRow})` };
    totalRow.getCell("total").value = { formula: `SUM(D${firstDataRow}:D${lastDataRow})` };
  } else {
    totalRow.getCell("count").value = 0;
    totalRow.getCell("total").value = 0;
  }
  styleSumCells(totalRow, [...MONTHLY_SUM_COLUMNS], true);

  sheet.getColumn("total").numFmt = "#,##0.000";
}

function addRevenueDetailSheet(workbook: ExcelJS.Workbook, data: RevenueRow[]) {
  const sheet = workbook.addWorksheet(REVENUE_SHEET);
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
  const sheet = workbook.addWorksheet(EXPENSE_SHEET);
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

  const combined = uniqueYearMonths([...revenues, ...expenses]);
  const firstDataRow = 2;
  const lastDataRow = combined.length > 0 ? firstDataRow + combined.length - 1 : firstDataRow;

  for (const row of combined) {
    const excelRow = sheet.addRow({
      year: row.year,
      month: monthLabel(row.month),
    });
    const r = excelRow.number;
    excelRow.getCell("revenue").value = {
      formula: sumifsFormula(AMOUNT_COLUMN, REVENUE_SHEET, r),
    };
    excelRow.getCell("expense").value = {
      formula: sumifsFormula(AMOUNT_COLUMN, EXPENSE_SHEET, r),
    };
    excelRow.getCell("net").value = { formula: `C${r}-D${r}` };
    styleSumCells(excelRow, [...COMBINED_SUM_COLUMNS]);
  }

  const totalRow = sheet.addRow({
    year: "",
    month: "الإجمالي",
  });
  if (combined.length > 0) {
    totalRow.getCell("revenue").value = { formula: `SUM(C${firstDataRow}:C${lastDataRow})` };
    totalRow.getCell("expense").value = { formula: `SUM(D${firstDataRow}:D${lastDataRow})` };
    totalRow.getCell("net").value = { formula: `SUM(E${firstDataRow}:E${lastDataRow})` };
  } else {
    totalRow.getCell("revenue").value = 0;
    totalRow.getCell("expense").value = 0;
    totalRow.getCell("net").value = 0;
  }
  styleSumCells(totalRow, [...COMBINED_SUM_COLUMNS], true);

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
  addMonthlySummarySheet(workbook, data, { detailSheetName: REVENUE_SHEET });
  return workbookToBuffer(workbook);
}

export async function exportExpensesToExcel(data: ExpenseRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  addExpenseDetailSheet(workbook, data);
  addMonthlySummarySheet(workbook, data, { detailSheetName: EXPENSE_SHEET });
  return workbookToBuffer(workbook);
}

export async function exportFinancialsToExcel(
  revenues: RevenueRow[],
  expenses: ExpenseRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  addRevenueDetailSheet(workbook, revenues);
  addMonthlySummarySheet(workbook, revenues, {
    sheetName: "مجموع الإيرادات",
    detailSheetName: REVENUE_SHEET,
  });
  addExpenseDetailSheet(workbook, expenses);
  addMonthlySummarySheet(workbook, expenses, {
    sheetName: "مجموع المصروفات",
    detailSheetName: EXPENSE_SHEET,
  });
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
