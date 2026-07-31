/**
 * What survives the collapse (issue #39). The ranking and the verdict wording
 * are the whole point of the summary card, so they are pinned directly.
 */
import { describe, expect, it } from "vitest";

import type { RecipeMatch } from "@/lib/api-contract";
import type { IngredientCategory } from "@/lib/brewfather/types";
import type { IngredientMatch, MatchBucket } from "@/lib/matcher/types";
import {
  MAX_BLOCKERS,
  buildVerdict,
  selectBlockers,
} from "@/components/brew/blockers";

function line(
  name: string,
  category: IngredientCategory,
  status: IngredientMatch["status"],
  extra: Partial<IngredientMatch> = {}
): IngredientMatch {
  const need = extra.need ?? 1;
  return {
    ingredient: { id: name, name, category, amount: need, unit: "kg" },
    status,
    have: status === "satisfied" ? need : 0,
    need,
    shortfall: status === "satisfied" ? 0 : need,
    ...extra,
  };
}

function recipe(
  ingredientMatches: IngredientMatch[],
  bucket: MatchBucket = "almost",
  shoppingList: RecipeMatch["shoppingList"] = []
): RecipeMatch {
  return {
    recipe: { id: "r1", name: "Test" },
    bucket,
    score: 0.8,
    ingredientMatches,
    shoppingList,
  };
}

describe("selectBlockers", () => {
  it("keeps only ingredients that are not plainly satisfied", () => {
    const { blockers } = selectBlockers(
      recipe([
        line("Pilsner", "fermentable", "satisfied"),
        line("Citra", "hop", "missing"),
      ])
    );

    expect(blockers.map((b) => b.ingredient.name)).toEqual(["Citra"]);
  });

  it("ranks a missing yeast above everything else", () => {
    // The reason this file does not use isScored(): yeast is excluded from
    // scoring, so an isScored filter would drop it off the card entirely.
    const { blockers } = selectBlockers(
      recipe([
        line("Chocolate Malt", "fermentable", "missing", { need: 0.2 }),
        line("Whirlfloc", "misc", "missing"),
        line("US-05", "yeast", "missing"),
        line("Citra", "hop", "missing"),
      ])
    );

    expect(blockers[0]?.ingredient.name).toBe("US-05");
  });

  it("ranks base malt above hops and specialty malt below them", () => {
    const { blockers } = selectBlockers(
      recipe([
        line("Pale Malt", "fermentable", "missing", { need: 5 }),
        line("Crystal 60", "fermentable", "missing", { need: 0.3 }),
        line("Magnum", "hop", "missing", { need: 0.05 }),
      ])
    );

    expect(blockers.map((b) => b.ingredient.name)).toEqual([
      "Pale Malt",
      "Magnum",
      "Crystal 60",
    ]);
  });

  it("sorts substituted rows last — they explain, they do not block", () => {
    const { blockers } = selectBlockers(
      recipe([
        line("Vienna", "fermentable", "satisfied", {
          matchedBy: "equivalent",
          need: 4,
        }),
        line("Citra", "hop", "missing"),
      ])
    );

    expect(blockers.map((b) => b.ingredient.name)).toEqual(["Citra", "Vienna"]);
  });

  it("caps the list and reports the true remainder", () => {
    const { blockers, remaining } = selectBlockers(
      recipe([
        line("A", "fermentable", "missing"),
        line("B", "fermentable", "missing"),
        line("C", "hop", "missing"),
        line("D", "hop", "missing"),
        line("E", "misc", "missing"),
      ])
    );

    expect(blockers).toHaveLength(MAX_BLOCKERS);
    expect(remaining).toBe(2);
  });

  it("reports no remainder when everything fits", () => {
    expect(selectBlockers(recipe([line("A", "hop", "missing")])).remaining).toBe(0);
  });
});

describe("buildVerdict", () => {
  it("confirms a fully stocked recipe", () => {
    expect(
      buildVerdict(
        recipe(
          [
            line("Pilsner", "fermentable", "satisfied"),
            line("Citra", "hop", "satisfied"),
          ],
          "brew_now"
        )
      )
    ).toBe("All 2 ingredients in stock");
  });

  it("credits substitutes when they are what made it brewable", () => {
    expect(
      buildVerdict(
        recipe(
          [
            line("Vienna", "fermentable", "satisfied", { matchedBy: "equivalent" }),
            line("Citra", "hop", "satisfied"),
          ],
          "brew_now"
        )
      )
    ).toBe("All 2 ingredients in stock · 1 via a substitute");
  });

  it("never claims everything is in stock when a yeast is missing", () => {
    // A brew_now recipe CAN be short a yeast: yeast is excluded from both the
    // score and the shopping list, so the bucket alone would lie here.
    const verdict = buildVerdict(
      recipe(
        [
          line("Pilsner", "fermentable", "satisfied"),
          line("US-05", "yeast", "missing"),
        ],
        "brew_now"
      )
    );

    expect(verdict).not.toMatch(/All \d+ ingredients in stock/);
    expect(verdict).toMatch(/yeast needed/);
  });

  it("counts the shopping list for an almost recipe", () => {
    expect(
      buildVerdict(
        recipe(
          [
            line("Pilsner", "fermentable", "satisfied"),
            line("Crystal", "fermentable", "missing"),
          ],
          "almost",
          [{ name: "Crystal", category: "fermentable", amount: 1, unit: "kg" }]
        )
      )
    ).toBe("1 to buy");
  });

  it("advertises available swaps", () => {
    const verdict = buildVerdict(
      recipe(
        [
          line("Crystal", "fermentable", "missing", {
            substitutes: [
              {
                inventoryItem: {
                  id: "i1",
                  name: "Crystal 120",
                  category: "fermentable",
                  amount: 5,
                  unit: "kg",
                },
                have: 5,
                coversNeed: true,
                doseFactor: 1,
                justification: "same row",
              },
            ],
          }),
        ],
        "almost",
        [{ name: "Crystal", category: "fermentable", amount: 1, unit: "kg" }]
      )
    );

    expect(verdict).toBe("1 to buy · 1 swap available");
  });

  it("counts what is missing for a not_yet recipe", () => {
    expect(
      buildVerdict(
        recipe(
          [
            line("A", "fermentable", "missing"),
            line("B", "hop", "missing"),
            line("C", "fermentable", "satisfied"),
          ],
          "not_yet"
        )
      )
    ).toBe("2 ingredients missing");
  });
});
