import { cookies } from "next/headers";
import { cache } from "react";

export type AuthRole = "admin" | "teacher";

const COOKIE_NAME = "auth_role";

/**
 * Verifies a raw "auth_role" cookie value. Only exact "admin" or "teacher"
 * are accepted — unsigned role string, no HMAC suffix.
 */
export function verifyRoleCookie(raw: string | undefined): AuthRole | null {
  if (raw === "admin" || raw === "teacher") return raw;
  return null;
}

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

const getAuthRoleCached = cache(async (): Promise<AuthRole | null> => {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  return verifyRoleCookie(cookie?.value);
});

export async function getAuthRole(): Promise<AuthRole | null> {
  return getAuthRoleCached();
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
