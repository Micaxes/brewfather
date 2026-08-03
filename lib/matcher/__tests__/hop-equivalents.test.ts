/**
 * The transcribed hop chart. These assertions pin the data itself — a mistyped
 * alpha figure produces a silently wrong substitution weight rather than a
 * visible failure, so the dataset is worth testing directly.
 */
import { describe, expect, it } from "vitest";

import {
  HOP_NAME_ALIASES,
  HOP_VARIETIES,
  type HopEntry,
  type HopRange,
  SUBSTITUTES_NOT_IN_CHART,
  alphaMidpoint,
  bitternessEquivalentAmount,
  bitternessEquivalentFactor,
  lookupHop,
  reverseSubstitutesFor,
  substitutesFor,
  suitableFor,
} from "@/lib/matcher/hop-equivalents";
import { normalizeName } from "@/lib/matcher/normalize";

/** Every optional band on an entry, for the range-sanity sweep. */
function optionalRanges(entry: HopEntry): [string, HopRange | undefined][] {
  return [
    ["beta", entry.beta],
    ["oil", entry.oil],
    ["cohumulone", entry.cohumulone],
    ["myrcene", entry.myrcene],
    ["humulene", entry.humulene],
    ["caryophyllene", entry.caryophyllene],
    ["farnesene", entry.farnesene],
  ];
}

