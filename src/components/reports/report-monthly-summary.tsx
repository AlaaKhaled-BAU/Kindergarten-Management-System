import { getRevenueSummary } from "@/app/actions/revenue-actions";
import { getExpenseSummary } from "@/app/actions/expense-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const monthNames = [
  "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export async function ReportMonthlySummary() {
  const currentYear = new Date().getFullYear();
  const [revenueSummary, expenseSummary] = await Promise.all([
    getRevenueSummary(currentYear),
    getExpenseSummary(currentYear),
  ]);

  const monthlyData = new Map<
    number,
    { revenue: number; expense: number }
  >();

  for (let m = 1; m <= 12; m++) {
    monthlyData.set(m, { revenue: 0, expense: 0 });
  }

  for (const r of revenueSummary) {
    const current = monthlyData.get(r.month) ?? { revenue: 0, expense: 0 };
    current.revenue += r._sum.amount ?? 0;
    monthlyData.set(r.month, current);
  }

  for (const e of expenseSummary) {
    const current = monthlyData.get(e.month) ?? { revenue: 0, expense: 0 };
    current.expense += e._sum.amount ?? 0;
    monthlyData.set(e.month, current);
  }

  const rows = Array.from(monthlyData.entries()).map(([month, data]) => ({
    month,
    name: monthNames[month - 1],
    revenue: data.revenue,
    expense: data.expense,
    net: data.revenue - data.expense,
  }));

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              إجمالي الإيرادات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {totalRevenue.toFixed(2)} د.أ
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              إجمالي المصروفات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {totalExpense.toFixed(2)} د.أ
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              الصافي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                totalRevenue - totalExpense >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {(totalRevenue - totalExpense).toFixed(2)} د.أ
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>التقرير الشهري — {currentYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-3 px-4 text-start">الشهر</th>
                  <th className="py-3 px-4 text-end">الإيرادات</th>
                  <th className="py-3 px-4 text-end">المصروفات</th>
                  <th className="py-3 px-4 text-end">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.month} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{row.name}</td>
                    <td className="py-3 px-4 text-end text-green-600">
                      {row.revenue.toFixed(2)} د.أ
                    </td>
                    <td className="py-3 px-4 text-end text-red-600">
                      {row.expense.toFixed(2)} د.أ
                    </td>
                    <td
                      className={`py-3 px-4 text-end font-medium ${
                        row.net >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {row.net.toFixed(2)} د.أ
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-bold">
                  <td className="py-3 px-4">المجموع</td>
                  <td className="py-3 px-4 text-end text-green-600">
                    {totalRevenue.toFixed(2)} د.أ
                  </td>
                  <td className="py-3 px-4 text-end text-red-600">
                    {totalExpense.toFixed(2)} د.أ
                  </td>
                  <td
                    className={`py-3 px-4 text-end ${
                      totalRevenue - totalExpense >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {(totalRevenue - totalExpense).toFixed(2)} د.أ
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
