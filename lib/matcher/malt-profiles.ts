/**
 * Malt property profiles (pure data + lookup).
 *
 * Transcribed from `docs/reference/Malt_Comparison_Chart_Detailed.pdf` — "Malt
 * Comparison Chart, Detailed Reference", compiled August 2026 from the
 * Weyermann, Briess, Dingemans, Simpsons, Crisp and Bestmalz datasheets plus
 * the MoreBeer and Hogtown Brewers cross-reference charts. See
 * `docs/malt-reference.md` for the human-readable version and the provenance.
 * Keep the two in sync.
 *
 * **This module is additive and complementary to `malt-equivalents.ts`.** That
 * file answers "which maltster's product equals which" — one row per
 * equivalence class, many maltster names on it, colour only. This one answers
 * "what are this malt *type's* properties, and what does Weyermann or Briess
 * call it" — one row per malt type, carrying the numbers the equivalence guide
 * never published: diastatic power, whether it needs mashing, its dosage
 * ceiling, extract potential, moisture and protein. Neither supersedes the
 * other and nothing here changes what the substitution engine currently does;
 * wiring is the integrator's call (see `docs/malt-reference.md`).
 *
 * Two deliberate design points, both driven by real failures:
 *
 *   - **Diastatic power is the real measurement behind `MaltRow.unmalted`.**
 *     That boolean exists to stop raw grain standing in for malt. Degrees
 *     Lintner say the same thing quantitatively and for every row, not just the
 *     two the guide happened to flag: 0 = no enzymes at all (every adjunct,
 *     every crystal and roasted malt, acidulated malt), and per the chart's own
 *     footnote >35 = self-converting, >70 = can convert adjuncts as well.
 *
 *   - **`maxPercent` is a dosage ceiling, not decoration.** Special B at 10%,
 *     Rice Hulls at 10%, Roasted Barley at 10%, CaraAroma at 5%, Black Patent
 *     at 5%. A substitution that pushes a malt past its sane maximum is a bad
 *     suggestion however well the colour matches, so the ceiling travels with
 *     the data rather than living in the caller's head.
 *
 * Every figure below is transcribed as printed. Where the chart contradicts
 * itself the printed value is kept and the contradiction is called out in a
 * comment — this file is a transcription, not a correction.
 */
import { normalizeName } from "@/lib/matcher/normalize";

/**
 * The chart's own six categories, verbatim.
 *
 * **Do not map these onto `MaltClass` from `malt-equivalents.ts` without
 * reading `docs/malt-reference.md` first.** They are not the same taxonomy and
 * a naive mapping breaks substitution rule 1. This chart files Biscuit, Amber,
 * Brown and Victory under `caramel`, where the equivalence guide calls them
 * `kilned` and rule 1 explicitly forbids swapping the two ("a Caramunich Type 2
 * does *not* replace a Biscuit"). It also files Melanoidin, Acidulated, Peated,
 * Smoked, Rye, Oat and both wheat base malts under `base`, which the guide
 * splits across `melanoidin`, `technical`, `wheat` and `adjunct-grain`.
 */
export type MaltCategory =
  | "base"
  | "caramel"
  | "roasted"
  | "wheat"
  | "special"
  | "adjunct";

/** Human labels, for justification copy. */
export const MALT_CATEGORY_LABEL: Readonly<Record<MaltCategory, string>> = {
  base: "base malt",
  caramel: "caramel/crystal malt",
  roasted: "roasted malt",
  wheat: "wheat malt",
  special: "specialty malt",
  adjunct: "adjunct",
};

/**
 * An inclusive published band. `min === max` where the chart prints a single
 * figure rather than a range (e.g. Maris Otter at 3 °L, Pilsner Malt at 1.5).
 */
export interface NumericRange {
  min: number;
  max: number;
}

/**
 * A named product from another maltster's range.
 *
 * The chart marks some of these with an asterisk, footnoted "* Approximate
 * substitute — not identical". That distinction is preserved rather than
 * flattened: Carafa Special I's Briess counterpart is "Chocolate*", which is a
 * de-bittered malt being approximated by a sharply roasted one. Offering it
 * with the same confidence as an exact counterpart would be wrong.
 */
export interface MaltCrossReference {
  /** Product name as printed, with any trailing asterisk stripped. */
  name: string;
  /** The chart's "*": approximate substitute, not identical. */
  approximate: boolean;
}

export interface MaltReferenceProfile {
  id: string;
  /** Malt name exactly as the chart prints it. */
  name: string;
  category: MaltCategory;
  /** Published colour band, EBC. */
  ebc: NumericRange;
  /**
   * Published colour band, degrees Lovibond (the chart heads this column
   * "°Lov (SRM)", treating the two as one scale). Transcribed as printed —
   * see {@link ebcToLovibond} for why it does not always agree with `ebc`.
   */
  lovibond: NumericRange;
  /** Extract potential, points per gallon, at laboratory efficiency. */
  ppg: number;
  /** Whether the grain must be mashed to convert (chart column "Mash Req."). */
  mashRequired: boolean;
  /** Sane ceiling as a percentage of the grist. */
  maxPercent: number;
  moisturePercent: NumericRange;
  proteinPercent: NumericRange;
  /**
   * Diastatic power in degrees Lintner. 0 means no enzymes: the grain cannot
   * convert even its own starch and must ride along with a base malt.
   */
  diastaticPower: NumericRange;
  flavor: string;
  /** Styles the chart lists, as printed — a prose list, not a parsed set. */
  styles: string;
  /** Weyermann's counterpart, where the chart names one. */
  weyermann?: MaltCrossReference;
  /** Briess's counterpart, where the chart names one. */
  briess?: MaltCrossReference;
  notes: string;
}

/**
 * Chart footnote: "Diastatic Power in degrees Lintner (WK): >35 =
 * self-converting; >70 = can convert adjuncts."
 */
export const SELF_CONVERTING_LINTNER = 35;
export const ADJUNCT_CONVERTING_LINTNER = 70;

