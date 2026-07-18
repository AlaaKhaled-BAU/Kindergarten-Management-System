"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateMonthlyReceiptsPdf,
  type MonthlyReceiptsReportPdfData,
} from "@/app/actions/pdf-actions";
import { MonthlyReceiptsReportPdf } from "@/components/pdf/monthly-summary-pdf";
import { PDFDownloadLink } from "@react-pdf/renderer";

const monthNames = [
  "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function ReportTabMonthly() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [month, setMonth] = useState<string>(currentMonth.toString());
  const [year, setYear] = useState<string>(currentYear.toString());
  const [pdfData, setPdfData] = useState<MonthlyReceiptsReportPdfData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  async function handleGenerate() {
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    if (!monthNum || !yearNum) return;
    setLoading(true);
    setGenerated(false);
    try {
      const data = await generateMonthlyReceiptsPdf(yearNum, monthNum);
      setPdfData(data);
      setGenerated(true);
    } catch {
      setPdfData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>تحميل تقرير وصولات شهري</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>الشهر</Label>
            <Select value={month} onValueChange={(v) => setMonth(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر الشهر" />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((name, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>السنة</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={2020}
              max={2099}
            />
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={!month || !year || loading} className="w-full">
          {loading ? "جاري التحميل..." : "عرض البيانات"}
        </Button>

        {generated && !loading && pdfData && pdfData.receipts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            لا توجد وصولات في هذا الشهر
          </p>
        )}

        {generated && !loading && pdfData && pdfData.receipts.length > 0 && (
          <PDFDownloadLink
            document={<MonthlyReceiptsReportPdf {...pdfData} />}
            fileName={`monthly-receipts-${pdfData.year}-${String(pdfData.month).padStart(2, "0")}.pdf`}
          >
            {({ loading: pdfLoading }) =>
              pdfLoading ? (
                <span className="text-sm text-muted-foreground">
                  جاري إنشاء الملف...
                </span>
              ) : (
                <Button variant="default" className="w-full">
                  تحميل تقرير الوصولات ({pdfData.receipts.length} إيصال)
                </Button>
              )
            }
          </PDFDownloadLink>
        )}
      </CardContent>
    </Card>
  );
}
