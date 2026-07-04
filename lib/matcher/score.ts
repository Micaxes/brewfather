/**
 * Brewability scoring, bucketing, and shopping-list construction (pure logic).
 *
 * Only the ingredients that actually gate a brew day — fermentables and hops —
 * feed the % score and the bucket. Yeast and misc are still matched and
 * displayed with their have/need status, but a missing yeast or misc no longer
 * drags the score down or blocks "Brew now".
 *
 * The score is the weighted fraction of the scored requirements that are
 * satisfied, weighted by ingredient importance:
 *   - base malt                -> critical
 *   - hops                     -> high
 *   - specialty fermentables   -> medium
 *
 * Note: the frozen `RecipeIngredient` contract carries no hop `use`/`time`, so
 * bittering and aroma hops cannot be distinguished here; all hops are weighted
 * "high". Base vs specialty malt is inferred from each fermentable's share of
 * the grain bill.
 */
import type { IngredientCategory, RecipeIngredient } from "@/lib/brewfather/types";
import type {
  IngredientMatch,
  MatchBucket,
  ShoppingListItem,
} from "@/lib/matcher/types";
import { comparableMagnitude } from "@/lib/matcher/normalize";

export type IngredientImportance = "critical" | "high" | "medium" | "low";

/** Relative weight each importance tier contributes to the score. */
export const IMPORTANCE_WEIGHT: Readonly<Record<IngredientImportance, number>> = {
  critical: 1,
  high: 0.7,
  medium: 0.4,
  low: 0.15,
};

/** A fermentable counts as "base malt" at or above this share of the grain bill. */
export const BASE_MALT_SHARE = 0.3;

/** Minimum score for a not-fully-stocked recipe to be "almost" rather than "not_yet". */
export const ALMOST_SCORE_THRESHOLD = 0.6;

/** The ingredient categories that gate a brew day and therefore feed score/bucket. */
const SCORED = new Set<IngredientCategory>(["fermentable", "hop"]);

/** Whether a match participates in the % score and the bucket (grain + hops only). */
export function isScored(match: IngredientMatch): boolean {
  return SCORED.has(match.ingredient.category);
}

/**
 * Identify which fermentables are base malts: any at/above {@link BASE_MALT_SHARE}
 * of the total grain weight, plus the single largest (so a recipe with
 * fermentables always has at least one base malt). Uses object identity, so pass
 * the same `RecipeIngredient` references used elsewhere.
 */
export function findBaseMalts(
  fermentables: RecipeIngredient[]
): Set<RecipeIngredient> {
  const baseMalts = new Set<RecipeIngredient>();
  if (fermentables.length === 0) return baseMalts;

  const weights = fermentables.map((f) => comparableMagnitude(f.amount, f.unit));
  const total = weights.reduce((sum, w) => sum + w, 0);

  let largest = fermentables[0]!;
  let largestWeight = weights[0]!;
  fermentables.forEach((fermentable, i) => {
    const weight = weights[i]!;
    if (weight > largestWeight) {
      largest = fermentable;
      largestWeight = weight;
    }
    if (total > 0 && weight / total >= BASE_MALT_SHARE) {
      baseMalts.add(fermentable);
    }
  });
  baseMalts.add(largest);

  return baseMalts;
}

/** Importance tier for a single ingredient. */
export function classifyImportance(
  ingredient: RecipeIngredient,
  isBaseMalt: boolean
): IngredientImportance {
  switch (ingredient.category) {
    case "yeast":
      return "critical";
    case "fermentable":
      return isBaseMalt ? "critical" : "medium";
    case "hop":
      return "high";
    case "misc":
      return "low";
  }
}

/**
 * Weighted brewability score in [0, 1] over the scored (fermentable + hop)
 * matches only — yeast/misc are ignored. Satisfied ingredients count fully,
 * missing ones not at all, and short ones get partial credit (have/need).
 */
export function scoreRecipe(
  ingredientMatches: IngredientMatch[],
  baseMalts: Set<RecipeIngredient>
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const match of ingredientMatches) {
    if (!isScored(match)) continue;
    const weight =
      IMPORTANCE_WEIGHT[
        classifyImportance(match.ingredient, baseMalts.has(match.ingredient))
      ];
    totalWeight += weight;
    weightedSum += weight * satisfiedFraction(match);
  }

  if (totalWeight <= 0) return 0;
  return roundTo(weightedSum / totalWeight, 4);
}

/**
 * Bucket a recipe from its per-ingredient matches and weighted score.
 * "Brew now" means every *scored* (fermentable + hop) match is satisfied — a
 * missing yeast or misc does not block it, keeping the bucket consistent with
 * the score (a 100% recipe is always brew_now). For a recipe with no scored
 * ingredients at all, fall back to every match being satisfied.
 */
export function bucketFor(
  ingredientMatches: IngredientMatch[],
  score: number
): MatchBucket {
  if (ingredientMatches.length === 0) return "not_yet";
  const scored = ingredientMatches.filter(isScored);
  const gating = scored.length > 0 ? scored : ingredientMatches;
  if (gating.every((m) => m.status === "satisfied")) {
    return "brew_now";
  }
  return score >= ALMOST_SCORE_THRESHOLD ? "almost" : "not_yet";
}

/**
 * Build a shopping list of the shortfalls (missing + short) for a recipe:
 * fermentables, hops, and miscs — never yeast (not part of the buy-list).
 */
export function buildShoppingList(
  ingredientMatches: IngredientMatch[]
): ShoppingListItem[] {
  return ingredientMatches
    .filter(
      (match) => match.ingredient.category !== "yeast" && match.shortfall > 0
    )
    .map((match) => ({
      name: match.ingredient.name,
      category: match.ingredient.category,
      amount: match.shortfall,
      unit: match.ingredient.unit,
    }));
}

function satisfiedFraction(match: IngredientMatch): number {
  if (match.status === "satisfied") return 1;
  if (match.status === "missing") return 0;
  if (match.need <= 0) return 1;
  return clamp(match.have / match.need, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
