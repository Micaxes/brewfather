import { NextResponse } from "next/server";

import {
  SYNC_COOLDOWN_MS,
  type BrewCandidatesResponse,
} from "@/lib/api-contract";
import {
  getFreshCachedData,
  getLastSyncedAt,
  setCachedData,
} from "@/lib/brewfather/cache";
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
 * returns ranked candidates plus `syncedAt` (the cache's `fetched_at`).
 * `?refresh=true` bypasses the cache ("Sync now"), gated by a per-user
 * cooldown of {@link SYNC_COOLDOWN_MS}: inside the window it serves the cached
 * candidates with `cooldownSeconds` instead of calling Brewfather. Normal
 * (param-less) loads are never throttled. Not connected yet → an empty
 * (successful) result with an onboarding warning.
 */
export async function GET(request: Request) {
  const credentials = await getUserBrewfatherCredentials();
  if (!credentials) {
    const body: BrewCandidatesResponse = {
      candidates: [],
      generatedAt: new Date().toISOString(),
      warnings: [NOT_CONNECTED_WARNING],
      syncedAt: null,
    };
    return NextResponse.json(body);
  }

  try {
    const refresh = new URL(request.url).searchParams.get("refresh") === "true";

    if (refresh) {
      // Manual-sync cooldown: reject rapid re-syncs before they reach
      // Brewfather (500 calls/hr per key). Serve the cached candidates and
      // signal the wait instead of hard-failing.
      const lastSyncedAt = await getLastSyncedAt();
      const elapsedMs = lastSyncedAt
        ? Date.now() - new Date(lastSyncedAt).getTime()
        : Number.POSITIVE_INFINITY;
      if (elapsedMs < SYNC_COOLDOWN_MS) {
        const cached = await getFreshCachedData();
        if (cached) {
          const body: BrewCandidatesResponse = {
            ...matchRecipes(cached),
            syncedAt: lastSyncedAt,
            cooldownSeconds: Math.min(
              Math.max(1, Math.ceil((SYNC_COOLDOWN_MS - elapsedMs) / 1000)),
              Math.ceil(SYNC_COOLDOWN_MS / 1000)
            ),
          };
          return NextResponse.json(body);
        }
        // fetched_at is recent but the row is unreadable — fall through to a
        // real fetch rather than failing the sync.
      }
    }

    let data = refresh ? null : await getFreshCachedData();
    let syncedAt: string | null;
    if (data) {
      syncedAt = await getLastSyncedAt();
    } else {
      const client = createBrewfatherClient(credentials);
      const fresh = await client.getData();
      // Only reached when getData() fully resolved — a failed/partial fetch
      // throws (caught below) and the previous good cache row stays untouched.
      // setCachedData returns the fetched_at it wrote, or null when the write
      // didn't land; fall back to re-reading the row so `syncedAt` never
      // claims a sync the cache can't back up.
      syncedAt = (await setCachedData(fresh)) ?? (await getLastSyncedAt());
      data = fresh;
    }

    const body: BrewCandidatesResponse = { ...matchRecipes(data), syncedAt };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/brew-candidates failed:", error);
    const body: BrewCandidatesResponse = {
      candidates: [],
      generatedAt: new Date().toISOString(),
      warnings: ["Could not load data from Brewfather. Please try again."],
      syncedAt: null,
    };
    return NextResponse.json(body, { status: 502 });
  }
}
