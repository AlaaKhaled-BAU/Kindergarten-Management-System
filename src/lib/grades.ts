export const GRADE_LABELS: Record<string, string> = {
  Pre: "بستان",
  KG1: "روضة أولى",
  KG2: "روضة ثانية",
};

export const GRADES = Object.entries(GRADE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function gradeLabel(grade: string): string {
  return GRADE_LABELS[grade] ?? grade;
}
