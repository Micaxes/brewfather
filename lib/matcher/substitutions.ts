/**
 * Malt substitution engine (pure logic).
 *
 * Implements the five substitution rules from `docs/malt-substitutions.md`,
 * transcribed from the maltster equivalence guide:
 *
 *   1. never cross malt class            -> `sameClass`
 *   2. EBC band within ±10%              -> `ebcCompatible`
 *   3. style-origin coherence            -> ranking tiebreak + justification
 *   4. 1:1 except >250 EBC colourants    -> `doseFactor`
 *   5. Roasted Barley is its own case    -> `isBlockedPair`
 *
 * Two consumers:
 *   - `match.ts` uses {@link findMaltSubstitutes} to resolve a fermentable that
 *     neither id nor fuzzy name could match (a "looser" match).
 *   - the dashboard shows the top 3 for any missing or short fermentable.
 */
import type { InventoryItem, RecipeIngredient } from "@/lib/brewfather/types";
import type { MaltSubstitute } from "@/lib/matcher/types";
import {
  COLORANT_DOSE_ADJUSTMENT,
  COLORANT_EBC_THRESHOLD,
  EBC_TOLERANCE,
  MALT_CLASS_LABEL,
  type MaltClass,
  type ResolvedMalt,
  classifyByKeyword,
  ebcCompatible,
  ebcRelation,
  isBlockedPair,
  isUnmaltedForm,
  lookupMalt,
  mayStandInFor,
  sameEquivalenceRow,
  sameGrain,
} from "@/lib/matcher/malt-equivalents";
import {
  type HopEntry,
  alphaMidpoint,
  bitternessEquivalentFactor,
  lookupHop,
  reverseSubstitutesFor,
  substitutesFor,
} from "@/lib/matcher/hop-equivalents";
import { convertAmount } from "@/lib/matcher/normalize";

/** How many substitutes the UI shows per ingredient. */
export const MAX_SUBSTITUTES = 3;

/** A malt identified well enough to reason about substituting it. */
export interface MaltProfile {
  maltClass: MaltClass;
  ebcMin: number;
  ebcMax: number;
  /** Set when the name resolved against the guide's tables. */
  resolved?: ResolvedMalt;
}

/**
 * Identify a malt. Prefers the guide's own tables; falls back to a keyword
 * class plus the Brewfather colour value so malts the guide doesn't name
 * (e.g. "Caramel/Crystal Malt 110") still participate.
 */
export function resolveMaltProfile(
  name: string,
  color?: number
): MaltProfile | undefined {
  const resolved = lookupMalt(name);
  if (resolved) {
    return {
      maltClass: resolved.row.maltClass,
      ebcMin: resolved.entry.ebcMin,
      ebcMax: resolved.entry.ebcMax,
      resolved,
    };
  }
  // Unmalted grain is excluded from the keyword fallback too — otherwise a
  // "Torrefied Wheat" carrying a Brewfather colour would still profile as a
  // wheat malt and slip past the guard in `lookupMalt`.
  if (isUnmaltedForm(name)) return undefined;

  const maltClass = classifyByKeyword(name);
  if (maltClass === undefined || color === undefined || !Number.isFinite(color)) {
    return undefined;
  }
  return { maltClass, ebcMin: color, ebcMax: color };
}

/** Rules 1, 2 and 5: may `candidate` stand in for `wanted`? */
export function canSubstitute(
  wanted: MaltProfile,
  candidate: MaltProfile
): boolean {
  if (wanted.maltClass !== candidate.maltClass) return false;
  if (wanted.resolved && candidate.resolved) {
    if (isBlockedPair(wanted.resolved, candidate.resolved)) return false;
    // Directional: unmalted grain never stands in for a malted one.
    if (!mayStandInFor(wanted.resolved, candidate.resolved)) return false;
    // "adjunct-grain" covers rye, spelt and oats, whose bands overlap.
    if (!sameGrain(wanted.resolved, candidate.resolved)) return false;
  }
  return ebcCompatible(wanted, candidate);
}

