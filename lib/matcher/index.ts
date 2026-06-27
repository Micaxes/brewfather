/**
 * Deterministic inventory-to-recipe matching engine (public entrypoint).
 *
 * `matchRecipes` is a pure function over the Task 1 contracts: given the user's
 * inventory and full recipe details, it resolves each ingredient, scores and
 * buckets each recipe, builds shopping lists for "almost" recipes, and returns a
 * ranked `MatchResult`. The only non-pure input — the timestamp — is injectable
 * via `options.now` so callers/tests stay deterministic.
 */
import type { Recipe, RecipeDetail } from "@/lib/brewfather/types";
import type {
  MatchBucket,
  MatchInput,
  MatchResult,
  RecipeMatch,
} from "@/lib/matcher/types";
import {
  buildInventoryIndex,
  hasUnitMismatch,
  matchRecipeIngredients,
  FUZZY_NAME_THRESHOLD,
} from "@/lib/matcher/match";
import {
  bucketFor,
  buildShoppingList,
  findBaseMalts,
  scoreRecipe,
} from "@/lib/matcher/score";

export interface MatchOptions {
  /** Timestamp for `generatedAt` (defaults to now). Injectable for determinism. */
  now?: Date;
  /** Fuse.js fuzzy-name threshold override (defaults to {@link FUZZY_NAME_THRESHOLD}). */
  fuzzyThreshold?: number;
}

const BUCKET_RANK: Readonly<Record<MatchBucket, number>> = {
  brew_now: 0,
  almost: 1,
  not_yet: 2,
};

/**
 * Match every recipe against the inventory and return ranked candidates
 * (brew-now first, then by score, then by name for a stable order).
 */
export function matchRecipes(
  input: MatchInput,
  options: MatchOptions = {}
): MatchResult {
  const threshold = options.fuzzyThreshold ?? FUZZY_NAME_THRESHOLD;
  const index = buildInventoryIndex(input.inventory, threshold);
  const warnings = new Set<string>();

  const candidates = input.recipes.map((recipe) =>
    evaluateRecipe(recipe, index, warnings)
  );
  candidates.sort(compareCandidates);

  const now = options.now ?? new Date();
  return {
    candidates,
    generatedAt: now.toISOString(),
    warnings: [...warnings],
  };
}

function evaluateRecipe(
  recipe: RecipeDetail,
  index: ReturnType<typeof buildInventoryIndex>,
  warnings: Set<string>
): RecipeMatch {
  const ingredientMatches = matchRecipeIngredients(recipe, index);

  for (const match of ingredientMatches) {
    if (hasUnitMismatch(match) && match.inventoryItem) {
      warnings.add(
        `Recipe "${recipe.name}": cannot compare units for "${match.ingredient.name}" ` +
          `(have "${match.inventoryItem.unit}", need "${match.ingredient.unit}"); compared raw amounts.`
      );
    }
  }

  const baseMalts = findBaseMalts(recipe.fermentables);
  const score = scoreRecipe(ingredientMatches, baseMalts);
  const bucket = bucketFor(ingredientMatches, score);
  const shoppingList = bucket === "almost" ? buildShoppingList(ingredientMatches) : [];

  return {
    recipe: toRecipeSummary(recipe),
    bucket,
    score,
    ingredientMatches,
    shoppingList,
  };
}

function compareCandidates(a: RecipeMatch, b: RecipeMatch): number {
  const byBucket = BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket];
  if (byBucket !== 0) return byBucket;
  if (b.score !== a.score) return b.score - a.score;
  const byName = a.recipe.name.localeCompare(b.recipe.name);
  if (byName !== 0) return byName;
  return a.recipe.id.localeCompare(b.recipe.id);
}

/** Project a full recipe down to the summary identity stored on a `RecipeMatch`. */
function toRecipeSummary(recipe: RecipeDetail): Recipe {
  const summary: Recipe = { id: recipe.id, name: recipe.name };
  if (recipe.style !== undefined) summary.style = recipe.style;
  if (recipe.author !== undefined) summary.author = recipe.author;
  if (recipe.batchSize !== undefined) summary.batchSize = recipe.batchSize;
  return summary;
}

export { FUZZY_NAME_THRESHOLD } from "@/lib/matcher/match";
export {
  ALMOST_SCORE_THRESHOLD,
  BASE_MALT_SHARE,
  IMPORTANCE_WEIGHT,
} from "@/lib/matcher/score";
