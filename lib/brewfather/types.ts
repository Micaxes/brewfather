/**
 * Shared Brewfather domain contracts.
 *
 * These are normalized shapes the rest of the app codes against — the API
 * client (Task 2) maps raw Brewfather responses onto them, and the matcher
 * (Task 3) and UI (Task 4) consume them. Treat these interfaces as frozen:
 * changing them is a cross-task coordination event.
 *
 * Brewfather is metric throughout (kg, g, L, mL, °C, SG). See docs/CONCEPT.md
 * and https://docs.brewfather.app/api.
 */

/** Ingredient categories — one per Brewfather inventory endpoint. */
export type IngredientCategory = "fermentable" | "hop" | "yeast" | "misc";

/**
 * Measurement unit for an amount. Brewfather is metric: `kg` (fermentables),
 * `g` (hops/miscs), `l`/`ml` (liquids), and `pkg`/`each` (yeast and discrete
 * items). Kept as a string so the client/matcher can carry whatever unit the
 * upstream item declares; unit normalization lives in the matcher (Task 3).
 */
export type Unit = string;

/** A single item the user currently has on hand, with its stocked quantity. */
export interface InventoryItem {
  /** Stable Brewfather id (`_id`); empty string when the item has no id. */
  id: string;
  name: string;
  category: IngredientCategory;
  /** Quantity on hand, expressed in `unit`. */
  amount: number;
  unit: Unit;
  /** Hop alpha-acid percentage (hops only). */
  alpha?: number;
  /** Fermentable color in the source's color unit, e.g. EBC/Lovibond (fermentables only). */
  color?: number;
  /** Yeast attenuation percentage (yeasts only). */
  attenuation?: number;
}

/** Summary view of a saved recipe (the `/v2/recipes` list shape). */
export interface Recipe {
  /** Stable Brewfather id (`_id`). */
  id: string;
  name: string;
  /** Beer style name, when present on the recipe. */
  style?: string;
  /** Recipe author/brewer, when present. */
  author?: string;
  /** Target batch size in liters, when present. */
  batchSize?: number;
}

/** A single required ingredient within a recipe, scaled to its batch size. */
export interface RecipeIngredient {
  /** Stable Brewfather id (`_id`); empty string when the item has no id. */
  id: string;
  name: string;
  category: IngredientCategory;
  /** Required quantity for the recipe's batch size, expressed in `unit`. */
  amount: number;
  unit: Unit;
}

/** Full recipe detail (the `/v2/recipes/:id` shape) with ingredient arrays. */
export interface RecipeDetail extends Recipe {
  fermentables: RecipeIngredient[];
  hops: RecipeIngredient[];
  yeasts: RecipeIngredient[];
  miscs: RecipeIngredient[];
}
