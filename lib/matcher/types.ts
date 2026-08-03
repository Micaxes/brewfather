/**
 * Shared matching-engine contracts.
 *
 * The matcher (Task 3) compares live inventory against saved recipes and
 * produces these shapes; the BFF route (Task 2) returns them and the dashboard
 * (Task 4) renders them. Treat these interfaces as frozen.
 */
import type {
  IngredientCategory,
  InventoryItem,
  Recipe,
  RecipeDetail,
  RecipeIngredient,
  Unit,
} from "@/lib/brewfather/types";

/** Per-ingredient match outcome. */
export type MatchStatus = "satisfied" | "short" | "missing";

/**
 * How a recipe ingredient was resolved to an inventory item.
 *
 * `equivalent` means no exact item was found but a malt the substitution guide
 * considers interchangeable was — the recipe counts as satisfied, and the UI
 * says so rather than implying the exact malt is on the shelf.
 * See `docs/malt-substitutions.md`.
 *
 * `accepted` means the brewer explicitly chose this stand-in for this recipe.
 * It outranks every automatic path: a person looking at their own shelf knows
 * things the engine does not, which is the only way a hop line can ever be
 * satisfied by a substitute (a recipe line carries no use/time, so we cannot
 * tell a bittering charge from a whirlpool addition).
 */
export type MatchMethod = "id" | "name" | "equivalent" | "accepted";

/** An in-inventory stand-in for a malt, with the reason it was proposed. */
export interface MaltSubstitute {
  /** The item from the user's own inventory being proposed. */
  inventoryItem: InventoryItem;
  /** Stock available, expressed in the recipe ingredient's unit. */
  have: number;
  /** Whether that stock covers the requirement (after `doseFactor`). */
  coversNeed: boolean;
  /** Why the guide allows this swap — shown to the user verbatim. */
  justification: string;
  /** Dose multiplier: 1 for a straight swap, 0.85 for >250 EBC colourants. */
  doseFactor: number;
}

/** Overall bucket a recipe falls into for the dashboard. */
export type MatchBucket = "brew_now" | "almost" | "not_yet";

/** Result of matching one recipe ingredient against the inventory. */
export interface IngredientMatch {
  /** The recipe ingredient this match is for. */
  ingredient: RecipeIngredient;
  /** The inventory item it resolved to, if any. */
  inventoryItem?: InventoryItem;
  /** How the match was made (stable id vs fuzzy name); absent when missing. */
  matchedBy?: MatchMethod;
  status: MatchStatus;
  /** Quantity on hand in the ingredient's unit (0 when missing). */
  have: number;
  /** Quantity the recipe requires. */
  need: number;
  /** Amount still needed (`need - have`, clamped at 0). */
  shortfall: number;
  /**
   * In-inventory malts that could stand in, best first (max 3). Present only
   * for fermentables that are missing or short. When `matchedBy` is
   * `equivalent`, the first entry is the substitute that satisfied the line.
   */
  substitutes?: MaltSubstitute[];
}

/** A line on a recipe's shopping list (one shortfall to buy). */
export interface ShoppingListItem {
  name: string;
  category: IngredientCategory;
  /** Amount to buy to satisfy the recipe (the shortfall). */
  amount: number;
  unit: Unit;
}

/** A scored, bucketed recipe with its per-ingredient breakdown. */
export interface RecipeMatch {
  /** The recipe being scored (summary identity). */
  recipe: Recipe;
  bucket: MatchBucket;
  /** Weighted brewability score in the range [0, 1]. */
  score: number;
  ingredientMatches: IngredientMatch[];
  /** Shortfalls to buy (never yeast); empty for `not_yet`. */
  shoppingList: ShoppingListItem[];
}

/** Input to the matcher: the user's inventory and full recipe details. */
export interface MatchInput {
  inventory: InventoryItem[];
  recipes: RecipeDetail[];
}

/** Output of the matcher: ranked candidates plus metadata. */
export interface MatchResult {
  candidates: RecipeMatch[];
  /** ISO-8601 timestamp of when the match was computed. */
  generatedAt: string;
  /** Non-fatal warnings surfaced to the UI (e.g. skipped/partial data). */
  warnings: string[];
}
