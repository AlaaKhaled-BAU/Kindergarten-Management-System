"use client";

import { useEffect, useState } from "react";
import { getAcademicYears } from "@/app/actions/academic-year-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sortAcademicYearsDesc } from "@/lib/academic-year";

interface AcademicYearSelectProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | null) => void;
  /** Also offers next year -- for forward-looking pickers (new fees, promotion targets). */
  includeNext?: boolean;
  /** Prepends an "الكل" (all) option with value "all" -- for filter/browse contexts. */
  showAll?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

/**
 * Dropdown of the kindergarten's "open" academic years -- every year with
 * real data plus the currently-active one, fetched fresh each mount so it
 * reflects new years as soon as they're set up (a new fee, a promotion, or
 * an explicit "start new year") without needing a hardcoded list anywhere.
 */
export function AcademicYearSelect({
  name,
  value,
  defaultValue,
  onValueChange,
  includeNext,
  showAll,
  required,
  className,
  placeholder = "اختر السنة الدراسية",
}: AcademicYearSelectProps) {
  const [years, setYears] = useState<string[]>(defaultValue ? [defaultValue] : []);

  useEffect(() => {
    getAcademicYears({ includeNext }).then(({ years: fetched }) => {
      setYears((prev) => sortAcademicYearsDesc([...new Set([...fetched, ...prev])]));
    });
  }, [includeNext]);

  return (
    <Select name={name} value={value} defaultValue={defaultValue} onValueChange={onValueChange} required={required}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {showAll && <SelectItem value="all">الكل</SelectItem>}
        {years.map((y) => (
          <SelectItem key={y} value={y}>{y}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
