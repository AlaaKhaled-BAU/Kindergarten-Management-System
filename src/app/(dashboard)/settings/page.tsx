import { getKindergartenInfo } from "@/app/actions/settings-actions";
import { SettingsClient } from "@/components/settings/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const info = await getKindergartenInfo();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">الإعدادات</h1>
      <SettingsClient info={info} />
    </div>
  );
}