/** Guide rule 4: colourants above 250 EBC are dosed at −15%. */
export function doseFactorFor(candidate: MaltProfile): number {
  const mid = (candidate.ebcMin + candidate.ebcMax) / 2;
  return mid > COLORANT_EBC_THRESHOLD ? 1 + COLORANT_DOSE_ADJUSTMENT : 1;
}

/** Maltster inferred from the guide entry name, for rule 3. */
function maltsterOf(profile: MaltProfile): string | undefined {
  const name = profile.resolved?.entry.name.toLowerCase();
  if (!name) return undefined;
  if (name.startsWith("château") || name.startsWith("chateau")) return "Château";
  if (name.startsWith("weyermann")) return "Weyermann";
  if (name.startsWith("best")) return "Bestmalz";
  if (name.startsWith("crisp")) return "Crisp";
  if (name.startsWith("simpsons")) return "Simpsons";
  if (name.startsWith("fawcett")) return "Fawcett";
  return undefined;
}

/** Rule 3: the maltsters the guide considers origin-consistent for a style. */
function preferredMaltsters(style: string | undefined): string[] {
  if (!style) return [];
  const s = style.toLowerCase();
  if (/belg|dubbel|tripel|saison|wit|abbey|quad/.test(s)) return ["Château"];
  if (/märzen|marzen|helles|oktoberfest|bock|weizen|weiss|kölsch|kolsch|pils|lager|alt/.test(s)) {
    return ["Weyermann", "Bestmalz"];
  }
  if (/pale ale|bitter|esb|english|mild|porter|stout|brown/.test(s)) {
    return ["Crisp", "Simpsons", "Fawcett"];
  }
  return [];
}

function formatBand(profile: MaltProfile): string {
  const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return profile.ebcMin === profile.ebcMax
    ? `${round(profile.ebcMin)} EBC`
    : `${round(profile.ebcMin)}–${round(profile.ebcMax)} EBC`;
}

/** The "why this malt" sentence shown next to a suggestion. */
export function buildJustification(
  wantedName: string,
  wanted: MaltProfile,
  candidate: MaltProfile,
  styleMatch: boolean
): string {
  const parts: string[] = [];
  const label = MALT_CLASS_LABEL[wanted.maltClass];
  const directPair =
    wanted.resolved &&
    candidate.resolved &&
    sameEquivalenceRow(wanted.resolved, candidate.resolved);

  if (directPair) {
    parts.push(
      `The guide lists this on the same equivalence row as ${wantedName} — a direct 1:1 counterpart (${formatBand(candidate)} vs ${formatBand(wanted)}).`
    );
  } else if (ebcRelation(wanted, candidate) === "within-tolerance") {
    parts.push(
      `Both are ${label}s and the colour sits inside the guide's ±${Math.round(EBC_TOLERANCE * 100)}% band — ${formatBand(candidate)} vs ${formatBand(wanted)} — so swap 1:1.`
    );
  } else {
    // Overlapping bands can still be well over 10% apart at the midpoint, so
    // say "overlap" rather than claiming a tolerance that does not hold.
    parts.push(
      `Both are ${label}s and their colour ranges overlap — ${formatBand(candidate)} vs ${formatBand(wanted)} — so swap 1:1.`
    );
  }

  const maltster = maltsterOf(candidate);
  if (styleMatch && maltster) {
    parts.push(`${maltster} is the origin-consistent maltster for this style.`);
  }

  const dose = doseFactorFor(candidate);
  if (dose !== 1) {
    parts.push(
      `Above ${COLORANT_EBC_THRESHOLD} EBC — dose at ${Math.round(COLORANT_DOSE_ADJUSTMENT * 100)}% if the colour comes out too strong.`
    );
  }

  const caveat = candidate.resolved?.row.caveat;
  if (caveat && dose === 1) parts.push(`Note: ${caveat}.`);

  return parts.join(" ");
}

/** Relative distance between two colour midpoints — the primary ranking key. */
function ebcDistance(a: MaltProfile, b: MaltProfile): number {
  const midA = (a.ebcMin + a.ebcMax) / 2;
  const midB = (b.ebcMin + b.ebcMax) / 2;
  const largest = Math.max(midA, midB);
  return largest <= 0 ? 0 : Math.abs(midA - midB) / largest;
}

