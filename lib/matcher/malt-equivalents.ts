/**
 * Cross-maltster malt equivalence tables (pure data + lookup).
 *
 * Transcribed from `docs/reference/Equivalenze-Malti-Malterie.pdf` — see
 * `docs/malt-substitutions.md` for the human-readable version, the five
 * substitution rules, and the provenance. Keep the two in sync.
 *
 * EBC bands are the maltsters' own published figures and vary batch to batch,
 * so every comparison here works from the band midpoint with a tolerance
 * (guide rule 2), never from exact equality.
 */
import { normalizeName } from "@/lib/matcher/normalize";

/** Function in the mash. Rule 1: substitution never crosses class. */
export type MaltClass =
  | "base"
  | "melanoidin"
  | "caramel"
  | "kilned"
  | "roasted"
  | "wheat"
  | "technical"
  | "adjunct-grain";

/** Human labels for justification copy. */
export const MALT_CLASS_LABEL: Readonly<Record<MaltClass, string>> = {
  base: "base malt",
  melanoidin: "melanoidin malt",
  caramel: "caramel/crystal malt",
  kilned: "kilned malt",
  roasted: "roasted malt",
  wheat: "wheat malt",
  technical: "technical malt",
  "adjunct-grain": "adjunct grain",
};

export interface MaltEntry {
  name: string;
  /** Published EBC band; `ebcMin === ebcMax` for single-value specs. */
  ebcMin: number;
  ebcMax: number;
}

export interface MaltRow {
  id: string;
  maltClass: MaltClass;
  /** One entry per maltster variant listed on this row of the guide. */
  malts: MaltEntry[];
  /** Guide caveat that must ride along with any suggestion from this row. */
  caveat?: string;
  /** Rows this one is 1:1 with despite living in a different section. */
  equivalentRows?: string[];
  /** Rows never auto-matched despite EBC overlap (guide rule 5). */
  neverMatchRows?: string[];
  /**
   * Unmalted grain. It may be *replaced* by a malted equivalent (the guide's
   * "to soften, substitute with Chocolate Malt"), but must never be offered as
   * a stand-in for a malted grain: it carries no diastatic power and a
   * distinctly harsher, grain-forward character. Directional on purpose.
   */
  unmalted?: boolean;
  /**
   * Cereal species, for rows whose `maltClass` is too coarse to separate them.
   * Every adjunct-grain row shares one class, but rye, spelt and oats are not
   * interchangeable and their EBC bands overlap, so class + colour alone would
   * happily swap rye into an oatmeal stout. When both rows declare a grain,
   * they must agree.
   */
  grain?: string;
}

/** Guide rule 2: EBC bands within ±10% are interchangeable. */
export const EBC_TOLERANCE = 0.1;

/** Guide rule 4: colourants above this EBC are dosed at −15%. */
export const COLORANT_EBC_THRESHOLD = 250;
export const COLORANT_DOSE_ADJUSTMENT = -0.15;

