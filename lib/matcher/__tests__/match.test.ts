import { describe, expect, it } from "vitest";

import type {
  InventoryItem,
  RecipeDetail,
  RecipeIngredient,
} from "@/lib/brewfather/types";
import {
  buildInventoryIndex,
  hasUnitMismatch,
  isItemsUnit,
  matchIngredient,
  matchRecipeIngredients,
  prepareIngredients,
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

  it("compares pkg stock against a gram need (1 pkg = 12 g)", () => {
    const match = matchIngredient(
      ingredient({ id: "y-us05", category: "yeast", amount: 20, unit: "g" }),
      index
    );
    // 2 pkg of stock = 24 g >= 20 g.
    expect(hasUnitMismatch(match)).toBe(false);
    expect(match.have).toBe(24);
    expect(match.status).toBe("satisfied");
  });

  it("flags a unit mismatch and compares raw amounts", () => {
    const vialIndex = buildInventoryIndex([
      { id: "y-wlp001", name: "WLP001 California Ale", category: "yeast", amount: 2, unit: "vial" },
    ]);
    const match = matchIngredient(
      ingredient({ id: "y-wlp001", category: "yeast", amount: 1, unit: "g" }),
      vialIndex
    );
    // vial (count) vs g (measure) are incomparable -> raw amount used, flagged.
    expect(hasUnitMismatch(match)).toBe(true);
    expect(match.have).toBe(2);
    expect(match.status).toBe("satisfied");
  });
});

function recipe(overrides: Partial<RecipeDetail>): RecipeDetail {
  return {
    id: "r",
    name: "Test Recipe",
    fermentables: [],
    hops: [],
    yeasts: [],
    miscs: [],
    ...overrides,
  };
}

describe("isItemsUnit", () => {
  it("recognizes items/item in any casing but not real units", () => {
    expect(isItemsUnit("items")).toBe(true);
    expect(isItemsUnit("item")).toBe(true);
    expect(isItemsUnit(" Items ")).toBe(true);
    expect(isItemsUnit("g")).toBe(false);
    expect(isItemsUnit("each")).toBe(false);
  });
});

describe("prepareIngredients (cleaned pipeline)", () => {
  it("drops any ingredient measured in items", () => {
    const r = recipe({
      hops: [{ id: "h1", name: "Cascade", category: "hop", amount: 50, unit: "g" }],
      miscs: [
        { id: "m1", name: "Electricity", category: "misc", amount: 1, unit: "items" },
        { id: "m2", name: "Whirlfloc", category: "misc", amount: 2, unit: "items" },
        { id: "m3", name: "Irish Moss", category: "misc", amount: 5, unit: "g" },
      ],
    });

    const { all } = prepareIngredients(r);

    expect(all.map((i) => i.name)).toEqual(["Cascade", "Irish Moss"]);
  });

  it("merges duplicate lines (same category + normalized name) into one summed line", () => {
    const r = recipe({
      hops: [
        { id: "h-cascade", name: "Cascade", category: "hop", amount: 30, unit: "g" },
        { id: "h-cascade", name: "Cascade", category: "hop", amount: 20, unit: "g" },
      ],
    });

    const { all } = prepareIngredients(r);

    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: "Cascade", amount: 50, unit: "g" });
  });

  it("merges across compatible units into the first line's unit", () => {
    const r = recipe({
      fermentables: [
        { id: "f1", name: "Pilsner", category: "fermentable", amount: 1, unit: "kg" },
        { id: "f1", name: "Pilsner", category: "fermentable", amount: 500, unit: "g" },
      ],
    });

    const { all, fermentables } = prepareIngredients(r);

    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: "Pilsner", amount: 1.5, unit: "kg" });
    // The fermentable subset shares the same references as `all`.
    expect(fermentables[0]).toBe(all[0]);
  });

  it("keeps incomparable same-name lines separate and takes the first non-empty id", () => {
    const r = recipe({
      miscs: [
        { id: "", name: "Gypsum", category: "misc", amount: 4, unit: "g" },
        { id: "m-gypsum", name: "Gypsum", category: "misc", amount: 2, unit: "g" },
        { id: "", name: "Gypsum", category: "misc", amount: 1, unit: "tsp" },
      ],
    });

    const { all } = prepareIngredients(r);

    // g + g merged (adopting the later line's id); tsp incomparable -> separate.
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ id: "m-gypsum", amount: 6, unit: "g" });
    expect(all[1]).toMatchObject({ amount: 1, unit: "tsp" });
  });

  it("does not mutate the recipe's ingredient objects when merging", () => {
    const first = { id: "h1", name: "Cascade", category: "hop" as const, amount: 30, unit: "g" };
    const r = recipe({
      hops: [first, { id: "h1", name: "Cascade", category: "hop", amount: 20, unit: "g" }],
    });

    prepareIngredients(r);

    expect(first.amount).toBe(30);
  });
});

describe("matchRecipeIngredients (cleaned pipeline + shared stock)", () => {
  it("matches merged duplicates as one line with the summed need", () => {
    const r = recipe({
      // 30g + 20g = 50g of Cascade required, but only 40g is in stock.
      hops: [
        { id: "h-cascade", name: "Cascade", category: "hop", amount: 30, unit: "g" },
        { id: "h-cascade", name: "Cascade", category: "hop", amount: 20, unit: "g" },
      ],
    });
    const cascadeIndex = buildInventoryIndex([
      { id: "h-cascade", name: "Cascade", category: "hop", amount: 40, unit: "g" },
    ]);

    const matches = matchRecipeIngredients(r, cascadeIndex);

    expect(matches).toHaveLength(1);
    expect(matches[0]!.need).toBe(50);
    expect(matches[0]!.status).toBe("short");
    expect(matches[0]!.have).toBe(40);
    expect(matches[0]!.shortfall).toBe(10);
  });

  it("reserves stock across different-name lines that resolve to the same inventory item", () => {
    const r = recipe({
      // Different names -> no dedup, but both fuzzy-resolve to the same stock.
      hops: [
        { id: "", name: "Cascade", category: "hop", amount: 30, unit: "g" },
        { id: "", name: "Cascade (US)", category: "hop", amount: 20, unit: "g" },
      ],
    });
    const cascadeIndex = buildInventoryIndex([
      { id: "h-cascade", name: "Cascade", category: "hop", amount: 40, unit: "g" },
    ]);

    const [first, second] = matchRecipeIngredients(r, cascadeIndex);

    // First line consumes 30 of 40.
    expect(first!.status).toBe("satisfied");
    expect(first!.have).toBe(40);
    // Second line sees only the remaining 10 -> short by 10 (not a false satisfy).
    expect(second!.inventoryItem?.id).toBe("h-cascade");
    expect(second!.status).toBe("short");
    expect(second!.have).toBe(10);
    expect(second!.shortfall).toBe(10);
  });
});

describe("buildInventoryIndex (items guard)", () => {
  it("skips items-unit inventory rows so nothing can resolve to them", () => {
    const guardedIndex = buildInventoryIndex([
      { id: "m-elec", name: "Electricity", category: "misc", amount: 1, unit: "items" },
    ]);

    const match = matchIngredient(
      ingredient({ id: "m-elec", name: "Electricity", category: "misc", amount: 1, unit: "g" }),
      guardedIndex
    );

    expect(match.inventoryItem).toBeUndefined();
    expect(match.status).toBe("missing");
  });
});
