"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAllStudents } from "@/app/actions/student-actions";
import {
  generateLedgerPdf,
  type LedgerPdfData,
} from "@/app/actions/pdf-actions";
import { LedgerPdf } from "@/components/pdf/ledger-pdf";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Search } from "lucide-react";
import { GRADES, gradeLabel } from "@/lib/grades";

interface StudentOption {
  id: number;
  label: string;
  grade: string;
}

export function ReportTabLedger() {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pdfData, setPdfData] = useState<LedgerPdfData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAllStudents({ isActive: true }).then((list) => {
      const options = list.map((s) => ({
        id: s.id,
        label: `${s.firstName} ${s.lastName}`,
        grade: s.grade,
      }));
      setStudents(options);
    });
  }, []);

  const filtered = useMemo(() => {
    let result = students;
    if (gradeFilter !== "all") {
      result = result.filter((s) => s.grade === gradeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.label.toLowerCase().includes(q));
    }
    return result;
  }, [students, search, gradeFilter]);

  async function handleSelect(id: number) {
    setSelectedId(id);
    setLoading(true);
    try {
      const data = await generateLedgerPdf(id);
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
        <CardTitle>تحميل كشف حساب طالب</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن طالب..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedId(null);
                setPdfData(null);
              }}
              className="pe-9"
            />
          </div>
          <Select value={gradeFilter} onValueChange={(v) => setGradeFilter(v ?? "all")}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="الصف">
                {(value: string) => (value === "all" ? "الكل" : gradeLabel(value))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              {GRADES.map((g) => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-48 overflow-y-auto rounded-lg border">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              لا توجد نتائج
            </p>
          ) : (
            filtered.slice(0, 50).map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelect(s.id)}
                className={`w-full text-start px-4 py-2.5 text-sm border-b last:border-b-0 transition-colors hover:bg-muted ${
                  selectedId === s.id
                    ? "bg-primary/10 text-primary font-medium"
                    : ""
                }`}
              >
                <span>{s.label}</span>
                <span className="text-muted-foreground me-2">
                  ({gradeLabel(s.grade)})
                </span>
              </button>
            ))
          )}
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground">جاري تحميل البيانات...</p>
        )}

        {pdfData && !loading && (
          <PDFDownloadLink
            document={<LedgerPdf {...pdfData} />}
            fileName={`ledger-${pdfData.studentName.replace(/\s+/g, "-")}.pdf`}
          >
            {({ loading: pdfLoading }) =>
              pdfLoading ? (
                <span className="text-sm text-muted-foreground">
                  جاري إنشاء الملف...
                </span>
              ) : (
                <Button className="w-full">تحميل كشف الحساب</Button>
              )
            }
          </PDFDownloadLink>
        )}
      </CardContent>
    </Card>
  );
}
