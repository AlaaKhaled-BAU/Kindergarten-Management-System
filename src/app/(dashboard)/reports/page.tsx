import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportMonthlySummary } from "@/components/reports/report-monthly-summary";
import { ReportTabReceipt } from "@/components/reports/report-tab-receipt";
import { ReportTabLedger } from "@/components/reports/report-tab-ledger";
import { ReportTabMonthly } from "@/components/reports/report-tab-monthly";
import { getAuthRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const role = await getAuthRole();

  if (role !== "admin") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">كشف حساب طالب</h1>
        <ReportTabLedger />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">التقارير</h1>

      <Tabs defaultValue="summary">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="summary">التقرير الشهري</TabsTrigger>
          <TabsTrigger value="receipt">سند قبض</TabsTrigger>
          <TabsTrigger value="ledger">كشف حساب طالب</TabsTrigger>
          <TabsTrigger value="monthly">تقرير وصولات شهري</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <ReportMonthlySummary />
        </TabsContent>

        <TabsContent value="receipt">
          <ReportTabReceipt />
        </TabsContent>

        <TabsContent value="ledger">
          <ReportTabLedger />
        </TabsContent>

        <TabsContent value="monthly">
          <ReportTabMonthly />
        </TabsContent>
      </Tabs>
    </div>
  );
}