export const MALT_ROWS: readonly MaltRow[] = [
  // ---------------------------------------------------------------- base
  {
    id: "base-pilsen",
    maltClass: "base",
    malts: [
      { name: "Pilsen 2RP", ebcMin: 3, ebcMax: 4 },
      { name: "Château Pilsen 2RP", ebcMin: 3, ebcMax: 4 },
      { name: "BEST Pilsen", ebcMin: 3, ebcMax: 4.9 },
      { name: "Weyermann Pilsner", ebcMin: 2.5, ebcMax: 4.5 },
      { name: "Crisp Europils", ebcMin: 3, ebcMax: 4.5 },
      { name: "Fawcett Pilsner", ebcMin: 3, ebcMax: 4.5 },
      // Organic row — "functionally identical to the conventional equivalent".
      { name: "Pilsen Bio", ebcMin: 3, ebcMax: 4 },
      { name: "Château Pilsen Nature", ebcMin: 3, ebcMax: 3.5 },
      { name: "BEST Organic Pilsen", ebcMin: 3, ebcMax: 4.9 },
      { name: "Weyermann Organic Pilsner", ebcMin: 2.8, ebcMax: 4 },
    ],
  },
  {
    id: "base-pale-ale",
    maltClass: "base",
    malts: [
      { name: "Pale Ale", ebcMin: 4.5, ebcMax: 6.5 },
      { name: "Château Pale Ale 2RP", ebcMin: 7, ebcMax: 10 },
      { name: "BEST Pale Ale", ebcMin: 5, ebcMax: 7 },
      { name: "Weyermann Pale Ale", ebcMin: 5.5, ebcMax: 7.5 },
      { name: "Simpsons Golden Promise", ebcMin: 5, ebcMax: 8 },
      { name: "Crisp Maris Otter", ebcMin: 5, ebcMax: 8 },
      { name: "Fawcett Maris Otter", ebcMin: 5, ebcMax: 8 },
      { name: "Pale Ale Bio", ebcMin: 4.5, ebcMax: 6.5 },
      { name: "Château Pale Ale Nature", ebcMin: 7, ebcMax: 10 },
      { name: "BEST Organic Pale Ale", ebcMin: 5, ebcMax: 7 },
      { name: "Weyermann Organic Pale Ale", ebcMin: 5.5, ebcMax: 7.5 },
    ],
  },
  {
    id: "base-lager-maris-otter",
    maltClass: "base",
    malts: [
      { name: "Lager", ebcMin: 4, ebcMax: 6 },
      { name: "Maris Otter", ebcMin: 4, ebcMax: 6 },
      { name: "Château Pale Ale", ebcMin: 6, ebcMax: 8 },
      { name: "BEST Heidelberg", ebcMin: 3, ebcMax: 5 },
      { name: "Weyermann Barke Pilsner", ebcMin: 3, ebcMax: 4 },
      { name: "Crisp Best Ale", ebcMin: 5, ebcMax: 7 },
      { name: "Simpsons Best Pale Ale", ebcMin: 5, ebcMax: 7 },
    ],
  },
  {
    id: "base-vienna",
    maltClass: "base",
    malts: [
      { name: "Vienne 10", ebcMin: 7, ebcMax: 10 },
      { name: "Château Vienna", ebcMin: 4, ebcMax: 7 },
      { name: "BEST Vienna", ebcMin: 6, ebcMax: 9 },
      { name: "Weyermann Vienna", ebcMin: 6, ebcMax: 9 },
      { name: "Crisp Vienna", ebcMin: 6, ebcMax: 10 },
      { name: "Simpsons Vienna", ebcMin: 6, ebcMax: 10 },
      { name: "Vienne Bio", ebcMin: 7, ebcMax: 10 },
      { name: "Château Vienna Nature", ebcMin: 4, ebcMax: 7 },
      { name: "BEST Organic Vienna", ebcMin: 6, ebcMax: 9 },
      { name: "Weyermann Organic Vienna", ebcMin: 6, ebcMax: 9 },
    ],
  },
  {
    id: "base-munich-light",
    maltClass: "base",
    malts: [
      { name: "Munich 15", ebcMin: 12, ebcMax: 18 },
      { name: "Château Munich Light", ebcMin: 12, ebcMax: 18 },
      { name: "BEST Munich", ebcMin: 11, ebcMax: 20 },
      { name: "Weyermann Munich Type 1", ebcMin: 12, ebcMax: 18 },
      { name: "Crisp Munich", ebcMin: 15, ebcMax: 20 },
      { name: "Fawcett Munich", ebcMin: 15, ebcMax: 20 },
      { name: "Munich Bio", ebcMin: 15, ebcMax: 25 },
      { name: "Château Munich Light Nature", ebcMin: 12, ebcMax: 18 },
      { name: "BEST Organic Munich", ebcMin: 11, ebcMax: 20 },
      { name: "Weyermann Organic Munich", ebcMin: 18, ebcMax: 24 },
    ],
  },
  {
    id: "base-munich-dark",
    maltClass: "base",
    malts: [
      { name: "Munich 25", ebcMin: 20, ebcMax: 30 },
      { name: "Château Munich", ebcMin: 20, ebcMax: 25 },
      { name: "BEST Munich Dark", ebcMin: 21, ebcMax: 35 },
      { name: "Weyermann Munich Type 2", ebcMin: 20, ebcMax: 25 },
      { name: "Simpsons Munich", ebcMin: 25, ebcMax: 35 },
      { name: "Crisp Dark Munich", ebcMin: 25, ebcMax: 35 },
    ],
  },

  // ---------------------------------------------------------- melanoidin
  {
    id: "melanoidin",
    maltClass: "melanoidin",
    malts: [
      { name: "Château Melanoidin", ebcMin: 60, ebcMax: 80 },
      { name: "BEST Melanoidin", ebcMin: 61, ebcMax: 80 },
      { name: "Weyermann Melanoidin", ebcMin: 60, ebcMax: 80 },
      { name: "Simpsons Aromatic", ebcMin: 45, ebcMax: 60 },
    ],
  },

  // ------------------------------------------------------------- caramel
  {
    id: "caramel-pils",
    maltClass: "caramel",
    equivalentRows: ["kilned-dextrine"],
    malts: [
      { name: "Château Cara Clair", ebcMin: 7, ebcMax: 9 },
      { name: "BEST Caramel Pils", ebcMin: 3, ebcMax: 7 },
      { name: "Weyermann Carapils", ebcMin: 2.5, ebcMax: 6.5 },
      { name: "Crisp Carapils", ebcMin: 4, ebcMax: 8 },
      { name: "Simpsons Low Color Crystal", ebcMin: 4, ebcMax: 8 },
    ],
  },
  {
    id: "caramel-hell",
    maltClass: "caramel",
    malts: [
      { name: "Caramel Pilsen", ebcMin: 20, ebcMax: 30 },
      { name: "Château Cara Blond", ebcMin: 17, ebcMax: 24 },
      { name: "BEST Caramel Hell", ebcMin: 20, ebcMax: 30 },
      { name: "Weyermann Carahell", ebcMin: 20, ebcMax: 30 },
      { name: "Crisp Crystal 15", ebcMin: 20, ebcMax: 30 },
      { name: "Simpsons Crystal Light", ebcMin: 20, ebcMax: 30 },
    ],
  },
  {
    id: "caramel-red",
    maltClass: "caramel",
    malts: [
      { name: "Caramel Vienne", ebcMin: 50, ebcMax: 60 },
      { name: "Château Cara Ruby", ebcMin: 45, ebcMax: 55 },
      { name: "BEST Caramel Aromatic", ebcMin: 41, ebcMax: 60 },
      { name: "Weyermann Carared", ebcMin: 40, ebcMax: 60 },
      { name: "Crisp Crystal 55", ebcMin: 45, ebcMax: 60 },
      { name: "Simpsons Crystal Medium", ebcMin: 45, ebcMax: 60 },
      { name: "Fawcett Crystal 55", ebcMin: 45, ebcMax: 60 },
    ],
  },
  {
    id: "caramel-honey",
    maltClass: "caramel",
    malts: [
      { name: "Château Cara Honey", ebcMin: 60, ebcMax: 80 },
      { name: "Simpsons Heritage Crystal", ebcMin: 70, ebcMax: 90 },
    ],
  },
  {
    id: "caramel-munich-1",
    maltClass: "caramel",
    malts: [
      { name: "Château Cara Arôme", ebcMin: 80, ebcMax: 100 },
      { name: "BEST Caramel Munich I", ebcMin: 81, ebcMax: 100 },
      { name: "Weyermann Caramunich Type 1", ebcMin: 80, ebcMax: 100 },
      { name: "Crisp Crystal 95", ebcMin: 80, ebcMax: 100 },
      { name: "Fawcett Crystal 90", ebcMin: 80, ebcMax: 100 },
    ],
  },
  {
    id: "caramel-munich-2",
    maltClass: "caramel",
    malts: [
      { name: "Caramel Ambrée", ebcMin: 100, ebcMax: 120 },
      { name: "Château Cara Gold", ebcMin: 110, ebcMax: 130 },
      { name: "BEST Caramel Munich II", ebcMin: 110, ebcMax: 130 },
      { name: "Weyermann Caramunich Type 2", ebcMin: 110, ebcMax: 130 },
      { name: "Crisp Crystal 120", ebcMin: 110, ebcMax: 130 },
      { name: "Simpsons Dark Crystal", ebcMin: 110, ebcMax: 130 },
      { name: "Fawcett Crystal II", ebcMin: 110, ebcMax: 130 },
    ],
  },
  {
    id: "caramel-munich-3",
    maltClass: "caramel",
    malts: [
      { name: "Caramel Munich", ebcMin: 140, ebcMax: 160 },
      { name: "Château Cara Crystal", ebcMin: 140, ebcMax: 160 },
      { name: "BEST Caramel Munich III", ebcMin: 131, ebcMax: 200 },
      { name: "Weyermann Caramunich Type 3", ebcMin: 140, ebcMax: 160 },
      { name: "Crisp Crystal 150", ebcMin: 140, ebcMax: 180 },
      { name: "Simpsons Double Roasted Crystal", ebcMin: 140, ebcMax: 180 },
    ],
  },
  {
    id: "caramel-special-b",
    maltClass: "caramel",
    caveat:
      "above 250 EBC — dose at −15% if the colour comes out too strong (guide rule 4)",
    malts: [
      { name: "Château Special B", ebcMin: 250, ebcMax: 350 },
      { name: "BEST Special X", ebcMin: 300, ebcMax: 300 },
      { name: "Weyermann Special W", ebcMin: 280, ebcMax: 320 },
      { name: "Simpsons Extra Dark Crystal", ebcMin: 220, ebcMax: 320 },
      { name: "Fawcett Dark Crystal", ebcMin: 220, ebcMax: 320 },
    ],
  },

  // -------------------------------------------------------------- kilned
  {
    id: "kilned-abbey",
    maltClass: "kilned",
    malts: [
      { name: "Château Abbaye", ebcMin: 41, ebcMax: 49 },
      { name: "Weyermann Abbey", ebcMin: 40, ebcMax: 50 },
      { name: "Simpsons Aromatic Monastic", ebcMin: 40, ebcMax: 55 },
    ],
  },
  {
    id: "kilned-biscuit",
    maltClass: "kilned",
    malts: [
      { name: "Tourambrée", ebcMin: 45, ebcMax: 55 },
      { name: "Château Biscuit", ebcMin: 45, ebcMax: 55 },
      { name: "BEST Biscuit", ebcMin: 45, ebcMax: 55 },
      { name: "Simpsons Amber", ebcMin: 45, ebcMax: 65 },
      { name: "Fawcett Amber", ebcMin: 45, ebcMax: 65 },
    ],
  },
  {
    id: "kilned-dextrine",
    maltClass: "kilned",
    // Practical note: "Carapils / Carafoam / Dextrine — three names for the
    // same malt, substitutable 1:1", even though the tables split them across
    // the caramel and kilned sections.
    equivalentRows: ["caramel-pils"],
    malts: [
      { name: "Château Cara Pils Dextrine", ebcMin: 2, ebcMax: 4 },
      { name: "Weyermann Carafoam", ebcMin: 3, ebcMax: 5 },
      { name: "Crisp Dextrin Malt", ebcMin: 3, ebcMax: 5 },
    ],
  },
  {
    id: "kilned-brown",
    maltClass: "kilned",
    malts: [
      { name: "Simpsons Brown Malt", ebcMin: 130, ebcMax: 180 },
      { name: "Fawcett Brown", ebcMin: 130, ebcMax: 180 },
    ],
  },

  // ------------------------------------------------------------- roasted
  {
    id: "roasted-coffee",
    maltClass: "roasted",
    malts: [
      { name: "Café", ebcMin: 400, ebcMax: 650 },
      { name: "Château Café", ebcMin: 420, ebcMax: 520 },
      { name: "Crisp Pale Chocolate", ebcMin: 400, ebcMax: 600 },
      { name: "Simpsons Coffee Malt", ebcMin: 400, ebcMax: 600 },
    ],
  },
  {
    id: "roasted-chocolate",
    maltClass: "roasted",
    malts: [
      { name: "Chocolat", ebcMin: 800, ebcMax: 1000 },
      { name: "Château Chocolat", ebcMin: 900, ebcMax: 1000 },
      { name: "BEST Chocolate", ebcMin: 800, ebcMax: 1000 },
      { name: "Weyermann Carafa I", ebcMin: 800, ebcMax: 1000 },
      { name: "Crisp Chocolate Malt", ebcMin: 800, ebcMax: 1100 },
      { name: "Simpsons Chocolate", ebcMin: 800, ebcMax: 1100 },
      { name: "Fawcett Chocolate", ebcMin: 800, ebcMax: 1100 },
    ],
  },
  {
    id: "roasted-black",
    maltClass: "roasted",
    // Rule 5: Black Malt is cleaner and less harsh than Roasted Barley.
    neverMatchRows: ["roasted-barley"],
    malts: [
      { name: "Black", ebcMin: 1200, ebcMax: 1400 },
      { name: "Château Black", ebcMin: 1150, ebcMax: 1400 },
      { name: "BEST Black Malt", ebcMin: 1100, ebcMax: 1200 },
      { name: "Weyermann Carafa II", ebcMin: 1050, ebcMax: 1250 },
      { name: "Crisp Black Malt", ebcMin: 1100, ebcMax: 1400 },
      { name: "Simpsons Black Malt", ebcMin: 1100, ebcMax: 1400 },
      { name: "Fawcett Black", ebcMin: 1100, ebcMax: 1400 },
    ],
  },
  {
    id: "roasted-barley",
    maltClass: "roasted",
    caveat:
      "unmalted roasted barley — gives the grilled Guinness-style bite and is not fully interchangeable with Black Malt (guide rule 5)",
    neverMatchRows: ["roasted-black"],
    unmalted: true,
    malts: [
      { name: "Château Roasted Barley", ebcMin: 1000, ebcMax: 1400 },
      { name: "BEST Roasted Barley", ebcMin: 1200, ebcMax: 1400 },
      { name: "Weyermann Roasted Barley", ebcMin: 1000, ebcMax: 1300 },
      { name: "Crisp Roasted Barley", ebcMin: 1000, ebcMax: 1400 },
      { name: "Simpsons Roasted Barley", ebcMin: 1000, ebcMax: 1400 },
      { name: "Fawcett Roasted Barley", ebcMin: 1000, ebcMax: 1400 },
      { name: "Roasted Barley", ebcMin: 1000, ebcMax: 1400 },
    ],
  },
  {
    id: "roasted-debittered",
    maltClass: "roasted",
    malts: [
      { name: "Weyermann Carafa III", ebcMin: 1300, ebcMax: 1500 },
      { name: "Simpsons Black Malt Debittered", ebcMin: 1250, ebcMax: 1450 },
    ],
  },

  // --------------------------------------------------------------- wheat
  {
    id: "wheat-pale",
    maltClass: "wheat",
    malts: [
      { name: "Malt de blé", ebcMin: 2.4, ebcMax: 4 },
      { name: "Château Froment Blanc", ebcMin: 3.5, ebcMax: 5.5 },
      { name: "BEST Wheat", ebcMin: 3, ebcMax: 5 },
      { name: "Weyermann Pale Wheat", ebcMin: 3, ebcMax: 5 },
      { name: "Crisp Wheat Malt", ebcMin: 3, ebcMax: 5 },
      { name: "Fawcett Pale Wheat", ebcMin: 3, ebcMax: 5 },
    ],
  },
  {
    id: "wheat-dark",
    maltClass: "wheat",
    malts: [
      { name: "Château Froment Munich", ebcMin: 15, ebcMax: 20 },
      { name: "BEST Wheat Dark", ebcMin: 15, ebcMax: 20 },
      { name: "Weyermann Dark Wheat", ebcMin: 15, ebcMax: 19 },
      { name: "Simpsons Dark Wheat", ebcMin: 15, ebcMax: 20 },
    ],
  },
  {
    id: "wheat-caramel",
    maltClass: "wheat",
    malts: [
      { name: "Caramel de blé", ebcMin: 90, ebcMax: 110 },
      { name: "Château Froment Crystal", ebcMin: 140, ebcMax: 160 },
      { name: "BEST Caramel Wheat", ebcMin: 100, ebcMax: 140 },
      { name: "Weyermann CaraWheat", ebcMin: 110, ebcMax: 140 },
      { name: "Simpsons Crystal Wheat", ebcMin: 90, ebcMax: 140 },
    ],
  },
  {
    id: "wheat-chocolate",
    maltClass: "wheat",
    malts: [
      { name: "Château Froment Chocolat", ebcMin: 800, ebcMax: 1100 },
      { name: "Weyermann Chocolate Wheat", ebcMin: 900, ebcMax: 1200 },
      { name: "Simpsons Roasted Wheat", ebcMin: 900, ebcMax: 1200 },
    ],
  },
  {
    id: "wheat-black",
    maltClass: "wheat",
    malts: [{ name: "Château Froment Black", ebcMin: 1100, ebcMax: 1400 }],
  },

  // ----------------------------------------------------------- technical
  {
    id: "tech-diastatic",
    maltClass: "technical",
    malts: [
      { name: "Château Diastasique", ebcMin: 2.5, ebcMax: 4 },
      { name: "Weyermann Diastatic Barley", ebcMin: 2.5, ebcMax: 4 },
    ],
  },
  {
    id: "tech-smoked",
    maltClass: "technical",
    malts: [
      { name: "Château Fumé", ebcMin: 3, ebcMax: 8 },
      { name: "BEST Smoked", ebcMin: 3, ebcMax: 10 },
      { name: "Weyermann Beech Smoked", ebcMin: 4, ebcMax: 8 },
      { name: "Simpsons Peated Malt", ebcMin: 3, ebcMax: 6 },
    ],
  },
  {
    id: "tech-acid",
    maltClass: "technical",
    malts: [
      { name: "Château Acide", ebcMin: 6, ebcMax: 13 },
      { name: "BEST Acidulated", ebcMin: 3, ebcMax: 10 },
      { name: "Weyermann Acidulated", ebcMin: 2.5, ebcMax: 12 },
    ],
  },

  // ------------------------------------------------------- adjunct grain
  {
    id: "grain-rye",
    maltClass: "adjunct-grain",
    grain: "rye",
    malts: [
      { name: "Malt de Seigle", ebcMin: 4, ebcMax: 9 },
      { name: "Château Seigle", ebcMin: 4, ebcMax: 10 },
      { name: "BEST Rye", ebcMin: 4, ebcMax: 10 },
      { name: "Weyermann Pale Rye", ebcMin: 4, ebcMax: 10 },
      { name: "Crisp Rye Malt", ebcMin: 4, ebcMax: 10 },
      { name: "Fawcett Rye", ebcMin: 4, ebcMax: 10 },
    ],
  },
  {
    id: "grain-spelt",
    maltClass: "adjunct-grain",
    grain: "spelt",
    malts: [
      { name: "Château Épeautre", ebcMin: 3, ebcMax: 7 },
      { name: "BEST Spelt", ebcMin: 3, ebcMax: 6 },
      { name: "Weyermann Spelt", ebcMin: 3.5, ebcMax: 6 },
    ],
  },
  {
    id: "grain-oat",
    maltClass: "adjunct-grain",
    grain: "oat",
    // Malted oats keep their diastatic power; the raw flakes below do not, so
    // the two never swap for each other in either direction.
    neverMatchRows: ["grain-oat-unmalted"],
    malts: [
      { name: "Château Avoine", ebcMin: 2, ebcMax: 4 },
      { name: "Weyermann Oat", ebcMin: 3, ebcMax: 6 },
      { name: "Crisp Oat Malt", ebcMin: 3, ebcMax: 7 },
      { name: "Simpsons Oat Malt", ebcMin: 3, ebcMax: 7 },
      { name: "Fawcett Oat Malt", ebcMin: 3, ebcMax: 7 },
    ],
  },
  {
    /*
     * Unmalted oats. Not in the source guide — added because every form of raw
     * oat (flaked, rolled, torrefied, steel-cut, quick) is the same thing in
     * the mash: unmalted starch added for body, mouthfeel and haze, always
     * mashed alongside a base malt that supplies the enzymes. Brewers and
     * suppliers use the names interchangeably, and one library routinely
     * carries several spellings of the same sack.
     *
     * Kept apart from `grain-oat` (malted) in both directions: oat malt is
     * malted and behaves differently, so neither stands in for the other.
     */
    id: "grain-oat-unmalted",
    maltClass: "adjunct-grain",
    grain: "oat",
    unmalted: true,
    neverMatchRows: ["grain-oat"],
    malts: [
      { name: "Oats, Flaked", ebcMin: 2, ebcMax: 5 },
      { name: "Flaked Oats", ebcMin: 2, ebcMax: 5 },
      { name: "Flaked Torrefied Oats", ebcMin: 2, ebcMax: 5 },
      { name: "Torrefied Oats", ebcMin: 2, ebcMax: 5 },
      { name: "Rolled Oats", ebcMin: 2, ebcMax: 5 },
      { name: "Oat Flakes", ebcMin: 2, ebcMax: 5 },
      { name: "Steel Cut Oats", ebcMin: 2, ebcMax: 5 },
      { name: "Quick Oats", ebcMin: 2, ebcMax: 5 },
      { name: "Instant Oats", ebcMin: 2, ebcMax: 5 },
      { name: "Oatmeal", ebcMin: 2, ebcMax: 5 },
    ],
  },
];

