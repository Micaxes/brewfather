import { NextResponse } from "next/server";

import type { BrewCandidatesResponse } from "@/lib/api-contract";
import { createBrewfatherClient } from "@/lib/brewfather/client";
import { getUserBrewfatherCredentials } from "@/lib/brewfather/user-credentials";
import { matchRecipes } from "@/lib/matcher";

// Loads the user's data from Brewfather and runs the matcher, so it must run on
// the Node.js runtime and must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_CONNECTED_WARNING =
  "Connect your Brewfather account in Settings to load your inventory and recipes.";

/**
 * GET /api/brew-candidates
 *
 * Resolves the signed-in user's Brewfather key (decrypted server-side from
 * Vault), loads inventory + recipes, runs the deterministic matcher, and returns
 * the ranked candidates. The API key never leaves the server. When the user
 * hasn't connected Brewfather yet, returns an empty (but successful) result with
 * a warning so the dashboard can onboard them instead of erroring.
 */
export async function GET() {
  const credentials = await getUserBrewfatherCredentials();
  if (!credentials) {
    const body: BrewCandidatesResponse = {
      candidates: [],
      generatedAt: new Date().toISOString(),
      warnings: [NOT_CONNECTED_WARNING],
    };
    return NextResponse.json(body);
  }

  try {
    const client = createBrewfatherClient(credentials);
    const { inventory, recipes } = await client.getData();
    const result: BrewCandidatesResponse = matchRecipes({ inventory, recipes });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/brew-candidates failed:", error);
    const body: BrewCandidatesResponse = {
      candidates: [],
      generatedAt: new Date().toISOString(),
      warnings: ["Could not load data from Brewfather. Please try again."],
    };
    return NextResponse.json(body, { status: 502 });
  }
}
