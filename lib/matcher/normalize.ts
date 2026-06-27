/**
 * Pure normalization helpers for the matching engine: ingredient-name
 * canonicalization (for fuzzy matching) and metric unit handling (so `have` and
 * `need` can be compared even when expressed in different but compatible units).
 *
 * No I/O — everything here is a deterministic pure function.
 */
import type { Unit } from "@/lib/brewfather/types";

/** The measurement dimension a unit belongs to. */
export type UnitDimension = "mass" | "volume" | "count" | "unknown";

interface UnitConversion {
  dimension: UnitDimension;
  /** Multiplier to the dimension's base unit (grams, milliliters, or each). */
  factor: number;
}

/**
 * Known units mapped to their dimension and conversion factor to a base unit
 * (mass->g, volume->ml, count->each). Brewfather is metric; imperial mass units
 * are included defensively for manually-entered items.
 */
const UNIT_CONVERSIONS: Readonly<Record<string, UnitConversion>> = {
  // mass -> grams
  kg: { dimension: "mass", factor: 1000 },
  kgs: { dimension: "mass", factor: 1000 },
  g: { dimension: "mass", factor: 1 },
  gr: { dimension: "mass", factor: 1 },
  gram: { dimension: "mass", factor: 1 },
  grams: { dimension: "mass", factor: 1 },
  mg: { dimension: "mass", factor: 0.001 },
  oz: { dimension: "mass", factor: 28.349523125 },
  lb: { dimension: "mass", factor: 453.59237 },
  lbs: { dimension: "mass", factor: 453.59237 },
  // volume -> milliliters
  l: { dimension: "volume", factor: 1000 },
  liter: { dimension: "volume", factor: 1000 },
  liters: { dimension: "volume", factor: 1000 },
  litre: { dimension: "volume", factor: 1000 },
  litres: { dimension: "volume", factor: 1000 },
  ml: { dimension: "volume", factor: 1 },
  // count -> each
  each: { dimension: "count", factor: 1 },
  ea: { dimension: "count", factor: 1 },
  pkg: { dimension: "count", factor: 1 },
  pkgs: { dimension: "count", factor: 1 },
  package: { dimension: "count", factor: 1 },
  packages: { dimension: "count", factor: 1 },
  packet: { dimension: "count", factor: 1 },
  pack: { dimension: "count", factor: 1 },
  sachet: { dimension: "count", factor: 1 },
  unit: { dimension: "count", factor: 1 },
  units: { dimension: "count", factor: 1 },
  vial: { dimension: "count", factor: 1 },
};

/**
 * Canonicalize an ingredient name for matching: strip diacritics, lowercase,
 * replace any run of non-alphanumeric characters with a single space, and trim.
 *
 * e.g. "Cascade (US) - Leaf" -> "cascade us leaf", "Pilsner Malt" -> "pilsner malt".
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Lowercase + trim a unit string for table lookups. */
export function normalizeUnit(unit: Unit): string {
  return unit.trim().toLowerCase().replace(/\.+$/, "");
}

/** The dimension a unit belongs to (`unknown` for unrecognized units). */
export function getUnitDimension(unit: Unit): UnitDimension {
  return UNIT_CONVERSIONS[normalizeUnit(unit)]?.dimension ?? "unknown";
}

/**
 * Convert `amount` from `fromUnit` into `toUnit`.
 *
 * Returns `null` when the units are not comparable — different dimensions, or an
 * unrecognized unit on only one side. Two identical unrecognized units compare
 * as-is (factor 1).
 */
export function convertAmount(
  amount: number,
  fromUnit: Unit,
  toUnit: Unit
): number | null {
  const from = UNIT_CONVERSIONS[normalizeUnit(fromUnit)];
  const to = UNIT_CONVERSIONS[normalizeUnit(toUnit)];
  if (!from || !to) {
    // Unknown unit(s): only comparable when the raw unit strings match.
    return normalizeUnit(fromUnit) === normalizeUnit(toUnit) ? amount : null;
  }
  if (from.dimension !== to.dimension) return null;
  return (amount * from.factor) / to.factor;
}

/**
 * A magnitude usable for comparing amounts of the same kind of ingredient
 * (e.g. fermentable weights when picking the base malt): the amount converted to
 * its dimension's base unit, or the raw amount for unrecognized units.
 */
export function comparableMagnitude(amount: number, unit: Unit): number {
  const conversion = UNIT_CONVERSIONS[normalizeUnit(unit)];
  return conversion ? amount * conversion.factor : amount;
}