/** A malt name resolved against the guide. */
export interface ResolvedMalt {
  entry: MaltEntry;
  row: MaltRow;
  /** Midpoint of the published band — what comparisons work from. */
  ebcMid: number;
}

export function ebcMidpoint(entry: MaltEntry): number {
  return (entry.ebcMin + entry.ebcMax) / 2;
}

/** Maltster prefixes stripped for a second lookup pass. */
const MALTSTER_PREFIXES = [
  "weyermann",
  "chateau",
  "best",
  "bestmalz",
  "crisp",
  "simpsons",
  "fawcett",
  "thomas fawcett",
  "soufflet",
  "malteries soufflet",
];

interface IndexedMalt {
  normalized: string;
  resolved: ResolvedMalt;
}

let index: IndexedMalt[] | undefined;
let exact: Map<string, ResolvedMalt> | undefined;

/**
 * Memoized {@link lookupMalt} answers, keyed on the *normalized* query.
 *
 * The containment pass is a linear scan over ~350 indexed names, and
 * `findMaltSubstitutes` re-resolves the whole inventory for every missing malt
 * of every recipe — the same handful of names, over and over. Misses are cached
 * too (as `undefined`), because a pantry full of hops and salts is exactly the
 * input that pays the full scan every time.
 *
 * Rebuilt by {@link buildIndex} so the cache can never outlive the index it was
 * derived from.
 */
