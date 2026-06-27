/**
 * Ingredient-to-inventory matching (pure logic).
 *
 * Each recipe ingredient is resolved to an inventory item by stable `_id`
 * first, then a normalized-name fuzzy fallback (Fuse.js), restricted to the same
 * category. Availability (`have` vs `need`) is then computed per ingredient.
 *
 * `IngredientMatch` is per `RecipeIngredient`, but stock is shared within a
 * recipe: when several lines resolve to the same inventory item (e.g. one hop
 * used for bittering, flavor, and aroma), earlier lines reserve what they use so
 * later lines only see the remaining stock. This prevents falsely reporting a
 * recipe as brewable. Reservation resets per recipe (each recipe is evaluated
 * against the full inventory).
 */
import Fuse from "fuse.js";

import type {
  IngredientCategory,
  InventoryItem,
  RecipeDetail,
  RecipeIngredient,
} from "@/lib/brewfather/types";
import type { IngredientMatch, MatchStatus } from "@/lib/matcher/types";
import { convertAmount, normalizeName } from "@/lib/matcher/normalize";

/**
 * Default Fuse.js score threshold for the normalized-name fuzzy fallback.
 * Lower is stricter (0 = exact, 1 = match anything). Conservative by default to
 * favor precision; tune from the Task 5 spike against real data.
 */
export const FUZZY_NAME_THRESHOLD = 0.3;

interface IndexedItem {
  inventory: InventoryItem;
  normalizedName: string;
}

export interface InventoryIndex {
  /** Inventory items keyed by stable `_id` (non-empty ids only). */
  byId: Map<string, InventoryItem>;
  /** Per-category Fuse index over normalized names. */
  fuseByCategory: Map<IngredientCategory, Fuse<IndexedItem>>;
}

/** Tracks stock already reserved by earlier lines of a recipe, in each item's own unit. */
type Reservations = Map<InventoryItem, number>;

const BASE_FUSE_OPTIONS = {
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: ["normalizedName"],
};

/**
 * Build a reusable index over the inventory: an id map plus a per-category Fuse
 * index. Build once and reuse across recipes.
 */
export function buildInventoryIndex(
  inventory: InventoryItem[],
  threshold: number = FUZZY_NAME_THRESHOLD
): InventoryIndex {
  const byId = new Map<string, InventoryItem>();
  const itemsByCategory = new Map<IngredientCategory, IndexedItem[]>();

  for (const item of inventory) {
    if (item.id && !byId.has(item.id)) {
      byId.set(item.id, item);
    }
    const indexed: IndexedItem = {
      inventory: item,
      normalizedName: normalizeName(item.name),
    };
    const list = itemsByCategory.get(item.category);
    if (list) {
      list.push(indexed);
    } else {
      itemsByCategory.set(item.category, [indexed]);
    }
  }

  const fuseByCategory = new Map<IngredientCategory, Fuse<IndexedItem>>();
  for (const [category, items] of itemsByCategory) {
    fuseByCategory.set(
      category,
      new Fuse(items, { ...BASE_FUSE_OPTIONS, threshold })
    );
  }

  return { byId, fuseByCategory };
}

/**
 * Resolve a single recipe ingredient against the inventory index. Pass a shared
 * `reservations` map to account for stock consumed by earlier lines of the same
 * recipe; omit it to compare against the full stock.
 */
export function matchIngredient(
  ingredient: RecipeIngredient,
  index: InventoryIndex,
  reservations?: Reservations
): IngredientMatch {
  let matched: InventoryItem | undefined;
  let matchedBy: "id" | "name" | undefined;

  // 1) Stable id match (same category to stay meaningful).
  if (ingredient.id) {
    const byId = index.byId.get(ingredient.id);
    if (byId && byId.category === ingredient.category) {
      matched = byId;
      matchedBy = "id";
    }
  }

  // 2) Normalized-name fuzzy fallback within the same category.
  if (!matched) {
    const query = normalizeName(ingredient.name);
    const fuse = index.fuseByCategory.get(ingredient.category);
    if (fuse && query.length > 0) {
      const best = fuse.search(query)[0];
      if (best) {
        matched = best.item.inventory;
        matchedBy = "name";
      }
    }
  }

  return buildIngredientMatch(ingredient, matched, matchedBy, reservations);
}

/** Match every ingredient of a recipe (fermentables, hops, yeasts, miscs). */
export function matchRecipeIngredients(
  recipe: RecipeDetail,
  index: InventoryIndex
): IngredientMatch[] {
  const reservations: Reservations = new Map();
  return collectIngredients(recipe).map((ingredient) =>
    matchIngredient(ingredient, index, reservations)
  );
}

/** Flatten a recipe's ingredient arrays into a single ordered list. */
export function collectIngredients(recipe: RecipeDetail): RecipeIngredient[] {
  return [
    ...recipe.fermentables,
    ...recipe.hops,
    ...recipe.yeasts,
    ...recipe.miscs,
  ];
}

function buildIngredientMatch(
  ingredient: RecipeIngredient,
  matched: InventoryItem | undefined,
  matchedBy: "id" | "name" | undefined,
  reservations?: Reservations
): IngredientMatch {
  const need = ingredient.amount;

  if (!matched) {
    return {
      ingredient,
      status: "missing",
      have: 0,
      need,
      shortfall: Math.max(need, 0),
    };
  }

  // Stock still available after earlier lines of this recipe reserved theirs,
  // expressed in the matched item's own unit.
  const reserved = reservations?.get(matched) ?? 0;
  const availableInItemUnit = Math.max(matched.amount - reserved, 0);

  // Express the available stock in the recipe ingredient's unit. When the units
  // are incomparable, fall back to the raw available amount (surfaced as a
  // warning by the orchestrator via `hasUnitMismatch`).
  const converted = convertAmount(
    availableInItemUnit,
    matched.unit,
    ingredient.unit
  );
  const have = converted ?? availableInItemUnit;
  const status = resolveStatus(have, need);

  // Reserve what this line consumes (capped at what's available), so later lines
  // sharing this item see the remainder. Only when the units are comparable.
  if (reservations) {
    const needInItemUnit = convertAmount(need, ingredient.unit, matched.unit);
    if (needInItemUnit !== null) {
      const used = Math.min(Math.max(needInItemUnit, 0), availableInItemUnit);
      reservations.set(matched, reserved + used);
    }
  }

  return {
    ingredient,
    inventoryItem: matched,
    matchedBy,
    status,
    have,
    need,
    shortfall: Math.max(need - have, 0),
  };
}

function resolveStatus(have: number, need: number): MatchStatus {
  if (need <= 0) return "satisfied";
  if (have <= 0) return "missing";
  if (have >= need) return "satisfied";
  return "short";
}

/**
 * Whether a resolved match compared incomparable units (and therefore fell back
 * to a raw amount comparison). Used by the orchestrator to emit a warning.
 */
export function hasUnitMismatch(match: IngredientMatch): boolean {
  return (
    match.inventoryItem !== undefined &&
    convertAmount(
      match.inventoryItem.amount,
      match.inventoryItem.unit,
      match.ingredient.unit
    ) === null
  );
}
