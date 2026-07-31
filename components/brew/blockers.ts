/**
 * What a collapsed recipe card shows (pure logic — see issue #39).
 *
 * The ingredient list was never a scanning surface: of 12–16 rows per recipe,
 * only the ones that are wrong carry decision value. Collapsed, a card shows a
 * one-line verdict plus at most {@link MAX_BLOCKERS} notable rows; everything
 * else moves behind the card's disclosure.
 */
import type { IngredientCategory, RecipeIngredient } from "@/lib/brewfather/types";
import type { RecipeMatch } from "@/lib/api-contract";
import type { IngredientMatch } from "@/lib/matcher/types";
import { findBaseMalts } from "@/lib/matcher/score";

/** Notable rows shown on a collapsed card before the "+N more" line. */
export const MAX_BLOCKERS = 3;

/**
 * Display rank. Lower sorts first.
 *
 * Deliberately NOT `isScored()` from `score.ts`. That helper is fermentables +
 * hops only, because #32 excluded yeast and misc from *scoring* — using it here
 * would drop a missing yeast off the card entirely, which is worse than the
 * long card it replaces. Nothing brews without yeast, so it ranks first.
 * Scoring and bucketing are untouched; this is display order only.
 */
const CATEGORY_RANK: Readonly<Record<IngredientCategory, number>> = {
  yeast: 0,
  fermentable: 1, // base malt promoted to 1, specialty demoted below hops
  hop: 2,
  misc: 4,
};

const SPECIALTY_MALT_RANK = 3;
/** Resolved-by-substitute rows sort last: they explain, they don't block. */
const SUBSTITUTED_RANK = 5;

function rankOf(
  match: IngredientMatch,
  baseMalts: Set<RecipeIngredient>
): number {
  if (match.matchedBy === "equivalent") return SUBSTITUTED_RANK;
  const category = match.ingredient.category;
  if (category === "fermentable" && !baseMalts.has(match.ingredient)) {
    return SPECIALTY_MALT_RANK;
  }
  return CATEGORY_RANK[category];
}

export interface SelectedBlockers {
  /** Rows to render on the collapsed card, most important first. */
  blockers: IngredientMatch[];
  /** How many notable rows did not fit — 0 when everything is shown. */
  remaining: number;
}

/**
 * Pick the rows worth showing on a collapsed card.
 *
 * "Notable" is anything that is not a plain, directly-matched, satisfied
 * ingredient: every unsatisfied line, plus lines resolved via a substitute.
 * Substituted lines are included on purpose — they are the reason the recipe is
 * brewable at all, and hiding them would bury the substitution feature behind a
 * click on the very cards where it did the work.
 */
export function selectBlockers(
  match: RecipeMatch,
  limit: number = MAX_BLOCKERS
): SelectedBlockers {
  const baseMalts = findBaseMalts(
    match.ingredientMatches
      .filter((m) => m.ingredient.category === "fermentable")
      .map((m) => m.ingredient)
  );

  const notable = match.ingredientMatches.filter(
    (m) => m.status !== "satisfied" || m.matchedBy === "equivalent"
  );

  const sorted = [...notable].sort((a, b) => {
    const byRank = rankOf(a, baseMalts) - rankOf(b, baseMalts);
    if (byRank !== 0) return byRank;
    // Bigger gaps first, then a stable alphabetical tiebreak.
    if (b.shortfall !== a.shortfall) return b.shortfall - a.shortfall;
    return a.ingredient.name.localeCompare(b.ingredient.name);
  });

  return {
    blockers: sorted.slice(0, limit),
    remaining: Math.max(sorted.length - limit, 0),
  };
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * The one-line verdict under the recipe name.
 *
 * Derived from the actual ingredient statuses rather than the bucket, so it can
 * never claim "all in stock" when something is missing. That matters because a
 * `brew_now` recipe *can* be short a yeast: yeast is excluded from both the
 * score (#32) and the shopping list, so the bucket alone would lie here.
 */
export function buildVerdict(match: RecipeMatch): string {
  const { ingredientMatches, shoppingList, bucket } = match;
  const unsatisfied = ingredientMatches.filter((m) => m.status !== "satisfied");
  const substituted = ingredientMatches.filter(
    (m) => m.matchedBy === "equivalent"
  ).length;

  if (unsatisfied.length === 0) {
    const total = plural(ingredientMatches.length, "ingredient");
    return substituted > 0
      ? `All ${total} in stock · ${substituted} via ${substituted === 1 ? "a substitute" : "substitutes"}`
      : `All ${total} in stock`;
  }

  const parts: string[] = [];

  if (bucket === "not_yet") {
    parts.push(`${plural(unsatisfied.length, "ingredient")} missing`);
  } else if (shoppingList.length > 0) {
    parts.push(`${shoppingList.length} to buy`);
  } else {
    parts.push(`${plural(unsatisfied.length, "ingredient")} short`);
  }

  // Yeast never reaches the shopping list, so "N to buy" would silently omit
  // it. Call it out — you cannot brew without pitching something.
  if (unsatisfied.some((m) => m.ingredient.category === "yeast")) {
    parts.push("yeast needed");
  }

  const swaps = unsatisfied.filter(
    (m) => (m.substitutes?.length ?? 0) > 0
  ).length;
  if (swaps > 0) parts.push(`${plural(swaps, "swap")} available`);

  return parts.join(" · ");
}