let lookupCache: Map<string, ResolvedMalt | undefined> | undefined;

function buildIndex(): void {
  const list: IndexedMalt[] = [];
  const map = new Map<string, ResolvedMalt>();
  for (const row of MALT_ROWS) {
    for (const entry of row.malts) {
      const resolved: ResolvedMalt = { entry, row, ebcMid: ebcMidpoint(entry) };
      const normalized = normalizeName(entry.name);
      list.push({ normalized, resolved });
      if (!map.has(normalized)) map.set(normalized, resolved);
      // Also index the bare name so "Caramunich Type 2" finds the Weyermann
      // row, and — critically — so the containment pass can see it. Real
      // inventory names are things like "Pilsner Malt" or "Carapils/Carafoam",
      // which contain the bare name but never the maltster-prefixed one.
      for (const prefix of MALTSTER_PREFIXES) {
        if (normalized.startsWith(`${prefix} `)) {
          const bare = normalized.slice(prefix.length + 1);
          if (bare) {
            if (!map.has(bare)) map.set(bare, resolved);
            list.push({ normalized: bare, resolved });
          }
        }
      }
    }
  }
  // Longest names first so "caramunich type 2" wins over "caramunich".
  list.sort((a, b) => b.normalized.length - a.normalized.length);
  index = list;
  exact = map;
  lookupCache = new Map();
}

