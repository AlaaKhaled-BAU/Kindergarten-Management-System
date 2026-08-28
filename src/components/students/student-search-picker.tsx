"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AcademicYearSelect } from "@/components/shared/academic-year-select";
import { Search } from "lucide-react";
import { GRADES, gradeLabel } from "@/lib/grades";

const MAX_VISIBLE = 50;

export interface StudentSearchOption {
  id: number;
  firstName: string;
  lastName: string;
  grade: string;
  academicYear: string;
}

interface StudentSearchPickerProps {
  students: StudentSearchOption[];
  balances: Record<string, number>;
  value: string;
  onChange: (studentId: string) => void;
  defaultYearFilter: string;
  name?: string;
  required?: boolean;
}

export function StudentSearchPicker({
  students,
  balances,
  value,
  onChange,
  defaultYearFilter,
  name = "studentId",
  required,
}: StudentSearchPickerProps) {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(defaultYearFilter);

  const filtered = useMemo(() => {
    let result = students;
    if (gradeFilter !== "all") {
      result = result.filter((s) => s.grade === gradeFilter);
    }
    if (yearFilter !== "all") {
      result = result.filter((s) => s.academicYear === yearFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
      );
    }
    return result;
  }, [students, search, gradeFilter, yearFilter]);

  const visible = filtered.slice(0, MAX_VISIBLE);
  const truncated = filtered.length > MAX_VISIBLE;

  const selectedStudent = value
    ? students.find((s) => s.id.toString() === value)
    : undefined;

  function handleSelect(id: number) {
    onChange(id.toString());
  }

  function handleSearchChange(next: string) {
    setSearch(next);
    if (value) {
      const selected = students.find((s) => s.id.toString() === value);
      if (selected) {
        const q = next.toLowerCase();
        const name = `${selected.firstName} ${selected.lastName}`.toLowerCase();
        if (q && !name.includes(q)) onChange("");
      }
    }
  }

  function handleGradeChange(next: string) {
    setGradeFilter(next);
    clearIfNoLongerVisible(next, yearFilter, search);
  }

  function handleYearChange(next: string | null) {
    const v = next ?? "all";
    setYearFilter(v);
    clearIfNoLongerVisible(gradeFilter, v, search);
  }

  function clearIfNoLongerVisible(grade: string, year: string, q: string) {
    if (!value) return;
    const selected = students.find((s) => s.id.toString() === value);
    if (!selected) {
      onChange("");
      return;
    }
    if (grade !== "all" && selected.grade !== grade) {
      onChange("");
      return;
    }
    if (year !== "all" && selected.academicYear !== year) {
      onChange("");
      return;
    }
    if (q.trim()) {
      const query = q.toLowerCase();
      const name = `${selected.firstName} ${selected.lastName}`.toLowerCase();
      if (!name.includes(query)) onChange("");
    }
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={value} required={required} />

      {selectedStudent && (
        <p className="text-sm">
          <span className="text-muted-foreground">الطالب المختار: </span>
          <span className="font-medium">
            {selectedStudent.firstName} {selectedStudent.lastName}
          </span>
          <span className="text-muted-foreground">
            {" "}
            ({gradeLabel(selectedStudent.grade)} — {selectedStudent.academicYear})
          </span>
        </p>
      )}

      <div className="relative">
        <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="بحث عن طالب..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pe-9"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={gradeFilter} onValueChange={handleGradeChange}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="الصف">
              {(v: string) =>
                !v ? "الصف" : v === "all" ? "الكل" : gradeLabel(v)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {GRADES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <AcademicYearSelect
          value={yearFilter}
          onValueChange={handleYearChange}
          showAll
          className="w-full sm:w-36"
          placeholder="السنة"
        />
      </div>

      <div className="max-h-48 overflow-y-auto rounded-lg border">
        {visible.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">
            لا توجد نتائج
          </p>
        ) : (
          visible.map((s) => {
            const idStr = s.id.toString();
            const isSelected = value === idStr;
            const balance = balances[idStr] ?? 0;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s.id)}
                className={`flex w-full items-center justify-between gap-2 border-b px-4 py-2.5 text-start text-sm transition-colors last:border-b-0 hover:bg-muted ${
                  isSelected ? "bg-primary/10 font-medium text-primary" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className={isSelected ? "font-semibold" : ""}>
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="text-muted-foreground me-2">
                    {" "}
                    ({gradeLabel(s.grade)} — {s.academicYear})
                  </span>
                </span>
                <span
                  className={`shrink-0 tabular-nums ${
                    balance > 0 ? "text-amber-700" : "text-muted-foreground"
                  }`}
                >
                  {balance.toFixed(2)} د.أ
                </span>
              </button>
            );
          })
        )}
      </div>

      {truncated && (
        <p className="text-xs text-muted-foreground text-center">
          يُعرض أول {MAX_VISIBLE} نتيجة — ضيّق البحث أو الفلاتر لعرض المزيد
        </p>
      )}
    </div>
  );
}
