/**
 * The transcribed malt comparison chart. Same reasoning as the equivalence
 * tables: a mistyped number here never throws, it just produces a subtly wrong
 * substitution suggestion months later, so the dataset is pinned directly.
 *
 * Three things get more attention than the rest:
 *   - diastatic power, because 0 is what makes a grain unable to stand in for
 *     a malt and the whole point of adding this table;
 *   - `maxPercent`, because breaching a dosage ceiling is a bad suggestion
 *     however well the colour matches;
 *   - the colour conversion, which the chart states and then contradicts.
 */
import { describe, expect, it } from "vitest";

import {
  ADJUNCT_CONVERTING_LINTNER,
  EBC_PER_SRM,
  MALT_CATEGORY_LABEL,
  MALT_PROFILES,
  type MaltCategory,
  type MaltReferenceProfile,
  SELF_CONVERTING_LINTNER,
  canConvertAdjuncts,
  ebcToLovibond,
  ebcToSrm,
  exceedsMaxPercent,
  hasDiastaticPower,
  isSelfConverting,
  lookupMaltProfile,
  lovibondToEbc,
  midpoint,
  srmToEbc,
} from "@/lib/matcher/malt-profiles";
import { normalizeName } from "@/lib/matcher/normalize";

function profile(id: string): MaltReferenceProfile {
  const found = MALT_PROFILES.find((entry) => entry.id === id);
  if (!found) throw new Error(`no profile with id "${id}"`);
  return found;
}