/** Shortest guide name allowed to match by containment. */
const MIN_CONTAINMENT_LENGTH = 4;

/**
 * Markers for grain that was never malted: flaked, torrefied, rolled or raw.
 *
 * These carry no diastatic power and a different character, so they must not
 * resolve onto a malted row — "Torrefied Wheat" and "Wheat Unmalted" both used
 * to land on Weyermann Pale Wheat via the bare `wheat` alias, which would offer
 * raw grain as a stand-in for malt. Same failure the `unmalted` row flag
 * prevents for Roasted Barley.
 *
 * Matched per whole token, never as a raw substring: `raw` occurs inside
 * "Weyermann Ca-raw-heat", which a substring check wrongly disqualified. No
 * guide entry name trips the token form, so the guard can never suppress a
 * legitimate resolution (asserted in the tests).
 */
const UNMALTED_TOKENS = new Set(["unmalted", "rolled", "raw", "green"]);
/** Token prefixes, so "flaked"/"flakes" and "torrefied"/"torrified" all count. */
const UNMALTED_TOKEN_PREFIXES = ["flake", "torref", "torrif"];

/** Whether a name describes unmalted grain rather than malt. */
export function isUnmaltedForm(name: string): boolean {
  const tokens = normalizeName(name).split(" ").filter(Boolean);
  return tokens.some(
    (token) =>
      UNMALTED_TOKENS.has(token) ||
      UNMALTED_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix))
  );
}

