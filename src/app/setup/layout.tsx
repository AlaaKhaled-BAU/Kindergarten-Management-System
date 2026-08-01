import { getAuthRole } from "@/lib/auth";
import { hasSetting } from "@/lib/settings";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await getAuthRole()) {
    redirect("/");
  }
  if (await hasSetting("adminPasswordHash")) {
    redirect("/login");
  }
  return <>{children}</>;
}
