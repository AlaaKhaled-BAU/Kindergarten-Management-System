import { getFees } from "@/app/actions/fee-actions";
import { FeesClient } from "@/components/financial/fees-client";

export const dynamic = "force-dynamic";

export default async function FeesPage() {
  const fees = await getFees();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">الرسوم الدراسية</h1>
      <FeesClient fees={fees} />
    </div>
  );
}