/**
 * Resolve a malt name against the guide.
 *
 * Two passes, strictest first: exact normalized name (which also covers bare
 * names with the maltster prefix dropped), then a containment pass so messy
 * real-world names ("Pilsner Malt", "Carapils/Carafoam") still land.
 *
 * Containment is **one-directional on purpose**: the queried name must contain
 * a guide name, never the reverse. Matching a guide name that merely contains
 * the query resolved "Munich I" — a 12–18 EBC base malt — onto "Caramel Munich
 * I" at 131–200 EBC, which would have swapped a crystal malt into a pilsner.
 * Whole-word boundaries and a minimum length keep short names from matching
 * mid-word.
 *
 * Memoized on the normalized query (see {@link lookupCache}); the answer is a
 * pure function of that query, so caching changes nothing but the cost.
 */
export function lookupMalt(name: string): ResolvedMalt | undefined {
  if (!index || !exact || !lookupCache) buildIndex();
  const query = normalizeName(name);
  if (!query) return undefined;

  const cache = lookupCache!;
  // `has`, not a truthiness check: a cached miss is stored as `undefined` and
  // must short-circuit the scan just like a cached hit.
  if (cache.has(query)) return cache.get(query);

  let resolved = resolveByName(query);
  // Unmalted grain never resolves onto a malted row (see UNMALTED_TOKENS).
  if (resolved && isUnmaltedForm(query) && !resolved.row.unmalted) {
    resolved = undefined;
  }
  cache.set(query, resolved);
  return resolved;
}