/**
 * The chart's stated colour conversion: `°L = (EBC + 1.2) / 2.65`.
 *
 * **It does not reproduce the chart's own rows.** Its two US crystal malts are
 * named for their Lovibond rating and so pin the relation exactly: Crystal Malt
 * 60L is listed at 115–130 EBC and Crystal Malt 120L at 230–260 EBC. This
 * formula turns those bands into 43.9–49.5 °L and 87.3–98.6 °L — 18–27%
 * below the 60 and 120 the same rows print. Inverted it is worse: 60 °L comes out at
 * 157.8 EBC against a printed band topping out at 130.
 *
 * Both rows instead sit on `EBC ≈ 1.97 × SRM`, the relation already used in
 * `docs/malt-substitutions.md` and exposed here as {@link srmToEbc}. The 2.65
 * figure is the historical pre-1990 EBC scale; the chart appears to have
 * carried the old footnote onto modern EBC figures.
 *
 * It is exported anyway, and used nowhere by default, because it is what the
 * source says and the discrepancy is only demonstrable if both are available.
 * For interpreting a real colour number, prefer {@link srmToEbc}.
 */
export function ebcToLovibond(ebc: number): number {
  return (ebc + 1.2) / 2.65;
}

/** Inverse of {@link ebcToLovibond}: `EBC = °L × 2.65 − 1.2`. */
export function lovibondToEbc(lovibond: number): number {
  return lovibond * 2.65 - 1.2;
}

/**
 * `EBC = SRM × 1.97`.
 *
 * **Not from this chart** — it is the relation already documented in
 * `docs/malt-substitutions.md`, restated here because it is the one that
 * reproduces this chart's Crystal 60L and 120L rows (see
 * {@link ebcToLovibond}). Kept beside its rival so a caller choosing between
 * them can see both.
 */
export const EBC_PER_SRM = 1.97;

export function srmToEbc(srm: number): number {
  return srm * EBC_PER_SRM;
}

export function ebcToSrm(ebc: number): number {
  return ebc / EBC_PER_SRM;
}

/** Midpoint of a published band — what colour comparisons work from. */
export function midpoint(range: NumericRange): number {
  return (range.min + range.max) / 2;
}

/**
 * Whether the malt brings any enzymes at all.
 *
 * This is the measured form of `MaltRow.unmalted` in `malt-equivalents.ts`: a
 * grain with no diastatic power carries no enzymes, which is exactly why raw
 * barley must never be offered as a stand-in for a malted grain.
 */
export function hasDiastaticPower(profile: MaltReferenceProfile): boolean {
  return profile.diastaticPower.max > 0;
}

/** Chart footnote: >35 °Lintner converts its own starch. */
export function isSelfConverting(profile: MaltReferenceProfile): boolean {
  return profile.diastaticPower.min > SELF_CONVERTING_LINTNER;
}

/**
 * Chart footnote: >70 °Lintner has enough enzyme surplus to convert adjuncts
 * as well as its own starch.
 */
export function canConvertAdjuncts(profile: MaltReferenceProfile): boolean {
  return profile.diastaticPower.min > ADJUNCT_CONVERTING_LINTNER;
}

/**
 * Whether a proposed grist share breaches the chart's ceiling for this malt.
 *
 * `percent` is a share of the grist expressed 0–100, matching the chart's own
 * column. Callers that hold a fraction must scale it first.
 */
export function exceedsMaxPercent(
  profile: MaltReferenceProfile,
  percent: number
): boolean {
  return percent > profile.maxPercent;
}

/**
 * The chart's 53 rows, grouped by its own six categories and alphabetical
 * within each — the order the source prints them, so a reader can diff the two
 * side by side.
 *
 * (The chart's own header line claims "52 malt types across 6 categories". The
 * table itself carries 53. The rows are transcribed; the header is not.)
 */
