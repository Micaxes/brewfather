/**
 * task-005 — `_id`-vs-name matching spike (#10).
 *
 * Pulls the user's REAL Brewfather inventory + saved recipes and measures, for
 * every recipe ingredient, whether it resolves to an inventory item by stable
 * `_id`, by normalized-name fuzzy match, or not at all. This validates the
 * load-bearing assumption from PRD #1 §9 — that recipe ingredients and inventory
 * items share a stable `_id` — and recommends a `FUZZY_NAME_THRESHOLD`.
 *
 * Run: add real credentials to `.env` (BF_USER_ID + BF_API_KEY), then
 *   npm run spike
 *
 * Output: a human-readable summary on stdout + a committed report at
 * docs/spikes/id-vs-name.md. No writes to Brewfather (read-only).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createBrewfatherClient } from "@/lib/brewfather/client";
import type {
  IngredientCategory,
  InventoryItem,
  RecipeDetail,
  RecipeIngredient,
} from "@/lib/brewfather/types";
import {
  buildInventoryIndex,
  collectIngredients,
  FUZZY_NAME_THRESHOLD,
} from "@/lib/matcher/match";
import { normalizeName } from "@/lib/matcher/normalize";

const REPORT_PATH = "docs/spikes/id-vs-name.md";
const CATEGORIES: IngredientCategory[] = ["fermentable", "hop", "yeast", "misc"];
const SWEEP_THRESHOLDS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
/** Score band a looser threshold than the default would newly capture. */
const BORDERLINE_LOW = FUZZY_NAME_THRESHOLD;
const BORDERLINE_HIGH = 0.45;

/**
 * Minimal `.env` loader. A standalone tsx script (unlike Next.js) does not load
 * `.env`, so read it here. Existing process env wins; quotes are stripped.
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

type ResolutionKind = "id" | "name" | "unmatched";

interface IngredientProbe {
  recipe: string;
  category: IngredientCategory;
  name: string;
  /** Whether a same-category inventory item shares this ingredient's `_id`. */
  idMatch: boolean;
  /** Best (lowest) Fuse score among same-category items, or null if no candidate. */
  bestScore: number | null;
  /** Name of the best same-category candidate, for eyeballing. */
  bestCandidate: string | null;
  /** Resolution under the current default threshold. */
  kind: ResolutionKind;
}

function classify(idMatch: boolean, bestScore: number | null, threshold: number): ResolutionKind {
  if (idMatch) return "id";
  if (bestScore !== null && bestScore <= threshold) return "name";
  return "unmatched";
}

function probeIngredient(
  ingredient: RecipeIngredient,
  recipeName: string,
  index: ReturnType<typeof buildInventoryIndex>
): IngredientProbe {
  const idHit = ingredient.id ? index.byId.get(ingredient.id) : undefined;
  const idMatch = !!idHit && idHit.category === ingredient.category;

  let bestScore: number | null = null;
  let bestCandidate: string | null = null;
  const fuse = index.fuseByCategory.get(ingredient.category);
  const query = normalizeName(ingredient.name);
  if (fuse && query.length > 0) {
    const best = fuse.search(query)[0];
    if (best) {
      bestScore = best.score ?? null;
      bestCandidate = best.item.inventory.name;
    }
  }

  return {
    recipe: recipeName,
    category: ingredient.category,
    name: ingredient.name,
    idMatch,
    bestScore,
    bestCandidate,
    kind: classify(idMatch, bestScore, FUZZY_NAME_THRESHOLD),
  };
}

