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
