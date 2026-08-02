/**
 * Hop variety reference table (pure data + lookup).
 *
 * Transcribed from `docs/reference/Hop_Comparison_Chart_Detailed.pdf` — "Hop
 * Comparison Chart, Detailed Reference", sourced from the Brouwland Hopguide
 * 2025. See `docs/hop-substitutions.md` for the human-readable version and the
 * rules this data supports. Keep the two in sync.
 *
 * This is the hop-side companion to `malt-equivalents.ts`, but the two model
 * fundamentally different sources and deliberately do NOT share a shape:
 *
 *   - The malt guide publishes *equivalence rows* — sets of malts the maltsters
 *     consider interchangeable — so substitution there is derived from colour
 *     and class.
 *   - This hop chart publishes an explicit, named **Substitutes column** per
 *     variety. That column is the primary signal and is modelled directly;
 *     nothing here infers a substitution from oil chemistry.
 *
 * Two properties of the source that the code must not paper over:
 *
 *   1. **The substitute lists are not symmetric.** Cascade lists Ahtanum;
 *      nothing lists Cascade back from Ahtanum. El Dorado lists only Ekuanot,
 *      while Ekuanot lists Huell Melon *and* El Dorado. The chart is
 *      transcribed exactly as printed and is never auto-symmetrised. The
 *      reverse direction is available separately via
 *      {@link reverseSubstitutesFor} so the integrator picks it knowingly.
 *   2. **Some named substitutes are not varieties in this chart.** Five names
 *      appear only in the Substitutes column and have no row of their own —
 *      see {@link SUBSTITUTES_NOT_IN_CHART}. They are kept as printed rather
 *      than dropped or invented, because "the chart suggests Ahtanum and we
 *      have no data on it" is a truthful answer and a silent omission is not.
 *
 * Transcription notes (the whole value of this file is that the numbers are
 * right, so every deviation from a clean read is recorded at its entry):
 *   - The chart's own header claims "68 hop varieties"; the tables actually
 *     contain **70** rows. All 70 are transcribed.
 *   - `Mistral` humulene is omitted — it prints as an inverted range.
 *   - `Elixir` farnesene is omitted — the cell is blank in the source.
 *   - `Barbe Rouge` has a blank Substitutes cell (others print "-"); both mean
 *     "no substitute named" and become an empty array.
 *
 * Every figure is a typical range that varies by crop year and producer — the
 * source says so itself. Nothing here replaces a certificate of analysis.
 */
import { normalizeName } from "@/lib/matcher/normalize";

/**
 * The chart's Type column. This is the single most important field after
 * alpha: a bittering swap and a late-aroma swap are different problems, and a
 * variety that is only ever used for clean bitterness (Apollo, Herkules) is a
 * poor stand-in for one bought for its aroma, however close the alpha is.
 */
export type HopType = "bitter" | "aroma" | "dual";

/** Human labels for justification copy. */
export const HOP_TYPE_LABEL: Readonly<Record<HopType, string>> = {
  bitter: "bittering hop",
  aroma: "aroma hop",
  dual: "dual-purpose hop",
};

/** What a variety may reasonably be used for, per the chart's Type column. */
export type HopRole = "bittering" | "aroma";

/**
 * Alpha-acid band. Required on every variety: all 70 rows publish a genuine
 * two-ended range, and alpha is what the bitterness maths below depends on, so
 * it is the one field that is never optional.
 */
export interface AlphaRange {
  min: number;
  max: number;
}

/**
 * Any other published band.
 *
 * `min` is optional because the chart writes some cells as a bare upper bound
 * ("<40", "<2.6"), where the lower end is genuinely unstated. Recording those
 * as `{ min: 0, max: 40 }` would invent a lower bound the source never gives,
 * so `min` is simply absent and consumers must handle that. Single published
 * values ("1.8", "43.4") are stored with `min === max`.
 */
export interface HopRange {
  min?: number;
  max: number;
}

export interface HopEntry {
  /** Variety name exactly as printed in the chart's Hop Variety column. */
  name: string;
  /** Growing origin as published (country/region codes, sometimes several). */
  origin: string;
  type: HopType;
  /** Alpha acid %, the bittering potential. See {@link alphaMidpoint}. */
  alpha: AlphaRange;
  /** Beta acid %. */
  beta?: HopRange;
  /** Total oil, ml per 100 g. Broadly, aroma intensity. */
  oil?: HopRange;
  /** Cohumulone % — lower is reckoned a smoother bitterness. */
  cohumulone?: HopRange;
  /** Myrcene % — high is fruity/citrus. */
  myrcene?: HopRange;
  /** Humulene % — high is noble/earthy. */
  humulene?: HopRange;
  /** Caryophyllene %. */
  caryophyllene?: HopRange;
  /** Farnesene %. */
  farnesene?: HopRange;
  /** Beer Styles column, split on the chart's own commas. */
  styles: readonly string[];
  /**
   * The chart's Substitutes column, verbatim and in printed order.
   *
   * Empty when the chart prints "-" or leaves the cell blank. NOT symmetric —
   * see the file header. Names here may not resolve to an entry in this table
   * ({@link SUBSTITUTES_NOT_IN_CHART}).
   */
  substitutes: readonly string[];
  /** Aroma Profile column, split on the chart's own commas. */
  aroma: readonly string[];
}

