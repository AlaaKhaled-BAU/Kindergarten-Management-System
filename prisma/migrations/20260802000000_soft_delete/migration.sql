-- Soft-delete columns: Revenue/Expense rows are never hard-deleted;
-- isActive=false hides them from every report/dashboard/export.
ALTER TABLE "Revenue" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Expense" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Only one ACTIVE Monthly fee per grade+year (partial unique; inactive
-- duplicates are legal after soft-delete).
CREATE UNIQUE INDEX "Fee_grade_year_type_active_key"
ON "Fee"("applicableGrade", "academicYear", "feeType")
WHERE "isActive" = true;
