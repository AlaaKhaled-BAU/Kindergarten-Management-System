import { getDashboardStats } from "@/app/actions/revenue-actions";
import { getUnpaidStudents } from "@/app/actions/student-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UnpaidAlert } from "@/components/dashboard/unpaid-alert";
import {
  TrendingUp,
  Banknote,
  AlertTriangle,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const [stats, unpaidStudents] = await Promise.all([
    getDashboardStats(),
    getUnpaidStudents(),
  ]);

  const cards = [
    {
      title: "الدخل المتوقع",
      value: `${stats.expectedIncome.toFixed(2)} د.أ`,
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "الدخل المحصل (الشهر الحالي)",
      value: `${stats.receivedIncome.toFixed(2)} د.أ`,
      icon: Banknote,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "الأرصدة المستحقة",
      value: `${stats.outstandingBalance.toFixed(2)} د.أ`,
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: "نسبة التحصيل",
      value: `${stats.collectionRate}%`,
      icon: Percent,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "متأخرون عن الدفع",
      value: `${unpaidStudents.length} طالب`,
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">لوحة القيادة</h1>

      <UnpaidAlert students={unpaidStudents} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={cn("rounded-lg p-2", card.bg)}>
                <card.icon className={cn("size-4", card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ملخص المصروفات (الشهر الحالي)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-destructive">
            {stats.expensesThisMonth.toFixed(2)} د.أ
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


