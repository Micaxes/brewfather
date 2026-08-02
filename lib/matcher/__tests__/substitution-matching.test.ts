/**
 * End-to-end behaviour of the malt-substitution pass through `matchRecipes`:
 * a malt the user doesn't own can now be satisfied by an equivalent they do,
 * which is what moves recipes between buckets.
 */
import { describe, expect, it } from "vitest";

import type {
  InventoryItem,
  RecipeDetail,
  RecipeIngredient,
} from "@/lib/brewfather/types";
import { matchRecipes } from "@/lib/matcher";

function malt(name: string, amount: number, unit = "kg"): InventoryItem {
  return { id: `inv-${name}`, name, category: "fermentable", amount, unit };
}

function grain(name: string, amount: number, unit = "kg"): RecipeIngredient {
  return { id: "", name, category: "fermentable", amount, unit };
}

function recipe(
  fermentables: RecipeIngredient[],
  extra: Partial<RecipeDetail> = {}
): RecipeDetail {
  return {
    id: "r1",
    name: "Test Recipe",
    fermentables,
    hops: [],
    yeasts: [],
    miscs: [],
    ...extra,
  };
}

/** Match one recipe against one inventory and return its ingredient matches. */
function matchOne(recipes: RecipeDetail, inventory: InventoryItem[]) {
  const result = matchRecipes({ inventory, recipes: [recipes] });
  return result.candidates[0]!;
}

describe("duplicate inventory rows", () => {
  // Brewfather leaves catalog entries in the inventory at zero, so the same
  // malt appears twice — once empty, once stocked. Which one a recipe hits was
  // decided by whichever _id it happened to carry: "Oats, Flaked" read
  // "missing" in one recipe and "in stock" in another, off the same inventory.
  const empty: InventoryItem = {
    id: "default-empty",
    name: "Oats, Flaked",
    category: "fermentable",
    amount: 0,
    unit: "kg",
  };
  const stocked: InventoryItem = {
    id: "default-stocked",
    name: "Oats, Flaked",
    category: "fermentable",
    amount: 8.95,
    unit: "kg",
  };

  it("prefers the stocked twin when the id points at an empty row", () => {
    const candidate = matchOne(
      recipe([
        { id: "default-empty", name: "Oats, Flaked", category: "fermentable", amount: 0.41, unit: "kg" },
      ]),
      [empty, stocked]
    );
    const match = candidate.ingredientMatches[0]!;

    expect(match.status).toBe("satisfied");
    expect(match.inventoryItem?.id).toBe("default-stocked");
    expect(match.have).toBe(8.95);
  });

  it("prefers the stocked twin on the fuzzy-name path too", () => {
    const candidate = matchOne(
      recipe([grain("Oats, Flaked", 0.41)]),
      [empty, stocked]
    );

    expect(candidate.ingredientMatches[0]!.status).toBe("satisfied");
  });

  it("picks the fullest twin when several hold stock", () => {
    const candidate = matchOne(
      recipe([grain("Oats, Flaked", 0.41)]),
      [empty, { ...stocked, id: "small", amount: 0.2 }, stocked]
    );

    expect(candidate.ingredientMatches[0]!.inventoryItem?.id).toBe("default-stocked");
  });

  it("stays missing when every twin is empty", () => {
    const candidate = matchOne(
      recipe([grain("Oats, Flaked", 0.41)]),
      [empty, { ...empty, id: "other-empty" }]
    );

    expect(candidate.ingredientMatches[0]!.status).toBe("missing");
  });

  it("never redirects to a different ingredient", () => {
    const candidate = matchOne(
      recipe([grain("Oats, Flaked", 0.41)]),
      [empty, malt("Pilsner Malt", 25)]
    );

    expect(candidate.ingredientMatches[0]!.inventoryItem?.name).not.toBe("Pilsner Malt");
  });

  it("respects stock already reserved by an earlier line", () => {
    // Two lines, one stocked twin holding 8.95 kg: the second must not be
    // handed stock the first already claimed.
    const candidate = matchOne(
      recipe([grain("Oats, Flaked", 8), grain("Oats, Flaked", 8)]),
      [empty, stocked]
    );
    const [first, second] = candidate.ingredientMatches;

    // Duplicate lines merge into one 16 kg requirement, which 8.95 cannot meet.
    expect(first!.status).toBe("short");
    expect(second).toBeUndefined();
  });
});

