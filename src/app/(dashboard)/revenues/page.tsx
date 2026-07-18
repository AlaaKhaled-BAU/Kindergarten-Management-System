import { getRevenues } from "@/app/actions/revenue-actions";
import { RevenuesPageClient } from "@/components/financial/revenues-client";

export const dynamic = "force-dynamic";

export default async function RevenuesPage() {
  const revenues = await getRevenues();

  return (
    <RevenuesPageClient
      revenues={revenues.map((r) => ({
        ...r,
        recordDate: r.recordDate.toISOString(),
      }))}
    />
  );
}
