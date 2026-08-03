/**
 * Accepted substitutions through `matchRecipes` — the point of the feature is
 * that an acceptance moves readiness, so the assertions are about status,
 * score and bucket, not just about the row rendering differently.
 */
import { describe, expect, it } from "vitest";

import type { InventoryItem, RecipeDetail } from "@/lib/brewfather/types";
import { matchRecipes } from "@/lib/matcher";
import { ingredientKey } from "@/lib/matcher/normalize";

const PILSNER: InventoryItem = {
  id: "inv-pils",
  name: "Pilsner Malt",
  category: "fermentable",
  amount: 25,
  unit: "kg",
};
const MOSAIC: InventoryItem = {
  id: "inv-mosaic",
  name: "Mosaic",
  category: "hop",
  amount: 200,
  unit: "g",
};

const RECIPE: RecipeDetail = {
  id: "r1",
  name: "Test IPA",
  fermentables: [
    { id: "", name: "Pilsner Malt", category: "fermentable", amount: 5, unit: "kg" },
  ],
  hops: [{ id: "", name: "Citra", category: "hop", amount: 50, unit: "g" }],
  yeasts: [],
  miscs: [],
};

/** An acceptance map as `matchRecipes` expects it: keyed `recipeId key`. */
function accept(
  recipeId: string,
  category: "fermentable" | "hop",
  name: string,
  item: InventoryItem
) {
  return new Map([
    [
      `${recipeId} ${ingredientKey(category, name)}`,
      { inventoryItemId: item.id, inventoryItemName: item.name },
    ],
  ]);
}

const inventory = [PILSNER, MOSAIC];

describe("accepted substitutions", () => {
  it("leaves a hop unsatisfied until it is accepted", () => {
    const before = matchRecipes({ inventory, recipes: [RECIPE] }).candidates[0]!;
    const hop = before.ingredientMatches.find(
      (m) => m.ingredient.category === "hop"
    )!;

    expect(hop.status).toBe("missing");
    expect(hop.substitutes?.[0]?.inventoryItem.name).toBe("Mosaic");
    expect(before.bucket).not.toBe("brew_now");
  });

  it("satisfies the line and moves readiness once accepted", () => {
    const after = matchRecipes(
      { inventory, recipes: [RECIPE] },
      { accepted: accept("r1", "hop", "Citra", MOSAIC) }
    ).candidates[0]!;
    const hop = after.ingredientMatches.find(
      (m) => m.ingredient.category === "hop"
    )!;

    expect(hop.status).toBe("satisfied");
    expect(hop.matchedBy).toBe("accepted");
    expect(hop.inventoryItem?.name).toBe("Mosaic");
    expect(after.score).toBe(1);
    expect(after.bucket).toBe("brew_now");
  });

  it("keeps the acceptance scoped to its own recipe", () => {
    const other: RecipeDetail = { ...RECIPE, id: "r2", name: "Other IPA" };
    const result = matchRecipes(
      { inventory, recipes: [RECIPE, other] },
      { accepted: accept("r1", "hop", "Citra", MOSAIC) }
    );

    const first = result.candidates.find((c) => c.recipe.id === "r1")!;
    const second = result.candidates.find((c) => c.recipe.id === "r2")!;
    const hopOf = (c: typeof first) =>
      c.ingredientMatches.find((m) => m.ingredient.category === "hop")!;

    expect(hopOf(first).matchedBy).toBe("accepted");
    expect(hopOf(second).status).toBe("missing");
  });

  it("falls back to the named row when the accepted id is gone", () => {
    // Brewfather routinely replaces an inventory row with an equivalent one.
    const replaced: InventoryItem = { ...MOSAIC, id: "inv-mosaic-new" };
    const after = matchRecipes(
      { inventory: [PILSNER, replaced], recipes: [RECIPE] },
      { accepted: accept("r1", "hop", "Citra", MOSAIC) }
    ).candidates[0]!;

    expect(
      after.ingredientMatches.find((m) => m.ingredient.category === "hop")!.matchedBy
    ).toBe("accepted");
  });

  it("reports short rather than satisfied when the accepted stock runs out", () => {
    const thin: InventoryItem = { ...MOSAIC, amount: 20 };
    const hop = matchRecipes(
      { inventory: [PILSNER, thin], recipes: [RECIPE] },
      { accepted: accept("r1", "hop", "Citra", MOSAIC) }
    ).candidates[0]!.ingredientMatches.find(
      (m) => m.ingredient.category === "hop"
    )!;

    expect(hop.status).toBe("short");
    expect(hop.have).toBe(20);
  });

  it("ignores an acceptance naming an item that is not in stock", () => {
    const hop = matchRecipes(
      { inventory: [PILSNER], recipes: [RECIPE] },
      { accepted: accept("r1", "hop", "Citra", MOSAIC) }
    ).candidates[0]!.ingredientMatches.find(
      (m) => m.ingredient.category === "hop"
    )!;

    expect(hop.status).toBe("missing");
    expect(hop.matchedBy).toBeUndefined();
  });

  it("never overrides an ingredient the brewer already has", () => {
    const stocked: RecipeDetail = { ...RECIPE, hops: [] };
    const malt = matchRecipes(
      { inventory, recipes: [stocked] },
      { accepted: accept("r1", "fermentable", "Pilsner Malt", MOSAIC) }
    ).candidates[0]!.ingredientMatches[0]!;

    expect(malt.matchedBy).not.toBe("accepted");
    expect(malt.inventoryItem?.name).toBe("Pilsner Malt");
  });
});
