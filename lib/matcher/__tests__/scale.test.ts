import { describe, expect, it } from "vitest";

import type {
  InventoryItem,
  RecipeDetail,
  RecipeIngredient,
} from "@/lib/brewfather/types";
import { scaleRecipeToStock } from "@/lib/matcher/scale";

function inv(partial: Partial<InventoryItem>): InventoryItem {
  return { id: "", name: "", category: "hop", amount: 0, unit: "g", ...partial };
}

function ing(partial: Partial<RecipeIngredient>): RecipeIngredient {
  return { id: "", name: "", category: "hop", amount: 0, unit: "g", ...partial };
}

function recipe(partial: Partial<RecipeDetail>): RecipeDetail {
  return {
    id: "r1",
    name: "Test Recipe",
    fermentables: [],
    hops: [],
    yeasts: [],
    miscs: [],
    ...partial,
  };
}

describe("scaleRecipeToStock", () => {
  it("scales by the single limiting ingredient ratio", () => {
    const r = recipe({
      batchSize: 20,
      hops: [ing({ id: "h1", name: "Cascade", amount: 50, unit: "g" })],
    });
    const inventory = [inv({ id: "h1", name: "Cascade", amount: 150, unit: "g" })];

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(3); // 150 / 50
    expect(result.scaledBatchSize).toBe(60); // 20 * 3
    expect(result.ingredients[0]!.scaledAmount).toBe(150);
    expect(result.ingredients[0]!.limiting).toBe(true);
    expect(result.limitedBy).toEqual(["Cascade"]);
    expect(result.warnings).toEqual([]);
  });

  it("picks the smallest ratio across multiple ingredients", () => {
    const r = recipe({
      batchSize: 20,
      fermentables: [
        ing({ id: "f1", name: "Pilsner", category: "fermentable", amount: 5, unit: "kg" }),
      ],
      hops: [ing({ id: "h1", name: "Saaz", amount: 40, unit: "g" })],
      yeasts: [ing({ id: "y1", name: "US-05", category: "yeast", amount: 1, unit: "pkg" })],
    });
    const inventory = [
      inv({ id: "f1", name: "Pilsner", category: "fermentable", amount: 20, unit: "kg" }), // 4x
      inv({ id: "h1", name: "Saaz", amount: 60, unit: "g" }), // 1.5x  <- limiting
      inv({ id: "y1", name: "US-05", category: "yeast", amount: 5, unit: "pkg" }), // 5x
    ];

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(1.5);
    expect(result.scaledBatchSize).toBe(30);
    expect(result.limitedBy).toEqual(["Saaz"]);
    const saaz = result.ingredients.find((i) => i.ingredient.name === "Saaz")!;
    expect(saaz.limiting).toBe(true);
    const pilsner = result.ingredients.find((i) => i.ingredient.name === "Pilsner")!;
    expect(pilsner.limiting).toBe(false);
    expect(pilsner.scaledAmount).toBe(7.5); // 5kg * 1.5
  });

  it("sums shared stock across lines resolving to the same item", () => {
    // One hop used twice; combined draw is 20 + 30 = 50 g against 50 g of stock.
    const r = recipe({
      batchSize: 20,
      hops: [
        ing({ id: "h1", name: "Cascade", amount: 20, unit: "g" }),
        ing({ id: "h1", name: "Cascade", amount: 30, unit: "g" }),
      ],
    });
    const inventory = [inv({ id: "h1", name: "Cascade", amount: 50, unit: "g" })];

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(1); // 50 / (20 + 30), NOT 50/30
    expect(result.ingredients.every((i) => i.limiting)).toBe(true);
    expect(result.limitedBy).toEqual(["Cascade"]);
  });

  it("converts compatible units before comparing (g need vs kg stock)", () => {
    const r = recipe({
      batchSize: 20,
      fermentables: [
        ing({ id: "f1", name: "Maris Otter", category: "fermentable", amount: 1000, unit: "g" }),
      ],
    });
    const inventory = [
      inv({ id: "f1", name: "Maris Otter", category: "fermentable", amount: 5, unit: "kg" }),
    ];

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(5); // 5 kg / 1 kg
    expect(result.ingredients[0]!.scaledAmount).toBe(5000); // 1000 g * 5
  });

  it("returns factor 0 and names the missing ingredient", () => {
    const r = recipe({
      batchSize: 20,
      hops: [ing({ id: "h1", name: "Citra", amount: 50, unit: "g" })],
      yeasts: [ing({ id: "y1", name: "Kveik", category: "yeast", amount: 1, unit: "pkg" })],
    });
    const inventory = [inv({ id: "h1", name: "Citra", amount: 200, unit: "g" })]; // no yeast

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(0);
    expect(result.scaledBatchSize).toBe(0);
    expect(result.limitedBy).toEqual(["Kveik"]);
    const kveik = result.ingredients.find((i) => i.ingredient.name === "Kveik")!;
    expect(kveik.limiting).toBe(true);
    expect(kveik.scaledAmount).toBe(0);
  });

  it("excludes incomparable units with a warning", () => {
    const r = recipe({
      batchSize: 20,
      hops: [ing({ id: "h1", name: "Cascade", amount: 50, unit: "g" })],
      // misc measured by volume but stocked by mass -> incomparable
      miscs: [ing({ id: "m1", name: "Lactic Acid", category: "misc", amount: 10, unit: "ml" })],
    });
    const inventory = [
      inv({ id: "h1", name: "Cascade", amount: 100, unit: "g" }), // 2x
      inv({ id: "m1", name: "Lactic Acid", category: "misc", amount: 500, unit: "g" }),
    ];

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(2); // limited by Cascade; lactic acid excluded
    expect(result.warnings.some((w) => w.includes("Lactic Acid"))).toBe(true);
  });

  it("propagates how each ingredient was matched (id vs fuzzy name)", () => {
    const r = recipe({
      hops: [
        ing({ id: "h1", name: "Cascade", amount: 50, unit: "g" }),
        // Same name as stock but a divergent id (the real-world case from PRD §9):
        // resolves via the normalized-name fuzzy fallback, not by id.
        ing({ id: "divergent-id", name: "Citra", amount: 50, unit: "g" }),
      ],
    });
    const inventory = [
      inv({ id: "h1", name: "Cascade", amount: 100, unit: "g" }),
      inv({ id: "inv-citra", name: "Citra", amount: 100, unit: "g" }),
    ];

    const result = scaleRecipeToStock(r, inventory);

    const cascade = result.ingredients.find((i) => i.ingredient.name === "Cascade")!;
    const citra = result.ingredients.find((i) => i.ingredient.name === "Citra")!;
    expect(cascade.matchedBy).toBe("id");
    expect(citra.matchedBy).toBe("name");
  });

  it("floors the factor so scaled needs never exceed available stock", () => {
    const r = recipe({
      hops: [ing({ id: "h1", name: "Mosaic", amount: 3, unit: "g" })],
    });
    const inventory = [inv({ id: "h1", name: "Mosaic", amount: 10, unit: "g" })];

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(3.3333); // floor(10/3, 4dp), not 3.3333...
    expect(result.ingredients[0]!.scaledAmount).toBeLessThanOrEqual(10);
  });

  it("ignores zero-amount lines and warns when there is nothing to scale", () => {
    const r = recipe({
      miscs: [ing({ id: "m1", name: "Whirlfloc", category: "misc", amount: 0, unit: "each" })],
    });
    const inventory = [
      inv({ id: "m1", name: "Whirlfloc", category: "misc", amount: 5, unit: "each" }),
    ];

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(0);
    expect(result.ingredients[0]!.limiting).toBe(false);
    expect(result.warnings.some((w) => w.includes("nothing") || w.includes("cannot scale"))).toBe(
      true
    );
  });

  it("reports a missing batch size without failing", () => {
    const r = recipe({
      hops: [ing({ id: "h1", name: "EKG", amount: 25, unit: "g" })],
    });
    const inventory = [inv({ id: "h1", name: "EKG", amount: 100, unit: "g" })];

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(4);
    expect(result.scaledBatchSize).toBeUndefined();
    expect(result.warnings.some((w) => w.includes("batch size"))).toBe(true);
  });
});
