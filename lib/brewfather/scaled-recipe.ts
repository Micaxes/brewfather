/**
 * Build a Brewfather `POST /v2/recipes` payload that is a scaled copy of an
 * existing recipe (pure logic).
 *
 * The Brewfather API cannot create a *batch* (there is no create-batch
 * endpoint), so "push a chosen recipe to Brewfather" is realized as **creating a
 * new recipe** — here, a copy scaled to a factor (e.g. the scale-to-stock
 * result). We round-trip the recipe's own raw JSON (rather than reconstruct the
 * rich Brewfather schema): strip server-managed identity/version fields, set a
 * new name, and scale the batch/boil sizes and every ingredient `amount`.
 *
 * Derived fields (OG/FG/IBU/color, totals) are left for Brewfather to recompute;
 * we scale the ingredient amounts and the volumes, which is what a linear
 * batch-size scale changes.
 */

/** Top-level server-managed keys stripped so the POST creates a fresh recipe. */
const STRIPPED_TOP_LEVEL_KEYS = new Set([
  "_id",
  "_rev",
  "_created",
  "_timestamp",
  "_timestamp_ms",
  "_version",
  "_versionId",
  "_versionNumber",
  "_uid",
  "_ev",
  "_init",
  "_origin",
  "_share",
  "_public",
]);

/** Scalar volume/quantity fields that scale linearly with batch size. */
const SCALED_SCALAR_KEYS = [
  "batchSize",
  "boilSize",
  "fermentablesTotalAmount",
  "hopsTotalAmount",
  "mashWaterAmount",
  "spargeWaterAmount",
  "totalWaterAmount",
] as const;

/** Ingredient arrays whose items each carry a scalable `amount`. */
const INGREDIENT_ARRAY_KEYS = ["fermentables", "hops", "miscs", "yeasts"] as const;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scaleAmountField(item: unknown, factor: number): unknown {
  if (!isRecord(item)) return item;
  const next = { ...item };
  const amount = next.amount;
  if (typeof amount === "number" && Number.isFinite(amount)) {
    next.amount = roundTo(amount * factor, 6);
  }
  return next;
}

export interface BuildScaledRecipeOptions {
  /** Override the generated recipe name. */
  name?: string;
}

/**
 * Produce a new-recipe payload that is `rawRecipe` scaled by `factor`.
 * Throws if `rawRecipe` is not an object or `factor` is not a positive finite number.
 */
export function buildScaledRecipePayload(
  rawRecipe: unknown,
  factor: number,
  options: BuildScaledRecipeOptions = {}
): Record<string, unknown> {
  if (!isRecord(rawRecipe)) {
    throw new Error("buildScaledRecipePayload: rawRecipe must be an object");
  }
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`buildScaledRecipePayload: factor must be > 0 (got ${factor})`);
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawRecipe)) {
    if (STRIPPED_TOP_LEVEL_KEYS.has(key)) continue;
    out[key] = value;
  }

  const originalName = typeof rawRecipe.name === "string" ? rawRecipe.name : "Recipe";
  out.name = options.name ?? `${originalName} (scaled ×${roundTo(factor, 3)})`;

  for (const key of SCALED_SCALAR_KEYS) {
    const value = rawRecipe[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = roundTo(value * factor, 6);
    }
  }

  for (const key of INGREDIENT_ARRAY_KEYS) {
    const array = rawRecipe[key];
    if (Array.isArray(array)) {
      out[key] = array.map((item) => scaleAmountField(item, factor));
    }
  }

  return out;
}
