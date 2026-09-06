import { describe, expect, it } from "vitest";
import { verifyRoleCookie } from "./auth";

describe("verifyRoleCookie", () => {
  it('accepts "admin"', () => {
    expect(verifyRoleCookie("admin")).toBe("admin");
  });

  it('accepts "teacher"', () => {
    expect(verifyRoleCookie("teacher")).toBe("teacher");
  });

  it('rejects old HMAC cookie "admin.deadbeef"', () => {
    expect(verifyRoleCookie("admin.deadbeef")).toBeNull();
  });

  it('rejects empty string', () => {
    expect(verifyRoleCookie("")).toBeNull();
  });

  it('rejects "guest"', () => {
    expect(verifyRoleCookie("guest")).toBeNull();
  });

  it("rejects undefined", () => {
    expect(verifyRoleCookie(undefined)).toBeNull();
  });
});
