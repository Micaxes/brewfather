import { NextResponse } from "next/server";

import type { BrewCandidatesResponse } from "@/lib/api-contract";
import {
  BrewfatherAuthError,
  createBrewfatherClient,
} from "@/lib/brewfather/client";
import { matchRecipes } from "@/lib/matcher";

// Loads the user's data from Brewfather and runs the matcher, so it must run on
// the Node.js runtime and must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MISSING_CREDENTIALS_WARNING =
  "Brewfather credentials are not configured. Set BF_USER_ID and BF_API_KEY in your .env to load your inventory and recipes.";

/**
 * GET /api/brew-candidates
 *
 * Loads inventory + recipes via the Brewfather client, runs the deterministic
 * matcher, and returns the ranked candidates in the shared api-contract shape.
 * The API key never leaves the server. When credentials are absent, returns an
 * empty (but successful) result with a warning so the dashboard can onboard the
 * user instead of erroring.
 */
export async function GET() {
  try {
    const client = createBrewfatherClient();
    const { inventory, recipes } = await client.getData();
    const result: BrewCandidatesResponse = matchRecipes({ inventory, recipes });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BrewfatherAuthError) {
      const body: BrewCandidatesResponse = {
        candidates: [],
        generatedAt: new Date().toISOString(),
        warnings: [MISSING_CREDENTIALS_WARNING],
      };
      return NextResponse.json(body);
    }

    console.error("GET /api/brew-candidates failed:", error);
    const body: BrewCandidatesResponse = {
      candidates: [],
      generatedAt: new Date().toISOString(),
      warnings: ["Could not load data from Brewfather. Please try again."],
    };
    return NextResponse.json(body, { status: 502 });
  }
}
