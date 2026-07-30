/**
 * Scale-to-stock (pure logic).
 *
 * Given a recipe and the user's inventory, compute the largest multiple of the
 * recipe the current stock supports — and the scaled ingredient amounts at that
 * multiple. The limiting factor is the smallest `have / need` ratio across the
 * recipe's required ingredients.
 *
 * Stock is shared correctly: when several recipe lines resolve to the same
 * inventory item (e.g. one hop used for bittering, flavor, and aroma), their
 * needs are summed against that item's single stock before computing the ratio —
 * so the factor reflects the *combined* draw on each item, not each line alone.
 *
 * The factor is floored (to 4 decimals) so the scaled amounts never recommend
 * more than the inventory actually holds. Ingredient resolution reuses the
 * matcher's id-first, fuzzy-name-fallback logic (`matchIngredient`), plus the
 * same malt-equivalence fallback the dashboard applies — otherwise the two
 * would disagree about what the user has (see `resolveFermentableByGuide`).
 */
import type {
  InventoryItem,
  RecipeDetail,
  RecipeIngredient,
} from "@/lib/brewfather/types";
import type { MatchMethod } from "@/lib/matcher/types";
import {
  buildInventoryIndex,
  matchIngredient,
  prepareIngredients,
} from "@/lib/matcher/match";
import { convertAmount } from "@/lib/matcher/normalize";
import { findMaltSubstitutes } from "@/lib/matcher/substitutions";

/** A recipe ingredient with its amount scaled to the stock-limited factor. */
export interface ScaledIngredient {
  ingredient: RecipeIngredient;
  /** The inventory item it resolved to, if any. */
  inventoryItem?: InventoryItem;
  /**
   * How the match was made (stable id, fuzzy name, or a guide equivalent);
   * absent when missing.
   */
  matchedBy?: MatchMethod;
  /** `ingredient.amount * factor`, in the ingredient's own unit. */
  scaledAmount: number;
  /** This ingredient's inventory item binds the maximum factor (the bottleneck). */
  limiting: boolean;
}

export interface ScaleToStockResult {
  /**
   * Largest multiple of the recipe the inventory supports, floored to 4 decimals
   * (>= 0). `1` means exactly one batch; `0` means a required ingredient is
   * missing (or there is nothing to scale).
   */
  factor: number;
  /** Scaled batch size in liters at `factor`, when the recipe declares one. */
  scaledBatchSize?: number;
  /** Per-ingredient scaled amounts at `factor`, in recipe order. */
  ingredients: ScaledIngredient[];
  /**
   * The ingredient name(s) that limit the factor — the bottleneck(s) when
   * scalable, or the missing ingredient(s) when the factor is 0.
   */
  limitedBy: string[];
  /** Non-fatal warnings (missing ingredients, unit mismatches, no batch size). */
  warnings: string[];
}

export interface ScaleToStockOptions {
  /** Fuse.js fuzzy-name threshold override (defaults to the matcher's default). */
  fuzzyThreshold?: number;
}

const EPSILON = 1e-9;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Floor (not round) so a scaled need never exceeds the available stock. */
function floorTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.floor(value * factor) / factor;
}

/** What a recipe line resolved to, once the guide fallback has had its turn. */
interface ResolvedSource {
  inventoryItem?: InventoryItem;
  matchedBy?: MatchMethod;
  /**
   * Guide rule 4: a >250 EBC colourant stand-in is dosed at −15%, so the line
   * draws proportionally less of *that item's* stock. Always 1 for a direct
   * (id or name) match.
   */
  doseFactor: number;
}

/**
 * Guide fallback for a fermentable neither id nor fuzzy name could resolve.
 *
 * `match.ts` already satisfies such a malt from an in-stock equivalent
 * (`applyMaltSubstitutes`), so without this scale-to-stock would call the very
 * recipe the dashboard shows as brewable unbrewable, forcing factor 0.
 *
 * Deliberately reservation-free, like the rest of this module: two lines
 * standing in on the same sack land on the same inventory item and their needs
 * are summed into one `needByItem` entry below — the same stock-sharing rule
 * already applied to directly matched items. Unlike `match.ts` this does not
 * require the stand-in to cover the whole requirement: a partly-stocked
 * equivalent yields a fractional factor, exactly as partial stock of the
 * requested malt itself does.
 */
function resolveFermentableByGuide(
  ingredient: RecipeIngredient,
  inventory: InventoryItem[],
  style: string | undefined
): ResolvedSource {
  if (ingredient.category !== "fermentable") return { doseFactor: 1 };
  const best = findMaltSubstitutes(ingredient, inventory, {
    ...(style !== undefined ? { style } : {}),
    limit: 1,
  })[0];
  if (!best) return { doseFactor: 1 };
  return {
    inventoryItem: best.inventoryItem,
    matchedBy: "equivalent",
    doseFactor: best.doseFactor,
  };
}

