/**
 * The transcribed guide tables. These assertions pin the data itself — if a
 * row is mistyped, the substitution engine silently gets subtler, so the
 * dataset is worth testing directly.
 */
import { describe, expect, it } from "vitest";

import {
  EBC_TOLERANCE,
  MALT_ROWS,
  classifyByKeyword,
  ebcCompatible,
  ebcRelation,
  isBlockedPair,
  isUnmaltedForm,
  lookupMalt,
  sameEquivalenceRow,
} from "@/lib/matcher/malt-equivalents";
import { canSubstitute, resolveMaltProfile } from "@/lib/matcher/substitutions";

describe("MALT_ROWS data integrity", () => {
  it("has unique row ids", () => {
    const ids = MALT_ROWS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a sane EBC band on every entry", () => {
    for (const row of MALT_ROWS) {
      expect(row.malts.length).toBeGreaterThan(0);
      for (const malt of row.malts) {
        expect(malt.ebcMin).toBeGreaterThan(0);
        expect(malt.ebcMax).toBeGreaterThanOrEqual(malt.ebcMin);
      }
    }
  });

  it("only cross-references rows that exist", () => {
    const ids = new Set(MALT_ROWS.map((row) => row.id));
    for (const row of MALT_ROWS) {
      for (const ref of [
        ...(row.equivalentRows ?? []),
        ...(row.neverMatchRows ?? []),
      ]) {
        expect(ids).toContain(ref);
      }
    }
  });
});

describe("lookupMalt", () => {
  it("resolves an exact guide name", () => {
    const found = lookupMalt("Weyermann Caramunich Type 2");
    expect(found?.row.id).toBe("caramel-munich-2");
    expect(found?.ebcMid).toBe(120);
  });

  it("resolves a bare name with the maltster prefix dropped", () => {
    expect(lookupMalt("Caramunich Type 2")?.row.id).toBe("caramel-munich-2");
    expect(lookupMalt("Carapils")?.row.id).toBe("caramel-pils");
  });

  it("resolves messy real-world names by containment", () => {
    expect(lookupMalt("Weyermann Caramunich Type 2 (110-130 EBC)")?.row.id).toBe(
      "caramel-munich-2"
    );
    expect(lookupMalt("Château Pilsen 2RP")?.row.id).toBe("base-pilsen");
  });

  it("normalizes accents so Chateau finds Château", () => {
    expect(lookupMalt("Chateau Cara Ruby")?.row.id).toBe("caramel-red");
  });

  it("puts organic malts on their conventional row", () => {
    expect(lookupMalt("BEST Organic Pilsen")?.row.id).toBe("base-pilsen");
    expect(lookupMalt("Weyermann Organic Vienna")?.row.id).toBe("base-vienna");
  });

  it("returns undefined for a malt the guide does not list", () => {
    expect(lookupMalt("Totally Made Up Malt")).toBeUndefined();
    expect(lookupMalt("")).toBeUndefined();
  });

  // Real Brewfather inventory names, which carry the bare malt name rather
  // than the guide's maltster-prefixed one. These all failed before the bare
  // aliases were added to the containment index.
  it.each([
    ["Pilsner Malt", "base-pilsen"],
    ["German Pilsen", "base-pilsen"],
    ["Gladfield Pilsner Malt", "base-pilsen"],
    ["Chateau Pilsen 2RS", "base-pilsen"],
    ["Carapils/Carafoam", "caramel-pils"],
    ["Vienna Malt", "base-vienna"],
    ["Dark Munich Malt 30L", "base-munich-dark"],
    ["Acidulated Malt", "tech-acid"],
  ])("resolves the real-world name %s", (name, rowId) => {
    expect(lookupMalt(name)?.row.id).toBe(rowId);
  });

  it("never resolves a short name onto a longer, different malt", () => {
    // Regression: "Munich I" (a 12-18 EBC base malt) used to resolve onto
    // "BEST Caramel Munich I" at 131-200 EBC, which would swap a crystal malt
    // into a pilsner. It must land on a base row or nowhere.
    const found = lookupMalt("Munich I");
    expect(found?.row.maltClass).toBe("base");

    expect(lookupMalt("Vienna")?.row.maltClass).toBe("base");
    expect(lookupMalt("Wheat")?.row.maltClass).toBe("wheat");
  });

  it("does not match a guide name mid-word", () => {
    // "blackcurrant" must not resolve via "Black".
    expect(lookupMalt("Blackcurrant Puree")).toBeUndefined();
  });
});

