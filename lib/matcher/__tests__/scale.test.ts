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

  it("pre-merges duplicate lines into one scaled row with the summed need", () => {
    // One hop used twice; the cleaned pipeline merges 20 + 30 into one 50 g row.
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
    expect(result.ingredients).toHaveLength(1);
    expect(result.ingredients[0]!.ingredient.amount).toBe(50);
    expect(result.ingredients[0]!.scaledAmount).toBe(50);
    expect(result.ingredients[0]!.limiting).toBe(true);
    expect(result.limitedBy).toEqual(["Cascade"]);
  });

  it("sums shared stock across different-name lines resolving to the same item", () => {
    // Distinct names survive dedup, but both resolve to one 50 g stock row.
    const r = recipe({
      batchSize: 20,
      hops: [
        ing({ id: "", name: "Cascade", amount: 20, unit: "g" }),
        ing({ id: "", name: "Cascade (US)", amount: 30, unit: "g" }),
      ],
    });
    const inventory = [inv({ id: "h1", name: "Cascade", amount: 50, unit: "g" })];

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(1); // 50 / (20 + 30), NOT 50/30
    expect(result.ingredients).toHaveLength(2);
    expect(result.ingredients.every((i) => i.limiting)).toBe(true);
  });

  it("drops items-unit rows before scaling", () => {
    const r = recipe({
      batchSize: 20,
      hops: [ing({ id: "h1", name: "Cascade", amount: 50, unit: "g" })],
      miscs: [
        ing({ id: "m1", name: "Electricity", category: "misc", amount: 1, unit: "items" }),
      ],
    });
    const inventory = [inv({ id: "h1", name: "Cascade", amount: 100, unit: "g" })];

    const result = scaleRecipeToStock(r, inventory);

    // "Electricity" neither blocks (missing) nor appears in the scaled rows.
    expect(result.factor).toBe(2);
    expect(result.ingredients.map((i) => i.ingredient.name)).toEqual(["Cascade"]);
    expect(result.warnings).toEqual([]);
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
      // misc measured in teaspoons but stocked by mass -> incomparable
      miscs: [ing({ id: "m1", name: "Yeast Nutrient", category: "misc", amount: 2, unit: "tsp" })],
    });
    const inventory = [
      inv({ id: "h1", name: "Cascade", amount: 100, unit: "g" }), // 2x
      inv({ id: "m1", name: "Yeast Nutrient", category: "misc", amount: 500, unit: "g" }),
    ];

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(2); // limited by Cascade; yeast nutrient excluded
    expect(result.warnings.some((w) => w.includes("Yeast Nutrient"))).toBe(true);
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

  it("scales a fermentable on a guide equivalent instead of zeroing the factor", () => {
    // The dashboard already satisfies Caramunich Type 2 from Crystal 120 (they
    // share an equivalence row in docs/malt-substitutions.md), so scale-to-stock
    // must draw on that same sack rather than calling the malt missing.
    const r = recipe({
      batchSize: 20,
      fermentables: [
        ing({
          id: "",
          name: "Weyermann Caramunich Type 2",
          category: "fermentable",
          amount: 1,
          unit: "kg",
        }),
      ],
      hops: [ing({ id: "h1", name: "Saaz", amount: 40, unit: "g" })],
    });
    const inventory = [
      inv({
        id: "inv-crystal",
        name: "Crisp Crystal 120",
        category: "fermentable",
        amount: 3,
        unit: "kg",
      }),
      inv({ id: "h1", name: "Saaz", amount: 400, unit: "g" }), // 10x, not limiting
    ];

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(3); // 3 kg of the stand-in / 1 kg needed
    expect(result.scaledBatchSize).toBe(60);
    const malt = result.ingredients.find(
      (i) => i.ingredient.name === "Weyermann Caramunich Type 2"
    )!;
    expect(malt.inventoryItem?.name).toBe("Crisp Crystal 120");
    expect(malt.matchedBy).toBe("equivalent");
    expect(malt.scaledAmount).toBe(3);
    expect(result.limitedBy).toEqual(["Weyermann Caramunich Type 2"]);
  });

  it("still reports a fermentable with no guide equivalent as missing", () => {
    // A base malt cannot stand in for a crystal malt (guide rule 1), so the
    // fallback must not loosen the missing case into a bogus factor.
    const r = recipe({
      batchSize: 20,
      fermentables: [
        ing({
          id: "",
          name: "Weyermann Caramunich Type 2",
          category: "fermentable",
          amount: 1,
          unit: "kg",
        }),
      ],
    });
    const inventory = [
      inv({
        id: "inv-pils",
        name: "Weyermann Pilsner",
        category: "fermentable",
        amount: 10,
        unit: "kg",
      }),
    ];

    const result = scaleRecipeToStock(r, inventory);

    expect(result.factor).toBe(0);
    expect(result.ingredients[0]!.inventoryItem).toBeUndefined();
    expect(result.limitedBy).toEqual(["Weyermann Caramunich Type 2"]);
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
