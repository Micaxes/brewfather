import { describe, expect, it } from "vitest";

import type { IngredientCategory, RecipeIngredient } from "@/lib/brewfather/types";
import type { IngredientMatch, MatchStatus } from "@/lib/matcher/types";
import {
  ALMOST_SCORE_THRESHOLD,
  bucketFor,
  buildShoppingList,
  classifyImportance,
  findBaseMalts,
  scoreRecipe,
} from "@/lib/matcher/score";

function ing(
  category: IngredientCategory,
  name: string,
  amount: number,
  unit = category === "fermentable" ? "kg" : "g"
): RecipeIngredient {
  return { id: "", name, category, amount, unit };
}

function mkMatch(
  ingredient: RecipeIngredient,
  status: MatchStatus,
  have: number
): IngredientMatch {
  return {
    ingredient,
    status,
    have,
    need: ingredient.amount,
    shortfall: Math.max(ingredient.amount - have, 0),
  };
}

describe("findBaseMalts", () => {
  it("treats a dominant fermentable as the base malt", () => {
    const base = ing("fermentable", "Pale", 9);
    const specialty = ing("fermentable", "Crystal", 1);
    const result = findBaseMalts([base, specialty]);
    expect(result.has(base)).toBe(true);
    expect(result.has(specialty)).toBe(false);
  });

  it("treats every fermentable at or above the share threshold as base", () => {
    const a = ing("fermentable", "A", 4);
    const b = ing("fermentable", "B", 4);
    const c = ing("fermentable", "C", 2);
    const result = findBaseMalts([a, b, c]);
    expect(result.has(a)).toBe(true);
    expect(result.has(b)).toBe(true);
    expect(result.has(c)).toBe(false);
  });

  it("always includes the largest even below the threshold, and handles empty", () => {
    const a = ing("fermentable", "A", 1);
    const b = ing("fermentable", "B", 1);
    const c = ing("fermentable", "C", 1);
    const d = ing("fermentable", "D", 1);
    // four equal => each share 0.25 < 0.3, but the largest (first) is still base.
    expect(findBaseMalts([a, b, c, d]).has(a)).toBe(true);
    expect(findBaseMalts([]).size).toBe(0);
  });

  it("compares across units (kg vs g) when picking the base", () => {
    const big = ing("fermentable", "Base", 4, "kg"); // 4000 g
    const small = ing("fermentable", "Tiny", 900, "g"); // 900 g
    const result = findBaseMalts([big, small]);
    expect(result.has(big)).toBe(true);
    expect(result.has(small)).toBe(false);
  });
});

describe("classifyImportance", () => {
  it("classifies by category and base-malt status", () => {
    expect(classifyImportance(ing("yeast", "US-05", 1), false)).toBe("critical");
    expect(classifyImportance(ing("fermentable", "Pale", 5), true)).toBe("critical");
    expect(classifyImportance(ing("fermentable", "Crystal", 1), false)).toBe("medium");
    expect(classifyImportance(ing("hop", "Cascade", 50), false)).toBe("high");
    expect(classifyImportance(ing("misc", "Irish Moss", 5), false)).toBe("low");
  });
});

describe("scoreRecipe", () => {
  it("returns 1 when everything is satisfied", () => {
    const base = ing("fermentable", "Pale", 5);
    const yeast = ing("yeast", "US-05", 1);
    const matches = [mkMatch(base, "satisfied", 5), mkMatch(yeast, "satisfied", 1)];
    expect(scoreRecipe(matches, new Set([base]))).toBe(1);
  });

  it("gives partial credit for short and zero for missing, weighted by importance", () => {
    const base = ing("fermentable", "Pale", 5);
    const hop = ing("hop", "Cascade", 2);
    const yeast = ing("yeast", "US-05", 1);
    const matches = [
      mkMatch(base, "satisfied", 5), // critical 1.0 * 1
      mkMatch(hop, "short", 1), // high 0.7 * 0.5
      mkMatch(yeast, "missing", 0), // critical 1.0 * 0
    ];
    // (1 + 0.35 + 0) / (1 + 0.7 + 1) = 1.35 / 2.7 = 0.5
    expect(scoreRecipe(matches, new Set([base]))).toBe(0.5);
  });

  it("returns 0 for an empty ingredient list", () => {
    expect(scoreRecipe([], new Set())).toBe(0);
  });
});

describe("bucketFor", () => {
  const satisfied = mkMatch(ing("yeast", "US-05", 1), "satisfied", 1);
  const missing = mkMatch(ing("misc", "Whirlfloc", 1), "missing", 0);

  it("is brew_now only when all ingredients are satisfied", () => {
    expect(bucketFor([satisfied], 1)).toBe("brew_now");
  });

  it("is not_yet for an empty recipe", () => {
    expect(bucketFor([], 1)).toBe("not_yet");
  });

  it("is almost at or above the threshold, not_yet just below", () => {
    expect(bucketFor([satisfied, missing], ALMOST_SCORE_THRESHOLD)).toBe("almost");
    expect(bucketFor([satisfied, missing], ALMOST_SCORE_THRESHOLD - 0.001)).toBe(
      "not_yet"
    );
  });
});

describe("buildShoppingList", () => {
  it("lists only shortfalls (short + missing) with ingredient name/category/unit", () => {
    const list = buildShoppingList([
      mkMatch(ing("fermentable", "Pale", 5), "satisfied", 5),
      mkMatch(ing("hop", "Citra", 150), "short", 100),
      mkMatch(ing("misc", "Whirlfloc", 1, "each"), "missing", 0),
    ]);
    expect(list).toEqual([
      { name: "Citra", category: "hop", amount: 50, unit: "g" },
      { name: "Whirlfloc", category: "misc", amount: 1, unit: "each" },
    ]);
  });

  it("is empty when nothing is short", () => {
    expect(
      buildShoppingList([mkMatch(ing("yeast", "US-05", 1), "satisfied", 1)])
    ).toEqual([]);
  });
});