describe("lookupMalt memoization", () => {
  // The lookup is memoized on the normalized query because the containment
  // pass scans every indexed guide name and the matcher re-resolves the whole
  // inventory once per missing malt. These pin that the cache cannot change an
  // answer: hits, misses, and the unmalted guard all survive a repeat.
  it("returns the same result for a repeated hit", () => {
    const first = lookupMalt("Weyermann Caramunich Type 2");
    const second = lookupMalt("Weyermann Caramunich Type 2");
    expect(first?.row.id).toBe("caramel-munich-2");
    expect(second).toBe(first);
  });

  it("shares one answer across names that normalize alike", () => {
    expect(lookupMalt("Château Roasted Barley")).toBe(
      lookupMalt("chateau  roasted barley!")
    );
  });

  it("caches a miss without ever turning it into a hit", () => {
    expect(lookupMalt("Totally Made Up Malt")).toBeUndefined();
    expect(lookupMalt("Totally Made Up Malt")).toBeUndefined();
  });

  it("keeps a hit and a miss on the same stem apart", () => {
    // "Flaked Wheat" is suppressed by the unmalted guard while "Pale Wheat"
    // resolves — a cache keyed on anything coarser would collapse the two.
    for (let pass = 0; pass < 2; pass += 1) {
      expect(lookupMalt("Weyermann Pale Wheat")?.row.id).toBe("wheat-pale");
      expect(lookupMalt("Flaked Wheat")).toBeUndefined();
    }
  });
});

describe("unmalted grain never resolves onto a malted row", () => {
  // Regression: the bare `wheat` alias made "Torrefied Wheat" and
  // "Wheat Unmalted" resolve to Weyermann Pale Wheat, offering raw grain as a
  // stand-in for malt — no diastatic power, same failure rule 5 guards against
  // for Roasted Barley.
  it.each([
    "Torrefied Wheat",
    "Wheat Unmalted",
    "Unmalted Wheat",
    "Flaked Wheat",
    "Rolled Oats",
    "Raw Wheat",
  ])("refuses to resolve %s", (name) => {
    expect(isUnmaltedForm(name)).toBe(true);
    expect(lookupMalt(name)).toBeUndefined();
  });

  it("still resolves Roasted Barley, which is unmalted by definition", () => {
    expect(lookupMalt("Château Roasted Barley")?.row.id).toBe("roasted-barley");
  });

  it("leaves ordinary malt names untouched", () => {
    for (const name of ["Pilsner Malt", "Weyermann Pale Wheat", "Vienna Malt"]) {
      expect(isUnmaltedForm(name)).toBe(false);
      expect(lookupMalt(name)).toBeDefined();
    }
  });

  it("carries no unmalted marker in any guide entry name", () => {
    // Proves the guard can never suppress a legitimate resolution.
    for (const row of MALT_ROWS) {
      for (const entry of row.malts) {
        expect(isUnmaltedForm(entry.name)).toBe(false);
      }
    }
  });
});

describe("ebcRelation", () => {
  it("reports overlap separately from the 10% band", () => {
    // Pale Ale vs Château Pale Ale: bands overlap but midpoints are 21% apart.
    expect(ebcRelation({ ebcMin: 4.5, ebcMax: 6.5 }, { ebcMin: 6, ebcMax: 8 })).toBe(
      "overlap"
    );
    expect(
      ebcRelation({ ebcMin: 120, ebcMax: 120 }, { ebcMin: 130, ebcMax: 130 })
    ).toBe("within-tolerance");
    expect(
      ebcRelation({ ebcMin: 90, ebcMax: 90 }, { ebcMin: 120, ebcMax: 120 })
    ).toBeNull();
  });
});

describe("ebcCompatible", () => {
  it("accepts overlapping bands", () => {
    expect(ebcCompatible({ ebcMin: 110, ebcMax: 130 }, { ebcMin: 100, ebcMax: 120 })).toBe(true);
  });

  it("accepts midpoints within the tolerance", () => {
    // 120 vs 130 -> 7.7% apart.
    expect(ebcCompatible({ ebcMin: 120, ebcMax: 120 }, { ebcMin: 130, ebcMax: 130 })).toBe(true);
  });

  it("rejects midpoints beyond the tolerance", () => {
    // 90 vs 120 -> 25% apart, bands do not overlap.
    expect(ebcCompatible({ ebcMin: 90, ebcMax: 90 }, { ebcMin: 120, ebcMax: 120 })).toBe(false);
  });

  it("honors a caller-supplied tolerance", () => {
    expect(
      ebcCompatible({ ebcMin: 90, ebcMax: 90 }, { ebcMin: 120, ebcMax: 120 }, 0.3)
    ).toBe(true);
  });

  it("uses a 10% default", () => {
    expect(EBC_TOLERANCE).toBe(0.1);
  });
});