describe("MALT_PROFILES data integrity", () => {
  it("carries every row of the chart", () => {
    // The chart's header line says 52; the table itself prints 53. If a future
    // edit drops or duplicates a row this is the assertion that notices.
    expect(MALT_PROFILES).toHaveLength(53);
  });

  it("has unique ids and unique names", () => {
    const ids = MALT_PROFILES.map((entry) => entry.id);
    const names = MALT_PROFILES.map((entry) => entry.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses only the chart's six categories, and all of them", () => {
    const used = new Set(MALT_PROFILES.map((entry) => entry.category));
    expect([...used].sort()).toEqual(
      (Object.keys(MALT_CATEGORY_LABEL) as MaltCategory[]).sort()
    );
  });

  it("has a sane EBC band on every row", () => {
    for (const entry of MALT_PROFILES) {
      // Rice Hulls really is 0 EBC — husk, no colour — so the floor is 0, not 1.
      expect(entry.ebc.min).toBeGreaterThanOrEqual(0);
      expect(entry.ebc.max).toBeGreaterThanOrEqual(entry.ebc.min);
      // Nothing in the chart is darker than De-bittered Black at 1600.
      expect(entry.ebc.max).toBeLessThanOrEqual(1600);
    }
  });

  it("has sane Lovibond, extract, moisture and protein figures", () => {
    for (const entry of MALT_PROFILES) {
      expect(entry.lovibond.max).toBeGreaterThanOrEqual(entry.lovibond.min);
      expect(entry.lovibond.min).toBeGreaterThanOrEqual(0);
      // Maris Otter tops the extract table at 38 PPG; Rice Hulls contribute 0.
      expect(entry.ppg).toBeGreaterThanOrEqual(0);
      expect(entry.ppg).toBeLessThanOrEqual(38);
      expect(entry.moisturePercent.max).toBeGreaterThanOrEqual(
        entry.moisturePercent.min
      );
      expect(entry.proteinPercent.max).toBeGreaterThanOrEqual(
        entry.proteinPercent.min
      );
    }
  });

  it("states a dosage ceiling on every row", () => {
    for (const entry of MALT_PROFILES) {
      expect(entry.maxPercent).toBeGreaterThan(0);
      expect(entry.maxPercent).toBeLessThanOrEqual(100);
    }
  });

  it("pins the ceilings that most constrain a substitution", () => {
    // Named in the chart and easy to breach with a colour-only match.
    expect(profile("special-b").maxPercent).toBe(10);
    expect(profile("rice-hulls").maxPercent).toBe(10);
    expect(profile("roasted-barley").maxPercent).toBe(10);
    // The two tightest rows in the whole chart.
    expect(profile("caraaroma").maxPercent).toBe(5);
    expect(profile("black-patent-malt").maxPercent).toBe(5);
    // ... against a base malt, which has no meaningful ceiling.
    expect(profile("pilsner-malt").maxPercent).toBe(100);
  });

  it("carries a diastatic power figure on every base malt", () => {
    const base = MALT_PROFILES.filter((entry) => entry.category === "base");
    expect(base).toHaveLength(18);
    for (const entry of base) {
      expect(Number.isFinite(entry.diastaticPower.min)).toBe(true);
      expect(Number.isFinite(entry.diastaticPower.max)).toBe(true);
      expect(entry.diastaticPower.min).toBeGreaterThanOrEqual(0);
      expect(entry.diastaticPower.max).toBeGreaterThanOrEqual(
        entry.diastaticPower.min
      );
    }
  });

  it("gives no non-base malt any enzymes at all", () => {
    // Every caramel, roasted, wheat, specialty and adjunct row in the chart is
    // 0 °Lintner. If one ever isn't, the mash-requirement invariant below is
    // the thing that would quietly stop being true.
    for (const entry of MALT_PROFILES) {
      if (entry.category === "base") continue;
      expect(entry.diastaticPower).toEqual({ min: 0, max: 0 });
    }
  });

  it("only requires a mash where the chart says so, and only for base malts", () => {
    for (const entry of MALT_PROFILES) {
      if (entry.mashRequired) expect(entry.category).toBe("base");
      // The converse holds too: nothing with enzymes is mash-optional.
      if (hasDiastaticPower(entry)) expect(entry.mashRequired).toBe(true);
    }
  });

  it("keeps flavor, styles and notes prose on every row", () => {
    for (const entry of MALT_PROFILES) {
      expect(entry.flavor.length).toBeGreaterThan(0);
      expect(entry.styles.length).toBeGreaterThan(0);
      expect(entry.notes.length).toBeGreaterThan(0);
      // The chart prints "-" for an absent cross-reference; that must have
      // become an omitted field, never a literal dash.
      expect(entry.weyermann?.name).not.toBe("-");
      expect(entry.briess?.name).not.toBe("-");
    }
  });
});

describe("diastatic power", () => {
  it("separates no enzymes from weak enzymes from surplus", () => {
    // 0 - cannot convert even itself.
    expect(hasDiastaticPower(profile("flaked-barley"))).toBe(false);
    expect(hasDiastaticPower(profile("roasted-barley"))).toBe(false);
    expect(hasDiastaticPower(profile("acidulated-malt"))).toBe(false);
    // 120-160 - converts itself and adjuncts besides.
    const twoRow = profile("two-row-pale-us");
    expect(hasDiastaticPower(twoRow)).toBe(true);
    expect(isSelfConverting(twoRow)).toBe(true);
    expect(canConvertAdjuncts(twoRow)).toBe(true);
  });

  it("reads Dark Wheat Malt's band-spanning-zero conservatively", () => {
    // 0-30: the top of the band has some enzymes, the bottom has none, and it
    // never clears the self-converting threshold. Treating the midpoint as the
    // answer would call it enzymatic.
    const darkWheat = profile("dark-wheat-malt");
    expect(darkWheat.diastaticPower).toEqual({ min: 0, max: 30 });
    expect(hasDiastaticPower(darkWheat)).toBe(true);
    expect(isSelfConverting(darkWheat)).toBe(false);
  });

  it("puts 6-Row above 2-Row, as the chart's note claims", () => {
    // "Higher protein & enzymes than 2-row" - the numbers have to agree with
    // the prose or one of the two was mistyped.
    const six = profile("six-row-pale-us");
    const two = profile("two-row-pale-us");
    expect(six.diastaticPower.min).toBeGreaterThan(two.diastaticPower.min);
    expect(six.proteinPercent.min).toBeGreaterThan(two.proteinPercent.min);
  });

  it("uses the chart's own footnote thresholds", () => {
    expect(SELF_CONVERTING_LINTNER).toBe(35);
    expect(ADJUNCT_CONVERTING_LINTNER).toBe(70);
    // Munich II at 30-60 converts itself but has nothing spare for adjuncts.
    const munich = profile("munich-malt-2");
    expect(isSelfConverting(munich)).toBe(false);
    expect(canConvertAdjuncts(munich)).toBe(false);
    expect(hasDiastaticPower(munich)).toBe(true);
  });

  it("finds every zero-enzyme grain the equivalence guide calls unmalted", () => {
    // The `unmalted` boolean in malt-equivalents.ts flags two things: roasted
    // barley and raw oats. Diastatic power flags all of them, which is the
    // point of adding this table.
    for (const id of [
      "roasted-barley",
      "flaked-oats",
      "flaked-barley",
      "flaked-wheat",
      "flaked-rye",
      "flaked-rice",
      "flaked-corn-maize",
      "torrified-wheat",
      "rice-hulls",
    ]) {
      expect(hasDiastaticPower(profile(id))).toBe(false);
      expect(profile(id).mashRequired).toBe(false);
    }
  });
});

describe("exceedsMaxPercent", () => {
  it("accepts a dose at the ceiling and rejects one above it", () => {
    const specialB = profile("special-b");
    expect(exceedsMaxPercent(specialB, 10)).toBe(false);
    expect(exceedsMaxPercent(specialB, 10.1)).toBe(true);
    expect(exceedsMaxPercent(profile("pilsner-malt"), 100)).toBe(false);
  });
});

describe("EBC / Lovibond conversion", () => {
  it("implements the formula the chart states", () => {
    // °L = (EBC + 1.2) / 2.65
    expect(ebcToLovibond(100)).toBeCloseTo(38.19, 2);
    expect(lovibondToEbc(40)).toBeCloseTo(104.8, 2);
  });

  it("round-trips in both directions", () => {
    for (const ebc of [0, 3, 20, 130, 260, 1500]) {
      expect(lovibondToEbc(ebcToLovibond(ebc))).toBeCloseTo(ebc, 10);
    }
    for (const lov of [1.5, 25, 60, 120, 650]) {
      expect(ebcToLovibond(lovibondToEbc(lov))).toBeCloseTo(lov, 10);
    }
  });

  it("does NOT reproduce the chart's own Crystal 60L and 120L rows", () => {
    // The two US crystal malts are named for their Lovibond rating, so their
    // EBC bands pin the true relation. The chart's stated formula misses both
    // by roughly a quarter. This assertion exists to stop anyone "fixing" the
    // data to match the formula: the rows are right, the footnote is not.
    const crystal60 = profile("crystal-malt-60l");
    expect(crystal60.ebc).toEqual({ min: 115, max: 130 });
    expect(crystal60.lovibond).toEqual({ min: 60, max: 60 });
    expect(ebcToLovibond(crystal60.ebc.min)).toBeCloseTo(43.85, 2);
    expect(ebcToLovibond(crystal60.ebc.max)).toBeCloseTo(49.51, 2);
    // Even the darkest end of the band is more than 10% short of 60.
    expect(ebcToLovibond(crystal60.ebc.max)).toBeLessThan(60 * 0.9);

    const crystal120 = profile("crystal-malt-120l");
    expect(crystal120.ebc).toEqual({ min: 230, max: 260 });
    expect(crystal120.lovibond).toEqual({ min: 120, max: 120 });
    expect(ebcToLovibond(crystal120.ebc.min)).toBeCloseTo(87.25, 2);
    expect(ebcToLovibond(crystal120.ebc.max)).toBeCloseTo(98.57, 2);
    expect(ebcToLovibond(crystal120.ebc.max)).toBeLessThan(120 * 0.9);

    // Inverted, the formula overshoots the published band entirely.
    expect(lovibondToEbc(60)).toBeGreaterThan(crystal60.ebc.max);
    expect(lovibondToEbc(120)).toBeGreaterThan(crystal120.ebc.max);
  });

  it("finds both crystal rows sitting on EBC = SRM x 1.97 instead", () => {
    // The relation already documented in docs/malt-substitutions.md lands
    // inside both published bands, which is why it is the one to reach for
    // when interpreting a bare colour number.
    expect(EBC_PER_SRM).toBe(1.97);
    for (const id of ["crystal-malt-60l", "crystal-malt-120l"]) {
      const entry = profile(id);
      const predicted = srmToEbc(entry.lovibond.min);
      expect(predicted).toBeGreaterThanOrEqual(entry.ebc.min);
      expect(predicted).toBeLessThanOrEqual(entry.ebc.max);
    }
    expect(ebcToSrm(118.2)).toBeCloseTo(60, 5);
  });

  it("agrees with the chart within a few points on the pale rows", () => {
    // The two conversions only diverge as colour climbs, which is how the
    // stated formula survived being written down: Vienna and Dark Wheat land
    // on it exactly.
    const vienna = profile("vienna-malt");
    expect(ebcToLovibond(vienna.ebc.min)).toBeCloseTo(vienna.lovibond.min, 1);
    expect(ebcToLovibond(vienna.ebc.max)).toBeCloseTo(vienna.lovibond.max, 1);
    const darkWheat = profile("dark-wheat-malt");
    expect(ebcToLovibond(darkWheat.ebc.min)).toBeCloseTo(darkWheat.lovibond.min, 0);
    expect(ebcToLovibond(darkWheat.ebc.max)).toBeCloseTo(darkWheat.lovibond.max, 1);
  });

  it("keeps Victory Malt's contradictory colour exactly as printed", () => {
    // 25 °L against 25-30 EBC cannot be right under any conversion. It is
    // transcribed rather than corrected, and pinned here so nobody silently
    // "fixes" it in one column and not the other.
    const victory = profile("victory-malt");
    expect(victory.ebc).toEqual({ min: 25, max: 30 });
    expect(victory.lovibond).toEqual({ min: 25, max: 25 });
    expect(ebcToLovibond(victory.ebc.max)).toBeLessThan(victory.lovibond.min / 2);
  });
});

describe("midpoint", () => {
  it("averages a band and passes a single figure through", () => {
    expect(midpoint(profile("caramunich-2").ebc)).toBe(120);
    expect(midpoint(profile("crystal-malt-60l").lovibond)).toBe(60);
  });
});

describe("maltster cross-references", () => {
  it("preserves the chart's approximate marker rather than flattening it", () => {
    // Carafa Special I is de-bittered; Briess Chocolate is not. The chart marks
    // the pairing with "*" and that caveat has to survive transcription.
    expect(profile("carafa-special-1").briess).toEqual({
      name: "Chocolate",
      approximate: true,
    });
    // ... while an exact counterpart stays exact.
    expect(profile("chocolate-malt").briess).toEqual({
      name: "Chocolate",
      approximate: false,
    });
    expect(profile("chocolate-malt").weyermann).toEqual({
      name: "Carafa II",
      approximate: false,
    });
  });

  it("marks exactly the six pairings the chart asterisks, all of them Briess", () => {
    const approximate = MALT_PROFILES.flatMap((entry) => [
      ...(entry.weyermann?.approximate ? [`${entry.id}:weyermann`] : []),
      ...(entry.briess?.approximate ? [`${entry.id}:briess`] : []),
    ]);
    expect(approximate.sort()).toEqual([
      "caraaroma:briess",
      "carafa-special-1:briess",
      "carafa-special-3:briess",
      "de-bittered-black:briess",
      "pale-chocolate:briess",
      "smoked-malt:briess",
    ]);
  });

  it("omits the cross-reference where the chart prints a dash", () => {
    // Roasted Barley has no Weyermann counterpart in the chart at all.
    expect(profile("roasted-barley").weyermann).toBeUndefined();
    expect(profile("roasted-barley").briess).toEqual({
      name: "Roasted Barley",
      approximate: false,
    });
    // Rice Hulls have neither.
    expect(profile("rice-hulls").weyermann).toBeUndefined();
    expect(profile("rice-hulls").briess).toBeUndefined();
  });
});

describe("lookupMaltProfile", () => {
  it("resolves an exact chart name", () => {
    expect(lookupMaltProfile("Caramunich II")?.id).toBe("caramunich-2");
    expect(lookupMaltProfile("Special B")?.id).toBe("special-b");
  });

  it("is case- and punctuation-insensitive", () => {
    expect(lookupMaltProfile("  CARAMUNICH   II  ")?.id).toBe("caramunich-2");
    expect(lookupMaltProfile("carapils/dextrin")?.id).toBe("carapils-dextrin");
  });

  it("resolves a name with the chart's parenthetical dropped", () => {
    expect(lookupMaltProfile("2-Row Pale")?.id).toBe("two-row-pale-us");
    expect(lookupMaltProfile("Acidulated Malt")?.id).toBe("acidulated-malt");
    expect(lookupMaltProfile("Smoked Malt")?.id).toBe("smoked-malt");
    // ... and still resolves it with the parenthetical present.
    expect(lookupMaltProfile("Smoked Malt (Rauch)")?.id).toBe("smoked-malt");
  });

  it("resolves either half of a slashed chart name", () => {
    expect(lookupMaltProfile("Carapils")?.id).toBe("carapils-dextrin");
    expect(lookupMaltProfile("Dextrin")?.id).toBe("carapils-dextrin");
    expect(lookupMaltProfile("Flaked Maize")?.id).toBe("flaked-corn-maize");
  });

  it("resolves Brewfather's inverted adjunct spelling", () => {
    // "Barley, Flaked" is how the owner's inventory actually spells it, and it
    // is the one name on the failing list this table can identify.
    expect(lookupMaltProfile("Barley, Flaked")?.id).toBe("flaked-barley");
    expect(lookupMaltProfile("Oats, Flaked")?.id).toBe("flaked-oats");
    expect(lookupMaltProfile("Wheat, Flaked")?.id).toBe("flaked-wheat");
  });

  it("resolves messy real-world names by containment", () => {
    expect(lookupMaltProfile("Weyermann Carahell Malt")?.id).toBe("carahell");
    expect(lookupMaltProfile("Best Munich Malt II (20-25 EBC)")?.id).toBe(
      "munich-malt-2"
    );
    expect(lookupMaltProfile("Crisp Maris Otter 2020 harvest")?.id).toBe(
      "maris-otter"
    );
  });

  it("returns undefined for a name the chart does not carry", () => {
    expect(lookupMaltProfile("Totally Made Up Malt")).toBeUndefined();
    expect(lookupMaltProfile("")).toBeUndefined();
    expect(lookupMaltProfile("   ")).toBeUndefined();
    expect(lookupMaltProfile("Calcium Chloride")).toBeUndefined();
  });

  it("never resolves a short query onto a longer, different malt", () => {
    // The one-directional trap. Containment runs query-contains-chart-name and
    // never the reverse, so a bare word that merely prefixes a chart name
    // resolves to nothing rather than to the wrong row. "Amber" is the sharp
    // case: it prefixes "Amber Malt" at 50-70 EBC and is a substring of
    // "CaraAmber" as well, and either answer would drag a 0-enzyme, 15-20%
    // ceiling onto whatever the brewer actually meant.
    expect(lookupMaltProfile("Amber")).toBeUndefined();
    expect(lookupMaltProfile("Munich")).toBeUndefined();
    expect(lookupMaltProfile("Crystal")).toBeUndefined();
    expect(lookupMaltProfile("Carafa")).toBeUndefined();
    expect(lookupMaltProfile("Special")).toBeUndefined();
  });

  it("does not match a chart name mid-word", () => {
    // "Blackcurrant" must not reach "Black Patent Malt" via any fragment, and
    // "Buckwheat" must not reach "Wheat Malt".
    expect(lookupMaltProfile("Blackcurrant Puree")).toBeUndefined();
    expect(lookupMaltProfile("Buckwheat Honey")).toBeUndefined();
  });

  it("keeps the numbered families apart", () => {
    // "Munich Malt I" is a substring of "Munich Malt II" up to the word break,
    // and the two differ by 30 °Lintner and 6 EBC points.
    expect(lookupMaltProfile("Munich Malt I")?.id).toBe("munich-malt-1");
    expect(lookupMaltProfile("Munich Malt II")?.id).toBe("munich-malt-2");
    expect(lookupMaltProfile("Caramunich I")?.id).toBe("caramunich-1");
    expect(lookupMaltProfile("Caramunich III")?.id).toBe("caramunich-3");
    expect(lookupMaltProfile("Carafa Special II")?.id).toBe("carafa-special-2");
    expect(lookupMaltProfile("Carafa Special III")?.id).toBe("carafa-special-3");
  });

  it("prefers the leftmost of two equally long containment matches", () => {
    // "Pale Chocolate Malt" contains both "pale chocolate" and "chocolate
    // malt" - same length, different malts, 500-650 vs 800-1000 EBC. Without a
    // defined tiebreak the answer would depend on table order.
    expect(lookupMaltProfile("Pale Chocolate Malt")?.id).toBe("pale-chocolate");
    expect(lookupMaltProfile("Simpsons Pale Chocolate")?.id).toBe("pale-chocolate");
    // The plain name still lands on the plain malt.
    expect(lookupMaltProfile("Chocolate Malt")?.id).toBe("chocolate-malt");
    // And a wheat qualifier wins over the barley chocolate row.
    expect(lookupMaltProfile("Chocolate Wheat Malt")?.id).toBe("chocolate-wheat");
  });

  it("resolves every chart name and every derived alias unambiguously", () => {
    // If two rows ever generated the same normalized alias, one of them would
    // become unreachable and the other would answer for both.
    const seen = new Map<string, string>();
    for (const entry of MALT_PROFILES) {
      expect(lookupMaltProfile(entry.name)?.id).toBe(entry.id);
      const key = normalizeName(entry.name);
      expect(seen.has(key)).toBe(false);
      seen.set(key, entry.id);
    }
  });
});

describe("lookupMaltProfile memoization", () => {
  it("returns the identical object for a repeated hit", () => {
    const first = lookupMaltProfile("Caramunich II");
    const second = lookupMaltProfile("Caramunich II");
    expect(first?.id).toBe("caramunich-2");
    expect(second).toBe(first);
  });

  it("shares one answer across names that normalize alike", () => {
    expect(lookupMaltProfile("Carahell")).toBe(lookupMaltProfile("  carahell!!  "));
  });

  it("caches a miss without ever turning it into a hit", () => {
    expect(lookupMaltProfile("Totally Made Up Malt")).toBeUndefined();
    expect(lookupMaltProfile("Totally Made Up Malt")).toBeUndefined();
  });

  it("keeps a hit and a miss on the same stem apart", () => {
    for (let pass = 0; pass < 2; pass += 1) {
      expect(lookupMaltProfile("Amber Malt")?.id).toBe("amber-malt");
      expect(lookupMaltProfile("Amber")).toBeUndefined();
    }
  });
});

describe("real inventory names that previously failed to resolve", () => {
  // The seven names the owner stocks that neither the equivalence tables nor
  // the keyword fallback could identify. Pinned as they behave today so the
  // report and the code cannot drift apart: one is fixed, six are not, and the
  // six are not fixable from this chart without inventing product names it
  // does not print. See docs/malt-reference.md.
  it.each([
    ["Barley, Flaked", "flaked-barley"],
  ])("now resolves %s", (name, id) => {
    expect(lookupMaltProfile(name)?.id).toBe(id);
  });

  it.each([
    "Karamelmalt Hell",
    "Caramel/Crystal Malt 110",
    "Crystal 150L",
    "Chateau Melano Light",
    "Gladfield American Ale Malt",
    "BEST Chit Malt",
  ])("still does not resolve %s", (name) => {
    expect(lookupMaltProfile(name)).toBeUndefined();
  });

  it("gives the colour numbers in those names a defensible reading", () => {
    // The chart cannot name "Caramel/Crystal Malt 110" or "Crystal 150L", but
    // its two Lovibond-named crystal rows do settle what the number means. Read
    // as Lovibond, 110L and 150L are ~217 and ~296 EBC - a dark crystal and a
    // Special B, not the Caramunich II and Caramunich III that reading the
    // numbers as EBC would suggest. That is a two-row difference in colour.
    expect(srmToEbc(110)).toBeCloseTo(216.7, 1);
    expect(srmToEbc(150)).toBeCloseTo(295.5, 1);
    expect(profile("caramunich-2").ebc).toEqual({ min: 110, max: 130 });
    expect(profile("special-b").ebc.min).toBe(300);
  });
});