export const HOP_VARIETIES: readonly HopEntry[] = [
  {
    name: "Amarillo",
    origin: "USA",
    type: "dual",
    alpha: { min: 6, max: 11 },
    beta: { min: 6, max: 7 },
    oil: { min: 1.5, max: 1.9 },
    cohumulone: { min: 68, max: 70 },
    myrcene: { min: 9, max: 11 },
    humulene: { min: 2, max: 4 },
    caryophyllene: { min: 21, max: 24 },
    farnesene: { min: 2, max: 4 },
    styles: ["Ale", "IPA", "APA"],
    substitutes: ["Cascade", "Centennial", "Chinook", "Simcoe"],
    aroma: ["Citrus", "Floral", "Tropical"],
  },
  {
    name: "Apollo",
    origin: "USA",
    type: "bitter",
    alpha: { min: 15, max: 19 },
    beta: { min: 5, max: 8 },
    oil: { min: 1.5, max: 2.5 },
    cohumulone: { min: 25, max: 30 },
    myrcene: { min: 35, max: 50 },
    humulene: { min: 10, max: 15 },
    caryophyllene: { min: 14, max: 18 },
    farnesene: { min: 0, max: 0 },
    styles: ["Ale", "IPA"],
    substitutes: ["Chinook", "Columbus", "Zeus"],
    aroma: ["Citrus", "Pine", "Resin"],
  },
  {
    name: "Aramis",
    origin: "FR",
    type: "aroma",
    alpha: { min: 6.5, max: 8.5 },
    beta: { min: 3.5, max: 5.5 },
    oil: { min: 1.2, max: 1.6 },
    cohumulone: { max: 40 },
    myrcene: { min: 21, max: 28 },
    humulene: { max: 21 },
    caryophyllene: { max: 2.6 },
    farnesene: { min: 2, max: 4 },
    styles: ["APA", "Pale Ale", "Pils", "Saison", "Wheat"],
    substitutes: ["Willamette", "Challenger", "Strisselspalt"],
    aroma: ["Citrus", "Spiced"],
  },
  {
    name: "Ariana",
    origin: "DE",
    type: "dual",
    alpha: { min: 8, max: 14.5 },
    beta: { min: 3.7, max: 6.6 },
    oil: { min: 2.1, max: 2.4 },
    cohumulone: { max: 47 },
    myrcene: { min: 40, max: 42 },
    humulene: { max: 18 },
    caryophyllene: { max: 5.4 },
    farnesene: { max: 0.1 },
    styles: ["APA", "Pils", "Saison", "Wheat"],
    substitutes: ["Mandarina Bavaria", "Huell Melon"],
    aroma: ["Citrus", "Stone fruit", "Tropical"],
  },
  {
    name: "Azacca",
    origin: "USA",
    type: "dual",
    alpha: { min: 10, max: 14 },
    beta: { min: 4, max: 5.5 },
    oil: { min: 1.0, max: 2.0 },
    cohumulone: { min: 35, max: 50 },
    myrcene: { min: 15, max: 24 },
    humulene: { min: 9, max: 14 },
    caryophyllene: { min: 36, max: 40 },
    farnesene: { min: 0.1, max: 1 },
    styles: ["APA", "Pale Ale"],
    substitutes: ["Amarillo", "Citra", "Pekko"],
    aroma: ["Citrus", "Pine", "Spicy", "Tropical"],
  },
  {
    // Substitutes cell is blank in the chart (not a "-"): no stand-in is named.
    name: "Barbe Rouge",
    origin: "FR",
    type: "aroma",
    alpha: { min: 7.5, max: 9.5 },
    beta: { min: 3, max: 3.8 },
    oil: { min: 1.8, max: 2.2 },
    cohumulone: { min: 35, max: 52 },
    myrcene: { min: 42.1, max: 42.2 },
    humulene: { min: 15, max: 25 },
    caryophyllene: { min: 2.5, max: 2.8 },
    farnesene: { min: 2.5, max: 3.5 },
    styles: ["Altbier", "Pils", "Porter"],
    substitutes: [],
    aroma: ["Citrus", "Fruity", "Strawberry Sorbet"],
  },
  {
    name: "Bobek",
    origin: "SVN",
    type: "aroma",
    alpha: { min: 3.5, max: 7.8 },
    beta: { min: 4, max: 6.1 },
    oil: { min: 0.7, max: 3.0 },
    cohumulone: { min: 45, max: 57 },
    myrcene: { min: 26, max: 31 },
    humulene: { min: 13, max: 19 },
    caryophyllene: { min: 4, max: 6 },
    farnesene: { min: 4, max: 7 },
    styles: ["Blond", "Pale Ale", "Pils", "Saison", "Tripel"],
    substitutes: ["Fuggles", "Willamette", "Styrian Golding"],
    aroma: ["Floral", "Citrus", "Fruity", "Spiced"],
  },
  {
    name: "Bramling Cross",
    origin: "UK",
    type: "aroma",
    alpha: { min: 5, max: 7 },
    beta: { min: 2.5, max: 3.5 },
    oil: { min: 0.8, max: 1.5 },
    cohumulone: { min: 30, max: 45 },
    myrcene: { min: 25, max: 35 },
    humulene: { min: 22, max: 28 },
    caryophyllene: { min: 5, max: 8 },
    farnesene: { min: 0.5, max: 1.0 },
    styles: ["ESB", "Bitter", "Pale Ale"],
    substitutes: ["Kent Golding", "Progress", "Whitbread Golding"],
    aroma: ["Mild", "Fruity", "Currant"],
  },
  {
    name: "Brewers Gold",
    origin: "BE",
    type: "bitter",
    alpha: { min: 4, max: 6.5 },
    beta: { min: 3.7, max: 6.8 },
    oil: { min: 1.8, max: 1.8 },
    cohumulone: { min: 40, max: 40 },
    myrcene: { min: 41, max: 41 },
    humulene: { min: 35, max: 35 },
    caryophyllene: { min: 35, max: 35 },
    farnesene: { max: 1 },
    styles: ["Blond", "Pale Ale", "Porter", "Stout"],
    substitutes: ["Northern Brewer", "Chinook"],
    aroma: ["Fruity", "Spiced", "Spicy"],
  },
  {
    name: "Callista",
    origin: "DE",
    type: "aroma",
    alpha: { min: 2, max: 5 },
    beta: { min: 5, max: 10 },
    oil: { min: 0.7, max: 1.5 },
    cohumulone: { max: 52.5 },
    myrcene: { min: 15, max: 21 },
    humulene: { max: 17.3 },
    caryophyllene: { max: 4.4 },
    farnesene: { max: 0.4 },
    styles: ["APA", "Pale Ale"],
    substitutes: ["Hallertau Tradition"],
    aroma: ["Citrus", "Stone fruit", "Tropical", "Apricot"],
  },
  {
    name: "Cascade",
    origin: "USA",
    type: "aroma",
    alpha: { min: 4.5, max: 8.9 },
    beta: { min: 3.6, max: 7.5 },
    oil: { min: 0.8, max: 1.5 },
    cohumulone: { min: 45, max: 60 },
    myrcene: { min: 8, max: 16 },
    humulene: { min: 4, max: 6 },
    caryophyllene: { min: 33, max: 40 },
    farnesene: { min: 4, max: 8 },
    styles: ["Fruit beer", "APA"],
    substitutes: ["Centennial", "Amarillo", "Ahtanum"],
    aroma: ["Floral", "Citrus", "Grapefruit"],
  },
  {
    name: "Cashmere",
    origin: "USA",
    type: "dual",
    alpha: { min: 7.0, max: 10.0 },
    beta: { min: 5.0, max: 7.0 },
    oil: { min: 0.5, max: 1.5 },
    cohumulone: { min: 25, max: 40 },
    myrcene: { min: 20, max: 35 },
    humulene: { min: 10, max: 15 },
    caryophyllene: { min: 20, max: 24 },
    farnesene: { min: 0.1, max: 0.5 },
    styles: ["Saison"],
    substitutes: ["Cascade"],
    aroma: ["Citrus", "Lemon", "Lime", "Melon"],
  },
  {
    // Aroma profile prints "Citrus" twice in the source; transcribed verbatim.
    name: "Centennial",
    origin: "USA",
    type: "dual",
    alpha: { min: 8.5, max: 12.0 },
    beta: { min: 3.5, max: 5.5 },
    oil: { min: 1.0, max: 3.5 },
    cohumulone: { min: 60, max: 75 },
    myrcene: { min: 7, max: 12 },
    humulene: { min: 3, max: 7 },
    caryophyllene: { min: 23, max: 26 },
    farnesene: { min: 0.7, max: 1.7 },
    styles: ["APA"],
    substitutes: ["Chinook", "Cascade", "Columbus", "Amarillo"],
    aroma: ["Floral", "Citrus", "Citrus"],
  },
  {
    name: "Challenger",
    origin: "BE",
    type: "dual",
    alpha: { min: 6.5, max: 9 },
    beta: { min: 3.2, max: 4.5 },
    oil: { min: 1.0, max: 1.7 },
    cohumulone: { min: 30, max: 42 },
    myrcene: { min: 20, max: 25 },
    humulene: { min: 25, max: 32 },
    caryophyllene: { min: 8, max: 10 },
    farnesene: { min: 1, max: 3 },
    styles: ["Blond", "Bock", "Pale Ale", "Porter", "Stout"],
    substitutes: ["Northern Brewer", "Target"],
    aroma: ["Floral", "Pine", "Fruity", "Spicy"],
  },
  {
    name: "Chinook",
    origin: "USA",
    type: "dual",
    alpha: { min: 11.0, max: 15.0 },
    beta: { min: 3.0, max: 4.5 },
    oil: { min: 1.0, max: 2.5 },
    cohumulone: { min: 25, max: 40 },
    myrcene: { min: 15, max: 20 },
    humulene: { min: 6.5, max: 11 },
    caryophyllene: { min: 26, max: 31 },
    farnesene: { min: 0.1, max: 0.8 },
    styles: ["APA", "IPA", "Stout", "Porter"],
    substitutes: ["Columbus", "Northern Brewer"],
    aroma: ["Citrus", "Pine", "Spicy"],
  },
  {
    name: "Citra",
    origin: "USA",
    type: "dual",
    alpha: { min: 10.0, max: 16.0 },
    beta: { min: 3, max: 4.5 },
    oil: { min: 1.0, max: 3.0 },
    cohumulone: { min: 50, max: 70 },
    myrcene: { min: 7, max: 12.5 },
    humulene: { min: 4, max: 8 },
    caryophyllene: { min: 20, max: 24 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["APA"],
    substitutes: ["Simcoe", "Mosaic", "Cascade", "Centennial"],
    aroma: ["Citrus", "Fruity", "Stone fruit", "Tropical"],
  },
  {
    name: "Columbus",
    origin: "USA",
    type: "bitter",
    alpha: { min: 14, max: 18 },
    beta: { min: 4.5, max: 6 },
    oil: { min: 2.0, max: 4.0 },
    cohumulone: { min: 45, max: 60 },
    myrcene: { min: 9, max: 14 },
    humulene: { min: 6, max: 10 },
    caryophyllene: { min: 26, max: 30 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["APA"],
    substitutes: ["Chinook", "Hallertau Taurus"],
    aroma: ["Citrus", "Resin", "Spiced"],
  },
  {
    name: "Crystal",
    origin: "USA",
    type: "aroma",
    alpha: { min: 3.5, max: 6.0 },
    beta: { min: 6.5, max: 9.0 },
    oil: { min: 0.8, max: 1.8 },
    cohumulone: { min: 35, max: 50 },
    myrcene: { min: 20, max: 24 },
    humulene: { min: 20, max: 28 },
    caryophyllene: { min: 6, max: 10 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Pils"],
    substitutes: ["Hallertau Hersbrücker", "Strisselspalt"],
    aroma: ["Floral", "Spiced", "Spicy", "Cinnamon"],
  },
  {
    name: "Ekuanot",
    origin: "USA",
    type: "dual",
    alpha: { min: 12.9, max: 15.7 },
    beta: { min: 4, max: 5.5 },
    oil: { min: 2.5, max: 4.5 },
    cohumulone: { min: 30, max: 40 },
    myrcene: { min: 17, max: 22 },
    humulene: { min: 9, max: 12 },
    caryophyllene: { min: 30, max: 37 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Blond", "APA", "Pils"],
    substitutes: ["Huell Melon", "El Dorado"],
    aroma: ["Floral", "Pine", "Fruity", "Stone fruit", "Tropical"],
  },
  {
    name: "El Dorado",
    origin: "USA",
    type: "dual",
    alpha: { min: 13, max: 17 },
    beta: { min: 5.2, max: 8.0 },
    oil: { min: 2.2, max: 2.8 },
    cohumulone: { min: 55, max: 60 },
    myrcene: { min: 10, max: 15 },
    humulene: { min: 6, max: 8 },
    caryophyllene: { min: 28, max: 33 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Blond", "APA", "Pale Ale"],
    substitutes: ["Ekuanot"],
    aroma: ["Fruity", "Stone fruit", "Tropical"],
  },
  {
    // Farnesene is blank in the chart, so it is omitted. Caryophyllene 0.1-0.2 is
    // an order of magnitude below every other variety, but it sits squarely in
    // the caryophyllene column in the PDF, so it is transcribed as printed.
    name: "Elixir",
    origin: "FR",
    type: "aroma",
    alpha: { min: 5, max: 7 },
    beta: { min: 4.5, max: 5.5 },
    oil: { min: 1.8, max: 2.2 },
    cohumulone: { min: 70, max: 75 },
    myrcene: { min: 29, max: 39 },
    humulene: { min: 25, max: 30 },
    caryophyllene: { min: 0.1, max: 0.2 },
    styles: ["APA", "Pale Ale", "Saison"],
    substitutes: ["Kazbek", "Mistral"],
    aroma: ["Floral", "Spiced", "Tropical", "Tangerine"],
  },
  {
    name: "Fuggles",
    origin: "FR",
    type: "aroma",
    alpha: { min: 4, max: 5.5 },
    beta: { min: 2.1, max: 2.8 },
    oil: { min: 0.44, max: 0.83 },
    cohumulone: { min: 43.4, max: 43.4 },
    myrcene: { min: 27, max: 33 },
    humulene: { min: 27, max: 27 },
    caryophyllene: { min: 9.1, max: 9.1 },
    farnesene: { min: 4.3, max: 4.3 },
    styles: ["APA", "Pale Ale", "Porter", "Stout"],
    substitutes: ["Willamette", "Styrian Golding"],
    aroma: ["Floral", "Grassy", "Earthy"],
  },
  {
    name: "Galaxy",
    origin: "AU",
    type: "dual",
    alpha: { min: 11, max: 16 },
    beta: { min: 5, max: 6.9 },
    oil: { min: 3.5, max: 3.5 },
    cohumulone: { min: 33, max: 67 },
    myrcene: { min: 32, max: 42 },
    humulene: { min: 1, max: 2 },
    caryophyllene: { min: 7, max: 9 },
    farnesene: { min: 2, max: 4 },
    styles: ["Fruit beer", "APA", "Pale Ale"],
    substitutes: ["Simcoe", "Citra", "Amarillo"],
    aroma: ["Citrus", "Fruity", "Peach", "Passion fruit"],
  },
  {
    name: "Goldings",
    origin: "BE",
    type: "aroma",
    alpha: { min: 5, max: 6 },
    beta: { min: 2, max: 3 },
    oil: { min: 0.85, max: 0.85 },
    cohumulone: { min: 42, max: 42 },
    myrcene: { min: 29, max: 29 },
    humulene: { min: 27, max: 27 },
    caryophyllene: { min: 9, max: 9 },
    farnesene: { max: 1 },
    styles: ["Blond", "Brown", "Pale Ale", "Porter", "Stout"],
    substitutes: ["Fuggles", "Styrian Goldings", "Willamette"],
    aroma: ["Earthy", "Floral", "Citrus", "Spicy"],
  },
  {
    name: "Hallertau Blanc",
    origin: "DE",
    type: "aroma",
    alpha: { min: 8.0, max: 12.9 },
    beta: { min: 4.6, max: 7.0 },
    oil: { min: 0.8, max: 1.9 },
    cohumulone: { min: 35, max: 45 },
    myrcene: { min: 22, max: 26 },
    humulene: { min: 1, max: 4 },
    caryophyllene: { min: 1, max: 4 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Blond", "APA", "Saison"],
    substitutes: ["Nelson Sauvin"],
    aroma: ["Citrus", "Fruity", "Spiced", "Wine"],
  },
  {
    name: "Hallertau Cascade",
    origin: "DE",
    type: "aroma",
    alpha: { min: 4.5, max: 7 },
    beta: { min: 4.5, max: 7 },
    oil: { min: 0.8, max: 1.5 },
    cohumulone: { min: 30, max: 55 },
    myrcene: { min: 31, max: 40 },
    humulene: { min: 7.0, max: 14 },
    caryophyllene: { min: 2.5, max: 4.7 },
    farnesene: { min: 3.2, max: 6.0 },
    styles: ["Fruit beer", "APA"],
    substitutes: ["Centennial", "Amarillo"],
    aroma: ["Floral", "Citrus", "Grapefruit"],
  },
  {
    name: "Hallertau Hersbrucker",
    origin: "DE",
    type: "aroma",
    alpha: { min: 2, max: 5 },
    beta: { min: 4, max: 6 },
    oil: { min: 0.5, max: 1.3 },
    cohumulone: { min: 10, max: 25 },
    myrcene: { min: 19, max: 25 },
    humulene: { min: 15, max: 35 },
    caryophyllene: { min: 7, max: 15 },
    farnesene: { max: 1 },
    styles: ["Altbier", "Bock", "Pils", "Weizen"],
    substitutes: ["Hallertau Tradition", "Spalt Select"],
    aroma: ["Floral", "Spiced", "Spicy"],
  },
  {
    name: "Hallertau Mittelfruh",
    origin: "DE",
    type: "aroma",
    alpha: { min: 2.3, max: 6.6 },
    beta: { min: 3.3, max: 6.5 },
    oil: { min: 0.5, max: 1.0 },
    cohumulone: { min: 20, max: 30 },
    myrcene: { min: 18, max: 28 },
    humulene: { min: 30, max: 40 },
    caryophyllene: { min: 6, max: 12 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Pils", "Lager"],
    substitutes: ["Hallertau Tradition", "Spalt Select"],
    aroma: ["Floral", "Spiced", "Spicy", "Noble"],
  },
  {
    name: "Hallertau Perle",
    origin: "DE",
    type: "dual",
    alpha: { min: 3, max: 11 },
    beta: { min: 2.3, max: 5.2 },
    oil: { min: 0.5, max: 1.5 },
    cohumulone: { min: 20, max: 30 },
    myrcene: { min: 29, max: 35 },
    humulene: { min: 35, max: 45 },
    caryophyllene: { min: 10, max: 15 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Altbier", "Blond", "Bock", "Pils", "Tripel"],
    substitutes: ["Northern Brewer", "Magnum"],
    aroma: ["Floral", "Spiced", "Spicy"],
  },
  {
    name: "Hallertau Taurus",
    origin: "DE",
    type: "dual",
    alpha: { min: 12, max: 17 },
    beta: { min: 4, max: 6 },
    oil: { min: 0.9, max: 1.5 },
    cohumulone: { min: 30, max: 50 },
    myrcene: { min: 20, max: 25 },
    humulene: { min: 22, max: 33 },
    caryophyllene: { min: 6, max: 11 },
    farnesene: { max: 1 },
    styles: ["Altbier", "Pils"],
    substitutes: ["Magnum", "Hallertau Tradition", "Herkules"],
    aroma: ["Earthy", "Resin"],
  },
  {
    name: "Hallertau Tradition",
    origin: "DE",
    type: "aroma",
    alpha: { min: 4, max: 7 },
    beta: { min: 4, max: 5 },
    oil: { min: 0.9, max: 1.9 },
    cohumulone: { min: 20, max: 25 },
    myrcene: { min: 23, max: 29 },
    humulene: { min: 40, max: 55 },
    caryophyllene: { min: 10, max: 15 },
    farnesene: { max: 1 },
    styles: ["Blond", "Pils"],
    substitutes: ["Hallertau Mittelfruh", "Tettnanger"],
    aroma: ["Floral", "Grassy", "Spiced"],
  },
  {
    name: "Herkules",
    origin: "DE",
    type: "bitter",
    alpha: { min: 12, max: 17 },
    beta: { min: 4, max: 6 },
    oil: { min: 1.4, max: 2.0 },
    cohumulone: { min: 30, max: 50 },
    myrcene: { min: 32, max: 38 },
    humulene: { min: 28, max: 45 },
    caryophyllene: { min: 7, max: 12 },
    farnesene: { max: 1 },
    styles: ["Altbier", "Pils"],
    substitutes: ["Magnum", "Hallertau Taurus"],
    aroma: ["Resin", "Spiced", "Peppery"],
  },
  {
    name: "Huell Melon",
    origin: "DE",
    type: "dual",
    alpha: { min: 4.9, max: 9.5 },
    beta: { min: 7.3, max: 12 },
    oil: { min: 0.7, max: 2.1 },
    cohumulone: { min: 35, max: 37 },
    myrcene: { min: 25, max: 30 },
    humulene: { min: 10, max: 20 },
    caryophyllene: { min: 5, max: 10 },
    farnesene: { max: 1 },
    styles: ["Blond", "Saison", "Tripel"],
    substitutes: [],
    aroma: ["Fruity", "Honeydew Melon", "Strawberry"],
  },
  {
    name: "Idaho 7",
    origin: "USA",
    type: "dual",
    alpha: { min: 9, max: 14 },
    beta: { min: 3.5, max: 9.1 },
    oil: { min: 1.0, max: 5.0 },
    cohumulone: { min: 45, max: 55 },
    myrcene: { min: 10, max: 15 },
    humulene: { min: 5, max: 8 },
    caryophyllene: { min: 30, max: 40 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["APA", "Pale Ale", "IPA"],
    substitutes: ["Azacca", "El Dorado", "Cashmere", "Citra"],
    aroma: ["Pine", "Stone fruit", "Tropical"],
  },
  {
    name: "Kazbek",
    origin: "CZ",
    type: "dual",
    alpha: { min: 5, max: 8 },
    beta: { min: 4, max: 6 },
    oil: { min: 0.9, max: 1.8 },
    cohumulone: { min: 40, max: 55 },
    myrcene: { min: 30, max: 40 },
    humulene: { min: 20, max: 35 },
    caryophyllene: { min: 10, max: 15 },
    farnesene: { max: 1 },
    styles: ["Pale Ale", "Pils"],
    substitutes: ["Saaz"],
    aroma: ["Citrus", "Spiced", "Stone fruit", "Tropical"],
  },
  {
    name: "Krush HBC586",
    origin: "USA",
    type: "dual",
    alpha: { min: 10, max: 14 },
    beta: { min: 7, max: 9 },
    oil: { min: 0.5, max: 3.0 },
    cohumulone: { min: 40, max: 60 },
    myrcene: { min: 10, max: 16 },
    humulene: { min: 10, max: 18 },
    caryophyllene: { min: 36, max: 40 },
    farnesene: { max: 1 },
    styles: ["Blond", "APA", "Pale Ale", "Saison"],
    substitutes: [],
    aroma: ["Citrus", "Stone fruit", "Tropical", "Mango"],
  },
  {
    name: "Magnum",
    origin: "DE/BE",
    type: "bitter",
    alpha: { min: 10, max: 15 },
    beta: { min: 4.5, max: 5.5 },
    oil: { min: 1.9, max: 2.3 },
    cohumulone: { min: 30, max: 35 },
    myrcene: { min: 24, max: 25 },
    humulene: { min: 34, max: 40 },
    caryophyllene: { min: 8, max: 12 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Altbier", "Blond", "Pale Ale", "Stout"],
    substitutes: ["Columbus", "Hallertau Taurus"],
    aroma: ["Citrus", "Grassy", "Spiced"],
  },
  {
    name: "Mandarina Bavaria",
    origin: "DE",
    type: "dual",
    alpha: { min: 7, max: 10 },
    beta: { min: 5, max: 6.5 },
    oil: { min: 0.8, max: 2.0 },
    cohumulone: { min: 35, max: 45 },
    myrcene: { min: 31, max: 35 },
    humulene: { min: 10, max: 15 },
    caryophyllene: { min: 6, max: 10 },
    farnesene: { min: 1, max: 2 },
    styles: ["Blond", "APA", "Pale Ale", "Wheat"],
    substitutes: ["Cascade", "Huell Melon"],
    aroma: ["Citrus", "Fruity", "Tangerine"],
  },
  {
    // Humulene reads "9.5-1.8" in the chart — an inverted range we cannot read
    // with confidence, so the field is omitted rather than guessed at.
    name: "Mistral",
    origin: "FR",
    type: "dual",
    alpha: { min: 6.5, max: 8.5 },
    beta: { min: 3.1, max: 3.8 },
    oil: { min: 1.0, max: 1.5 },
    cohumulone: { min: 59, max: 65 },
    myrcene: { min: 29, max: 39 },
    caryophyllene: { min: 3.0, max: 3.15 },
    farnesene: { max: 1 },
    styles: ["Bock", "APA", "Pale Ale", "Pils", "Saison"],
    substitutes: ["Kazbek", "Elixir"],
    aroma: ["Floral", "Citrus", "Pine", "Tropical"],
  },
  {
    name: "Mosaic",
    origin: "USA",
    type: "dual",
    alpha: { min: 10, max: 15 },
    beta: { min: 3.0, max: 4.5 },
    oil: { min: 0.5, max: 3.0 },
    cohumulone: { min: 45, max: 65 },
    myrcene: { min: 9, max: 16 },
    humulene: { min: 3, max: 8 },
    caryophyllene: { min: 20, max: 25 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["APA"],
    substitutes: ["Simcoe", "Citra"],
    aroma: ["Earthy", "Citrus", "Resin", "Tropical"],
  },
  {
    name: "Motueka",
    origin: "NZ",
    type: "dual",
    alpha: { min: 6.5, max: 8.5 },
    beta: { min: 5, max: 5.5 },
    oil: { min: 0.8, max: 1.5 },
    cohumulone: { min: 45, max: 60 },
    myrcene: { min: 28, max: 32 },
    humulene: { min: 0.8, max: 4.0 },
    caryophyllene: { min: 0.8, max: 2.0 },
    farnesene: { min: 10, max: 15 },
    styles: ["Blond", "Bock", "Brown", "Tripel"],
    substitutes: ["Saaz", "Sterling"],
    aroma: ["Citrus", "Spiced", "Tropical", "Mojito"],
  },
  {
    name: "Nectaron",
    origin: "NZ",
    type: "dual",
    alpha: { min: 10.5, max: 11.5 },
    beta: { min: 4.5, max: 5 },
    oil: { min: 1.5, max: 2.0 },
    cohumulone: { min: 55, max: 65 },
    myrcene: { min: 26, max: 28 },
    humulene: { min: 15, max: 18 },
    caryophyllene: { min: 4.0, max: 5.0 },
    farnesene: { min: 0.1, max: 0.2 },
    styles: ["Pale Ale", "Pils"],
    substitutes: ["Citra", "Mosaic"],
    aroma: ["Fruity", "Stone fruit", "Tropical"],
  },
  {
    name: "Nelson Sauvin",
    origin: "NZ",
    type: "dual",
    alpha: { min: 10, max: 13 },
    beta: { min: 5, max: 8 },
    oil: { min: 0.8, max: 1.5 },
    cohumulone: { min: 35, max: 45 },
    myrcene: { min: 20, max: 24 },
    humulene: { min: 25, max: 35 },
    caryophyllene: { min: 6, max: 10 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["APA", "Pale Ale"],
    substitutes: ["Hallertau Blanc", "Motueka"],
    aroma: ["Fruity", "Wine", "Sauvignon Blanc"],
  },
  {
    name: "Northern Brewer",
    origin: "DE",
    type: "dual",
    alpha: { min: 6.0, max: 10.0 },
    beta: { min: 3.0, max: 5.0 },
    oil: { min: 1.0, max: 1.6 },
    cohumulone: { min: 35, max: 45 },
    myrcene: { min: 27, max: 32 },
    humulene: { min: 25, max: 35 },
    caryophyllene: { min: 9, max: 14 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Blond", "Pale Ale", "Porter", "Stout"],
    substitutes: ["Hallertau Perle", "Chinook", "Magnum"],
    aroma: ["Resin"],
  },
  {
    name: "Nugget",
    origin: "FR",
    type: "bitter",
    alpha: { min: 10, max: 14 },
    beta: { min: 4, max: 6 },
    oil: { min: 1.5, max: 3.0 },
    cohumulone: { min: 48, max: 59 },
    myrcene: { min: 22, max: 30 },
    humulene: { min: 12, max: 22 },
    caryophyllene: { min: 7, max: 10 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Blond", "Pale Ale", "Porter", "Stout"],
    substitutes: ["Magnum", "Columbus"],
    aroma: ["Floral", "Resin", "Spiced"],
  },
  {
    name: "Opal",
    origin: "DE",
    type: "dual",
    alpha: { min: 5, max: 10.5 },
    beta: { min: 3.5, max: 5.5 },
    oil: { min: 0.8, max: 1.3 },
    cohumulone: { min: 15, max: 35 },
    myrcene: { min: 13, max: 17 },
    humulene: { min: 20, max: 35 },
    caryophyllene: { min: 7, max: 12 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Brown", "Pils", "Saison", "Weizen"],
    substitutes: ["Goldings", "Tettnanger"],
    aroma: ["Citrus", "Spiced", "Herbal"],
  },
  {
    name: "Pacific Jade",
    origin: "NZ",
    type: "dual",
    alpha: { min: 12, max: 14 },
    beta: { min: 7, max: 9 },
    oil: { min: 1.0, max: 2.0 },
    cohumulone: { min: 40, max: 50 },
    myrcene: { min: 22, max: 26 },
    humulene: { min: 20, max: 25 },
    caryophyllene: { min: 6, max: 9 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["APA", "Pale Ale"],
    substitutes: ["Magnum"],
    aroma: ["Citrus", "Spiced", "Black Pepper"],
  },
  {
    name: "Pekko",
    origin: "USA",
    type: "dual",
    alpha: { min: 13, max: 16 },
    beta: { min: 3.5, max: 5.0 },
    oil: { min: 1.0, max: 3.0 },
    cohumulone: { min: 20, max: 30 },
    myrcene: { min: 20, max: 28 },
    humulene: { min: 15, max: 20 },
    caryophyllene: { min: 27, max: 30 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Various"],
    substitutes: ["Saaz", "Azacca"],
    aroma: ["Floral", "Citrus", "Spiced", "Mint"],
  },
  {
    name: "Pilgrim",
    origin: "UK",
    type: "dual",
    alpha: { min: 9, max: 13 },
    beta: { min: 4.2, max: 5.2 },
    oil: { min: 1.0, max: 2.0 },
    cohumulone: { min: 30, max: 35 },
    myrcene: { min: 36, max: 38 },
    humulene: { min: 21, max: 25 },
    caryophyllene: { min: 7, max: 8 },
    farnesene: { min: 0.3, max: 1.0 },
    styles: ["Stout", "Wheat beer"],
    substitutes: ["Target", "Challenger"],
    aroma: ["Citrus", "Fruity", "Spicy"],
  },
  {
    name: "Riwaka",
    origin: "NZ",
    type: "aroma",
    alpha: { min: 4.5, max: 6.5 },
    beta: { min: 4, max: 5 },
    oil: { min: 0.9, max: 1.5 },
    cohumulone: { min: 55, max: 65 },
    myrcene: { min: 29, max: 36 },
    humulene: { min: 9, max: 13 },
    caryophyllene: { min: 4, max: 7 },
    farnesene: { min: 0.5, max: 1.0 },
    styles: ["APA", "Pale Ale", "Pils"],
    substitutes: ["Saaz"],
    aroma: ["Citrus", "Fruity", "Grapefruit", "Kumquat"],
  },
  {
    name: "Saaz",
    origin: "CZ/SVN/DE",
    type: "aroma",
    alpha: { min: 3, max: 4.5 },
    beta: { min: 3, max: 4.5 },
    oil: { min: 0.5, max: 1.0 },
    cohumulone: { min: 25, max: 37 },
    myrcene: { min: 24, max: 28 },
    humulene: { min: 23, max: 40 },
    caryophyllene: { min: 7, max: 11 },
    farnesene: { min: 9, max: 13 },
    styles: ["Altbier", "Pils", "Wheat", "Weizen"],
    substitutes: ["Tettnanger", "Sladek"],
    aroma: ["Earthy", "Floral", "Spiced", "Noble"],
  },
  {
    name: "Sabro",
    origin: "USA",
    type: "aroma",
    alpha: { min: 12, max: 17 },
    beta: { min: 5.5, max: 7.5 },
    oil: { min: 1.0, max: 4.0 },
    cohumulone: { min: 55, max: 70 },
    myrcene: { min: 6, max: 10 },
    humulene: { min: 8, max: 14 },
    caryophyllene: { min: 20, max: 24 },
    farnesene: { min: 0.1, max: 1 },
    styles: ["APA", "Porter", "Saison", "Stout"],
    substitutes: [],
    aroma: ["Citrus", "Spiced", "Stone fruit", "Tropical", "Coconut"],
  },
  {
    name: "Simcoe",
    origin: "USA",
    type: "dual",
    alpha: { min: 12, max: 14 },
    beta: { min: 4, max: 5 },
    oil: { min: 2, max: 2.5 },
    cohumulone: { min: 60, max: 65 },
    myrcene: { min: 10, max: 15 },
    humulene: { min: 5, max: 8 },
    caryophyllene: { min: 15, max: 20 },
    farnesene: { max: 1 },
    styles: ["APA"],
    substitutes: ["Amarillo", "Cascade", "Citra", "Mosaic"],
    aroma: ["Earthy", "Citrus", "Resin", "Pine"],
  },
  {
    name: "Sladek",
    origin: "CZ",
    type: "aroma",
    alpha: { min: 4.5, max: 8.0 },
    beta: { min: 4, max: 7 },
    oil: { min: 1.0, max: 2.0 },
    cohumulone: { min: 35, max: 50 },
    myrcene: { min: 23, max: 30 },
    humulene: { min: 25, max: 35 },
    caryophyllene: { min: 8, max: 13 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Blond", "Pale Ale", "Pils"],
    substitutes: ["Saaz"],
    aroma: ["Citrus", "Fruity", "Tropical", "Grapefruit"],
  },
  {
    name: "Spalt Select",
    origin: "DE/SVN",
    type: "aroma",
    alpha: { min: 3, max: 6.5 },
    beta: { min: 2, max: 5 },
    oil: { min: 0.5, max: 1.2 },
    cohumulone: { min: 40, max: 50 },
    myrcene: { min: 20, max: 28 },
    humulene: { min: 15, max: 20 },
    caryophyllene: { min: 6, max: 8 },
    farnesene: { min: 10, max: 22 },
    styles: ["Altbier", "Bock", "Pils", "Weizen"],
    substitutes: ["Saaz", "Tettnanger"],
    aroma: ["Floral", "Spiced", "Spicy"],
  },
  {
    name: "Strisselspalt",
    origin: "FR",
    type: "aroma",
    alpha: { min: 1.8, max: 2.5 },
    beta: { min: 4, max: 4.7 },
    oil: { min: 0.6, max: 0.8 },
    cohumulone: { min: 35, max: 52 },
    myrcene: { min: 20, max: 23 },
    humulene: { min: 13, max: 21 },
    caryophyllene: { min: 8, max: 10 },
    farnesene: { max: 1 },
    styles: ["Pale Ale", "Saison"],
    substitutes: ["Hallertau Hersbrucker", "Hallertau Tradition"],
    aroma: ["Earthy", "Floral", "Spiced"],
  },
  {
    name: "Styrian Aurora",
    origin: "SVN",
    type: "dual",
    alpha: { min: 6.5, max: 9.5 },
    beta: { min: 3.2, max: 5.5 },
    oil: { min: 0.9, max: 1.6 },
    cohumulone: { min: 35, max: 45 },
    myrcene: { min: 22, max: 26 },
    humulene: { min: 20, max: 27 },
    caryophyllene: { min: 4, max: 8 },
    farnesene: { min: 6, max: 9 },
    styles: ["Blond", "Pale Ale", "Tripel"],
    substitutes: ["Styrian Goldings", "Northern Brewer"],
    aroma: ["Floral", "Grassy", "Super Styrian"],
  },
  {
    name: "Styrian Cardinal",
    origin: "SVN",
    type: "aroma",
    alpha: { min: 10, max: 15 },
    beta: { min: 3, max: 5 },
    oil: { min: 3.0, max: 4.0 },
    cohumulone: { min: 40, max: 50 },
    myrcene: { min: 31, max: 37 },
    humulene: { min: 15, max: 22 },
    caryophyllene: { min: 8, max: 11 },
    farnesene: { min: 5, max: 7 },
    styles: ["Blond", "APA", "Pale Ale"],
    substitutes: [],
    aroma: ["Citrus", "Fruity", "Tropical", "Pineapple"],
  },
  {
    name: "Styrian Dana",
    origin: "SVN",
    type: "dual",
    alpha: { min: 11, max: 16 },
    beta: { min: 4, max: 6 },
    oil: { min: 2.4, max: 3.9 },
    cohumulone: { min: 42, max: 60 },
    myrcene: { min: 28, max: 31 },
    humulene: { min: 15, max: 21.6 },
    caryophyllene: { min: 5.7, max: 7.6 },
    farnesene: { min: 6.9, max: 8.7 },
    styles: ["APA", "Pale Ale"],
    substitutes: ["Bobek", "Celeia", "Willamette"],
    aroma: ["Citrus", "Fruity", "Spiced"],
  },
  {
    name: "Styrian Dragon",
    origin: "SVN",
    type: "aroma",
    alpha: { min: 6, max: 11 },
    beta: { min: 7.5, max: 8.5 },
    oil: { min: 1.5, max: 2.1 },
    cohumulone: { min: 58, max: 63 },
    myrcene: { min: 22, max: 24 },
    humulene: { min: 22, max: 33 },
    caryophyllene: { min: 12, max: 16 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Blond", "APA", "Pale Ale"],
    substitutes: ["Azacca", "Galaxy", "Idaho 7"],
    aroma: ["Citrus", "Fruity", "Tropical", "Grapefruit"],
  },
  {
    name: "Styrian Goldings Celeia",
    origin: "SVN",
    type: "aroma",
    alpha: { min: 2.8, max: 6 },
    beta: { min: 2, max: 3 },
    oil: { min: 0.5, max: 2.0 },
    cohumulone: { min: 25, max: 35 },
    myrcene: { min: 25, max: 30 },
    humulene: { min: 20, max: 25 },
    caryophyllene: { min: 8, max: 10 },
    farnesene: { min: 3, max: 7 },
    styles: ["Blond", "Pale Ale", "Tripel"],
    substitutes: ["Saaz", "Bobek"],
    aroma: ["Earthy", "Resin", "Spiced"],
  },
  {
    name: "Styrian Kolibri",
    origin: "SVN",
    type: "aroma",
    alpha: { min: 4, max: 6 },
    beta: { min: 2.8, max: 5.4 },
    oil: { min: 1, max: 2 },
    cohumulone: { min: 32, max: 32 },
    myrcene: { min: 21, max: 25 },
    humulene: { min: 16, max: 21 },
    caryophyllene: { min: 5.5, max: 7 },
    farnesene: { min: 25, max: 27 },
    styles: ["APA"],
    substitutes: [],
    aroma: ["Floral", "Citrus", "Fruity", "Spiced"],
  },
  {
    name: "Styrian Wolf",
    origin: "SVN",
    type: "dual",
    alpha: { min: 10, max: 18.5 },
    beta: { min: 5, max: 6 },
    oil: { min: 2.2, max: 3.6 },
    cohumulone: { min: 60, max: 70 },
    myrcene: { min: 22, max: 23 },
    humulene: { min: 5, max: 9 },
    caryophyllene: { min: 2, max: 3 },
    farnesene: { min: 4.5, max: 6.5 },
    styles: ["APA"],
    substitutes: [],
    aroma: ["Floral", "Citrus", "Fruity", "Tropical", "Mango"],
  },
  {
    name: "Tango",
    origin: "DE",
    type: "dual",
    alpha: { min: 7.5, max: 12.4 },
    beta: { min: 6, max: 10 },
    oil: { min: 2.4, max: 4.0 },
    cohumulone: { min: 29, max: 30 },
    myrcene: { min: 20, max: 25 },
    humulene: { min: 0.1, max: 0.5 },
    caryophyllene: { min: 0.5, max: 0.6 },
    farnesene: { min: 4.5, max: 5.5 },
    styles: ["Altbier", "Blond", "APA", "Tripel"],
    substitutes: ["Hallertau Tradition", "Hallertau Perle"],
    aroma: ["Citrus", "Fruity", "Resin"],
  },
  {
    name: "Target",
    origin: "BE",
    type: "bitter",
    alpha: { min: 8, max: 15 },
    beta: { min: 5, max: 5.5 },
    oil: { min: 1.2, max: 1.8 },
    cohumulone: { min: 45, max: 55 },
    myrcene: { min: 35, max: 40 },
    humulene: { min: 17, max: 22 },
    caryophyllene: { min: 5, max: 9 },
    farnesene: { min: 0.1, max: 1.0 },
    styles: ["Pale Ale", "Porter", "Stout"],
    substitutes: ["Willamette", "Fuggles"],
    aroma: ["Pine", "Resin"],
  },
  {
    name: "Tettnanger",
    origin: "DE",
    type: "aroma",
    alpha: { min: 2.5, max: 5.5 },
    beta: { min: 3.0, max: 5.0 },
    oil: { min: 0.5, max: 0.9 },
    cohumulone: { min: 25, max: 35 },
    myrcene: { min: 22, max: 28 },
    humulene: { min: 22, max: 28 },
    caryophyllene: { min: 6, max: 11 },
    farnesene: { min: 16, max: 24 },
    styles: ["Altbier", "Bock", "Pils", "Weizen"],
    substitutes: ["Saaz", "Spalt Select"],
    aroma: ["Floral", "Spiced", "Spicy", "Noble"],
  },
  {
    name: "Triskel",
    origin: "FR",
    type: "aroma",
    alpha: { min: 2.8, max: 4.6 },
    beta: { min: 4, max: 4.7 },
    oil: { min: 1.5, max: 2 },
    cohumulone: { min: 59, max: 61 },
    myrcene: { min: 20, max: 23 },
    humulene: { min: 13.4, max: 13.6 },
    caryophyllene: { min: 6, max: 6.2 },
    farnesene: { max: 1 },
    styles: ["Pils"],
    substitutes: ["Strisselspalt", "Ahtanum", "Centennial"],
    aroma: ["Floral", "Citrus", "Spiced"],
  },
  {
    name: "Wakatu",
    origin: "NZ",
    type: "dual",
    alpha: { min: 6.5, max: 8.5 },
    beta: { min: 7.5, max: 8.5 },
    oil: { min: 0.8, max: 1.5 },
    cohumulone: { min: 35, max: 45 },
    myrcene: { min: 28, max: 32 },
    humulene: { min: 15, max: 17 },
    caryophyllene: { min: 6, max: 8.5 },
    farnesene: { min: 5, max: 7 },
    styles: ["Pale Ale", "Pils"],
    substitutes: ["Hallertau Mittelfruh"],
    aroma: ["Floral", "Citrus"],
  },
  {
    name: "Whitbread Golding",
    origin: "UK",
    type: "dual",
    alpha: { min: 5, max: 7.5 },
    beta: { min: 2.5, max: 5.5 },
    oil: { min: 0.8, max: 1.2 },
    cohumulone: { min: 19, max: 27 },
    myrcene: { min: 33, max: 37 },
    humulene: { min: 35, max: 42 },
    caryophyllene: { min: 11, max: 15 },
    farnesene: { min: 1, max: 2.1 },
    styles: ["Blond", "Pale Ale", "Tripel"],
    substitutes: ["Fuggles"],
    aroma: ["Floral", "Fruity", "Spiced"],
  },
  {
    name: "Willamette",
    origin: "USA",
    type: "aroma",
    alpha: { min: 4, max: 6.5 },
    beta: { min: 3.5, max: 5.0 },
    oil: { min: 0.5, max: 1.6 },
    cohumulone: { min: 25, max: 40 },
    myrcene: { min: 28, max: 32 },
    humulene: { min: 25, max: 35 },
    caryophyllene: { min: 10, max: 14 },
    farnesene: { min: 6, max: 10 },
    styles: ["Various"],
    substitutes: ["Fuggle", "Styrian Goldings", "Tettnanger"],
    aroma: ["Floral", "Spiced"],
  },
];

/**
 * Substitute names the chart prints but never gives a row of its own.
 *
 * These are NOT missing transcriptions and NOT to be filled in from outside
 * knowledge — inventing an alpha range for them is exactly the failure mode
 * this dataset exists to avoid. They stay as printed so a suggestion can
 * honestly say "the chart names Ahtanum, which it does not otherwise
 * describe".
 *
 * `Ahtanum` matters in practice: it is stocked in real inventory here, so
 * {@link lookupHop} returns `undefined` for it and it can only ever appear as
 * a name the chart mentions. `Warrior` is also commonly stocked and does not
 * occur anywhere in the source at all — not even as a substitute — so it is
 * absent from this list too.
 */
export const SUBSTITUTES_NOT_IN_CHART: readonly string[] = [
  "Ahtanum", // named by Cascade and Triskel
  "Kent Golding", // named by Bramling Cross
  "Progress", // named by Bramling Cross
  "Sterling", // named by Motueka
  "Zeus", // named by Apollo
];

/**
 * Spelling variants, NOT new data.
 *
 * ADDED BEYOND THE CHART — the only additions in this file. Each one maps a
 * name the chart itself uses in its Substitutes column onto the row the chart
 * gives that same hop under a slightly different spelling. No value, range or
 * relationship is invented; these purely reconcile the source with itself.
 *
 * The Styrian aliases also close a real trap. "Styrian Goldings" ends with the
 * chart name "Goldings", so without an alias the containment pass in
 * {@link lookupHop} would resolve Styrian Goldings — a 2.8-6% Slovenian aroma
 * hop — onto Goldings, a different Belgian variety. Because the index is
 * scanned longest-name-first, the 16-character alias wins over the
 * 8-character "goldings" and the mis-resolution cannot happen.
 */
export const HOP_NAME_ALIASES: Readonly<Record<string, string>> = {
  // The chart's row is "Styrian Goldings Celeia"; its Substitutes column calls
  // the same hop "Styrian Goldings", "Styrian Golding" and "Celeia".
  "Styrian Goldings": "Styrian Goldings Celeia",
  "Styrian Golding": "Styrian Goldings Celeia",
  Celeia: "Styrian Goldings Celeia",
  // Willamette's Substitutes column prints the singular "Fuggle"; the row is
  // "Fuggles".
  Fuggle: "Fuggles",
};

/** Midpoint of the published alpha band — what the bitterness maths uses. */
export function alphaMidpoint(entry: HopEntry): number {
  return (entry.alpha.min + entry.alpha.max) / 2;
}

/**
 * Whether the chart's Type column sanctions using this variety in `role`.
 * "Dual" covers both; "Bitter" and "Aroma" are single-purpose.
 */
export function suitableFor(entry: HopEntry, role: HopRole): boolean {
  if (entry.type === "dual") return true;
  return role === "bittering" ? entry.type === "bitter" : entry.type === "aroma";
}

interface IndexedHop {
  normalized: string;
  entry: HopEntry;
}

let index: IndexedHop[] | undefined;
let exact: Map<string, HopEntry> | undefined;
/** Normalized substitute name -> the varieties that list it. */
let reverse: Map<string, HopEntry[]> | undefined;

/**
 * Memoized {@link lookupHop} answers, keyed on the *normalized* query.
 *
 * Same reasoning as the malt table: the containment pass is a linear scan, and
 * a matcher re-resolves the whole hop inventory for every missing hop of every
 * recipe. Misses are cached as `undefined` too, because an inventory full of
 * malts and salts is exactly the input that pays for the full scan every time.
 *
 * Rebuilt by {@link buildIndex} so the cache can never outlive its index.
 */
let lookupCache: Map<string, HopEntry | undefined> | undefined;

function buildIndex(): void {
  const list: IndexedHop[] = [];
  const map = new Map<string, HopEntry>();
  const byName = new Map<string, HopEntry>();

  for (const entry of HOP_VARIETIES) {
    const normalized = normalizeName(entry.name);
    byName.set(normalized, entry);
    if (!map.has(normalized)) map.set(normalized, entry);
    list.push({ normalized, entry });
  }

  // Aliases are indexed exactly like real names, so they win by length in the
  // containment pass as well as answering exact lookups.
  for (const [alias, canonical] of Object.entries(HOP_NAME_ALIASES)) {
    const target = byName.get(normalizeName(canonical));
    // A dangling alias is a data bug, not a runtime condition — the tests
    // assert every alias resolves, so silently skipping is safe here.
    if (!target) continue;
    const normalized = normalizeName(alias);
    if (!map.has(normalized)) map.set(normalized, target);
    list.push({ normalized, entry: target });
  }

  // Longest names first, so "hallertau cascade" wins over "cascade" and
  // "styrian goldings" over "goldings".
  list.sort((a, b) => b.normalized.length - a.normalized.length);

  const back = new Map<string, HopEntry[]>();
  for (const entry of HOP_VARIETIES) {
    for (const name of entry.substitutes) {
      const key = normalizeName(name);
      if (!key) continue;
      const parents = back.get(key);
      if (parents) parents.push(entry);
      else back.set(key, [entry]);
    }
  }

  index = list;
  exact = map;
  reverse = back;
  lookupCache = new Map();
}

/** Shortest chart name allowed to match by containment. */
const MIN_CONTAINMENT_LENGTH = 4;

/**
 * Resolve a hop name against the chart.
 *
 * Two passes, strictest first: exact normalized name (which also covers the
 * spelling aliases), then a whole-word containment pass so real inventory
 * names — "Citra (US) - Pellets", "Cascade Leaf 2024" — still land.
 *
 * Containment is **one-directional on purpose**: the queried name must contain
 * a chart name, never the reverse. This is the same trap `lookupMalt` documents
 * after it resolved "Munich I" onto "Caramel Munich I", and it bites harder
 * here because hop names nest so heavily. Allowing the reverse direction would
 * resolve a bare "Styrian" onto Styrian Wolf, "Hallertau" onto whichever
 * Hallertau sorted first, and "Golding" onto Whitbread Golding — each of them
 * a different hop with a different alpha, which then silently produces a wrong
 * weight from {@link bitternessEquivalentAmount}. A query that is merely a
 * fragment of a variety name is genuinely ambiguous, so it resolves to nothing.
 *
 * Whole-word boundaries and {@link MIN_CONTAINMENT_LENGTH} keep short names
 * from matching mid-word.
 *
 * Memoized on the normalized query (see {@link lookupCache}); the answer is a
 * pure function of that query, so caching changes nothing but the cost.
 */
export function lookupHop(name: string): HopEntry | undefined {
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

function resolveByName(query: string): HopEntry | undefined {
  const direct = exact!.get(query);
  if (direct) return direct;

  const padded = ` ${query} `;
  for (const candidate of index!) {
    if (candidate.normalized.length < MIN_CONTAINMENT_LENGTH) continue;
    if (padded.includes(` ${candidate.normalized} `)) return candidate.entry;
  }
  return undefined;
}

/** The chart's Substitutes column for one variety, split by what resolves. */
export interface HopSubstitutes {
  /** Substitutes that are themselves varieties in this table. */
  resolved: HopEntry[];
  /**
   * Substitute names printed by the chart with no row here — a subset of
   * {@link SUBSTITUTES_NOT_IN_CHART}. Surfaced rather than dropped so the UI
   * can name them without pretending to know their specs.
   */
  unresolved: string[];
}

/**
 * FORWARD direction: what the chart says you may use *instead of* `name`.
 *
 * This is the chart's own explicit recommendation and the signal to prefer.
 * Order is the chart's printed order, which reads as a preference ranking.
 */
export function substitutesFor(name: string): HopSubstitutes | undefined {
  const entry = lookupHop(name);
  if (!entry) return undefined;

  const resolved: HopEntry[] = [];
  const unresolved: string[] = [];
  for (const candidate of entry.substitutes) {
    const found = lookupHop(candidate);
    if (found) resolved.push(found);
    else unresolved.push(candidate);
  }
  return { resolved, unresolved };
}

/**
 * REVERSE direction: the varieties that list `name` as one of *their*
 * substitutes.
 *
 * Deliberately a separate function, never folded into
 * {@link substitutesFor}. The chart's lists are one-way, and "X may replace Y"
 * does not license "Y may replace X" — Cascade lists Ahtanum, but the chart
 * makes no claim in the other direction. This is a weaker, inferred signal;
 * the integrator opts into it knowingly.
 *
 * It does work for names with no row of their own, which is the point: nothing
 * here describes Ahtanum, yet the chart still tells us Cascade and Triskel
 * consider it an acceptable stand-in.
 *
 * Results are in chart order and de-duplicated.
 */
export function reverseSubstitutesFor(name: string): HopEntry[] {
  if (!index || !reverse) buildIndex();

  const keys = new Set<string>();
  const query = normalizeName(name);
  if (query) keys.add(query);

  // Fold in the canonical name and every alias of it, so asking by any
  // spelling finds parents that used a different one.
  const entry = lookupHop(name);
  if (entry) {
    const canonical = normalizeName(entry.name);
    keys.add(canonical);
    for (const [alias, target] of Object.entries(HOP_NAME_ALIASES)) {
      if (normalizeName(target) === canonical) keys.add(normalizeName(alias));
    }
  }

  const seen = new Set<HopEntry>();
  for (const key of keys) {
    for (const parent of reverse!.get(key) ?? []) seen.add(parent);
  }
  return HOP_VARIETIES.filter((variety) => seen.has(variety));
}

/** Accept either a resolved entry or a name to resolve. */
function asEntry(hop: HopEntry | string): HopEntry | undefined {
  return typeof hop === "string" ? lookupHop(hop) : hop;
}

/**
 * How much of `candidate` replaces one unit of `wanted` at equal bitterness.
 *
 * `alphaMid(wanted) / alphaMid(candidate)`, from the band midpoints. Returns
 * `undefined` when either name fails to resolve or the candidate's alpha
 * midpoint is not positive (impossible for chart data — the weakest variety,
 * Strisselspalt, midpoints at 2.15% — but the guard keeps the function total).
 */
export function bitternessEquivalentFactor(
  wanted: HopEntry | string,
  candidate: HopEntry | string
): number | undefined {
  const from = asEntry(wanted);
  const to = asEntry(candidate);
  if (!from || !to) return undefined;

  const candidateAlpha = alphaMidpoint(to);
  if (!(candidateAlpha > 0)) return undefined;
  return alphaMidpoint(from) / candidateAlpha;
}

/**
 * Weight of `candidate` giving the same bitterness as `amountWanted` of
 * `wanted`.
 *
 * `alphaWanted x amountWanted / alphaCandidate`, using the midpoint of each
 * published band. Unit-agnostic: the result is in whatever unit `amountWanted`
 * was given in.
 *
 * This is why alpha is modelled as a range at all. Swapping a 4% variety for a
 * 15% one at the same weight nearly quadruples the bitterness, so any hop
 * suggestion that does not restate the weight is actively misleading.
 *
 * **This is a bitterness equivalence and nothing more.** It says nothing about
 * aroma, and the two are not interchangeable concerns:
 *
 *   - It is only meaningful for a bittering addition, where alpha acids are
 *     isomerised by a long boil. For a late, whirlpool or dry-hop addition the
 *     point of the hop is its oil and aroma profile, and scaling the weight by
 *     alpha is the wrong adjustment — it will change the aroma intensity for
 *     no reason.
 *   - It ignores cohumulone, which the chart tracks precisely because the
 *     *quality* of bitterness differs even at equal IBU.
 *   - It works from midpoints, so it inherits the width of both bands. Chinook
 *     (11-15%) against Simcoe (12-14%) is a tight comparison; Hallertau Perle
 *     (3-11%) against anything is not, and the real crop-year figure should
 *     come off the certificate of analysis.
 *   - It assumes the substitution happens at the same time in the boil. Utilisation
 *     changes with time and gravity; this formula holds neither.
 */
export function bitternessEquivalentAmount(
  wanted: HopEntry | string,
  amountWanted: number,
  candidate: HopEntry | string
): number | undefined {
  const factor = bitternessEquivalentFactor(wanted, candidate);
  if (factor === undefined || !Number.isFinite(amountWanted)) return undefined;
  return amountWanted * factor;
}
