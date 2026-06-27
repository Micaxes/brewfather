import { describe, expect, it } from "vitest";

import type { InventoryItem, RecipeDetail } from "@/lib/brewfather/types";
import type { RecipeMatch } from "@/lib/matcher/types";
import { matchRecipes } from "@/lib/matcher";
import inventoryFixture from "@/lib/matcher/fixtures/inventory.json";
import recipesFixture from "@/lib/matcher/fixtures/recipes.json";

const inventory = inventoryFixture as unknown as InventoryItem[];
const recipes = recipesFixture as unknown as RecipeDetail[];

const FIXED_NOW = new Date("2026-06-27T12:00:00.000Z");

function run() {
  return matchRecipes({ inventory, recipes }, { now: FIXED_NOW });
}

function byId(candidates: RecipeMatch[], id: string): RecipeMatch {
  const found = candidates.find((c) => c.recipe.id === id);
  if (!found) throw new Error(`no candidate for ${id}`);
  return found;
}

describe("matchRecipes (integration over fixtures)", () => {
  it("buckets a fully-stocked recipe as brew_now with no shopping list", () => {
    const apa = byId(run().candidates, "r-apa");
    expect(apa.bucket).toBe("brew_now");
    expect(apa.score).toBe(1);
    expect(apa.shoppingList).toEqual([]);
    expect(apa.ingredientMatches.every((m) => m.status === "satisfied")).toBe(true);
    expect(apa.ingredientMatches.every((m) => m.matchedBy === "id")).toBe(true);
  });

  it("buckets a nearly-stocked recipe as almost with a correct shopping list", () => {
    const ipa = byId(run().candidates, "r-citra-ipa");
    expect(ipa.bucket).toBe("almost");
    expect(ipa.score).toBeGreaterThanOrEqual(0.6);
    expect(ipa.shoppingList).toEqual([
      { name: "Citra", category: "hop", amount: 50, unit: "g" },
      { name: "Whirlfloc", category: "misc", amount: 1, unit: "each" },
    ]);
  });

  it("buckets a far-from-stocked recipe as not_yet", () => {
    const stout = byId(run().candidates, "r-imperial-stout");
    expect(stout.bucket).toBe("not_yet");
    expect(stout.score).toBeLessThan(0.6);
    // not_yet recipes do not carry a shopping list.
    expect(stout.shoppingList).toEqual([]);
  });

  it("ranks brew_now before almost before not_yet", () => {
    const buckets = run().candidates.map((c) => c.bucket);
    expect(buckets).toEqual(["brew_now", "almost", "not_yet"]);
  });

  it("uses the injected timestamp and emits no warnings for clean fixtures", () => {
    const result = run();
    expect(result.generatedAt).toBe(FIXED_NOW.toISOString());
    expect(result.warnings).toEqual([]);
  });

  it("returns an empty candidate list for no recipes", () => {
    const result = matchRecipes({ inventory, recipes: [] }, { now: FIXED_NOW });
    expect(result.candidates).toEqual([]);
  });
});
