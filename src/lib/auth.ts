import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSetting } from "./settings";

export type AuthRole = "admin" | "teacher";

const COOKIE_NAME = "auth_role";

async function sign(role: string): Promise<string> {
  // cookieSecret is generated once (random, DB-stored) the first time
  // settings.ts initializes -- always present by the time any cookie needs
  // signing or verifying. No password-derived or hardcoded fallback key.
  //
  // The role's password hash is mixed into the key so changing the password
  // (admin or teacher) instantly invalidates every existing session of that
  // role -- otherwise a terminated employee keeps a valid cookie for up to
  // the 7-day maxAge.
  const key = await getSetting("cookieSecret");
  const pwdHash = await getSetting(role === "admin" ? "adminPasswordHash" : "teacherPasswordHash");
  return createHmac("sha256", `${key}:${pwdHash ?? ""}`).update(role).digest("hex");
}

async function signRoleCookie(role: AuthRole): Promise<string> {
  return `${role}.${await sign(role)}`;
}

/**
 * Verifies a raw "auth_role" cookie value against its HMAC signature, so
 * editing the cookie value (e.g. teacher -> admin) in devtools no longer
 * works — httpOnly alone only stops JS from reading it, not a manual edit.
 * Pure-ish function (only reads the settings cache, no cookies() call) so
 * both Server Actions and proxy.ts share this exact verification logic.
 */
export async function verifyRoleCookie(raw: string | undefined): Promise<AuthRole | null> {
  if (!raw) return null;
  const [role, signature] = raw.split(".");
  if (role !== "admin" && role !== "teacher") return null;
  if (!signature) return null;

  const expected = await sign(role);
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  return role;
}

export async function setAuthCookie(role: AuthRole): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, await signRoleCookie(role), {
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
