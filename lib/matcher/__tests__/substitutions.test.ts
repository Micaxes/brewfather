import { describe, expect, it } from "vitest";

import type { InventoryItem, RecipeIngredient } from "@/lib/brewfather/types";
import {
  buildJustification,
  canSubstitute,
  doseFactorFor,
  findMaltSubstitutes,
  resolveMaltProfile,
} from "@/lib/matcher/substitutions";

function malt(
  name: string,
  amount: number,
  extra: Partial<InventoryItem> = {}
): InventoryItem {
  return {
    id: `inv-${name}`,
    name,
    category: "fermentable",
    amount,
    unit: "kg",
    ...extra,
  };
}

function wants(name: string, amount = 1, unit = "kg"): RecipeIngredient {
  return { id: "", name, category: "fermentable", amount, unit };
}

describe("resolveMaltProfile", () => {
  it("prefers the guide's own band over the inventory colour", () => {
    const profile = resolveMaltProfile("Weyermann Caramunich Type 2", 999);
    expect(profile).toMatchObject({ maltClass: "caramel", ebcMin: 110, ebcMax: 130 });
  });

  it("falls back to keyword class plus the Brewfather colour", () => {
    const profile = resolveMaltProfile("Caramel/Crystal Malt 110", 110);
    expect(profile).toMatchObject({ maltClass: "caramel", ebcMin: 110, ebcMax: 110 });
    expect(profile?.resolved).toBeUndefined();
  });

  it("gives up when the malt is unknown and has no colour", () => {
    expect(resolveMaltProfile("Mystery Grain")).toBeUndefined();
    expect(resolveMaltProfile("Caramel/Crystal Malt 110")).toBeUndefined();
  });
});

describe("canSubstitute", () => {
  it("allows a same-class, same-colour swap across maltsters", () => {
    const wanted = resolveMaltProfile("Weyermann Caramunich Type 2")!;
    const candidate = resolveMaltProfile("Crisp Crystal 120")!;
    expect(canSubstitute(wanted, candidate)).toBe(true);
  });

  it("refuses to cross malt class even at the same EBC (rule 1)", () => {
    // Caramunich Type 1 (80-100) vs Biscuit-class Amber (45-65): different class.
    const caramel = resolveMaltProfile("Weyermann Caramunich Type 1")!;
    const kilned = resolveMaltProfile("Château Biscuit")!;
    expect(caramel.maltClass).not.toBe(kilned.maltClass);
    expect(canSubstitute(caramel, kilned)).toBe(false);
  });

  it("refuses a same-class swap whose colour is too far off (rule 2)", () => {
    const light = resolveMaltProfile("Weyermann Carahell")!; // 20-30
    const dark = resolveMaltProfile("Weyermann Caramunich Type 3")!; // 140-160
    expect(canSubstitute(light, dark)).toBe(false);
  });

  it("blocks Roasted Barley against Black Malt (rule 5)", () => {
    const roastedBarley = resolveMaltProfile("Château Roasted Barley")!;
    const black = resolveMaltProfile("Crisp Black Malt")!;
    expect(canSubstitute(roastedBarley, black)).toBe(false);
  });

  it("never offers unmalted Roasted Barley as a stand-in for a malted grain", () => {
    // The guide sanctions only the softening direction.
    const chocolate = resolveMaltProfile("Château Chocolat")!;
    const roastedBarley = resolveMaltProfile("Château Roasted Barley")!;
    expect(canSubstitute(chocolate, roastedBarley)).toBe(false);
  });

  it("still lets Chocolate soften a Roasted Barley requirement (rule 5 remedy)", () => {
    const roastedBarley = resolveMaltProfile("Château Roasted Barley")!;
    const chocolate = resolveMaltProfile("Château Chocolat")!;
    expect(canSubstitute(roastedBarley, chocolate)).toBe(true);
  });

  it("still swaps one maltster's Roasted Barley for another's", () => {
    const wanted = resolveMaltProfile("Château Roasted Barley")!;
    const candidate = resolveMaltProfile("BEST Roasted Barley")!;
    expect(canSubstitute(wanted, candidate)).toBe(true);
  });
});

describe("doseFactorFor (rule 4)", () => {
  it("doses colourants above 250 EBC at -15%", () => {
    expect(doseFactorFor(resolveMaltProfile("Château Special B")!)).toBeCloseTo(0.85);
  });

  it("keeps everything else 1:1", () => {
    expect(doseFactorFor(resolveMaltProfile("Weyermann Carahell")!)).toBe(1);
  });
});