export const MALT_PROFILES: readonly MaltReferenceProfile[] = [
  // -------------------------------------------------------------- base
  {
    id: "two-row-pale-us",
    name: "2-Row Pale (US)",
    category: "base",
    ebc: { min: 3, max: 5 },
    lovibond: { min: 1.5, max: 2 },
    ppg: 37,
    mashRequired: true,
    maxPercent: 100,
    moisturePercent: { min: 4, max: 5 },
    proteinPercent: { min: 11, max: 13 },
    diastaticPower: { min: 120, max: 160 },
    flavor: "Light malt, grainy, clean",
    styles: "All styles",
    weyermann: { name: "Pilsner", approximate: false },
    briess: { name: "2-Row Brewers Malt", approximate: false },
    notes: "Standard US base malt, high enzymatic power",
  },
  {
    id: "six-row-pale-us",
    name: "6-Row Pale (US)",
    category: "base",
    ebc: { min: 3, max: 5 },
    lovibond: { min: 1.5, max: 2 },
    ppg: 35,
    mashRequired: true,
    maxPercent: 100,
    moisturePercent: { min: 4, max: 5 },
    proteinPercent: { min: 12, max: 14 },
    diastaticPower: { min: 160, max: 200 },
    flavor: "Light malt, grainy",
    styles: "Lagers, Cream Ale",
    weyermann: { name: "Pilsner", approximate: false },
    briess: { name: "6-Row Brewers Malt", approximate: false },
    notes: "Higher protein & enzymes than 2-row, good with adjuncts",
  },
  {
    id: "acidulated-malt",
    name: "Acidulated Malt (Sauermalz)",
    category: "base",
    ebc: { min: 2, max: 4 },
    lovibond: { min: 1.5, max: 1.5 },
    ppg: 35,
    mashRequired: true,
    maxPercent: 10,
    moisturePercent: { min: 5, max: 7 },
    proteinPercent: { min: 8, max: 10 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Slightly sour/tart",
    styles: "Adjusts mash pH",
    weyermann: { name: "Acidulated", approximate: false },
    briess: { name: "Acid Malt", approximate: false },
    notes: "1-5% lowers mash pH ~0.1 per 1%",
  },
  /*
   * The only row whose diastatic band spans zero. A batch at the bottom of it
   * converts nothing, so 0-30 °Lintner is not "weakly enzymatic" — it is
   * "may bring no enzymes at all", which is why `hasDiastaticPower` reads the
   * band max but `isSelfConverting` reads the min.
   */
  {
    id: "dark-wheat-malt",
    name: "Dark Wheat Malt",
    category: "base",
    ebc: { min: 15, max: 20 },
    lovibond: { min: 6, max: 8 },
    ppg: 35,
    mashRequired: true,
    maxPercent: 70,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 13, max: 16 },
    diastaticPower: { min: 0, max: 30 },
    flavor: "Dark bread, earthy, slightly smoky",
    styles: "Dunkelweizen, Dunkel",
    weyermann: { name: "Dark Wheat", approximate: false },
    notes: "Kilned wheat, rich dark character",
  },
  {
    id: "golden-promise",
    name: "Golden Promise",
    category: "base",
    ebc: { min: 5, max: 7 },
    lovibond: { min: 2.5, max: 2.5 },
    ppg: 37,
    mashRequired: true,
    maxPercent: 100,
    moisturePercent: { min: 3, max: 4 },
    proteinPercent: { min: 9, max: 11 },
    diastaticPower: { min: 60, max: 90 },
    flavor: "Sweet, clean, slightly grainy",
    styles: "Scottish Ale, Lager",
    briess: { name: "Golden Promise", approximate: false },
    notes: "Scottish heritage barley, smooth malt character",
  },
  {
    id: "maris-otter",
    name: "Maris Otter",
    category: "base",
    ebc: { min: 6, max: 8 },
    lovibond: { min: 3, max: 3 },
    ppg: 38,
    mashRequired: true,
    maxPercent: 100,
    moisturePercent: { min: 3, max: 4 },
    proteinPercent: { min: 9, max: 11 },
    diastaticPower: { min: 60, max: 90 },
    flavor: "Rich, nutty, biscuity, clean",
    styles: "English Ales, Bitter, Stout",
    weyermann: { name: "Pale Ale", approximate: false },
    briess: { name: "Maris Otter", approximate: false },
    notes: "Premium English variety, classic ale base",
  },
  /*
   * Filed under Base by the chart, but its own diastatic power figure is 0 and
   * its ceiling is 20% of the grist — the numbers describe a colour-and-aroma
   * malt, not a base malt. `malt-equivalents.ts` gives melanoidin its own
   * class, and this row is the reason to keep it that way.
   */
  {
    id: "melanoidin",
    name: "Melanoidin",
    category: "base",
    ebc: { min: 60, max: 80 },
    lovibond: { min: 25, max: 33 },
    ppg: 34,
    mashRequired: true,
    maxPercent: 20,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 12, max: 14 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Intense malty, honey, toffee, raisin",
    styles: "Bock, Amber, Brown Ale",
    weyermann: { name: "Melanoidin", approximate: false },
    briess: { name: "Aromatic", approximate: false },
    notes: "Maillard reaction product, deep malt aroma",
  },
  {
    id: "mild-ale-malt",
    name: "Mild Ale Malt",
    category: "base",
    ebc: { min: 6, max: 9 },
    lovibond: { min: 3, max: 4 },
    ppg: 37,
    mashRequired: true,
    maxPercent: 100,
    moisturePercent: { min: 3, max: 4 },
    proteinPercent: { min: 9, max: 11 },
    diastaticPower: { min: 70, max: 90 },
    flavor: "Nutty, slightly sweet",
    styles: "Mild Ale, Brown Ale",
    weyermann: { name: "Pale Ale", approximate: false },
    notes: "Lower kilned than Pale Ale, softer flavor",
  },
  {
    id: "munich-malt-1",
    name: "Munich Malt I",
    category: "base",
    ebc: { min: 14, max: 18 },
    lovibond: { min: 6, max: 8 },
    ppg: 35,
    mashRequired: true,
    maxPercent: 80,
    moisturePercent: { min: 4, max: 5 },
    proteinPercent: { min: 11, max: 13 },
    diastaticPower: { min: 40, max: 70 },
    flavor: "Malty, bready, toasty, aromatic",
    styles: "Bock, Dunkel, Märzen",
    weyermann: { name: "Munich I", approximate: false },
    briess: { name: "Munich 10L", approximate: false },
    notes: "Light Munich, rich malt backbone",
  },
  {
    id: "munich-malt-2",
    name: "Munich Malt II",
    category: "base",
    ebc: { min: 20, max: 25 },
    lovibond: { min: 9, max: 11 },
    ppg: 34,
    mashRequired: true,
    maxPercent: 80,
    moisturePercent: { min: 4, max: 5 },
    proteinPercent: { min: 11, max: 13 },
    diastaticPower: { min: 30, max: 60 },
    flavor: "Intense malt, bready, sweet",
    styles: "Bock, Doppelbock, Dunkel",
    weyermann: { name: "Munich II", approximate: false },
    briess: { name: "Munich 20L", approximate: false },
    notes: "Dark Munich, deeper malt flavor",
  },
  /*
   * Base by category, 0 °Lintner by measurement, ceiling 30%. Malted oats
   * still need a real base malt alongside them; the equivalence guide keeps
   * oat malt apart from raw oats, and this row shows why even the *malted*
   * form cannot carry a mash on its own.
   */
  {
    id: "oat-malt",
    name: "Oat Malt",
    category: "base",
    ebc: { min: 3, max: 5 },
    lovibond: { min: 1.5, max: 2 },
    ppg: 28,
    mashRequired: true,
    maxPercent: 30,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 13, max: 16 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Creamy, smooth, silky",
    styles: "Oatmeal Stout, NEIPA",
    weyermann: { name: "Malted Oats", approximate: false },
    notes: "Adds body and smoothness, max 30%",
  },
  {
    id: "pale-ale-malt",
    name: "Pale Ale Malt",
    category: "base",
    ebc: { min: 6, max: 9 },
    lovibond: { min: 3, max: 4 },
    ppg: 38,
    mashRequired: true,
    maxPercent: 100,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 9, max: 11 },
    diastaticPower: { min: 80, max: 120 },
    flavor: "Biscuity, slightly toasty, full",
    styles: "Pale Ale, IPA, Bitter",
    weyermann: { name: "Pale Ale", approximate: false },
    briess: { name: "Pale Ale", approximate: false },
    notes: "Slightly kilned vs Pilsner, richer malt character",
  },
  {
    id: "peated-malt",
    name: "Peated Malt",
    category: "base",
    ebc: { min: 3, max: 5 },
    lovibond: { min: 2, max: 2 },
    ppg: 36,
    mashRequired: true,
    maxPercent: 30,
    moisturePercent: { min: 4, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 50, max: 80 },
    flavor: "Peat smoke, medicinal, iodine",
    styles: "Scottish Ale, Smoked Beer",
    weyermann: { name: "Peated Malt", approximate: false },
    briess: { name: "Peated", approximate: false },
    notes: "Strong peat smoke, 5-10% typical",
  },
  {
    id: "pilsner-malt",
    name: "Pilsner Malt",
    category: "base",
    ebc: { min: 3, max: 4 },
    lovibond: { min: 1.5, max: 1.5 },
    ppg: 37,
    mashRequired: true,
    maxPercent: 100,
    moisturePercent: { min: 4, max: 5 },
    proteinPercent: { min: 9, max: 11 },
    diastaticPower: { min: 100, max: 120 },
    flavor: "Very light, sweet, delicate",
    styles: "Pils, Lager, Witbier",
    weyermann: { name: "Pilsner Malt", approximate: false },
    briess: { name: "Pilsen", approximate: false },
    notes: "Lightest base malt, finest flavor",
  },
  {
    id: "rye-malt",
    name: "Rye Malt",
    category: "base",
    ebc: { min: 5, max: 8 },
    lovibond: { min: 2, max: 3 },
    ppg: 36,
    mashRequired: true,
    maxPercent: 50,
    moisturePercent: { min: 5, max: 6 },
    proteinPercent: { min: 13, max: 16 },
    diastaticPower: { min: 60, max: 100 },
    flavor: "Spicy, earthy, dry",
    styles: "Roggenbier, Rye Pale Ale",
    weyermann: { name: "Rye Malt", approximate: false },
    briess: { name: "Rye", approximate: false },
    notes: "Max 50%, high beta-glucan, can cause stuck sparge",
  },
  {
    id: "smoked-malt",
    name: "Smoked Malt (Rauch)",
    category: "base",
    ebc: { min: 3, max: 5 },
    lovibond: { min: 2, max: 2 },
    ppg: 37,
    mashRequired: true,
    maxPercent: 100,
    moisturePercent: { min: 4, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 60, max: 90 },
    flavor: "Intense smoke, campfire, bacon",
    styles: "Rauchbier, Smoked Porter",
    weyermann: { name: "Smoked Malt", approximate: false },
    briess: { name: "Special Roast", approximate: true },
    notes: "Beechwood smoked, use 30-100% for rauchbier",
  },
  {
    id: "vienna-malt",
    name: "Vienna Malt",
    category: "base",
    ebc: { min: 8, max: 12 },
    lovibond: { min: 3.5, max: 5 },
    ppg: 36,
    mashRequired: true,
    maxPercent: 100,
    moisturePercent: { min: 4, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 60, max: 90 },
    flavor: "Toasty, light amber, biscuity",
    styles: "Vienna Lager, Märzen, Amber",
    weyermann: { name: "Vienna Malt", approximate: false },
    briess: { name: "Vienna", approximate: false },
    notes: "Fuller than Pilsner, lighter than Munich",
  },
  {
    id: "wheat-malt",
    name: "Wheat Malt",
    category: "base",
    ebc: { min: 3, max: 5 },
    lovibond: { min: 1.5, max: 2 },
    ppg: 37,
    mashRequired: true,
    maxPercent: 70,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 13, max: 16 },
    diastaticPower: { min: 100, max: 130 },
    flavor: "Grainy, slightly tart, clean",
    styles: "Weizen, Witbier, NEIPA",
    weyermann: { name: "Pale Wheat", approximate: false },
    briess: { name: "White Wheat", approximate: false },
    notes: "No husk, needs rice hulls in thick mash",
  },
  // ----------------------------------------------------------- caramel
  /*
   * Amber, Biscuit, Brown and Victory sit in the chart's Caramel category but
   * are kilned malts, not crystal: dry, toasty and biscuity where a crystal
   * malt is sweet, and 0 °Lintner diastatic where crystal is also 0 — colour
   * and enzymes cannot tell them apart. `malt-equivalents.ts` files them as
   * `kilned` and substitution rule 1 forbids swapping the two ("a Caramunich
   * Type 2 does *not* replace a Biscuit"). Mapping this `category` straight
   * onto `MaltClass` would silently undo that.
   */
  {
    id: "amber-malt",
    name: "Amber Malt",
    category: "caramel",
    ebc: { min: 50, max: 70 },
    lovibond: { min: 22, max: 30 },
    ppg: 34,
    mashRequired: false,
    maxPercent: 20,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Biscuit, toast, nutty, dry",
    styles: "Brown Ale, Porter, ESB",
    briess: { name: "Amber", approximate: false },
    notes: "UK specialty, dry toasted character",
  },
  {
    id: "biscuit-malt",
    name: "Biscuit Malt",
    category: "caramel",
    ebc: { min: 45, max: 55 },
    lovibond: { min: 20, max: 23 },
    ppg: 34,
    mashRequired: false,
    maxPercent: 20,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Biscuit, toast, bread crust, nutty",
    styles: "Amber, Brown Ale, IPA",
    weyermann: { name: "Melanoidin", approximate: false },
    briess: { name: "Victory Malt", approximate: false },
    notes: "Lightly roasted, dry roasty character",
  },
  {
    id: "brown-malt",
    name: "Brown Malt",
    category: "caramel",
    ebc: { min: 150, max: 200 },
    lovibond: { min: 60, max: 80 },
    ppg: 33,
    mashRequired: false,
    maxPercent: 15,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Dry biscuit, dark bread, toast",
    styles: "Brown Ale, Porter, Dark Belgian",
    weyermann: { name: "Melanoidin", approximate: false },
    briess: { name: "Brown", approximate: false },
    notes: "UK traditional malt, porter style",
  },
  {
    id: "caraamber",
    name: "CaraAmber",
    category: "caramel",
    ebc: { min: 50, max: 70 },
    lovibond: { min: 20, max: 30 },
    ppg: 34,
    mashRequired: false,
    maxPercent: 15,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 10, max: 13 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Caramel, bread, amber",
    styles: "Amber Ale, Scottish Ale",
    weyermann: { name: "CaraAmber", approximate: false },
    notes: "Mid-range crystal malt",
  },
  // Ceiling 5% — with Black Patent the tightest in the chart.
  {
    id: "caraaroma",
    name: "CaraAroma",
    category: "caramel",
    ebc: { min: 300, max: 400 },
    lovibond: { min: 120, max: 160 },
    ppg: 33,
    mashRequired: false,
    maxPercent: 5,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 10, max: 13 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Dark fruit, plum, raisin, caramel",
    styles: "Dubbel, Quad, Dark Ale",
    weyermann: { name: "CaraAroma", approximate: false },
    briess: { name: "Special B", approximate: true },
    notes: "Very dark crystal, fruitcake character",
  },
  {
    id: "carapils-dextrin",
    name: "CaraPils / Dextrin",
    category: "caramel",
    ebc: { min: 2, max: 6 },
    lovibond: { min: 1, max: 2 },
    ppg: 33,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 10, max: 13 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Neutral, boosts head/body",
    styles: "All styles",
    weyermann: { name: "CaraPils", approximate: false },
    briess: { name: "Dextrin Malt", approximate: false },
    notes: "No color, pure body/foam enhancement",
  },
  {
    id: "carared",
    name: "CaraRed",
    category: "caramel",
    ebc: { min: 40, max: 60 },
    lovibond: { min: 16, max: 25 },
    ppg: 34,
    mashRequired: false,
    maxPercent: 15,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 10, max: 13 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Light caramel, berry, red color",
    styles: "Red Ale, Amber",
    weyermann: { name: "CaraRed", approximate: false },
    briess: { name: "Crystal 30", approximate: false },
    notes: "Imparts red/amber color",
  },
  {
    id: "carahell",
    name: "Carahell",
    category: "caramel",
    ebc: { min: 20, max: 30 },
    lovibond: { min: 8, max: 12 },
    ppg: 33,
    mashRequired: false,
    maxPercent: 15,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 10, max: 13 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Light caramel, sweet, honey",
    styles: "Lager, Blond, Wheat",
    weyermann: { name: "CaraHell", approximate: false },
    briess: { name: "Crystal 10", approximate: false },
    notes: "Very pale crystal, subtle sweetness",
  },
  {
    id: "caramunich-1",
    name: "Caramunich I",
    category: "caramel",
    ebc: { min: 90, max: 110 },
    lovibond: { min: 35, max: 45 },
    ppg: 34,
    mashRequired: false,
    maxPercent: 15,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 10, max: 13 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Caramel, biscuit, toffee",
    styles: "Märzen, Amber, Red Ale",
    weyermann: { name: "CaraMunich I", approximate: false },
    briess: { name: "Crystal 40", approximate: false },
    notes: "Light-medium crystal, caramel sweet",
  },
  {
    id: "caramunich-2",
    name: "Caramunich II",
    category: "caramel",
    ebc: { min: 110, max: 130 },
    lovibond: { min: 45, max: 55 },
    ppg: 34,
    mashRequired: false,
    maxPercent: 15,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 10, max: 13 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Rich caramel, toffee, plum",
    styles: "Bock, Red Ale, Amber",
    weyermann: { name: "CaraMunich II", approximate: false },
    briess: { name: "Crystal 60", approximate: false },
    notes: "Medium crystal, richer character",
  },
  {
    id: "caramunich-3",
    name: "Caramunich III",
    category: "caramel",
    ebc: { min: 150, max: 180 },
    lovibond: { min: 60, max: 75 },
    ppg: 34,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 10, max: 13 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Dark caramel, dried fruit, raisin",
    styles: "Doppelbock, Brown Ale",
    weyermann: { name: "CaraMunich III", approximate: false },
    briess: { name: "Crystal 80", approximate: false },
    notes: "Dark crystal, plum/raisin notes",
  },
  /*
   * One of the chart's two colour anchors, and the reason to distrust its own
   * conversion formula. These two rows are named for their Lovibond rating, so
   * the EBC band beside it pins the relation: 120 °L <-> 230-260 EBC and
   * 60 °L <-> 115-130 EBC, i.e. EBC ~ 1.95x the Lovibond number. The chart's
   * stated `°L = (EBC + 1.2) / 2.65` returns 87-99 for this row's own band.
   * See {@link ebcToLovibond}.
   */
  {
    id: "crystal-malt-120l",
    name: "Crystal Malt 120L (US)",
    category: "caramel",
    ebc: { min: 230, max: 260 },
    lovibond: { min: 120, max: 120 },
    ppg: 33,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 10, max: 13 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Dark caramel, dried fruit, burnt sugar",
    styles: "Porter, Stout, Dark Ale",
    weyermann: { name: "CaraAroma", approximate: false },
    briess: { name: "Crystal 120", approximate: false },
    notes: "Very dark crystal, use sparingly",
  },
  {
    id: "crystal-malt-60l",
    name: "Crystal Malt 60L (US)",
    category: "caramel",
    ebc: { min: 115, max: 130 },
    lovibond: { min: 60, max: 60 },
    ppg: 34,
    mashRequired: false,
    maxPercent: 15,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 10, max: 13 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Caramel, toffee, light jam",
    styles: "Pale Ale, Amber, IPA",
    weyermann: { name: "CaraMunich II", approximate: false },
    briess: { name: "Crystal 60", approximate: false },
    notes: "Classic US crystal malt",
  },
  // Ceiling 10%. Rule 4 in `docs/malt-substitutions.md` dose-adjusts it too.
  {
    id: "special-b",
    name: "Special B",
    category: "caramel",
    ebc: { min: 300, max: 450 },
    lovibond: { min: 125, max: 180 },
    ppg: 33,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 10, max: 13 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Raisin, plum, dark fruit, chocolate",
    styles: "Dubbel, Quad, Dark Ale",
    weyermann: { name: "CaraAroma", approximate: false },
    briess: { name: "Special B", approximate: false },
    notes: "Dingemans specialty, unique dark crystal",
  },
  /*
   * Transcribed as printed, and internally inconsistent: 25 °L against a 25-30
   * EBC band is off by a factor of ~2.5 whichever conversion is applied (the
   * chart's own formula gives 9.9-11.8, the 1.97 relation 12.7-15.2). Briess
   * publish Victory at ~28 °L, which would put the EBC band near 55, so the
   * EBC column looks like the wrong one — but that is inference, not the
   * source, so both figures stand as printed. Treat this row's colour as
   * unreliable in either unit.
   */
  {
    id: "victory-malt",
    name: "Victory Malt (US)",
    category: "caramel",
    ebc: { min: 25, max: 30 },
    lovibond: { min: 25, max: 25 },
    ppg: 35,
    mashRequired: false,
    maxPercent: 20,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Biscuit, bread, toast, nutty",
    styles: "Amber, Brown Ale",
    weyermann: { name: "Melanoidin", approximate: false },
    briess: { name: "Victory", approximate: false },
    notes: "Briess version of Biscuit/Amber",
  },
  // ----------------------------------------------------------- roasted
  // Ceiling 5%, the chart's own note: "Aggressive roast, use <5%".
  {
    id: "black-patent-malt",
    name: "Black Patent Malt",
    category: "roasted",
    ebc: { min: 1300, max: 1500 },
    lovibond: { min: 500, max: 650 },
    ppg: 28,
    mashRequired: false,
    maxPercent: 5,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Burnt, harsh roast, sharp bitter",
    styles: "Stout, Porter",
    weyermann: { name: "Carafa III", approximate: false },
    briess: { name: "Black Malt", approximate: false },
    notes: "Aggressive roast, use <5%",
  },
  {
    id: "carafa-special-1",
    name: "Carafa Special I",
    category: "roasted",
    ebc: { min: 600, max: 900 },
    lovibond: { min: 250, max: 375 },
    ppg: 30,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Mild roast, coffee, dark bread",
    styles: "Schwarzbier, Dark Lager",
    weyermann: { name: "Carafa I", approximate: false },
    briess: { name: "Chocolate", approximate: true },
    notes: "De-bittered, smoother roast",
  },
  {
    id: "carafa-special-2",
    name: "Carafa Special II",
    category: "roasted",
    ebc: { min: 1100, max: 1300 },
    lovibond: { min: 450, max: 550 },
    ppg: 29,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Coffee, chocolate, roast",
    styles: "Stout, Porter, Dark Ale",
    weyermann: { name: "Carafa II", approximate: false },
    briess: { name: "Chocolate", approximate: false },
    notes: "De-bittered version of Chocolate",
  },
  {
    id: "carafa-special-3",
    name: "Carafa Special III",
    category: "roasted",
    ebc: { min: 1300, max: 1500 },
    lovibond: { min: 550, max: 650 },
    ppg: 28,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Intense dark roast, espresso, dark chocolate",
    styles: "Stout, Porter, Black IPA",
    weyermann: { name: "Carafa III", approximate: false },
    briess: { name: "Black Patent", approximate: true },
    notes: "Darkest de-bittered malt",
  },
  {
    id: "chocolate-malt",
    name: "Chocolate Malt",
    category: "roasted",
    ebc: { min: 800, max: 1000 },
    lovibond: { min: 350, max: 450 },
    ppg: 29,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Chocolate, coffee, nutty roast",
    styles: "Stout, Porter, Brown Ale",
    weyermann: { name: "Carafa II", approximate: false },
    briess: { name: "Chocolate", approximate: false },
    notes: "Sharp roast flavor, bitter finish",
  },
  {
    id: "coffee-malt",
    name: "Coffee Malt",
    category: "roasted",
    ebc: { min: 250, max: 450 },
    lovibond: { min: 100, max: 180 },
    ppg: 30,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Coffee, espresso, mocha",
    styles: "Stout, Porter, Brown Ale",
    weyermann: { name: "Carafa I", approximate: false },
    briess: { name: "Coffee Malt", approximate: false },
    notes: "Simpsons specialty, coffee character",
  },
  {
    id: "de-bittered-black",
    name: "De-bittered Black",
    category: "roasted",
    ebc: { min: 1400, max: 1600 },
    lovibond: { min: 550, max: 650 },
    ppg: 28,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Dark color with smooth roast",
    styles: "Schwarzbier, Dark Lager, Black IPA",
    weyermann: { name: "Carafa Special III", approximate: false },
    briess: { name: "Midnight Wheat", approximate: true },
    notes: "Color without harsh bitterness",
  },
  {
    id: "pale-chocolate",
    name: "Pale Chocolate",
    category: "roasted",
    ebc: { min: 500, max: 650 },
    lovibond: { min: 200, max: 275 },
    ppg: 30,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Mild chocolate, coffee",
    styles: "Stout, Porter",
    weyermann: { name: "Carafa I", approximate: false },
    briess: { name: "Chocolate", approximate: true },
    notes: "Lighter version, more restrained roast",
  },
  /*
   * Unmalted, 0 °Lintner diastatic, the lowest extract in the chart at 25 PPG,
   * and the only roasted row with no Weyermann counterpart at all. This is the malt
   * substitution rule 5 is written about; the diastatic figure is the
   * measurement behind `MaltRow.unmalted`.
   */
  {
    id: "roasted-barley",
    name: "Roasted Barley",
    category: "roasted",
    ebc: { min: 1200, max: 1400 },
    lovibond: { min: 500, max: 575 },
    ppg: 25,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 3, max: 5 },
    proteinPercent: { min: 10, max: 12 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Dry roast, coffee, sharp bitter",
    styles: "Stout (esp. Irish Dry Stout)",
    briess: { name: "Roasted Barley", approximate: false },
    notes: "Unmalted barley, drier than Black Malt",
  },
  // ------------------------------------------------------------- wheat
  {
    id: "caramel-wheat",
    name: "Caramel Wheat",
    category: "wheat",
    ebc: { min: 60, max: 80 },
    lovibond: { min: 25, max: 35 },
    ppg: 33,
    mashRequired: false,
    maxPercent: 20,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 12, max: 15 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Caramel, honey, wheat",
    styles: "Dunkelweizen, Weizenbock",
    weyermann: { name: "Caramel Wheat", approximate: false },
    notes: "Crystal malt from wheat, sweet",
  },
  {
    id: "chocolate-wheat",
    name: "Chocolate Wheat",
    category: "wheat",
    ebc: { min: 800, max: 900 },
    lovibond: { min: 350, max: 400 },
    ppg: 28,
    mashRequired: false,
    maxPercent: 15,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 12, max: 15 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Chocolate, dark bread, earthy",
    styles: "Dunkelweizen, Dark Wheat Beer",
    weyermann: { name: "Chocolate Wheat", approximate: false },
    notes: "Roasted wheat, smooth character",
  },
  // ----------------------------------------------------------- special
  {
    id: "honey-malt",
    name: "Honey Malt",
    category: "special",
    ebc: { min: 20, max: 25 },
    lovibond: { min: 8, max: 10 },
    ppg: 33,
    mashRequired: false,
    maxPercent: 15,
    moisturePercent: { min: 4, max: 6 },
    proteinPercent: { min: 8, max: 10 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Sweet honey, malt, caramel",
    styles: "Any style needing honey character",
    weyermann: { name: "Melanoidin", approximate: false },
    briess: { name: "Honey Malt", approximate: false },
    notes: "Gambrinus specialty, unique honeyed flavor",
  },
  // ----------------------------------------------------------- adjunct
  {
    id: "flaked-barley",
    name: "Flaked Barley",
    category: "adjunct",
    ebc: { min: 2, max: 3 },
    lovibond: { min: 1, max: 1.5 },
    ppg: 32,
    mashRequired: false,
    maxPercent: 20,
    moisturePercent: { min: 8, max: 10 },
    proteinPercent: { min: 11, max: 14 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Grainy, full body",
    styles: "Stout, Porter, Bitter",
    briess: { name: "Flaked Barley", approximate: false },
    notes: "Unmalted, improves head retention",
  },
  {
    id: "flaked-corn-maize",
    name: "Flaked Corn / Maize",
    category: "adjunct",
    ebc: { min: 1, max: 2 },
    lovibond: { min: 0.5, max: 1 },
    ppg: 37,
    mashRequired: false,
    maxPercent: 40,
    moisturePercent: { min: 8, max: 12 },
    proteinPercent: { min: 8, max: 10 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Neutral, light, corn",
    styles: "Cream Ale, American Lager",
    briess: { name: "Flaked Maize", approximate: false },
    notes: "ABV boost without flavor",
  },
  {
    id: "flaked-oats",
    name: "Flaked Oats",
    category: "adjunct",
    ebc: { min: 2, max: 3 },
    lovibond: { min: 1, max: 1.5 },
    ppg: 33,
    mashRequired: false,
    maxPercent: 30,
    moisturePercent: { min: 8, max: 10 },
    proteinPercent: { min: 13, max: 16 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Creamy, smooth, silky",
    styles: "Oatmeal Stout, NEIPA",
    briess: { name: "Flaked Oats", approximate: false },
    notes: "Adds body, creaminess, haze",
  },
  {
    id: "flaked-rice",
    name: "Flaked Rice",
    category: "adjunct",
    ebc: { min: 1, max: 2 },
    lovibond: { min: 0.5, max: 1 },
    ppg: 37,
    mashRequired: false,
    maxPercent: 40,
    moisturePercent: { min: 8, max: 10 },
    proteinPercent: { min: 6, max: 8 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Very neutral, light, dry",
    styles: "American Lager, Light Beer",
    briess: { name: "Flaked Rice", approximate: false },
    notes: "Lightest adjunct, crisp dry finish",
  },
  {
    id: "flaked-rye",
    name: "Flaked Rye",
    category: "adjunct",
    ebc: { min: 2, max: 3 },
    lovibond: { min: 1, max: 1.5 },
    ppg: 36,
    mashRequired: false,
    maxPercent: 20,
    moisturePercent: { min: 8, max: 10 },
    proteinPercent: { min: 13, max: 16 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Spicy, dry, crisp",
    styles: "Rye Pale Ale, Saison",
    briess: { name: "Flaked Rye", approximate: false },
    notes: "Gelatinized rye, spicy character",
  },
  {
    id: "flaked-wheat",
    name: "Flaked Wheat",
    category: "adjunct",
    ebc: { min: 2, max: 3 },
    lovibond: { min: 1, max: 1.5 },
    ppg: 36,
    mashRequired: false,
    maxPercent: 40,
    moisturePercent: { min: 8, max: 10 },
    proteinPercent: { min: 13, max: 16 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Grainy, tart, hazy",
    styles: "NEIPA, Witbier, Weizen",
    briess: { name: "Flaked Wheat", approximate: false },
    notes: "Gelatinized, no mash needed. Haze agent",
  },
  /*
   * Zero across the board — colour, extract, protein, enzymes — because it is
   * husk, not grain. It is in the chart as a lautering aid with a 10% ceiling,
   * and it is the clearest case for `maxPercent`: nothing about its colour or
   * class stops an engine proposing it, only the ceiling and the zero extract.
   */
  {
    id: "rice-hulls",
    name: "Rice Hulls",
    category: "adjunct",
    ebc: { min: 0, max: 0 },
    lovibond: { min: 0, max: 0 },
    ppg: 0,
    mashRequired: false,
    maxPercent: 10,
    moisturePercent: { min: 8, max: 12 },
    proteinPercent: { min: 0, max: 0 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "No flavor",
    styles: "All styles with sticky mash",
    notes: "Lautering aid, no extract, use with wheat/rye/oat",
  },
  {
    id: "torrified-wheat",
    name: "Torrified Wheat",
    category: "adjunct",
    ebc: { min: 2, max: 3 },
    lovibond: { min: 1, max: 1.5 },
    ppg: 36,
    mashRequired: false,
    maxPercent: 40,
    moisturePercent: { min: 8, max: 10 },
    proteinPercent: { min: 12, max: 15 },
    diastaticPower: { min: 0, max: 0 },
    flavor: "Neutral, boosts head retention",
    styles: "Bitter, ESB, Mild",
    notes: "Puffed wheat, no mash needed",
  },
];

/**
 * Extra spellings of a chart name, derived mechanically from the name itself.
 *
 * No new malts and no new numbers — only the ways the same product turns up in
 * a real Brewfather inventory. Every alias is a pure string transformation of a
 * name the chart prints, which is why this can never introduce a malt the
 * source does not list:
 *
 *   - the origin/German marker dropped: "2-Row Pale (US)" -> "2-Row Pale",
 *     "Acidulated Malt (Sauermalz)" -> "Acidulated Malt";
 *   - each half of a slashed name: "CaraPils / Dextrin" -> "CaraPils" and
 *     "Dextrin", which is the chart's way of printing two names for one malt;
 *   - Brewfather's sort-friendly inversion of the flaked adjuncts:
 *     "Flaked Barley" -> "Barley, Flaked", which is how the owner's inventory
 *     actually spells it;
 *   - a trailing "Malt" where the name lacks one: "Pale Chocolate" ->
 *     "Pale Chocolate Malt". Suppliers append it constantly, and this alias is
 *     also what stops "Pale Chocolate Malt" resolving onto the darker
 *     "Chocolate Malt" it happens to contain as well (500-650 vs 800-1000 EBC).
 */
function aliasesFor(name: string): string[] {
  const aliases = new Set<string>();
  const bare = name.replace(/\s*\([^)]*\)/g, " ").trim();
  for (const seed of [bare, ...bare.split("/").map((part) => part.trim())]) {
    if (!seed) continue;
    aliases.add(seed);
    const flaked = /^Flaked\s+(.+)$/i.exec(seed);
    if (flaked) aliases.add(`${flaked[1]}, Flaked`);
    if (!/\bmalt\b/i.test(seed)) aliases.add(`${seed} Malt`);
  }
  return [...aliases];
}

interface IndexedProfile {
  normalized: string;
  profile: MaltReferenceProfile;
}

let index: IndexedProfile[] | undefined;
let exact: Map<string, MaltReferenceProfile> | undefined;

/**
 * Memoized {@link lookupMaltProfile} answers, keyed on the *normalized* query.
 *
 * Same reasoning as the cache in `malt-equivalents.ts`: the containment pass is
 * a linear scan over every indexed name, and a caller resolving a whole
 * inventory asks about the same handful of names over and over. Misses are
 * cached as `undefined` too — a pantry full of hops and salts is exactly the
 * input that would otherwise pay the full scan every time. Rebuilt by
 * {@link buildIndex} so the cache can never outlive the index it came from.
 */
let lookupCache: Map<string, MaltReferenceProfile | undefined> | undefined;

function buildIndex(): void {
  const list: IndexedProfile[] = [];
  const map = new Map<string, MaltReferenceProfile>();
  for (const profile of MALT_PROFILES) {
    for (const alias of aliasesFor(profile.name)) {
      const normalized = normalizeName(alias);
      if (!normalized) continue;
      if (!map.has(normalized)) map.set(normalized, profile);
      list.push({ normalized, profile });
    }
  }
  // Longest first, so "caramunich iii" is considered before "caramunich i" and
  // the scan below can stop as soon as a shorter candidate comes up.
  list.sort((a, b) => b.normalized.length - a.normalized.length);
  index = list;
  exact = map;
  lookupCache = new Map();
}

/** Shortest chart name allowed to match by containment. */
const MIN_CONTAINMENT_LENGTH = 4;

/**
 * Resolve a malt name against the chart.
 *
 * Two passes, strictest first: exact normalized name (including the mechanical
 * aliases above), then a containment pass so messy real-world names still land.
 *
 * Containment is **one-directional, exactly as `lookupMalt` does it**: the
 * queried name must contain a chart name, never the reverse. The reverse is
 * what resolved "Munich I" — a 12-18 EBC base malt — onto "Caramel Munich I" at
 * 131-200 EBC in the equivalence tables, swapping a crystal malt into a
 * pilsner. Here it would be worse, because this chart carries a dosage ceiling
 * and a diastatic power that would travel with the wrong malt. So a bare
 * "Amber" does not resolve to "Amber Malt", and a bare "Munich" resolves to
 * nothing at all. Matches are whole-word and at least
 * {@link MIN_CONTAINMENT_LENGTH} characters, so nothing matches mid-word.
 *
 * Among containment matches the longest wins, and — unlike `lookupMalt`, which
 * returns the first hit — ties are broken by position, leftmost first. Two
 * chart names can be equally long and both present: "Pale Chocolate Malt"
 * contains "pale chocolate malt" and "chocolate malt", and without a defined
 * tiebreak the answer would depend on the order the table happens to be written
 * in. Leftmost is the right call because the specific product name leads and
 * the generic words trail.
 *
 * Memoized on the normalized query (see {@link lookupCache}); the answer is a
 * pure function of that query, so caching changes nothing but the cost.
 */
export function lookupMaltProfile(
  name: string
): MaltReferenceProfile | undefined {
  if (!index || !exact || !lookupCache) buildIndex();
  const query = normalizeName(name);
  if (!query) return undefined;

  const cache = lookupCache!;
  // `has`, not a truthiness check: a cached miss is stored as `undefined` and
  // must short-circuit the scan just like a cached hit.
  if (cache.has(query)) return cache.get(query);

  const resolved = resolveByName(query);
  cache.set(query, resolved);
  return resolved;
}

function resolveByName(query: string): MaltReferenceProfile | undefined {
  const direct = exact!.get(query);
  if (direct) return direct;

  const padded = ` ${query} `;
  let best:
    | { profile: MaltReferenceProfile; length: number; at: number }
    | undefined;
  for (const candidate of index!) {
    const { length } = candidate.normalized;
    if (length < MIN_CONTAINMENT_LENGTH) continue;
    // The index is sorted longest first, so once a match is in hand every
    // remaining candidate is shorter and cannot beat it.
    if (best && length < best.length) break;
    const at = padded.indexOf(` ${candidate.normalized} `);
    if (at === -1) continue;
    if (!best || at < best.at) best = { profile: candidate.profile, length, at };
  }
  return best?.profile;
}
