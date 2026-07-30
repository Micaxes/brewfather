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
  MALT_CLASS_LABEL,
  type MaltClass,
  type ResolvedMalt,
  classifyByKeyword,
  ebcCompatible,
  isBlockedPair,
  lookupMalt,
  mayStandInFor,
  sameEquivalenceRow,
} from "@/lib/matcher/malt-equivalents";
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
  } else {
    parts.push(
      `Both are ${label}s and the colour is close — ${formatBand(candidate)} vs ${formatBand(wanted)}, inside the guide's ±10% band, so swap 1:1.`
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
    .filter((item) => item !== options.exclude && item.name !== ingredient.name)
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
