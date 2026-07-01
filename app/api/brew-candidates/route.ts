import { NextResponse } from "next/server";

import type { BrewCandidatesResponse } from "@/lib/api-contract";
import { getFreshCachedData, setCachedData } from "@/lib/brewfather/cache";
import { createBrewfatherClient } from "@/lib/brewfather/client";
import { getUserBrewfatherCredentials } from "@/lib/brewfather/user-credentials";
import { matchRecipes } from "@/lib/matcher";

// Resolves the user's key, loads data, and runs the matcher, so it must run on
// the Node.js runtime and must never be HTTP-cached (freshness is our own cache).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_CONNECTED_WARNING =
  "Connect your Brewfather account in Settings to load your inventory and recipes.";

/**
 * GET /api/brew-candidates[?refresh=true]
 *
 * Resolves the signed-in user's Brewfather key (Vault-decrypted, server-side),
 * serves their cached inventory + recipes when fresh (else fetches from
 * Brewfather and repopulates the cache), runs the deterministic matcher, and
 * returns ranked candidates. `?refresh=true` bypasses the cache. Not connected
 * yet → an empty (successful) result with an onboarding warning.
 */
export async function GET(request: Request) {
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
    const refresh = new URL(request.url).searchParams.get("refresh") === "true";
    let data = refresh ? null : await getFreshCachedData();
    if (!data) {
      const client = createBrewfatherClient(credentials);
      data = await client.getData();
      await setCachedData(data);
    }
    const result: BrewCandidatesResponse = matchRecipes(data);
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