/**
 * Compute the largest stock-supported multiple of `recipe` and the scaled
 * ingredient amounts at that multiple.
 */
export function scaleRecipeToStock(
  recipe: RecipeDetail,
  inventory: InventoryItem[],
  options: ScaleToStockOptions = {}
): ScaleToStockResult {
  const index = buildInventoryIndex(inventory, options.fuzzyThreshold);
  const warnings: string[] = [];

  // Resolve each cleaned recipe ingredient (items rows dropped, duplicate
  // lines pre-merged) to an inventory item (id, then fuzzy name, then — for
  // fermentables only — a guide equivalent). Scale still considers yeast/misc
  // — physical stock, not the match score.
  const resolved = prepareIngredients(recipe).all.map((ingredient) => {
    const match = matchIngredient(ingredient, index);
    const source: ResolvedSource = match.inventoryItem
      ? {
          inventoryItem: match.inventoryItem,
          matchedBy: match.matchedBy,
          doseFactor: 1,
        }
      : resolveFermentableByGuide(ingredient, inventory, recipe.style);
    return { ingredient, ...source };
  });

  // Sum required amounts per resolved inventory item, in that item's own unit.
  const needByItem = new Map<InventoryItem, number>();
  const missing: string[] = [];
  let sawRequired = false;

  for (const { ingredient, inventoryItem, doseFactor } of resolved) {
    // `doseFactor` is 1 unless a >250 EBC stand-in is doing the work, in which
    // case the line draws less of that item's stock than the recipe asks for.
    const need = ingredient.amount * doseFactor;
    if (need <= 0) continue;
    sawRequired = true;
    if (!inventoryItem) {
      missing.push(ingredient.name);
      continue;
    }
    const needInItemUnit = convertAmount(need, ingredient.unit, inventoryItem.unit);
    if (needInItemUnit === null) {
      warnings.push(
        `Cannot compare units for "${ingredient.name}" (need "${ingredient.unit}", ` +
          `have "${inventoryItem.unit}"); excluded from the scale calculation.`
      );
      continue;
    }
    if (needInItemUnit <= 0) continue;
    needByItem.set(
      inventoryItem,
      (needByItem.get(inventoryItem) ?? 0) + needInItemUnit
    );
  }

  const hasMissing = missing.length > 0;
  const hasConstraints = [...needByItem.values()].some((n) => n > 0);

  // The limiting factor is the smallest have/need ratio across constrained items.
  let minRatio = Number.POSITIVE_INFINITY;
  const limitingItems = new Set<InventoryItem>();
  if (!hasMissing && hasConstraints) {
    for (const [item, totalNeed] of needByItem) {
      if (totalNeed <= 0) continue;
      const ratio = item.amount / totalNeed;
      if (ratio < minRatio) minRatio = ratio;
    }
    for (const [item, totalNeed] of needByItem) {
      if (totalNeed <= 0) continue;
      if (item.amount / totalNeed <= minRatio + EPSILON) limitingItems.add(item);
    }
  } else if (!hasMissing && !hasConstraints && !sawRequired) {
    warnings.push("Recipe has no ingredients with a positive amount; cannot scale.");
  }

  const factor =
    !hasMissing && hasConstraints && Number.isFinite(minRatio)
      ? floorTo(minRatio, 4)
      : 0;

  const ingredients: ScaledIngredient[] = resolved.map((r) => {
    const limiting =
      r.ingredient.amount > 0 &&
      (hasMissing
        ? missing.includes(r.ingredient.name)
        : r.inventoryItem !== undefined && limitingItems.has(r.inventoryItem));
    return {
      ingredient: r.ingredient,
      inventoryItem: r.inventoryItem,
      matchedBy: r.matchedBy,
      scaledAmount: roundTo(r.ingredient.amount * factor, 4),
      limiting,
    };
  });

  const limitedBy = hasMissing
    ? [...new Set(missing)]
    : [
        ...new Set(
          ingredients.filter((i) => i.limiting).map((i) => i.ingredient.name)
        ),
      ];

  const result: ScaleToStockResult = {
    factor,
    ingredients,
    limitedBy,
    warnings,
  };

  if (recipe.batchSize !== undefined) {
    result.scaledBatchSize = roundTo(recipe.batchSize * factor, 4);
  } else if (sawRequired) {
    warnings.push("Recipe has no batch size; reporting scale factor and amounts only.");
  }

  return result;
}
