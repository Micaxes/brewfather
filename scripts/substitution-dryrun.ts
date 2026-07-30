/**
 * Dry run of the malt-substitution engine against real Brewfather data.
 *
 * Mirrors `scripts/match-spike.ts`: reads `BF_USER_ID`/`BF_API_KEY` from `.env`
 * via the client's explicit `allowEnvFallback` opt-in, pulls the owner's live
 * inventory + recipes, and reports what the substitution rules actually do —
 * how many malts resolve against the guide, which lines are now satisfied by an
 * equivalent, and a sample of the suggestions shown to the user.
 *
 * Read-only: no writes to Brewfather, no database access.
 *
 *   npx tsx scripts/substitution-dryrun.ts
 */
import { createBrewfatherClient } from "@/lib/brewfather/client";
import { matchRecipes } from "@/lib/matcher";
import { lookupMalt } from "@/lib/matcher/malt-equivalents";
import { resolveMaltProfile } from "@/lib/matcher/substitutions";

async function main(): Promise<void> {
  const client = createBrewfatherClient({ allowEnvFallback: true });
  console.log("Fetching live inventory + recipes…");
  const { inventory, recipes } = await client.getData();

  const malts = inventory.filter((i) => i.category === "fermentable");
  const inGuide = malts.filter((m) => lookupMalt(m.name) !== undefined);
  const profiled = malts.filter(
    (m) => resolveMaltProfile(m.name, m.color) !== undefined
  );

  console.log(`\n=== Inventory coverage ===`);
  console.log(`fermentables in stock:        ${malts.length}`);
  console.log(`named in the guide:           ${inGuide.length}`);
  console.log(`usable (guide or keyword+EBC): ${profiled.length}`);
  const unresolved = malts.filter(
    (m) => resolveMaltProfile(m.name, m.color) === undefined
  );
  if (unresolved.length > 0) {
    console.log(`\nnot identifiable (no substitutions offered):`);
    for (const m of unresolved) console.log(`  - ${m.name}`);
  }

  const result = matchRecipes({ inventory, recipes });

  let equivalentLines = 0;
  let linesWithSuggestions = 0;
  const samples: string[] = [];

  for (const candidate of result.candidates) {
    for (const match of candidate.ingredientMatches) {
      if (match.matchedBy === "equivalent") {
        equivalentLines += 1;
        if (samples.length < 12) {
          samples.push(
            `  [${candidate.recipe.name}] ${match.ingredient.name}\n` +
              `      -> ${match.inventoryItem?.name}\n` +
              `      ${match.substitutes?.[0]?.justification ?? ""}`
          );
        }
      } else if (match.substitutes && match.substitutes.length > 0) {
        linesWithSuggestions += 1;
      }
    }
  }

  const buckets = { brew_now: 0, almost: 0, not_yet: 0 };
  for (const c of result.candidates) buckets[c.bucket] += 1;

  console.log(`\n=== Effect on ${result.candidates.length} recipes ===`);
  console.log(`buckets: brew_now ${buckets.brew_now} · almost ${buckets.almost} · not_yet ${buckets.not_yet}`);
  console.log(`malt lines satisfied by an equivalent: ${equivalentLines}`);
  console.log(`malt lines showing suggestions only:   ${linesWithSuggestions}`);

  if (samples.length > 0) {
    console.log(`\n=== Sample substitutions ===`);
    for (const s of samples) console.log(s);
  }

  for (const warning of result.warnings.slice(0, 5)) {
    console.log(`\nwarning: ${warning}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
