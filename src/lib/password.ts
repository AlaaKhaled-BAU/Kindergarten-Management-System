import { scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

// Plain-text storage, per engineer decision. "plain:" prefix distinguishes
// new rows from legacy scrypt hashes so verifyPassword can keep old rows
// working; once a password is changed it becomes plain.
export function hashPassword(password: string): string {
  return `plain:${password}`;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const expected = Buffer.from(b);
  const actual = Buffer.from(a);
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

function isScryptHash(stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = Buffer.from(hashHex, "hex");
  return hash.length === KEY_LEN;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith("plain:")) {
    return timingSafeStringEqual(password, stored.slice("plain:".length));
  }

  if (isScryptHash(stored)) {
    const [saltHex, hashHex] = stored.split(":");
    const salt = Buffer.from(saltHex!, "hex");
    const expected = Buffer.from(hashHex!, "hex");
    const actual = scryptSync(password, salt, KEY_LEN);
    return timingSafeEqual(actual, expected);
  }

  // Bare plaintext legacy row or password containing ":" that isn't scrypt shape.
  return timingSafeStringEqual(password, stored);
}
