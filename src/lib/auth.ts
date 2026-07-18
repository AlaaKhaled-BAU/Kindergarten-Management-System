import { cookies } from "next/headers";

export type AuthRole = "admin" | "teacher";

const COOKIE_NAME = "auth_role";

export async function setAuthCookie(role: AuthRole): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getAuthRole(): Promise<AuthRole | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie) return null;
  if (cookie.value !== "admin" && cookie.value !== "teacher") return null;
  return cookie.value as AuthRole;
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