function resolveByName(query: string): ResolvedMalt | undefined {
  const direct = exact!.get(query);
  if (direct) return direct;

  const padded = ` ${query} `;
  for (const candidate of index!) {
    if (candidate.normalized.length < MIN_CONTAINMENT_LENGTH) continue;
    if (padded.includes(` ${candidate.normalized} `)) return candidate.resolved;
  }
  return undefined;
}

interface ClassKeywords {
  maltClass: MaltClass;
  /**
   * Whole-word keywords. Multi-word entries ("pale ale", "roasted barley")
   * match a consecutive run of tokens, never a scattered one.
   */
  words: readonly string[];
  /**
   * Token *prefixes*, for the keywords whose real-world forms are inflected or
   * compounded: "oat"/"oats", "melanoid"/"melanoidin", "dextrin"/"dextrine",
   * "roast"/"roasted", "cara"/"carapils", "weizen"/"weizenmalz",
   * "pilsen"/"pilsener". These are the only keywords allowed to match a
   * prefix of a token, and none of them is a word that means anything else.
   */
  prefixes?: readonly string[];
}

/**
 * Best-effort malt class from name keywords, for inventory items that carry a
 * Brewfather colour but are not in the guide by name (e.g. "Caramel/Crystal
 * Malt 110").
 *
 * Keywords match on whole-word boundaries, the same rule {@link resolveByName}
 * and {@link isUnmaltedForm} already apply. A raw substring check classified
 * "Blackcurrant Puree" as roasted (via "black") and "Buckwheat" as wheat —
 * pure noise fed into the substitution ranking. Anything that genuinely needs
 * to match mid-word is spelled out as a prefix instead.
 *
 * Order matters: the most specific class wins. `wheat` leads, because a wheat
 * token is the strongest signal a name carries and the guide gives wheat its
 * own chocolate, caramel and black rows — "Chocolate Wheat Malt" is a wheat
 * malt, not a roasted one, while plain "Chocolate Malt" still lands on roasted.
 */
