const YEAR_PATTERN = /^(\d{4})-(\d{4})$/;

/** "2025-2026" -> "2026-2027". Falls back to the input unchanged if it doesn't match the expected shape. */
export function nextAcademicYear(label: string): string {
  const m = label.match(YEAR_PATTERN);
  if (!m) return label;
  const start = parseInt(m[1], 10) + 1;
  return `${start}-${start + 1}`;
}

/** Sort key: "2025-2026" -> 2025, so year strings sort chronologically. */
export function academicYearSortKey(label: string): number {
  const m = label.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

export function sortAcademicYearsDesc(years: string[]): string[] {
  return [...years].sort((a, b) => academicYearSortKey(b) - academicYearSortKey(a));
}

/**
 * Academic year "2025-2026" covers September of the start year through
 * August of the end year (the kindergarten's working year).
 */
export function academicYearPrismaFilter(label: string): {
  OR: Array<{ year: number; month: { gte: number } | { lte: number } }>;
} {
  const m = label.match(YEAR_PATTERN);
  if (!m) {
    throw new Error("السنة الدراسية غير صحيحة");
  }
  const startYear = parseInt(m[1], 10);
  const endYear = parseInt(m[2], 10);
  return {
    OR: [
      { year: startYear, month: { gte: 9 } },
      { year: endYear, month: { lte: 8 } },
    ],
  };
}
