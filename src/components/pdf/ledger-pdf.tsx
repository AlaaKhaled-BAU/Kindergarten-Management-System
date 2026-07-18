import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { formatDinarAmount } from "@/lib/tafqit";

Font.register({
  family: "Scheherazade New",
  fonts: [
    { src: "/fonts/scheherazade-400.woff2", fontWeight: 400 },
    { src: "/fonts/scheherazade-700.woff2", fontWeight: 700 },
  ],
});

const KG_NAME = "روضة صناع الفكر";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Scheherazade New",
    fontSize: 10,
  },
  headerCenter: {
    textAlign: "center",
    marginBottom: 8,
  },
  kgName: {
    fontSize: 16,
    fontWeight: 700,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 4,
  },
  infoSection: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginVertical: 10,
    borderTop: "1pt solid #000",
    borderBottom: "1pt solid #000",
    paddingVertical: 8,
  },
  infoColumn: {
    width: "48%",
  },
  infoRow: {
    flexDirection: "row-reverse",
    marginBottom: 4,
  },
  infoLabel: {
    fontWeight: 700,
    fontSize: 10,
    minWidth: 80,
  },
  infoValue: {
    fontSize: 10,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: "row-reverse",
    backgroundColor: "#e5e7eb",
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
  tableRowLast: {
    flexDirection: "row-reverse",
    borderBottom: "1.5pt solid #000",
    borderLeft: "1.5pt solid #000",
    borderRight: "1.5pt solid #000",
    minHeight: 20,
  },
  colNum: {
    width: "7%",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRight: "0.5pt solid #ccc",
  },
  colPayments: {
    width: "16%",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRight: "0.5pt solid #ccc",
  },
  colDate: {
    width: "16%",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRight: "0.5pt solid #ccc",
  },
  colReceiptNo: {
    width: "16%",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRight: "0.5pt solid #ccc",
  },
  colBalance: {
    width: "20%",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRight: "0.5pt solid #ccc",
  },
  colNotes: {
    width: "25%",
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  headerText: {
    fontWeight: 700,
    fontSize: 9,
  },
  cellText: {
    fontSize: 9,
  },
  emptyCell: {
    fontSize: 9,
    color: "#fff",
  },
  footer: {
    marginTop: 24,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  signatureBox: {
    width: "40%",
    textAlign: "center",
  },
  signatureLine: {
    borderTop: "1pt solid #000",
    marginTop: 32,
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 10,
  },
});

interface TransactionItem {
  id: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  receiptNumber?: string;
}

interface LedgerPdfProps {
  studentName: string;
  grade: string;
  section?: string;
  academicYear: string;
  transactions: TransactionItem[];
  totalDue: number;
  discount: number;
  netAmount: number;
}

export function LedgerPdf({
  studentName,
  grade,
  section,
  academicYear,
  transactions,
  totalDue,
  discount,
  netAmount,
}: LedgerPdfProps) {
  const gradeMap: Record<string, string> = {
    Pre: "بستان",
    KG1: "روضة أولى",
    KG2: "روضة ثانية",
  };

  const totalRows = 20;
  const dataRows = transactions;
  const emptyRows = Math.max(0, totalRows - dataRows.length);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Centered header */}
        <View style={styles.headerCenter}>
          <Text style={styles.kgName}>{KG_NAME}</Text>
          <Text style={styles.reportTitle}>كشف حساب طالب</Text>
          <Text style={{ fontSize: 10, color: "#555" }}>
            السنة الدراسية: {academicYear}
          </Text>
        </View>

        {/* Two-column info */}
        <View style={styles.infoSection}>
          <View style={styles.infoColumn}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>اسم الطالب:</Text>
              <Text style={styles.infoValue}>{studentName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>الصف:</Text>
              <Text style={styles.infoValue}>{gradeMap[grade] ?? grade}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>الشعبة:</Text>
              <Text style={styles.infoValue}>{section ?? "—"}</Text>
            </View>
          </View>
          <View style={styles.infoColumn}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>المبلغ المستحق:</Text>
              <Text style={styles.infoValue}>{formatDinarAmount(totalDue)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>قيمة الخصم:</Text>
              <Text style={styles.infoValue}>{formatDinarAmount(discount)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>صافي المبلغ:</Text>
              <Text style={styles.infoValue}>
                {formatDinarAmount(Math.abs(netAmount))}
                {netAmount > 0 ? " له" : netAmount < 0 ? " عليه" : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Table with solid borders, 20 rows */}
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colNotes, styles.headerText]}>ملاحظات</Text>
            <Text style={[styles.colBalance, styles.headerText]}>الرصيد</Text>
            <Text style={[styles.colReceiptNo, styles.headerText]}>رقم الوصل</Text>
            <Text style={[styles.colDate, styles.headerText]}>تاريخ الدفع</Text>
            <Text style={[styles.colPayments, styles.headerText]}>الدفعات</Text>
            <Text style={[styles.colNum, styles.headerText]}>الرقم</Text>
          </View>

          {/* Data rows */}
          {dataRows.map((t, i) => (
            <View
              style={
                i === totalRows - 1 && emptyRows === 0
                  ? styles.tableRowLast
                  : styles.tableRow
              }
              key={t.id}
            >
              <Text style={[styles.colNotes, styles.cellText]}>
                {t.description?.slice(0, 30)}
              </Text>
              <Text style={[styles.colBalance, styles.cellText]}>
                {formatDinarAmount(Math.abs(t.balance))}
                {t.balance > 0 ? " له" : t.balance < 0 ? " عليه" : ""}
              </Text>
              <Text style={[styles.colReceiptNo, styles.cellText]}>
                {t.receiptNumber ?? "—"}
              </Text>
              <Text style={[styles.colDate, styles.cellText]}>{t.date}</Text>
              <Text style={[styles.colPayments, styles.cellText]}>
                {t.credit > 0 ? formatDinarAmount(t.credit) : "—"}
              </Text>
              <Text style={[styles.colNum, styles.cellText]}>{i + 1}</Text>
            </View>
          ))}

          {/* Empty rows to total 20 */}
          {Array.from({ length: emptyRows }).map((_, i) => {
            const rowIndex = dataRows.length + i;
            const isLast = rowIndex === totalRows - 1;
            return (
              <View
                style={isLast ? styles.tableRowLast : styles.tableRow}
                key={`empty-${i}`}
              >
                <Text style={[styles.colNotes, styles.emptyCell]}>—</Text>
                <Text style={[styles.colBalance, styles.emptyCell]}>—</Text>
                <Text style={[styles.colReceiptNo, styles.emptyCell]}>—</Text>
                <Text style={[styles.colDate, styles.emptyCell]}>—</Text>
                <Text style={[styles.colPayments, styles.emptyCell]}>—</Text>
                <Text style={[styles.colNum, styles.cellText]}>
                  {rowIndex + 1}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Footer signatures */}
        <View style={styles.footer}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>توقيع الإدارة</Text>
            </View>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>توقيع ولي الأمر</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