function pct(part: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function countKind(probes: IngredientProbe[], kind: ResolutionKind): number {
  return probes.filter((p) => p.kind === kind).length;
}

function breakdownRow(label: string, probes: IngredientProbe[]): string {
  const total = probes.length;
  const id = countKind(probes, "id");
  const name = countKind(probes, "name");
  const unmatched = countKind(probes, "unmatched");
  return `| ${label} | ${total} | ${id} (${pct(id, total)}) | ${name} (${pct(
    name,
    total
  )}) | ${unmatched} (${pct(unmatched, total)}) |`;
}

function scoreHistogram(probes: IngredientProbe[]): string {
  const nonId = probes.filter((p) => !p.idMatch);
  const withScore = nonId.filter((p) => p.bestScore !== null);
  const noCandidate = nonId.length - withScore.length;
  const bands = 10; // 0.0-0.1, ..., 0.9-1.0
  const buckets = new Array<number>(bands).fill(0);
  for (const p of withScore) {
    const score = p.bestScore as number;
    const idx = Math.min(bands - 1, Math.floor(score * bands));
    buckets[idx] = (buckets[idx] ?? 0) + 1;
  }
  const lines = buckets.map((count, i) => {
    const lo = (i / bands).toFixed(1);
    const hi = ((i + 1) / bands).toFixed(1);
    const bar = "█".repeat(count);
    return `| ${lo}–${hi} | ${count} | ${bar} |`;
  });
  return (
    `Best fuzzy score per non-\`_id\` ingredient (lower = closer; the default ` +
    `threshold accepts ≤ ${FUZZY_NAME_THRESHOLD}). ${noCandidate} had no ` +
    `same-category candidate at all.\n\n` +
    `| score band | count | |\n|---|---|---|\n${lines.join("\n")}`
  );
}

function sweepTable(probes: IngredientProbe[]): string {
  const total = probes.length;
  const idCount = countKind(probes, "id");
  const nonId = probes.filter((p) => !p.idMatch);
  const rows = SWEEP_THRESHOLDS.map((t) => {
    const name = nonId.filter((p) => p.bestScore !== null && p.bestScore <= t).length;
    const matched = idCount + name;
    const unmatched = total - matched;
    const marker = t === FUZZY_NAME_THRESHOLD ? " (current)" : "";
    return `| ${t}${marker} | ${name} | ${matched} (${pct(matched, total)}) | ${unmatched} (${pct(
      unmatched,
      total
    )}) |`;
  });
  return (
    `How many ingredients resolve as the fuzzy threshold varies (\`_id\` matches ` +
    `are threshold-independent: ${idCount}).\n\n` +
    `| threshold | name matches | total matched | unmatched |\n|---|---|---|---|\n${rows.join(
      "\n"
    )}`
  );
}

function sampleList(probes: IngredientProbe[], limit = 25): string {
  if (probes.length === 0) return "_None._";
  return probes
    .slice(0, limit)
    .map((p) => {
      const cand =
        p.bestCandidate !== null
          ? `→ "${p.bestCandidate}" (score ${(p.bestScore as number).toFixed(3)})`
          : "→ no same-category candidate";
      return `- [${p.category}] "${p.name}" ${cand} _(in "${p.recipe}")_`;
    })
    .join("\n");
}

function recommendation(probes: IngredientProbe[]): { threshold: number; rationale: string } {
  const total = probes.length;
  if (total === 0) return { threshold: FUZZY_NAME_THRESHOLD, rationale: "No ingredients sampled." };
  const idRate = countKind(probes, "id") / total;
  const borderline = probes.filter(
    (p) => !p.idMatch && p.bestScore !== null && p.bestScore > BORDERLINE_LOW && p.bestScore <= BORDERLINE_HIGH
  ).length;
  const borderlineRate = borderline / total;

  if (idRate >= 0.8) {
    return {
      threshold: FUZZY_NAME_THRESHOLD,
      rationale:
        `\`_id\` matching resolves ${pct(
          countKind(probes, "id"),
          total
        )} of ingredients — it carries the load and fuzzy name is a true fallback. ` +
        `Keep the conservative default (${FUZZY_NAME_THRESHOLD}) to protect precision.`,
    };
  }
  if (borderlineRate > 0.1) {
    return {
      threshold: 0.4,
      rationale:
        `Name matching is the primary path (\`_id\` only resolves ${pct(
          countKind(probes, "id"),
          total
        )}), and ${pct(borderline, total)} of ingredients sit in the (${BORDERLINE_LOW}, ${BORDERLINE_HIGH}] ` +
        `score band that the current threshold rejects. Suggest loosening to 0.4 — but eyeball the ` +
        `borderline samples first to confirm they are real matches, not near-miss false positives.`,
    };
  }
  return {
    threshold: FUZZY_NAME_THRESHOLD,
    rationale:
      `Name matching is significant (\`_id\` resolves ${pct(
        countKind(probes, "id"),
        total
      )}), but few ingredients sit just past the current threshold, so loosening would mostly add ` +
      `false positives. Keep ${FUZZY_NAME_THRESHOLD}.`,
  };
}

function inventoryByCategory(inventory: InventoryItem[]): string {
  return CATEGORIES.map(
    (c) => `${inventory.filter((i) => i.category === c).length} ${c}`
  ).join(", ");
}

function buildReport(
  inventory: InventoryItem[],
  recipes: RecipeDetail[],
  probes: IngredientProbe[],
  generatedAt: string
): string {
  const rec = recommendation(probes);
  const idRate = probes.length ? countKind(probes, "id") / probes.length : 0;
  const verdict =
    idRate >= 0.6
      ? `\`_id\` matching carries the majority (${pct(
          countKind(probes, "id"),
          probes.length
        )}); normalized-name fuzzy matching is a genuine fallback.`
      : `Normalized-name fuzzy matching is effectively the **primary** path (\`_id\` only resolves ${pct(
          countKind(probes, "id"),
          probes.length
        )}) — this **confirms the PRD §9 risk** that recipe and inventory \`_id\`s often diverge.`;

  const byCategory = CATEGORIES.map((c) =>
    breakdownRow(c, probes.filter((p) => p.category === c))
  ).join("\n");

  const borderline = probes.filter(
    (p) => !p.idMatch && p.bestScore !== null && p.bestScore > BORDERLINE_LOW && p.bestScore <= BORDERLINE_HIGH
  );
  const unmatched = probes.filter((p) => p.kind === "unmatched");

  return `# Spike: \`_id\` vs name matching (task-005 / #10)

_Generated ${generatedAt} by \`npm run spike\` against real Brewfather data._

## Data sampled
- **Inventory:** ${inventory.length} items (${inventoryByCategory(inventory)})
- **Recipes:** ${recipes.length}
- **Recipe ingredients probed:** ${probes.length}

## Resolution breakdown (current threshold ${FUZZY_NAME_THRESHOLD})

| scope | ingredients | by \`_id\` | by fuzzy name | unmatched |
|---|---|---|---|---|
${breakdownRow("**all**", probes)}
${byCategory}

**Verdict (PRD §9):** ${verdict}

## Fuzzy score distribution
${scoreHistogram(probes)}

## Threshold sweep
${sweepTable(probes)}

## Recommendation
**\`FUZZY_NAME_THRESHOLD\` = ${rec.threshold}** ${
    rec.threshold === FUZZY_NAME_THRESHOLD ? "(no change)" : "(change from " + FUZZY_NAME_THRESHOLD + ")"
  }

${rec.rationale}

> Set in \`lib/matcher/match.ts\`. After any change, re-run \`npm test\` and re-run this spike.

## Borderline name matches (score in (${BORDERLINE_LOW}, ${BORDERLINE_HIGH}])
_A looser threshold would newly accept these. Eyeball them — real matches argue for loosening; near-misses argue against._

${sampleList(borderline)}

## Unmatched ingredients (current threshold)
_Either genuinely not in inventory, or a matching gap to investigate._

${sampleList(unmatched)}
`;
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

  console.log("Fetching real inventory + recipes from Brewfather…");
  const client = createBrewfatherClient();
  const { inventory, recipes } = await client.getData();
  console.log(
    `Fetched ${inventory.length} inventory items and ${recipes.length} recipes.`
  );

  if (recipes.length === 0) {
    console.error("No saved recipes found — nothing to measure. Save some recipes first.");
    process.exitCode = 1;
    return;
  }

  // Permissive index (threshold 1) so every fuzzy candidate's score is captured.
  const index = buildInventoryIndex(inventory, 1);
  const probes: IngredientProbe[] = [];
  for (const recipe of recipes) {
    for (const ingredient of collectIngredients(recipe)) {
      probes.push(probeIngredient(ingredient, recipe.name, index));
    }
  }

  const total = probes.length;
  const id = countKind(probes, "id");
  const name = countKind(probes, "name");
  const unmatched = countKind(probes, "unmatched");
  console.log("\n— Resolution (threshold " + FUZZY_NAME_THRESHOLD + ") —");
  console.log(`  by _id:   ${id} (${pct(id, total)})`);
  console.log(`  by name:  ${name} (${pct(name, total)})`);
  console.log(`  unmatched:${unmatched} (${pct(unmatched, total)})`);
  const rec = recommendation(probes);
  console.log(`\nRecommended FUZZY_NAME_THRESHOLD: ${rec.threshold}`);

  const generatedAt = new Date().toISOString();
  const report = buildReport(inventory, recipes, probes, generatedAt);
  const outPath = resolve(process.cwd(), REPORT_PATH);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, report, "utf8");
  console.log(`\nReport written to ${REPORT_PATH}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nSpike failed: ${message}`);
  if (message.includes("401") || message.toLowerCase().includes("auth")) {
    console.error(
      "→ 401 usually means BF_USER_ID/BF_API_KEY are wrong. The Brewfather API User ID\n" +
        "  is the short token in Settings → API, not your login email."
    );
  }
  process.exitCode = 1;
});
