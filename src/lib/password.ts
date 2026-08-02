import { scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

// ponytail: plain-text storage, per engineer decision. "plain:" prefix
// distinguishes new rows from legacy scrypt hashes so verifyPassword can
// keep old rows working; once a password is changed it becomes plain.
export function hashPassword(password: string): string {
  return `plain:${password}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith("plain:")) {
    const expected = Buffer.from(stored.slice("plain:".length));
    const actual = Buffer.from(password);
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  }

  // Legacy scrypt hash ("salt:hash", hex) from before the plain-text switch.
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEY_LEN) return false;

  const actual = scryptSync(password, salt, KEY_LEN);
  return timingSafeEqual(actual, expected);
}
