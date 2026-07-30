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

  it("only substitutes fermentables", () => {
    const candidate = matchOne(
      recipe([], {
        hops: [{ id: "", name: "Citra", category: "hop", amount: 50, unit: "g" }],
      }),
      [{ id: "h1", name: "Mosaic", category: "hop", amount: 200, unit: "g" }]
    );
    const match = candidate.ingredientMatches[0]!;

    expect(match.substitutes).toBeUndefined();
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
