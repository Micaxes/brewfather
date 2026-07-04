import { describe, expect, it } from "vitest";

import { safeNext } from "@/lib/auth/safe-next";

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
});
