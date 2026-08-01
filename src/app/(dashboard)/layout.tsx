import { Sidebar } from "@/components/layout/sidebar";
import { getAuthRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getAuthRole();

  if (!role) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar role={role} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 lg:pe-8">{children}</div>
      </main>
    </div>
  );
}
