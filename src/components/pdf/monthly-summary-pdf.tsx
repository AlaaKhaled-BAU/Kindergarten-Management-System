import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { formatDinarAmount } from "@/lib/tafqit";

// .ttf not .woff2 -- see the comment in receipt-pdf.tsx: fontkit's WOFF2
// decoder corrupts this font's loca table and crashes on Arabic text.
Font.register({
  family: "Scheherazade New",
  fonts: [
    { src: "/fonts/scheherazade-400.ttf", fontWeight: 400 },
    { src: "/fonts/scheherazade-700.ttf", fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: "Scheherazade New",
    fontSize: 9,
  },
  header: {
    textAlign: "right",
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 2,
  },
  periodText: {
    fontSize: 11,
    color: "#333",
  },
  table: {
    marginTop: 6,
  },
  tableHeader: {
    flexDirection: "row-reverse",
    backgroundColor: "#d1d5db",
    borderTop: "1.5pt solid #000",
    borderBottom: "1.5pt solid #000",
    borderLeft: "1.5pt solid #000",
    borderRight: "1.5pt solid #000",
  },
  tableRow: {
    flexDirection: "row-reverse",
    borderBottom: "1pt solid #000",
    borderLeft: "1.5pt solid #000",
    borderRight: "1.5pt solid #000",
    minHeight: 20,
  },
  tableRowAlt: {
    flexDirection: "row-reverse",
    borderBottom: "1pt solid #000",
    borderLeft: "1.5pt solid #000",
    borderRight: "1.5pt solid #000",
    minHeight: 20,
    backgroundColor: "#f3f4f6",
  },
  colNum: {
    width: "7%",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRight: "0.5pt solid #ccc",
  },
  colName: {
    width: "25%",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRight: "0.5pt solid #ccc",
  },
  colReceiptNo: {
    width: "14%",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRight: "0.5pt solid #ccc",
  },
  colAmount: {
    width: "16%",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRight: "0.5pt solid #ccc",
  },
  colBalance: {
    width: "18%",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRight: "0.5pt solid #ccc",
  },
  colNotes: {
    width: "20%",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  headerText: {
    fontWeight: 700,
    fontSize: 8,
  },
  cellText: {
    fontSize: 8,
  },
  footerRow: {
    flexDirection: "row-reverse",
    borderTop: "1.5pt solid #000",
    borderBottom: "1.5pt solid #000",
    borderLeft: "1.5pt solid #000",
    borderRight: "1.5pt solid #000",
    backgroundColor: "#e5e7eb",
  },
  footerLabel: {
    width: "46%",
    textAlign: "center",
    paddingVertical: 4,
    fontWeight: 700,
    fontSize: 9,
  },
  footerValue: {
    width: "54%",
    textAlign: "center",
    paddingVertical: 4,
    fontWeight: 700,
    fontSize: 9,
  },
});

interface ReceiptRow {
  studentName: string;
  receiptNumber: number;
  amount: number;
  remainingBalance: number;
  notes: string;
}

interface MonthlyReceiptsReportPdfProps {
  month: number;
  year: number;
  receipts: ReceiptRow[];
  totalAmount: number;
}

const MONTH_NAMES: Record<number, string> = {
  1: "كانون الثاني",
  2: "شباط",
  3: "آذار",
  4: "نيسان",
  5: "أيار",
  6: "حزيران",
  7: "تموز",
  8: "آب",
  9: "أيلول",
  10: "تشرين الأول",
  11: "تشرين الثاني",
  12: "كانون الأول",
};

export function MonthlyReceiptsReportPdf({
  month,
  year,
  receipts,
  totalAmount,
}: MonthlyReceiptsReportPdfProps) {
  const monthName = MONTH_NAMES[month] ?? String(month);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header: top right aligned */}
        <View style={styles.header}>
          <Text style={styles.reportTitle}>تقرير وصولات شهري</Text>
          <Text style={styles.periodText}>
            {monthName} / {year}
          </Text>
        </View>

        {/* Table with solid borders, alternating row colors */}
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colNotes, styles.headerText]}>ملاحظات</Text>
            <Text style={[styles.colBalance, styles.headerText]}>الباقي</Text>
            <Text style={[styles.colAmount, styles.headerText]}>المبلغ</Text>
            <Text style={[styles.colReceiptNo, styles.headerText]}>رقم الوصل</Text>
            <Text style={[styles.colName, styles.headerText]}>الاسم</Text>
            <Text style={[styles.colNum, styles.headerText]}>الرقم</Text>
          </View>

          {/* Data rows with alternating colors */}
          {receipts.map((row, i) => (
            <View
              style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              key={i}
            >
              <Text style={[styles.colNotes, styles.cellText]}>
                {row.notes || "—"}
              </Text>
              <Text style={[styles.colBalance, styles.cellText]}>
                {formatDinarAmount(Math.abs(row.remainingBalance))}
                {row.remainingBalance < 0 ? " (دائن)" : ""}
              </Text>
              <Text style={[styles.colAmount, styles.cellText]}>
                {formatDinarAmount(row.amount)}
              </Text>
              <Text style={[styles.colReceiptNo, styles.cellText]}>
                {String(row.receiptNumber).padStart(5, "0")}
              </Text>
              <Text style={[styles.colName, styles.cellText]}>
                {row.studentName}
              </Text>
              <Text style={[styles.colNum, styles.cellText]}>{i + 1}</Text>
            </View>
          ))}
        </View>

        {/* Footer: total row */}
        <View style={styles.footerRow}>
          <Text style={styles.footerValue}>
            {formatDinarAmount(totalAmount)}
          </Text>
          <Text style={styles.footerLabel}>المجموع</Text>
        </View>
      </Page>
    </Document>
  );
}
