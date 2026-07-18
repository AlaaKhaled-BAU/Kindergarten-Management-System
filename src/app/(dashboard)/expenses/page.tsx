import { getExpenses } from "@/app/actions/expense-actions";
import { ExpensesPageClient } from "@/components/financial/expenses-client";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const expenses = await getExpenses();

  return (
    <ExpensesPageClient
      expenses={expenses.map((e) => ({
        ...e,
        expenseDate: e.expenseDate.toISOString(),
      }))}
    />
  );
}
