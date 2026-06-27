import { describe, expect, it } from "vitest";

import {
  comparableMagnitude,
  convertAmount,
  getUnitDimension,
  normalizeName,
  normalizeUnit,
} from "@/lib/matcher/normalize";

describe("normalizeName", () => {
  const cases: Array<[string, string]> = [
    ["Cascade", "cascade"],
    ["  Maris   Otter  ", "maris otter"],
    ["Cascade (US) - Leaf", "cascade us leaf"],
    ["2-Row Pale Malt", "2 row pale malt"],
    ["Saaz®", "saaz"],
    ["Café Crème", "cafe creme"],
    ["Hallertau Mittelfrüh", "hallertau mittelfruh"],
  ];
  it.each(cases)("normalizes %j -> %j", (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });
});

describe("normalizeUnit", () => {
  it("lowercases, trims, and drops a trailing dot", () => {
    expect(normalizeUnit("  KG ")).toBe("kg");
    expect(normalizeUnit("g.")).toBe("g");
  });
});

describe("getUnitDimension", () => {
  const cases: Array<[string, ReturnType<typeof getUnitDimension>]> = [
    ["kg", "mass"],
    ["g", "mass"],
    ["oz", "mass"],
    ["l", "volume"],
    ["ml", "volume"],
    ["pkg", "count"],
    ["each", "count"],
    ["sploops", "unknown"],
  ];
  it.each(cases)("%s -> %s", (unit, dimension) => {
    expect(getUnitDimension(unit)).toBe(dimension);
  });
});

describe("convertAmount", () => {
  it("converts within mass", () => {
    expect(convertAmount(2, "kg", "g")).toBe(2000);
    expect(convertAmount(500, "g", "kg")).toBe(0.5);
  });

  it("converts within volume", () => {
    expect(convertAmount(1.5, "l", "ml")).toBe(1500);
  });

  it("is a no-op for identical units", () => {
    expect(convertAmount(7, "g", "g")).toBe(7);
  });

  it("returns null across different dimensions", () => {
    expect(convertAmount(1, "kg", "ml")).toBeNull();
    expect(convertAmount(1, "pkg", "g")).toBeNull();
  });

  it("compares identical unknown units as-is but null for differing unknowns", () => {
    expect(convertAmount(3, "blob", "blob")).toBe(3);
    expect(convertAmount(3, "blob", "blip")).toBeNull();
  });
});

describe("comparableMagnitude", () => {
  it("scales known units to their base", () => {
    expect(comparableMagnitude(2, "kg")).toBe(2000);
    expect(comparableMagnitude(250, "g")).toBe(250);
  });

  it("passes unknown units through unchanged", () => {
    expect(comparableMagnitude(4, "blob")).toBe(4);
  });
});
