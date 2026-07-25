import { getKindergartenInfo } from "@/app/actions/settings-actions";
import { getCurrentAcademicYear } from "@/app/actions/academic-year-actions";
import { SettingsClient } from "@/components/settings/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [info, currentAcademicYear] = await Promise.all([
    getKindergartenInfo(),
    getCurrentAcademicYear(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">الإعدادات</h1>
      <SettingsClient info={info} currentAcademicYear={currentAcademicYear} />
    </div>
  );
}
