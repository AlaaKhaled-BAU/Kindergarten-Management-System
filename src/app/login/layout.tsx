import { getAuthRole } from "@/lib/auth";
import { hasSetting } from "@/lib/settings";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasSetting("adminPasswordHash"))) {
    redirect("/setup");
  }
  if (await getAuthRole()) {
    redirect("/");
  }
  return <>{children}</>;
}
