-- CreateIndex
CREATE INDEX "Revenue_year_month_idx" ON "Revenue"("year", "month");

-- CreateIndex
CREATE INDEX "Expense_year_month_idx" ON "Expense"("year", "month");
