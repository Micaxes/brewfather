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

/** How a recipe ingredient was resolved to an inventory item. */
export type MatchMethod = "id" | "name";

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
  /** Shortfalls to buy; empty for `brew_now`. */
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
