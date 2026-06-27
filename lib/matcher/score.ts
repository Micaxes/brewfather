/**
 * Brewability scoring, bucketing, and shopping-list construction (pure logic).
 *
 * The score is the weighted fraction of a recipe's requirements that are
 * satisfied, weighted by ingredient importance:
 *   - yeast and base malt      -> critical
 *   - hops                     -> high
 *   - specialty fermentables   -> medium
 *   - miscs                    -> low
 *
 * Note: the frozen `RecipeIngredient` contract carries no hop `use`/`time`, so
 * bittering and aroma hops cannot be distinguished here; all hops are weighted
 * "high". Base vs specialty malt is inferred from each fermentable's share of
 * the grain bill.
 */
import type { RecipeIngredient } from "@/lib/brewfather/types";
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
 * Weighted brewability score in [0, 1]. Satisfied ingredients count fully,
 * missing ones not at all, and short ones get partial credit (have/need).
 */
export function scoreRecipe(
  ingredientMatches: IngredientMatch[],
  baseMalts: Set<RecipeIngredient>
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const match of ingredientMatches) {
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

/** Bucket a recipe from its per-ingredient matches and weighted score. */
export function bucketFor(
  ingredientMatches: IngredientMatch[],
  score: number
): MatchBucket {
  if (ingredientMatches.length === 0) return "not_yet";
  if (ingredientMatches.every((m) => m.status === "satisfied")) {
    return "brew_now";
  }
  return score >= ALMOST_SCORE_THRESHOLD ? "almost" : "not_yet";
}

/** Build a shopping list of the shortfalls (missing + short) for a recipe. */
export function buildShoppingList(
  ingredientMatches: IngredientMatch[]
): ShoppingListItem[] {
  return ingredientMatches
    .filter((match) => match.shortfall > 0)
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
