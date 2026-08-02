import ExcelJS from "exceljs";

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

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

export async function exportRevenuesToExcel(data: RevenueRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
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

  for (const row of data) {
    sheet.addRow({
      year: row.year,
      month: MONTH_NAMES[row.month - 1] || String(row.month),
      category: sanitizeCell(row.category),
      amount: row.amount,
      description: sanitizeCell(row.description ?? ""),
      source: sanitizeCell(row.source ?? ""),
      date: row.date.toLocaleDateString("ar"),
    });
  }

  sheet.getColumn("amount").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportExpensesToExcel(data: ExpenseRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
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

  for (const row of data) {
    sheet.addRow({
      year: row.year,
      month: MONTH_NAMES[row.month - 1] || String(row.month),
      category: sanitizeCell(row.category),
      amount: row.amount,
      description: sanitizeCell(row.description ?? ""),
      vendor: sanitizeCell(row.vendor ?? ""),
      date: row.date.toLocaleDateString("ar"),
    });
  }

  sheet.getColumn("amount").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
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

  sheet.getColumn("balance").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
