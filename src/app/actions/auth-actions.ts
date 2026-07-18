"use server";

import { clearAuthCookie } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function logout(): Promise<never> {
  await clearAuthCookie();
  redirect("/login");
}
