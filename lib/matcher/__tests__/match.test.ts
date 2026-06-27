import { describe, expect, it } from "vitest";

import type {
  InventoryItem,
  RecipeDetail,
  RecipeIngredient,
} from "@/lib/brewfather/types";
import {
  buildInventoryIndex,
  hasUnitMismatch,
  matchIngredient,
  matchRecipeIngredients,
} from "@/lib/matcher/match";

const inventory: InventoryItem[] = [
  { id: "f-pils", name: "Pilsner Malt", category: "fermentable", amount: 5, unit: "kg" },
  { id: "h-cascade", name: "Cascade (US)", category: "hop", amount: 200, unit: "g", alpha: 5.5 },
  { id: "y-us05", name: "SafAle US-05", category: "yeast", amount: 2, unit: "pkg" },
];

const index = buildInventoryIndex(inventory);

function ingredient(overrides: Partial<RecipeIngredient>): RecipeIngredient {
  return {
    id: "",
    name: "Unnamed",
    category: "hop",
    amount: 10,
    unit: "g",
    ...overrides,
  };
}

describe("matchIngredient", () => {
  it("matches by stable id first (ignoring the name)", () => {
    const match = matchIngredient(
      ingredient({ id: "h-cascade", name: "totally different", amount: 50 }),
      index
    );
    expect(match.matchedBy).toBe("id");
    expect(match.inventoryItem?.id).toBe("h-cascade");
    expect(match.status).toBe("satisfied");
    expect(match.have).toBe(200);
  });

  it("falls back to a normalized-name fuzzy match when there is no id", () => {
    const match = matchIngredient(
      ingredient({ id: "", name: "Cascade", amount: 50 }),
      index
    );
    expect(match.matchedBy).toBe("name");
    expect(match.inventoryItem?.id).toBe("h-cascade");
    expect(match.status).toBe("satisfied");
  });

  it("reports a shortfall when stock is insufficient", () => {
    const match = matchIngredient(
      ingredient({ id: "h-cascade", amount: 300 }),
      index
    );
    expect(match.status).toBe("short");
    expect(match.have).toBe(200);
    expect(match.need).toBe(300);
    expect(match.shortfall).toBe(100);
  });

  it("marks a fully missing ingredient", () => {
    const match = matchIngredient(
      ingredient({ id: "", name: "Citra", category: "hop", amount: 40 }),
      index
    );
    expect(match.status).toBe("missing");
    expect(match.inventoryItem).toBeUndefined();
    expect(match.matchedBy).toBeUndefined();
    expect(match.have).toBe(0);
    expect(match.shortfall).toBe(40);
  });

  it("compares across compatible units (kg stock vs g need)", () => {
    const match = matchIngredient(
      ingredient({ id: "f-pils", category: "fermentable", amount: 3000, unit: "g" }),
      index
    );
    // 5 kg of stock = 5000 g >= 3000 g
    expect(match.status).toBe("satisfied");
    expect(match.have).toBe(5000);
  });

  it("does not match an id when the category differs, then falls through to missing", () => {
    const match = matchIngredient(
      ingredient({ id: "h-cascade", name: "Cascade", category: "fermentable", amount: 1, unit: "kg" }),
      index
    );
    expect(match.matchedBy).toBeUndefined();
    expect(match.status).toBe("missing");
  });

  it("treats zero stock as missing, not short", () => {
    const zeroIndex = buildInventoryIndex([
      { id: "h-x", name: "Spalt", category: "hop", amount: 0, unit: "g" },
    ]);
    const match = matchIngredient(ingredient({ id: "h-x", amount: 10 }), zeroIndex);
    expect(match.status).toBe("missing");
    expect(match.have).toBe(0);
  });

  it("flags a unit mismatch and compares raw amounts", () => {
    const match = matchIngredient(
      ingredient({ id: "y-us05", category: "yeast", amount: 1, unit: "g" }),
      index
    );
    // pkg (count) vs g (mass) are incomparable -> raw amount used, flagged.
    expect(hasUnitMismatch(match)).toBe(true);
    expect(match.have).toBe(2);
    expect(match.status).toBe("satisfied");
  });
});

describe("matchRecipeIngredients (shared stock within a recipe)", () => {
  it("reserves stock across lines that resolve to the same inventory item", () => {
    const recipe: RecipeDetail = {
      id: "r",
      name: "Double Cascade",
      fermentables: [],
      // 30g + 20g = 50g of Cascade required, but only 40g is in stock.
      hops: [
        { id: "h-cascade", name: "Cascade", category: "hop", amount: 30, unit: "g" },
        { id: "h-cascade", name: "Cascade", category: "hop", amount: 20, unit: "g" },
      ],
      yeasts: [],
      miscs: [],
    };
    const cascadeIndex = buildInventoryIndex([
      { id: "h-cascade", name: "Cascade", category: "hop", amount: 40, unit: "g" },
    ]);

    const [first, second] = matchRecipeIngredients(recipe, cascadeIndex);

    // First line consumes 30 of 40.
    expect(first!.status).toBe("satisfied");
    expect(first!.have).toBe(40);
    // Second line sees only the remaining 10 -> short by 10 (not a false satisfy).
    expect(second!.status).toBe("short");
    expect(second!.have).toBe(10);
    expect(second!.shortfall).toBe(10);
  });
});
