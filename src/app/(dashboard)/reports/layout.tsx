import { getAuthRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getAuthRole();
  if (role !== "admin") {
    redirect(role ? "/students" : "/login");
  }
  return <>{children}</>;
}
