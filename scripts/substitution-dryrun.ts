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
 *
 * `npm run subs:dryrun` adds `--env-file=.env`, and Node refuses to start at all
 * when that file is absent — a stack trace before this script is ever loaded. So
 * the script also loads `.env` itself (exactly as `scripts/match-spike.ts` does)
 * and reports absent credentials as an actionable message. On a checkout with no
 * `.env` yet, invoke it directly via `npx tsx` rather than through the npm
 * script.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createBrewfatherClient } from "@/lib/brewfather/client";
import { matchRecipes } from "@/lib/matcher";
import { lookupMalt } from "@/lib/matcher/malt-equivalents";
import { resolveMaltProfile } from "@/lib/matcher/substitutions";

/**
 * Minimal `.env` loader. A standalone tsx script (unlike Next.js) does not load
 * `.env`, so read it here. Existing process env wins — that keeps whatever
 * `--env-file=.env` already put in place, and lets a one-off
 * `BF_USER_ID=… npx tsx …` override the file. Quotes are stripped.
 */
function loadDotEnv(file = ".env"): void {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadDotEnv();

  if (!process.env.BF_USER_ID || !process.env.BF_API_KEY) {
    console.error(
      "Missing BF_USER_ID / BF_API_KEY. Add them to .env at the repo root.\n" +
        "Generate a key in Brewfather → Settings → API (requires Premium). The User ID\n" +
        "is the short token shown next to the key, NOT your account email."
    );
    process.exitCode = 1;
    return;
  }

  // The ONLY place the BF_* env credentials are allowed: an offline developer
  // tool. Request paths must always pass the signed-in user's Vault key.
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