export interface SubstituteOptions {
  /** Recipe style, for rule 3 ranking. */
  style?: string;
  /** Stock already consumed by earlier lines, in each item's own unit. */
  reserved?: Map<InventoryItem, number>;
  /** Cap on returned suggestions. */
  limit?: number;
  /** Item the line already resolved to — never propose it as its own stand-in. */
  exclude?: InventoryItem;
}

/**
 * Rank in-inventory stand-ins for a malt the user does not have.
 *
 * Candidates come **only** from the user's own inventory, so every suggestion
 * is actionable tonight. Ordering: covers the required amount first, then
 * direct guide equivalents, then colour proximity, then style-origin fit.
 */
/**
 * Rank in-inventory stand-ins for a hop the user does not have.
 *
 * Driven by the Brouwland chart's own per-variety Substitutes column (see
 * `docs/hop-substitutions.md`), in printed order — the chart reads as a
 * preference ranking. Only forward, chart-sanctioned pairings are offered; the
 * inferred reverse direction is used solely for varieties the chart describes
 * but has no row for (Ahtanum).
 *
 * **Hop substitutes are never auto-applied**, unlike a malt on the same
 * equivalence row. The reason is a gap in the data we have, not caution for its
 * own sake: `RecipeIngredient` carries no hop `use`/`time` (see the note in
 * `score.ts`), so we cannot tell a 60-minute bittering charge from a whirlpool
 * addition. Swapping at equal weight changes bitterness for the first;
 * swapping at equal alpha changes aroma for the second. With no way to know
 * which, the brewer decides — these are proposals, and readiness only moves
 * once one is accepted.
 */
export function findHopSubstitutes(
  ingredient: RecipeIngredient,
  inventory: InventoryItem[],
  options: SubstituteOptions = {}
): MaltSubstitute[] {
  if (ingredient.category !== "hop") return [];

  const sanctioned = substitutesFor(ingredient.name);
  const wanted = lookupHop(ingredient.name);
  // A variety the chart names only inside other rows' substitute lists has no
  // row of its own; the reverse direction is all it can tell us.
  const allowed = sanctioned
    ? sanctioned.resolved
    : reverseSubstitutesFor(ingredient.name);
  if (allowed.length === 0) return [];

  const rank = new Map(allowed.map((entry, index) => [entry.name, index]));
  const limit = options.limit ?? MAX_SUBSTITUTES;

  const scored = inventory
    .filter((item) => item.category === "hop")
    .filter((item) => item !== options.exclude)
    .flatMap((item) => {
      const entry = lookupHop(item.name);
      if (!entry) return [];
      const order = rank.get(entry.name);
      if (order === undefined) return [];

      const reserved = options.reserved?.get(item) ?? 0;
      const available = Math.max(item.amount - reserved, 0);
      if (available <= 0) return [];
      const converted = convertAmount(available, item.unit, ingredient.unit);
      if (converted === null) return [];

      return [
        {
          substitute: {
            inventoryItem: item,
            have: converted,
            coversNeed: converted >= ingredient.amount,
            // Always 1: an alpha-scaled weight is only correct for a bittering
            // addition, and we cannot tell which additions those are.
            doseFactor: 1,
            justification: buildHopJustification(ingredient.name, wanted, entry),
          } satisfies MaltSubstitute,
          order,
        },
      ];
    });

  scored.sort((a, b) => {
    if (a.substitute.coversNeed !== b.substitute.coversNeed) {
      return a.substitute.coversNeed ? -1 : 1;
    }
    if (a.order !== b.order) return a.order - b.order;
    return a.substitute.inventoryItem.name.localeCompare(
      b.substitute.inventoryItem.name
    );
  });

  return scored.slice(0, limit).map((entry) => entry.substitute);
}

