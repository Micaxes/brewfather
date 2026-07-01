/**
 * Push a scale-to-stock copy of a saved recipe to Brewfather as a NEW recipe (#14).
 *
 * The Brewfather API has no create-batch endpoint, so "push a chosen recipe to
 * Brewfather" is realized as creating a scaled recipe via `POST /v2/recipes`
 * (requires the `recipes.write` scope on the API key).
 *
 * Usage:
 *   npm run push-recipe -- <recipeId>            # dry run: prints the scaled payload
 *   npm run push-recipe -- <recipeId> --confirm  # actually creates the recipe
 *   npm run push-recipe -- <recipeId> --factor=1.5 --name="My Big IPA" --confirm
 *   npm run push-recipe                          # lists your recipes (id + name)
 *
 * SAFE BY DEFAULT: without --confirm nothing is written to your account.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createBrewfatherClient } from "@/lib/brewfather/client";
import { buildScaledRecipePayload } from "@/lib/brewfather/scaled-recipe";
import { scaleRecipeToStock } from "@/lib/matcher/scale";

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

interface Args {
  recipeId?: string;
  factor?: number;
  name?: string;
  confirm: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { confirm: false };
  for (const token of argv) {
    if (token === "--confirm") args.confirm = true;
    else if (token.startsWith("--factor=")) args.factor = Number(token.slice("--factor=".length));
    else if (token.startsWith("--name=")) args.name = token.slice("--name=".length);
    else if (!token.startsWith("--") && !args.recipeId) args.recipeId = token;
  }
  return args;
}

async function main(): Promise<void> {
  loadDotEnv();
  if (!process.env.BF_USER_ID || !process.env.BF_API_KEY) {
    console.error("Missing BF_USER_ID / BF_API_KEY in .env.");
    process.exitCode = 1;
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  const client = createBrewfatherClient();

  if (!args.recipeId) {
    const recipes = await client.getRecipes();
    console.log("Pass a recipe id. Your saved recipes:\n");
    for (const r of recipes) console.log(`  ${r.id}  ${r.name}`);
    console.log("\nExample: npm run push-recipe -- <id> --confirm");
    return;
  }

  // Fetch the raw recipe (for round-trip) and the normalized detail + inventory
  // (to compute the stock-limited factor).
  const [raw, detail, inventory] = await Promise.all([
    client.getRawRecipe(args.recipeId),
    client.getRecipeDetail(args.recipeId),
    client.getInventory(),
  ]);

  let factor = args.factor;
  if (factor === undefined) {
    const scaled = scaleRecipeToStock(detail, inventory);
    factor = scaled.factor;
    if (factor <= 0) {
      console.error(
        `Recipe "${detail.name}" can't be brewed at your current stock (factor 0, ` +
          `limited by: ${scaled.limitedBy.join(", ") || "—"}).\n` +
          `Pass --factor=<n> to push a copy scaled by a factor you choose.`
      );
      process.exitCode = 1;
      return;
    }
    console.log(`Scale-to-stock factor for "${detail.name}": ${factor}`);
  }
  if (!Number.isFinite(factor) || factor <= 0) {
    console.error(`Invalid --factor (${args.factor}); must be a number > 0.`);
    process.exitCode = 1;
    return;
  }

  const payload = buildScaledRecipePayload(raw, factor, { name: args.name });
  const ferms = (payload.fermentables as Array<{ name: string; amount: number }>) ?? [];
  console.log(`\nNew recipe name: "${payload.name}"`);
  console.log(`  batchSize: ${payload.batchSize}  boilSize: ${payload.boilSize}`);
  console.log("  fermentables:");
  for (const f of ferms.slice(0, 6)) console.log(`    ${f.amount}  ${f.name}`);

  if (!args.confirm) {
    console.log(
      "\nDRY RUN — nothing written. Re-run with --confirm to create this recipe in Brewfather.\n" +
        "(Requires an API key with the recipes.write scope.)"
    );
    return;
  }

  console.log("\nCreating recipe in Brewfather…");
  const created = await client.createRecipe(payload);
  console.log(`Created recipe id: ${created.id ?? "(id not returned)"}`);
  console.log("Open Brewfather → My Recipes to see it.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nPush failed: ${message}`);
  if (message.includes("403")) {
    console.error(
      "→ 403 means the API key lacks the recipes.write scope. Regenerate the key in\n" +
        "  Brewfather → Settings → API with Recipes write enabled."
    );
  }
  process.exitCode = 1;
});
