import { describe, expect, it } from "vitest";

import { defaultNextForType, safeNext } from "@/lib/auth/safe-next";

describe("safeNext", () => {
  it("allows plain relative paths", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/brews/42?tab=readings")).toBe("/brews/42?tab=readings");
  });

  it("falls back to /dashboard when next is missing or empty", () => {
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext("")).toBe("/dashboard");
  });

  it("rejects absolute URLs", () => {
    expect(safeNext("https://evil.com")).toBe("/dashboard");
    expect(safeNext("http://evil.com/phish")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("//evil.com/phish")).toBe("/dashboard");
  });

  it("rejects backslash variants browsers normalize to //", () => {
    expect(safeNext("/\\evil.com")).toBe("/dashboard");
  });

  it("rejects paths without a leading slash", () => {
    expect(safeNext("dashboard")).toBe("/dashboard");
    expect(safeNext("javascript:alert(1)")).toBe("/dashboard");
  });

  it("uses the supplied fallback instead of /dashboard", () => {
    expect(safeNext(null, "/reset-password")).toBe("/reset-password");
    expect(safeNext("", "/reset-password")).toBe("/reset-password");
  });

  it("still rejects unsafe targets when a fallback is supplied", () => {
    expect(safeNext("https://evil.com", "/reset-password")).toBe("/reset-password");
    expect(safeNext("//evil.com", "/reset-password")).toBe("/reset-password");
    expect(safeNext("/\\evil.com", "/reset-password")).toBe("/reset-password");
  });

  it("still honors an explicit safe next over the fallback", () => {
    expect(safeNext("/dashboard/settings", "/reset-password")).toBe(
      "/dashboard/settings"
    );
  });
});

describe("defaultNextForType", () => {
  it("sends recovery links to the password form", () => {
    expect(defaultNextForType("recovery")).toBe("/reset-password");
  });

  it("sends every other link type to the dashboard", () => {
    expect(defaultNextForType("signup")).toBe("/dashboard");
    expect(defaultNextForType("magiclink")).toBe("/dashboard");
    expect(defaultNextForType("email_change")).toBe("/dashboard");
    expect(defaultNextForType(null)).toBe("/dashboard");
  });
});
