"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getReceipts } from "@/app/actions/payment-actions";
import { Search, Printer } from "lucide-react";

interface ReceiptOption {
  id: number;
  label: string;
}

export function ReportTabReceipt() {
  const [receipts, setReceipts] = useState<ReceiptOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>طباعة سند قبض</CardTitle>
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
                onClick={() => setSelectedId(r.id)}
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

        {selectedId && (
          <Button className="w-full" onClick={() => window.open(`/print/receipt/${selectedId}`, "_blank")}>
            <Printer className="me-2 size-4" />
            طباعة / حفظ سند القبض
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