describe("findMaltSubstitutes", () => {
  it("returns at most three, best first", () => {
    const inventory = [
      malt("Crisp Crystal 120", 5),
      malt("Château Cara Gold", 5),
      malt("BEST Caramel Munich II", 5),
      malt("Fawcett Crystal II", 5),
    ];
    const result = findMaltSubstitutes(wants("Weyermann Caramunich Type 2", 1), inventory);
    expect(result).toHaveLength(3);
    expect(result.every((s) => s.coversNeed)).toBe(true);
  });

  it("says bands overlap rather than claiming a ±10% band that does not hold", () => {
    // Pale Ale 4.5-6.5 vs Château Pale Ale 6-8: overlapping, but 21% apart at
    // the midpoint. Asserting "±10%" here was a false statement.
    const result = findMaltSubstitutes(wants("Pale Ale", 1), [
      malt("Château Pale Ale", 5),
    ]);
    expect(result[0]?.justification).toMatch(/colour ranges overlap/i);
    expect(result[0]?.justification).not.toMatch(/10%/);
  });

  it("claims the ±10% band only when the midpoints really are within it", () => {
    // Non-overlapping bands 7.7% apart at the midpoint. Built by hand so no
    // equivalence row exists and the colour branch is the one under test.
    const wanted = { maltClass: "caramel" as const, ebcMin: 120, ebcMax: 120 };
    const candidate = { maltClass: "caramel" as const, ebcMin: 130, ebcMax: 130 };

    const text = buildJustification("Some Malt", wanted, candidate, false);
    expect(text).toMatch(/inside the guide's ±10% band/);
    expect(text).not.toMatch(/overlap/);
  });

  it("says overlap when the bands overlap, whatever the midpoint gap", () => {
    const wanted = { maltClass: "caramel" as const, ebcMin: 100, ebcMax: 120 };
    const candidate = { maltClass: "caramel" as const, ebcMin: 110, ebcMax: 130 };

    const text = buildJustification("Some Malt", wanted, candidate, false);
    expect(text).toMatch(/colour ranges overlap/);
  });

  it("never offers unmalted grain as a stand-in for malt", () => {
    // "Torrefied Wheat" used to resolve onto Weyermann Pale Wheat.
    expect(resolveMaltProfile("Torrefied Wheat", 4)).toBeUndefined();
    expect(resolveMaltProfile("Wheat Unmalted", 4)).toBeUndefined();

    const result = findMaltSubstitutes(wants("Weyermann Pale Wheat", 1), [
      malt("Torrefied Wheat", 5),
    ]);
    expect(result).toEqual([]);
  });

  it("explains why each suggestion was made", () => {
    const result = findMaltSubstitutes(
      wants("Weyermann Caramunich Type 2", 1),
      [malt("Crisp Crystal 120", 5)]
    );
    expect(result[0]?.justification).toMatch(/same equivalence row/i);
    expect(result[0]?.justification).toMatch(/110–130 EBC/);
  });

  it("ranks a covering option above a closer-coloured one that runs out", () => {
    const inventory = [
      malt("Château Cara Gold", 0.2), // exact row, but only 0.2 kg
      malt("Caramel Ambrée", 5), // 100-120, overlaps, plenty of stock
    ];
    const result = findMaltSubstitutes(wants("Weyermann Caramunich Type 2", 1), inventory);
    expect(result[0]?.inventoryItem.name).toBe("Caramel Ambrée");
    expect(result[0]?.coversNeed).toBe(true);
    expect(result[1]?.coversNeed).toBe(false);
  });

  it("breaks an otherwise-equal tie on style origin (rule 3)", () => {
    // Both sit on the same row with an identical 110-130 band, so colour
    // proximity cannot separate them and origin decides.
    const inventory = [
      malt("Weyermann Caramunich Type 2", 5),
      malt("Château Cara Gold", 5),
    ];
    const result = findMaltSubstitutes(wants("Crisp Crystal 120", 1), inventory, {
      style: "Belgian Dubbel",
    });
    expect(result[0]?.inventoryItem.name).toBe("Château Cara Gold");
    expect(result[0]?.justification).toMatch(/Château is the origin-consistent/);
  });

  it("still puts colour proximity ahead of style origin", () => {
    // Weyermann Vienna (6-9) is a closer colour to Crisp Vienna (6-10) than
    // Château Vienna (4-7), so it wins despite the Belgian style.
    const inventory = [malt("Weyermann Vienna", 5), malt("Château Vienna", 5)];
    const result = findMaltSubstitutes(wants("Crisp Vienna", 1), inventory, {
      style: "Belgian Dubbel",
    });
    expect(result[0]?.inventoryItem.name).toBe("Weyermann Vienna");
  });

  it("carries the -15% dose note for >250 EBC colourants", () => {
    const result = findMaltSubstitutes(
      wants("Weyermann Special W", 1),
      [malt("Château Special B", 5)]
    );
    expect(result[0]?.doseFactor).toBeCloseTo(0.85);
    expect(result[0]?.justification).toMatch(/dose at -15%/i);
  });

  it("ignores non-fermentables entirely", () => {
    const hop: RecipeIngredient = {
      id: "",
      name: "Citra",
      category: "hop",
      amount: 50,
      unit: "g",
    };
    expect(findMaltSubstitutes(hop, [malt("Crisp Crystal 120", 5)])).toEqual([]);
  });

  it("never proposes an out-of-stock malt", () => {
    const result = findMaltSubstitutes(
      wants("Weyermann Caramunich Type 2", 1),
      [malt("Crisp Crystal 120", 0)]
    );
    expect(result).toEqual([]);
  });

  it("respects stock already reserved by earlier recipe lines", () => {
    const crystal = malt("Crisp Crystal 120", 5);
    const reserved = new Map([[crystal, 5]]);
    const result = findMaltSubstitutes(
      wants("Weyermann Caramunich Type 2", 1),
      [crystal],
      { reserved }
    );
    expect(result).toEqual([]);
  });

  it("skips candidates whose units cannot be compared", () => {
    const result = findMaltSubstitutes(
      wants("Weyermann Caramunich Type 2", 1, "kg"),
      [malt("Crisp Crystal 120", 5, { unit: "tsp" })]
    );
    expect(result).toEqual([]);
  });

  it("converts across comparable units", () => {
    const result = findMaltSubstitutes(
      wants("Weyermann Caramunich Type 2", 1, "kg"),
      [malt("Crisp Crystal 120", 2000, { unit: "g" })]
    );
    expect(result[0]?.have).toBe(2);
    expect(result[0]?.coversNeed).toBe(true);
  });

  it("never offers the excluded item as its own substitute", () => {
    const crystal = malt("Crisp Crystal 120", 5);
    const result = findMaltSubstitutes(
      wants("Weyermann Caramunich Type 2", 1),
      [crystal],
      { exclude: crystal }
    );
    expect(result).toEqual([]);
  });
});