/** The "why this hop" sentence, including the alpha gap the brewer must judge. */
function buildHopJustification(
  wantedName: string,
  wanted: HopEntry | undefined,
  candidate: HopEntry
): string {
  const parts = [
    `The hop chart lists ${candidate.name} as a substitute for ${wantedName}.`,
  ];

  if (candidate.aroma.length > 0) {
    parts.push(`Aroma: ${candidate.aroma.join(", ")}.`);
  }

  const factor = wanted ? bitternessEquivalentFactor(wanted, candidate) : undefined;
  if (wanted && factor !== undefined) {
    const wantedAlpha = alphaMidpoint(wanted).toFixed(1);
    const candidateAlpha = alphaMidpoint(candidate).toFixed(1);
    if (Math.abs(factor - 1) < 0.1) {
      parts.push(
        `Alpha is close (${candidateAlpha}% vs ${wantedAlpha}%), so weight carries over.`
      );
    } else {
      parts.push(
        `Alpha differs (${candidateAlpha}% vs ${wantedAlpha}%): for a bittering addition use about ${factor.toFixed(2)}× the weight, for a late or dry-hop addition keep the weight and expect a different aroma.`
      );
    }
  }

  return parts.join(" ");
}

export function findMaltSubstitutes(
  ingredient: RecipeIngredient,
  inventory: InventoryItem[],
  options: SubstituteOptions = {}
): MaltSubstitute[] {
  if (ingredient.category !== "fermentable") return [];

  const wanted = resolveMaltProfile(ingredient.name);
  if (!wanted) return [];

  const preferred = preferredMaltsters(options.style);
  const limit = options.limit ?? MAX_SUBSTITUTES;

  const scored = inventory
    .filter((item) => item.category === "fermentable")
    // Object identity only — deliberately *not* a name comparison. Fuzzy
    // matching in `match.ts` resolves a line onto the best NAME match
    // regardless of stock level, and real inventories carry duplicate rows for
    // one malt (two sacks of "Oats, Flaked", two of "Chateau Pilsen 2RS"). A
    // line can therefore land on the empty sack and go missing; filtering by
    // name as well would also hide the twin row that still has stock, so no
    // substitute would be offered for a malt the brewer demonstrably owns. The
    // identity check alone is enough to stop a line proposing the very item it
    // already resolved to.
    .filter((item) => item !== options.exclude)
    .flatMap((item) => {
      const candidate = resolveMaltProfile(item.name, item.color);
      if (!candidate || !canSubstitute(wanted, candidate)) return [];

      const reserved = options.reserved?.get(item) ?? 0;
      const availableInItemUnit = Math.max(item.amount - reserved, 0);
      if (availableInItemUnit <= 0) return [];

      const converted = convertAmount(
        availableInItemUnit,
        item.unit,
        ingredient.unit
      );
      // Only propose stock we can actually compare against the requirement.
      if (converted === null) return [];

      const doseFactor = doseFactorFor(candidate);
      const effectiveNeed = ingredient.amount * doseFactor;
      const maltsterName = maltsterOf(candidate);
      const styleMatch =
        maltsterName !== undefined && preferred.includes(maltsterName);

      return [
        {
          substitute: {
            inventoryItem: item,
            have: converted,
            coversNeed: converted >= effectiveNeed,
            doseFactor,
            justification: buildJustification(
              ingredient.name,
              wanted,
              candidate,
              styleMatch
            ),
          } satisfies MaltSubstitute,
          directPair:
            wanted.resolved &&
            candidate.resolved &&
            sameEquivalenceRow(wanted.resolved, candidate.resolved),
          distance: ebcDistance(wanted, candidate),
          styleMatch,
        },
      ];
    });

  scored.sort((a, b) => {
    if (a.substitute.coversNeed !== b.substitute.coversNeed) {
      return a.substitute.coversNeed ? -1 : 1;
    }
    if (a.directPair !== b.directPair) return a.directPair ? -1 : 1;
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (a.styleMatch !== b.styleMatch) return a.styleMatch ? -1 : 1;
    return a.substitute.inventoryItem.name.localeCompare(
      b.substitute.inventoryItem.name
    );
  });

  return scored.slice(0, limit).map((entry) => entry.substitute);
}