describe("guide cross-references", () => {
  it("treats Carapils and Carafoam/Dextrine as the same malt (practical note)", () => {
    const carapils = lookupMalt("Weyermann Carapils")!;
    const carafoam = lookupMalt("Weyermann Carafoam")!;
    expect(carapils.row.id).not.toBe(carafoam.row.id);
    expect(sameEquivalenceRow(carapils, carafoam)).toBe(true);
  });

  it("never auto-matches Roasted Barley to Black Malt (rule 5)", () => {
    const roastedBarley = lookupMalt("Château Roasted Barley")!;
    const black = lookupMalt("Crisp Black Malt")!;
    expect(ebcCompatible(roastedBarley.entry, black.entry)).toBe(true);
    expect(isBlockedPair(roastedBarley, black)).toBe(true);
  });

  it("still allows Roasted Barley to pair with Chocolate (rule 5 remedy)", () => {
    const roastedBarley = lookupMalt("Château Roasted Barley")!;
    const chocolate = lookupMalt("Crisp Chocolate Malt")!;
    expect(isBlockedPair(roastedBarley, chocolate)).toBe(false);
  });
});

describe("classifyByKeyword", () => {
  it.each([
    ["Caramel/Crystal Malt 110", "caramel"],
    ["Dark Crystal 400", "caramel"],
    ["Pilsner Malt", "base"],
    ["Light Munich Malt", "base"],
    ["Chocolate Malt", "roasted"],
    ["Roasted Barley", "roasted"],
    ["Torrefied Wheat", "wheat"],
    ["Flaked Oats", "adjunct-grain"],
    ["Acidulated Malt", "technical"],
  ])("classifies %s as %s", (name, expected) => {
    expect(classifyByKeyword(name)).toBe(expected);
  });

  it("returns undefined for something that is not a malt", () => {
    expect(classifyByKeyword("Calcium Chloride")).toBeUndefined();
  });

  it("classifies melanoidin as its own class, not kilned", () => {
    // The guide gives melanoidin its own row/class. Falling through to kilned
    // meant a keyword-classified "Melanoidin Malt" could never substitute for
    // a guide-resolved one, because rule 1 blocks cross-class swaps.
    expect(classifyByKeyword("Melanoidin Malt")).toBe("melanoidin");
    expect(classifyByKeyword("Melanoidin")).toBe("melanoidin");
    expect(canSubstitute(
      resolveMaltProfile("Weyermann Melanoidin")!,
      resolveMaltProfile("Some Melanoidin Malt", 70)!
    )).toBe(true);
  });

  it("matches keywords on whole words, never mid-word", () => {
    // Regression: a substring check made every one of these a malt — "black"
    // inside "blackcurrant" and "blackberry", "wheat" inside "buckwheat" —
    // feeding fruit and adjuncts into the substitution ranking.
    expect(classifyByKeyword("Blackcurrant Puree")).toBeUndefined();
    expect(classifyByKeyword("Blackberry Extract")).toBeUndefined();
    expect(classifyByKeyword("Buckwheat Honey")).toBeUndefined();
    // The words themselves still classify.
    expect(classifyByKeyword("Chocolate Malt")).toBe("roasted");
    expect(classifyByKeyword("Black Malt")).toBe("roasted");
  });

  it("still matches multi-word keywords, but only across consecutive tokens", () => {
    expect(classifyByKeyword("Roasted Barley")).toBe("roasted");
    expect(classifyByKeyword("Pale Ale Malt")).toBe("base");
    expect(classifyByKeyword("Golden Promise")).toBe("base");
    expect(classifyByKeyword("Château Special B")).toBe("caramel");
    expect(classifyByKeyword("Simpsons Brown Malt")).toBe("kilned");
    // "pale ale" must not match across the intervening word.
    expect(classifyByKeyword("Pale Golden Ale")).toBeUndefined();
  });

  it("lets a wheat token win over the roast keywords", () => {
    // The guide has wheat-chocolate, wheat-caramel and wheat-black rows, so a
    // wheat malt stays a wheat malt however dark it is — class order used to
    // hand "Chocolate Wheat Malt" to roasted, which then offered barley
    // chocolate malt as a substitute for it.
    expect(classifyByKeyword("Chocolate Wheat Malt")).toBe("wheat");
    expect(classifyByKeyword("Roasted Wheat")).toBe("wheat");
    expect(classifyByKeyword("Black Wheat Malt")).toBe("wheat");
    // ... while non-wheat names keep their old class.
    expect(classifyByKeyword("Chocolate Malt")).toBe("roasted");
    expect(classifyByKeyword("Roasted Barley")).toBe("roasted");
  });

  it("classifies inflected and compounded forms via token prefixes", () => {
    expect(classifyByKeyword("Oatmeal Malt")).toBe("adjunct-grain");
    expect(classifyByKeyword("Dextrine Malt")).toBe("kilned");
    expect(classifyByKeyword("Weizenmalz Hell")).toBe("wheat");
    expect(classifyByKeyword("Pilsener Malt")).toBe("base");
  });
});
