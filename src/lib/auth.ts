import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export type AuthRole = "admin" | "teacher";

const COOKIE_NAME = "auth_role";

function getSigningKey(): string {
  return process.env.ADMIN_PASSWORD ?? "insecure-fallback-key";
}

function sign(role: string): string {
  return createHmac("sha256", getSigningKey()).update(role).digest("hex");
}

function signRoleCookie(role: AuthRole): string {
  return `${role}.${sign(role)}`;
}

/**
 * Verifies a raw "auth_role" cookie value against its HMAC signature, so
 * editing the cookie value (e.g. teacher -> admin) in devtools no longer
 * works — httpOnly alone only stops JS from reading it, not a manual edit.
 * Pure function (no cookies() call) so both Server Actions and the
 * Node-runtime middleware share this exact verification logic.
 */
export function verifyRoleCookie(raw: string | undefined): AuthRole | null {
  if (!raw) return null;
  const [role, signature] = raw.split(".");
  if (role !== "admin" && role !== "teacher") return null;
  if (!signature) return null;

  const expected = sign(role);
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  return role;
}

export async function setAuthCookie(role: AuthRole): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, signRoleCookie(role), {
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
  return verifyRoleCookie(cookie?.value);
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
