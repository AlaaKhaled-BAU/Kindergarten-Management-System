import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { numberToArabicWords } from "@/lib/tafqit";

Font.register({
  family: "Scheherazade New",
  fonts: [
    { src: "/fonts/scheherazade-400.woff2", fontWeight: 400 },
    { src: "/fonts/scheherazade-700.woff2", fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: "Scheherazade New",
    fontSize: 11,
  },
  topBar: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerInfo: {
    flexDirection: "column",
    width: "65%",
  },
  kgName: {
    fontSize: 15,
    fontWeight: 700,
  },
  kgAddress: {
    fontSize: 9,
    color: "#444",
    marginTop: 2,
  },
  kgEmail: {
    fontSize: 9,
    color: "#444",
  },
  logoPlaceholder: {
    width: "30%",
    height: 50,
    border: "1pt dashed #ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 8,
    color: "#999",
  },
  receiptTitleBox: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
    gap: 12,
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "underline",
    textAlign: "center",
  },
  receiptNumber: {
    fontSize: 9,
    fontWeight: 700,
    color: "#333",
  },
  dinarFilsBoxes: {
    flexDirection: "row-reverse",
    gap: 8,
  },
  amountBox: {
    border: "1pt solid #000",
    paddingHorizontal: 10,
    paddingVertical: 3,
    textAlign: "center",
    minWidth: 60,
  },
  amountBoxLabel: {
    fontSize: 8,
  },
  amountBoxValue: {
    fontSize: 13,
    fontWeight: 700,
  },
  dottedRow: {
    flexDirection: "row-reverse",
    borderBottom: "1pt dotted #888",
    paddingVertical: 6,
    marginBottom: 2,
  },
  dottedRowArabic: {
    flexDirection: "row-reverse",
    borderBottom: "1pt dotted #888",
    paddingVertical: 6,
    marginBottom: 2,
  },
  dottedLabel: {
    fontWeight: 700,
    fontSize: 10,
    minWidth: 90,
    marginLeft: 6,
  },
  dottedValue: {
    fontSize: 10,
    flex: 1,
    textAlign: "right",
  },
  checkboxRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  cashLabel: {
    fontSize: 10,
  },
  checkboxCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    border: "1pt solid #000",
  },
  footer: {
    flexDirection: "row-reverse",
    marginTop: 24,
  },
  signatureBlock: {
    width: "50%",
    textAlign: "right",
  },
  signatureDots: {
    fontSize: 10,
    borderBottom: "1pt dotted #000",
    paddingBottom: 2,
  },
  signatureLabel: {
    fontSize: 9,
    marginTop: 4,
  },
});

interface ReceiptPdfProps {
  receiptNumber: number;
  issueDate: string;
  studentName: string;
  amount: number;
  paymentMethod: string;
  paymentReason?: string;
  kindergartenName: string;
}

export function ReceiptPdf({
  receiptNumber,
  issueDate,
  studentName,
  amount,
  paymentMethod,
  paymentReason,
  kindergartenName,
}: ReceiptPdfProps) {
  const dinar = Math.floor(amount);
  const fils = Math.round((amount - dinar) * 100);
  const amountWords = numberToArabicWords(amount);

  return (
    <Document>
      <Page size="A5" orientation="landscape" style={styles.page}>
        {/* Header: KG info + logo placeholder */}
        <View style={styles.topBar}>
          <View style={styles.headerInfo}>
            <Text style={styles.kgName}>{kindergartenName}</Text>
            <Text style={styles.kgAddress}>
              المستندة الغربية - قرب مركز زها الثقافي - تلفون : 079 0199411
            </Text>
            <Text style={styles.kgEmail}>thoughtmakerskg@gmail.com</Text>
          </View>
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>شعار الروضة</Text>
          </View>
        </View>

        {/* Title + Dinar/Fils boxes */}
        <View style={styles.receiptTitleBox}>
          <View style={styles.dinarFilsBoxes}>
            <View style={styles.amountBox}>
              <Text style={styles.amountBoxLabel}>فلس</Text>
              <Text style={styles.amountBoxValue}>{fils.toString().padStart(2, "0")}</Text>
            </View>
            <View style={styles.amountBox}>
              <Text style={styles.amountBoxLabel}>دينار</Text>
              <Text style={styles.amountBoxValue}>{dinar}</Text>
            </View>
          </View>
          <Text style={styles.receiptTitle}>سند قبض</Text>
          <Text style={styles.receiptNumber}>
            {"No. "}{String(receiptNumber).padStart(5, "0")}
          </Text>
        </View>

        {/* Dotted fillable rows */}
        <View style={styles.dottedRowArabic}>
          <Text style={styles.dottedLabel}>التاريخ :</Text>
          <Text style={styles.dottedValue}>...... {issueDate} ......</Text>
        </View>
        <View style={styles.dottedRowArabic}>
          <Text style={styles.dottedLabel}>وصلنا من السادة :</Text>
          <Text style={styles.dottedValue}>...... {studentName} ......</Text>
        </View>
        <View style={styles.dottedRowArabic}>
          <Text style={styles.dottedLabel}>مبلغ وقدره :</Text>
          <Text style={styles.dottedValue}>...... {amountWords} ......</Text>
        </View>
        <View style={styles.dottedRowArabic}>
          <Text style={styles.dottedLabel}>وذلك عن :</Text>
          <Text style={styles.dottedValue}>...... {paymentReason ?? "رسوم دراسية"} ......</Text>
        </View>

        {/* Payment method with checkbox */}
        <View style={styles.checkboxRow}>
          <View style={styles.checkboxCircle} />
          <Text style={styles.cashLabel}>{paymentMethod}</Text>
        </View>

        {/* Footer signature */}
        <View style={styles.footer}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureDots}>....................</Text>
            <Text style={styles.signatureLabel}>توقيع المستلم</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