describe("malt substitution through matchRecipes", () => {
  it("satisfies a missing malt with an in-stock equivalent", () => {
    const candidate = matchOne(
      recipe([grain("Weyermann Caramunich Type 2", 1)]),
      [malt("Crisp Crystal 120", 5)]
    );
    const match = candidate.ingredientMatches[0]!;

    expect(match.status).toBe("satisfied");
    expect(match.matchedBy).toBe("equivalent");
    expect(match.inventoryItem?.name).toBe("Crisp Crystal 120");
    expect(match.substitutes?.[0]?.justification).toMatch(/equivalence row/i);
  });

  it("moves a recipe into brew_now on the strength of a substitute", () => {
    const candidate = matchOne(
      recipe([grain("Weyermann Pilsner", 4), grain("Weyermann Caramunich Type 2", 1)]),
      [malt("Weyermann Pilsner", 10), malt("Crisp Crystal 120", 5)]
    );

    expect(candidate.bucket).toBe("brew_now");
    expect(candidate.score).toBe(1);
  });

  it("leaves a malt with no usable equivalent missing", () => {
    const candidate = matchOne(
      recipe([grain("Weyermann Caramunich Type 2", 1)]),
      [malt("Weyermann Pilsner", 10)] // base malt, wrong class
    );
    const match = candidate.ingredientMatches[0]!;

    expect(match.status).toBe("missing");
    expect(match.matchedBy).toBeUndefined();
    expect(match.substitutes).toBeUndefined();
  });

  it("does not silently swap Black Malt for Roasted Barley (rule 5)", () => {
    const candidate = matchOne(
      recipe([grain("Crisp Black Malt", 0.3)]),
      [malt("Château Roasted Barley", 5)]
    );
    const match = candidate.ingredientMatches[0]!;

    expect(match.status).toBe("missing");
    expect(match.matchedBy).toBeUndefined();
  });

  it("suggests substitutes for a short malt without changing its status", () => {
    const candidate = matchOne(
      recipe([grain("Weyermann Caramunich Type 2", 2)]),
      [malt("Weyermann Caramunich Type 2", 0.5), malt("Crisp Crystal 120", 5)]
    );
    const match = candidate.ingredientMatches[0]!;

    expect(match.status).toBe("short");
    expect(match.substitutes?.[0]?.inventoryItem.name).toBe("Crisp Crystal 120");
  });

  it("does not propose a substitute the recipe already resolved to", () => {
    const candidate = matchOne(
      recipe([grain("Crisp Crystal 120", 2)]),
      [malt("Crisp Crystal 120", 0.5)]
    );
    const match = candidate.ingredientMatches[0]!;

    expect(match.status).toBe("short");
    expect(
      match.substitutes?.some((s) => s.inventoryItem.name === "Crisp Crystal 120")
    ).not.toBe(true);
  });

  it("reserves substituted stock so two lines cannot claim the same sack", () => {
    // 5 kg of Crystal 120 cannot cover two 4 kg lines.
    const candidate = matchOne(
      recipe([
        grain("Weyermann Caramunich Type 2", 4),
        grain("Château Cara Gold", 4),
      ]),
      [malt("Crisp Crystal 120", 5)]
    );
    const [first, second] = candidate.ingredientMatches;

    expect(first!.status).toBe("satisfied");
    expect(first!.matchedBy).toBe("equivalent");
    expect(second!.status).toBe("missing");
  });

  it("proposes a chart-sanctioned hop but never resolves the line with it", () => {
    // The hop chart lists Mosaic as a substitute for Citra, so it is offered —
    // but a hop is never auto-applied: RecipeIngredient carries no use/time, so
    // we cannot tell a bittering charge from a whirlpool addition, and the
    // right weight adjustment differs between them. The brewer decides.
    const candidate = matchOne(
      recipe([], {
        hops: [{ id: "", name: "Citra", category: "hop", amount: 50, unit: "g" }],
      }),
      [{ id: "h1", name: "Mosaic", category: "hop", amount: 200, unit: "g" }]
    );
    const match = candidate.ingredientMatches[0]!;

    expect(match.substitutes?.[0]?.inventoryItem.name).toBe("Mosaic");
    expect(match.status).toBe("missing");
    expect(match.matchedBy).toBeUndefined();
    // Weight is never pre-scaled by alpha — that is only right for bittering.
    expect(match.substitutes?.[0]?.doseFactor).toBe(1);
  });

  it("offers no hop the chart does not sanction", () => {
    const candidate = matchOne(
      recipe([], {
        hops: [{ id: "", name: "Citra", category: "hop", amount: 50, unit: "g" }],
      }),
      [{ id: "h1", name: "Saaz", category: "hop", amount: 200, unit: "g" }]
    );

    expect(candidate.ingredientMatches[0]!.substitutes).toBeUndefined();
  });

  // The whole point of a substitution is that you do not have to buy anything:
  // an `equivalent` line has no shortfall, so it must not reappear as a line to
  // buy. A regression here would send the user shopping for a malt they were
  // told they could brew without.
  it("keeps a malt satisfied by an equivalent off the shopping list", () => {
    const candidate = matchOne(
      recipe([
        grain("Weyermann Pilsner", 4),
        grain("Weyermann Caramunich Type 2", 1),
        grain("Crisp Chocolate Malt", 0.2), // no equivalent in stock
      ]),
      [malt("Weyermann Pilsner", 10), malt("Crisp Crystal 120", 5)]
    );
    const substituted = candidate.ingredientMatches[1]!;

    expect(substituted.matchedBy).toBe("equivalent");
    expect(substituted.shortfall).toBe(0);
    // The genuinely missing malt still has to be bought — this asserts the
    // shopping list was built (not empty for an unrelated reason).
    expect(candidate.shoppingList.map((item) => item.name)).toEqual([
      "Crisp Chocolate Malt",
    ]);
  });

  it("uses the recipe style to pick between equally-close equivalents", () => {
    const candidate = matchOne(
      recipe([grain("Crisp Crystal 120", 1)], { style: "Belgian Dubbel" }),
      [malt("Weyermann Caramunich Type 2", 5), malt("Château Cara Gold", 5)]
    );
    const match = candidate.ingredientMatches[0]!;

    expect(match.inventoryItem?.name).toBe("Château Cara Gold");
  });
});
