import { describe, expect, it } from "vitest";

import { buildScaledRecipePayload } from "@/lib/brewfather/scaled-recipe";

/** Trimmed but representative raw Brewfather recipe (mirrors the real /v2/recipes/:id shape). */
function rawRecipe(): Record<string, unknown> {
  return {
    _id: "abc123",
    _rev: "9-xyz",
    _created: { seconds: 1 },
    _timestamp: { seconds: 1 },
    _timestamp_ms: 1000,
    _version: "1.0",
    _uid: "user1",
    _public: false,
    _type: "recipe",
    name: "Hoegaarden Clone",
    author: "Mia",
    type: "All Grain",
    batchSize: 23,
    boilSize: 28,
    boilTime: 60,
    fermentablesTotalAmount: 5.29,
    hopsTotalAmount: 36.8,
    fermentables: [
      { _id: "f1", name: "Pilsner", amount: 3.5, type: "Grain" },
      { _id: "f2", name: "Wheat", amount: 1.79, type: "Grain" },
    ],
    hops: [{ _id: "h1", name: "Saaz", amount: 36.8, alpha: 3.5, use: "Boil" }],
    yeasts: [{ _id: "y1", name: "Belgian Wit", amount: 1, unit: "pkg" }],
    miscs: [{ _id: "m1", name: "Coriander", amount: 20, unit: "g" }],
  };
}

describe("buildScaledRecipePayload", () => {
  it("scales batch/boil sizes and every ingredient amount by the factor", () => {
    const out = buildScaledRecipePayload(rawRecipe(), 2);

    expect(out.batchSize).toBe(46);
    expect(out.boilSize).toBe(56);
    expect(out.fermentablesTotalAmount).toBe(10.58);
    expect(out.hopsTotalAmount).toBe(73.6);
    expect((out.fermentables as Array<{ amount: number }>)[0]!.amount).toBe(7);
    expect((out.fermentables as Array<{ amount: number }>)[1]!.amount).toBe(3.58);
    expect((out.hops as Array<{ amount: number }>)[0]!.amount).toBe(73.6);
    expect((out.yeasts as Array<{ amount: number }>)[0]!.amount).toBe(2);
    expect((out.miscs as Array<{ amount: number }>)[0]!.amount).toBe(40);
  });

  it("handles fractional factors with rounding", () => {
    const out = buildScaledRecipePayload(rawRecipe(), 1.5);
    expect(out.batchSize).toBe(34.5);
    expect((out.fermentables as Array<{ amount: number }>)[0]!.amount).toBe(5.25); // 3.5 * 1.5
  });

  it("strips server-managed identity/version fields so a fresh recipe is created", () => {
    const out = buildScaledRecipePayload(rawRecipe(), 2);
    for (const key of ["_id", "_rev", "_created", "_timestamp", "_timestamp_ms", "_version", "_uid"]) {
      expect(out[key]).toBeUndefined();
    }
    // Ingredient-level ids are preserved (they reference library items).
    expect((out.fermentables as Array<{ _id: string }>)[0]!._id).toBe("f1");
  });

  it("sets a default scaled name and preserves non-scaled fields", () => {
    const out = buildScaledRecipePayload(rawRecipe(), 1.5);
    expect(out.name).toBe("Hoegaarden Clone (scaled ×1.5)");
    expect(out.author).toBe("Mia");
    expect(out.type).toBe("All Grain");
    expect(out.boilTime).toBe(60); // time is not a volume — must NOT scale
  });

  it("honors a custom name override", () => {
    const out = buildScaledRecipePayload(rawRecipe(), 2, { name: "Double Hoegaarden" });
    expect(out.name).toBe("Double Hoegaarden");
  });

  it("rejects invalid input", () => {
    expect(() => buildScaledRecipePayload(null, 2)).toThrow();
    expect(() => buildScaledRecipePayload(rawRecipe(), 0)).toThrow();
    expect(() => buildScaledRecipePayload(rawRecipe(), -1)).toThrow();
    expect(() => buildScaledRecipePayload(rawRecipe(), Number.NaN)).toThrow();
  });
});
