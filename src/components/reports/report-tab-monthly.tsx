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
import { generateMonthlyReceiptsPdf } from "@/app/actions/pdf-actions";
import { errorMessage } from "@/lib/utils";
import { Printer } from "lucide-react";

const monthNames = [
  "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function ReportTabMonthly() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [month, setMonth] = useState<string>(currentMonth.toString());
  const [year, setYear] = useState<string>(currentYear.toString());
  const [receiptCount, setReceiptCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    if (!monthNum || !yearNum) return;
    setLoading(true);
    setError(null);
    setReceiptCount(null);
    try {
      const data = await generateMonthlyReceiptsPdf(yearNum, monthNum);
      setReceiptCount(data.receipts.length);
    } catch (err) {
      setReceiptCount(null);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>طباعة تقرير وصولات شهري</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>الشهر</Label>
            <Select value={month} onValueChange={(v) => { setMonth(v ?? ""); setError(null); setReceiptCount(null); }}>
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
              onChange={(e) => { setYear(e.target.value); setError(null); setReceiptCount(null); }}
              min={2020}
              max={2099}
            />
          </div>
        </div>

        <Button onClick={handlePreview} disabled={!month || !year || loading} className="w-full">
          {loading ? "جاري التحميل..." : "عرض البيانات"}
        </Button>

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        {receiptCount === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center">
            لا توجد وصولات في هذا الشهر
          </p>
        )}

        {receiptCount !== null && receiptCount > 0 && !loading && (
          <Button
            variant="default"
            className="w-full"
            onClick={() => window.open(`/print/monthly/${year}/${month}`, "_blank")}
          >
            <Printer className="me-2 size-4" />
            طباعة تقرير الوصولات ({receiptCount} إيصال)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