describe("HOP_VARIETIES data integrity", () => {
  it("transcribes every row of the chart", () => {
    // The chart's own header says "68 hop varieties"; its tables hold 70. The
    // count is pinned so a dropped row during a re-transcription is loud.
    expect(HOP_VARIETIES).toHaveLength(70);
  });

  it("has unique names, before and after normalization", () => {
    const names = HOP_VARIETIES.map((hop) => hop.name);
    expect(new Set(names).size).toBe(names.length);
    const normalized = names.map(normalizeName);
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it("has a sane alpha band on every variety", () => {
    for (const hop of HOP_VARIETIES) {
      expect(hop.alpha.min, hop.name).toBeGreaterThan(0);
      expect(hop.alpha.max, hop.name).toBeGreaterThanOrEqual(hop.alpha.min);
      // Nothing in the chart is anywhere near 30% alpha; a decimal-point slip
      // during transcription is what this catches.
      expect(hop.alpha.max, hop.name).toBeLessThan(30);
    }
  });

  it("has a sane band on every optional figure that is present", () => {
    for (const hop of HOP_VARIETIES) {
      for (const [field, range] of optionalRanges(hop)) {
        if (range === undefined) continue;
        const where = `${hop.name}.${field}`;
        expect(range.max, where).toBeGreaterThanOrEqual(0);
        if (range.min !== undefined) {
          // The whole reason Mistral's humulene is omitted: an inverted range
          // is unreadable, so none may survive into the dataset.
          expect(range.min, where).toBeLessThanOrEqual(range.max);
          expect(range.min, where).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("omits the two figures the chart does not state readably", () => {
    // Blank cell in the source.
    expect(lookupHop("Elixir")?.farnesene).toBeUndefined();
    // Prints as "9.5-1.8" — an inverted range, so it is not guessed at.
    expect(lookupHop("Mistral")?.humulene).toBeUndefined();
    // Both varieties still carry the figures the chart does state.
    expect(lookupHop("Elixir")?.caryophyllene).toEqual({ min: 0.1, max: 0.2 });
    expect(lookupHop("Mistral")?.myrcene).toEqual({ min: 29, max: 39 });
  });

  it("records upper-bound-only cells without inventing a lower bound", () => {
    // The chart writes Aramis' cohumulone as "<40": the floor is unstated.
    expect(lookupHop("Aramis")?.cohumulone).toEqual({ max: 40 });
    expect(lookupHop("Aramis")?.cohumulone?.min).toBeUndefined();
  });

  it("always has a type, styles and an aroma profile", () => {
    for (const hop of HOP_VARIETIES) {
      expect(["bitter", "aroma", "dual"], hop.name).toContain(hop.type);
      expect(hop.styles.length, hop.name).toBeGreaterThan(0);
      expect(hop.aroma.length, hop.name).toBeGreaterThan(0);
      expect(hop.origin.length, hop.name).toBeGreaterThan(0);
    }
  });

  it("resolves every substitute name, or declares it absent from the chart", () => {
    const declared = new Set(SUBSTITUTES_NOT_IN_CHART);
    for (const hop of HOP_VARIETIES) {
      for (const name of hop.substitutes) {
        const resolved = lookupHop(name);
        if (resolved) continue;
        // Anything unresolvable must be a known gap in the source, never a
        // typo that quietly drops a suggestion.
        expect(declared, `${hop.name} -> ${name}`).toContain(name);
      }
    }
  });

  it("keeps SUBSTITUTES_NOT_IN_CHART free of stale entries", () => {
    const printed = new Set(
      HOP_VARIETIES.flatMap((hop) => [...hop.substitutes])
    );
    for (const name of SUBSTITUTES_NOT_IN_CHART) {
      // Still named by the chart...
      expect(printed, name).toContain(name);
      // ...and still genuinely absent as a variety.
      expect(lookupHop(name), name).toBeUndefined();
    }
  });

  it("points every alias at a real variety", () => {
    for (const [alias, canonical] of Object.entries(HOP_NAME_ALIASES)) {
      const target = HOP_VARIETIES.find((hop) => hop.name === canonical);
      expect(target, alias).toBeDefined();
      expect(lookupHop(alias)?.name, alias).toBe(canonical);
    }
  });

  it("gives every variety a name long enough to match by containment", () => {
    // MIN_CONTAINMENT_LENGTH is 4, so a shorter name could never be found in a
    // messy inventory string. "Saaz" and "Opal" are the shortest in the chart.
    for (const hop of HOP_VARIETIES) {
      expect(normalizeName(hop.name).length, hop.name).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("lookupHop", () => {
  it("resolves an exact chart name", () => {
    expect(lookupHop("Citra")?.name).toBe("Citra");
    expect(lookupHop("Nelson Sauvin")?.origin).toBe("NZ");
  });

  it("ignores case, punctuation and diacritics", () => {
    expect(lookupHop("  citra  ")?.name).toBe("Citra");
    // The chart's Crystal row names "Hallertau Hersbrücker"; the variety row
    // spells it without the umlaut. Normalization reconciles the two.
    expect(lookupHop("Hallertau Hersbrücker")?.name).toBe(
      "Hallertau Hersbrucker"
    );
  });

  it("resolves messy real-world inventory names", () => {
    expect(lookupHop("Citra (US) - Pellets")?.name).toBe("Citra");
    expect(lookupHop("Cascade Leaf 2024")?.name).toBe("Cascade");
    expect(lookupHop("Nelson Sauvin T90 Pellet 100g")?.name).toBe(
      "Nelson Sauvin"
    );
  });

  it("resolves the hops actually stocked, and only those in the chart", () => {
    const stocked = [
      "Motueka",
      "El Dorado",
      "Mosaic",
      "Citra",
      "Simcoe",
      "Cascade",
      "Amarillo",
      "Chinook",
      "Magnum",
      "Saaz",
      "Columbus",
      "Nelson Sauvin",
    ];
    for (const name of stocked) {
      expect(lookupHop(name)?.name, name).toBe(name);
    }
  });

  it("does not invent the stocked hops the chart never describes", () => {
    // "Warrior" appears nowhere in the source at all.
    expect(lookupHop("Warrior")).toBeUndefined();
    // "Ahtanum" is named twice as a substitute but has no row of its own, so
    // there is no alpha figure for it and none may be fabricated.
    expect(lookupHop("Ahtanum")).toBeUndefined();
    expect(SUBSTITUTES_NOT_IN_CHART).toContain("Ahtanum");
  });

  it("matches containment one-directionally only", () => {
    // The query may CONTAIN a chart name. The reverse — a chart name that
    // merely contains the query — is rejected, because a fragment is
    // ambiguous between varieties with very different alphas.
    expect(lookupHop("Hallertau")).toBeUndefined(); // 8 Hallertau varieties
    expect(lookupHop("Styrian")).toBeUndefined(); // 6 Styrian varieties
    expect(lookupHop("Nelson")).toBeUndefined();
    expect(lookupHop("Golding")).toBeUndefined();
  });

  it("never resolves the leading word of a multi-word variety", () => {
    // Generalises the trap above across the whole chart.
    for (const hop of HOP_VARIETIES) {
      const [first, ...rest] = normalizeName(hop.name).split(" ");
      if (rest.length === 0 || first === undefined) continue;
      expect(lookupHop(first), hop.name).toBeUndefined();
    }
  });

  it("prefers the longest chart name contained in the query", () => {
    // "Hallertau Cascade" is a distinct German variety, not Cascade.
    expect(lookupHop("Hallertau Cascade")?.name).toBe("Hallertau Cascade");
    expect(lookupHop("Hallertau Cascade Pellets 2024")?.name).toBe(
      "Hallertau Cascade"
    );
    // The trap the Styrian aliases exist to close: "Styrian Goldings" ends
    // with the chart name "Goldings", a different Belgian hop.
    expect(lookupHop("Styrian Goldings")?.name).toBe("Styrian Goldings Celeia");
    expect(lookupHop("Styrian Goldings")?.name).not.toBe("Goldings");
    expect(lookupHop("Goldings")?.name).toBe("Goldings");
  });

  it("matches whole words, never mid-word", () => {
    // "Saaz" inside a longer token must not resolve.
    expect(lookupHop("Saazer")).toBeUndefined();
    expect(lookupHop("Opalescent")).toBeUndefined();
  });

  it("returns a stable answer when memoized", () => {
    // Second call is served from the lookup cache; misses are cached too.
    expect(lookupHop("Simcoe")).toBe(lookupHop("Simcoe"));
    expect(lookupHop("Warrior")).toBeUndefined();
    expect(lookupHop("Warrior")).toBeUndefined();
  });

  it("returns undefined for empty or junk input", () => {
    expect(lookupHop("")).toBeUndefined();
    expect(lookupHop("   ")).toBeUndefined();
    expect(lookupHop("Protafloc Tablet")).toBeUndefined();
  });
});

describe("substitutesFor (forward — the chart's own column)", () => {
  it("returns the chart's list in printed order", () => {
    const subs = substitutesFor("Citra");
    expect(subs?.resolved.map((hop) => hop.name)).toEqual([
      "Simcoe",
      "Mosaic",
      "Cascade",
      "Centennial",
    ]);
    expect(subs?.unresolved).toEqual([]);
  });

  it("surfaces named substitutes that have no row, rather than dropping them", () => {
    const subs = substitutesFor("Cascade");
    expect(subs?.resolved.map((hop) => hop.name)).toEqual([
      "Centennial",
      "Amarillo",
    ]);
    expect(subs?.unresolved).toEqual(["Ahtanum"]);
  });

  it("returns an empty list where the chart names no substitute", () => {
    // Printed as "-".
    expect(substitutesFor("Huell Melon")?.resolved).toEqual([]);
    expect(substitutesFor("Huell Melon")?.unresolved).toEqual([]);
    // Blank cell rather than "-", but the same meaning.
    expect(substitutesFor("Barbe Rouge")?.resolved).toEqual([]);
  });

  it("returns undefined for a hop that is not in the chart", () => {
    expect(substitutesFor("Warrior")).toBeUndefined();
    expect(substitutesFor("Ahtanum")).toBeUndefined();
  });
});

describe("reverse vs forward substitution (the chart is not symmetric)", () => {
  it("does not read a forward suggestion backwards", () => {
    // Cashmere -> Cascade is printed. Cascade -> Cashmere is NOT.
    expect(substitutesFor("Cashmere")?.resolved.map((h) => h.name)).toEqual([
      "Cascade",
    ]);
    expect(substitutesFor("Cascade")?.resolved.map((h) => h.name)).not.toContain(
      "Cashmere"
    );
    // The reverse direction is available, but only by asking for it.
    expect(reverseSubstitutesFor("Cascade").map((h) => h.name)).toContain(
      "Cashmere"
    );
  });

  it("finds the parents of a name with no row of its own", () => {
    // Nothing here describes Ahtanum, yet the chart still tells us which
    // varieties accept it as a stand-in.
    expect(reverseSubstitutesFor("Ahtanum").map((hop) => hop.name)).toEqual([
      "Cascade",
      "Triskel",
    ]);
  });

  it("folds alias spellings into the reverse lookup", () => {
    // The chart names this one hop three ways across its Substitutes column:
    // "Styrian Goldings", "Styrian Golding" and "Celeia".
    const parents = reverseSubstitutesFor("Styrian Goldings Celeia").map(
      (hop) => hop.name
    );
    expect(parents).toEqual([
      "Bobek",
      "Fuggles",
      "Goldings",
      "Styrian Aurora",
      "Styrian Dana",
      "Willamette",
    ]);
  });

  it("returns an empty list for a name nothing points at", () => {
    expect(reverseSubstitutesFor("Warrior")).toEqual([]);
    expect(reverseSubstitutesFor("")).toEqual([]);
  });

  it("de-duplicates and keeps chart order", () => {
    const parents = reverseSubstitutesFor("Saaz");
    expect(new Set(parents).size).toBe(parents.length);
    const order = parents.map((hop) => HOP_VARIETIES.indexOf(hop));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe("bitterness equivalence", () => {
  it("takes the midpoint of the published alpha band", () => {
    expect(alphaMidpoint(lookupHop("Cascade")!)).toBeCloseTo(6.7, 10); // 4.5-8.9
    expect(alphaMidpoint(lookupHop("Magnum")!)).toBe(12.5); // 10-15
  });

  it("scales weight by the alpha ratio", () => {
    // Magnum midpoints at 12.5%, Cascade at 6.7%: you need ~1.87x the weight
    // of Cascade to land the same bitterness.
    const grams = bitternessEquivalentAmount("Magnum", 100, "Cascade");
    expect(grams).toBeCloseTo((12.5 * 100) / 6.7, 6);
    expect(grams).toBeCloseTo(186.567, 3);
  });

  it("is 1:1 when the midpoints agree", () => {
    // Chinook 11-15, Simcoe 12-14 and Citra 10-16 all midpoint at 13%.
    expect(bitternessEquivalentFactor("Chinook", "Simcoe")).toBeCloseTo(1, 10);
    expect(bitternessEquivalentAmount("Simcoe", 42, "Citra")).toBeCloseTo(42, 10);
  });

  it("handles the extreme swap the range exists to catch", () => {
    // Apollo 15-19 (mid 17) for Strisselspalt 1.8-2.5 (mid 2.15): swapping at
    // equal weight would have been ~8x the bitterness.
    expect(bitternessEquivalentAmount("Apollo", 30, "Strisselspalt")).toBeCloseTo(
      (17 * 30) / 2.15,
      6
    );
    expect(bitternessEquivalentFactor("Apollo", "Strisselspalt")).toBeGreaterThan(
      7
    );
  });

  it("round-trips", () => {
    const forward = bitternessEquivalentAmount("Saaz", 60, "Columbus")!;
    expect(bitternessEquivalentAmount("Columbus", forward, "Saaz")).toBeCloseTo(
      60,
      10
    );
  });

  it("is unit-agnostic and linear in the amount", () => {
    const one = bitternessEquivalentAmount("Magnum", 1, "Cascade")!;
    expect(bitternessEquivalentAmount("Magnum", 250, "Cascade")).toBeCloseTo(
      one * 250,
      10
    );
  });

  it("accepts entries as well as names", () => {
    const magnum = lookupHop("Magnum")!;
    const cascade = lookupHop("Cascade")!;
    expect(bitternessEquivalentAmount(magnum, 100, cascade)).toBe(
      bitternessEquivalentAmount("Magnum", 100, "Cascade")
    );
  });

  it("returns undefined rather than a wrong number for unknown hops", () => {
    // Warrior has no alpha figure here, so no weight can be offered for it.
    expect(bitternessEquivalentAmount("Warrior", 100, "Magnum")).toBeUndefined();
    expect(bitternessEquivalentAmount("Magnum", 100, "Warrior")).toBeUndefined();
    expect(bitternessEquivalentAmount("Ahtanum", 100, "Cascade")).toBeUndefined();
    expect(bitternessEquivalentFactor("Magnum", "Warrior")).toBeUndefined();
  });

  it("returns undefined for a non-finite amount", () => {
    expect(
      bitternessEquivalentAmount("Magnum", Number.NaN, "Cascade")
    ).toBeUndefined();
  });

  it("produces a usable weight for every pair in the chart", () => {
    // No entry may have a zero or missing alpha midpoint, which is the
    // precondition the maths relies on.
    for (const hop of HOP_VARIETIES) {
      expect(alphaMidpoint(hop), hop.name).toBeGreaterThan(0);
      expect(
        bitternessEquivalentAmount("Magnum", 100, hop),
        hop.name
      ).toBeGreaterThan(0);
    }
  });
});

describe("suitableFor", () => {
  it("lets dual-purpose hops serve either role", () => {
    const citra = lookupHop("Citra")!;
    expect(citra.type).toBe("dual");
    expect(suitableFor(citra, "bittering")).toBe(true);
    expect(suitableFor(citra, "aroma")).toBe(true);
  });

  it("keeps single-purpose hops in their own role", () => {
    const apollo = lookupHop("Apollo")!; // Bitter
    expect(suitableFor(apollo, "bittering")).toBe(true);
    expect(suitableFor(apollo, "aroma")).toBe(false);

    const saaz = lookupHop("Saaz")!; // Aroma
    expect(suitableFor(saaz, "aroma")).toBe(true);
    expect(suitableFor(saaz, "bittering")).toBe(false);
  });
});