const CLASS_KEYWORDS: readonly ClassKeywords[] = [
  { maltClass: "wheat", words: ["wheat", "froment", "blé"], prefixes: ["weizen"] },
  {
    maltClass: "roasted",
    words: ["roasted barley", "black malt", "chocolate", "carafa", "black", "coffee"],
    prefixes: ["roast"],
  },
  {
    maltClass: "caramel",
    words: ["caramunich", "carahell", "carared", "caramel", "crystal", "special b", "special w"],
    prefixes: ["cara"],
  },
  // Its own class in the guide, so it must not fall through to `kilned`:
  // rule 1 blocks cross-class swaps, which would stop a keyword-classified
  // "Melanoidin Malt" ever substituting for the guide's melanoidin row.
  { maltClass: "melanoidin", words: [], prefixes: ["melanoid"] },
  {
    maltClass: "kilned",
    words: ["carafoam", "biscuit", "abbey", "abbaye", "amber", "brown malt"],
    prefixes: ["dextrin"],
  },
  {
    maltClass: "adjunct-grain",
    words: ["rye", "seigle", "spelt", "epeautre", "avoine"],
    prefixes: ["oat"],
  },
  {
    maltClass: "technical",
    words: ["acidulated", "acide", "smoked", "fumé", "peated", "diastatic"],
  },
  {
    maltClass: "base",
    words: ["pilsner", "pale ale", "maris otter", "golden promise", "vienna", "vienne", "munich", "lager", "heidelberg", "base"],
    prefixes: ["pilsen"],
  },
];

export function classifyByKeyword(name: string): MaltClass | undefined {
  const query = normalizeName(name);
  if (!query) return undefined;

  // Padding turns `includes` into a whole-word test, and — because
  // normalizeName collapses separators to single spaces — a multi-word keyword
  // then only matches consecutive tokens.
  const padded = ` ${query} `;
  const tokens = query.split(" ").filter(Boolean);

  for (const { maltClass, words, prefixes } of CLASS_KEYWORDS) {
    for (const word of words) {
      if (padded.includes(` ${normalizeName(word)} `)) return maltClass;
    }
    for (const prefix of prefixes ?? []) {
      const normalized = normalizeName(prefix);
      if (tokens.some((token) => token.startsWith(normalized))) return maltClass;
    }
  }
  return undefined;
}

/**
 * Why two malts are colour-compatible, or `null` when they are not.
 *
 * `overlap` and `within-tolerance` are genuinely different claims — overlapping
 * bands can still be more than 10% apart at the midpoint (Pale Ale 4.5–6.5 vs
 * Château Pale Ale 6–8 overlap but sit 21% apart). The justification copy has
 * to say which one applies rather than asserting ±10% for both.
 */
export type EbcRelation = "overlap" | "within-tolerance";

export function ebcRelation(
  a: { ebcMin: number; ebcMax: number },
  b: { ebcMin: number; ebcMax: number },
  tolerance: number = EBC_TOLERANCE
): EbcRelation | null {
  if (a.ebcMin <= b.ebcMax && b.ebcMin <= a.ebcMax) return "overlap";
  const midA = (a.ebcMin + a.ebcMax) / 2;
  const midB = (b.ebcMin + b.ebcMax) / 2;
  const largest = Math.max(midA, midB);
  if (largest <= 0) return "within-tolerance";
  return Math.abs(midA - midB) / largest <= tolerance ? "within-tolerance" : null;
}

/**
 * Guide rule 2: two malts are colour-compatible when their published bands
 * overlap, or their midpoints sit within {@link EBC_TOLERANCE} of each other.
 */
export function ebcCompatible(
  a: { ebcMin: number; ebcMax: number },
  b: { ebcMin: number; ebcMax: number },
  tolerance: number = EBC_TOLERANCE
): boolean {
  return ebcRelation(a, b, tolerance) !== null;
}

/** Whether two resolved malts sit on the same guide row (direct 1:1 pair). */
export function sameEquivalenceRow(a: ResolvedMalt, b: ResolvedMalt): boolean {
  if (a.row.id === b.row.id) return true;
  return (
    a.row.equivalentRows?.includes(b.row.id) === true ||
    b.row.equivalentRows?.includes(a.row.id) === true
  );
}

/** Guide rule 5 exceptions: pairs never auto-matched despite EBC overlap. */
export function isBlockedPair(a: ResolvedMalt, b: ResolvedMalt): boolean {
  return (
    a.row.neverMatchRows?.includes(b.row.id) === true ||
    b.row.neverMatchRows?.includes(a.row.id) === true
  );
}

/**
 * Whether `candidate` may be offered as a stand-in for `wanted`.
 *
 * Directional: unmalted grain (Roasted Barley) can be replaced by a malted
 * equivalent, but never offered as a replacement *for* one. The guide only
 * sanctions the softening direction — "to soften, substitute with Chocolate
 * Malt" — and unmalted barley brings no diastatic power.
 */
export function mayStandInFor(wanted: ResolvedMalt, candidate: ResolvedMalt): boolean {
  if (!candidate.row.unmalted) return true;
  return candidate.row.id === wanted.row.id;
}

/**
 * Whether two rows are the same cereal. Rows that declare no grain (barley
 * malts, where the class already separates them) never conflict.
 */
export function sameGrain(a: ResolvedMalt, b: ResolvedMalt): boolean {
  if (a.row.grain === undefined || b.row.grain === undefined) return true;
  return a.row.grain === b.row.grain;
}
