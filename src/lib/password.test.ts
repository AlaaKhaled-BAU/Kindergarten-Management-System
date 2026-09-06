import { describe, expect, it } from "vitest";
import { verifyPassword } from "./password";

describe("verifyPassword", () => {
  it("matches bare plaintext stored value", () => {
    expect(verifyPassword("x", "x")).toBe(true);
  });

  it('matches "plain:" prefixed stored value', () => {
    expect(verifyPassword("x", "plain:x")).toBe(true);
  });

  it("rejects wrong password", () => {
    expect(verifyPassword("wrong", "plain:secret")).toBe(false);
  });

  it("returns false on length mismatch without throwing", () => {
    expect(() => verifyPassword("short", "plain:longer")).not.toThrow();
    expect(verifyPassword("short", "plain:longer")).toBe(false);
  });

  it('does not throw when password contains ":"', () => {
    expect(() => verifyPassword("pass:word", "pass:word")).not.toThrow();
    expect(verifyPassword("pass:word", "pass:word")).toBe(true);
  });
});
