"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getReceipts } from "@/app/actions/payment-actions";
import {
  generateReceiptPdf,
  type ReceiptPdfData,
} from "@/app/actions/pdf-actions";
import { ReceiptPdf } from "@/components/pdf/receipt-pdf";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Search } from "lucide-react";

interface ReceiptOption {
  id: number;
  label: string;
}

export function ReportTabReceipt() {
  const [receipts, setReceipts] = useState<ReceiptOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pdfData, setPdfData] = useState<ReceiptPdfData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getReceipts().then((list) => {
      const options = list
        .filter((r) => !r.isCanceled)
        .sort((a, b) => b.receiptNumber - a.receiptNumber)
        .map((r) => ({
          id: r.id,
          label: `#${String(r.receiptNumber).padStart(5, "0")} — ${r.studentName}`,
        }));
      setReceipts(options);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return receipts;
    const q = search.toLowerCase();
    return receipts.filter((r) => r.label.toLowerCase().includes(q));
  }, [receipts, search]);

  async function handleSelect(id: number) {
    setSelectedId(id);
    setLoading(true);
    try {
      const data = await generateReceiptPdf(id);
      setPdfData(data);
    } catch {
      setPdfData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>تحميل سند قبض</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="ابحث عن إيصال (رقم أو اسم)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedId(null);
              setPdfData(null);
            }}
            className="pe-9"
          />
        </div>

        <div className="max-h-48 overflow-y-auto rounded-lg border">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              لا توجد نتائج
            </p>
          ) : (
            filtered.slice(0, 50).map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r.id)}
                className={`w-full text-start px-4 py-2.5 text-sm border-b last:border-b-0 transition-colors hover:bg-muted ${
                  selectedId === r.id
                    ? "bg-primary/10 text-primary font-medium"
                    : ""
                }`}
              >
                {r.label}
              </button>
            ))
          )}
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground">جاري تحميل البيانات...</p>
        )}

        {pdfData && !loading && (
          <PDFDownloadLink
            document={<ReceiptPdf {...pdfData} />}
            fileName={`receipt-${String(pdfData.receiptNumber).padStart(5, "0")}.pdf`}
          >
            {({ loading: pdfLoading }) =>
              pdfLoading ? (
                <span className="text-sm text-muted-foreground">
                  جاري إنشاء الملف...
                </span>
              ) : (
                <Button className="w-full">تحميل سند القبض</Button>
              )
            }
          </PDFDownloadLink>
        )}
      </CardContent>
    </Card>
  );
}
