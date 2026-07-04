import { NextResponse } from "next/server";

import type { UpstreamErrorCode } from "@/lib/api-contract";
import { getFreshCachedData, setCachedData } from "@/lib/brewfather/cache";
import { BrewfatherError, createBrewfatherClient } from "@/lib/brewfather/client";
import { classifyUpstreamError } from "@/lib/brewfather/errors";
import { getUserBrewfatherCredentials } from "@/lib/brewfather/user-credentials";

// Resolves the signed-in user's key and calls the upstream API, so it must run
// on the Node.js runtime (needs Buffer) and must never be HTTP-cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One user-facing message per upstream failure class (#23). */
const UPSTREAM_ERRORS: Record<UpstreamErrorCode, string> = {
  reconnect:
    "Brewfather rejected the stored API key. Reconnect your account in Settings.",
  rate_limited:
    "Brewfather is rate-limiting requests. Please try again in a few minutes.",
  upstream: "Failed to load data from Brewfather.",
};

/**
 * GET /api/brewfather-data[?refresh=true]
 *
 * Returns the signed-in user's normalized inventory + full recipes, served from
 * the per-user cache when fresh (else fetched and repopulated). The Brewfather
 * key and raw upstream payloads never leave the server.
 */
export async function GET(request: Request) {
  const credentials = await getUserBrewfatherCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: "Brewfather account not connected." },
      { status: 503 }
    );
  }

  try {
    const refresh = new URL(request.url).searchParams.get("refresh") === "true";
    let data = refresh ? null : await getFreshCachedData();
    if (!data) {
      const client = createBrewfatherClient(credentials);
      data = await client.getData();
      await setCachedData(data);
    }
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BrewfatherError) {
      const code = classifyUpstreamError(error);
      // BrewfatherError messages carry status + path only — never the key.
      console.error("Brewfather upstream request failed:", error.message);
      return NextResponse.json(
        { error: UPSTREAM_ERRORS[code], errorCode: code },
        { status: code === "rate_limited" ? 429 : 502 }
      );
    }
    console.error(
      "Unexpected error loading Brewfather data:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      { error: "Unexpected error while loading Brewfather data." },
      { status: 500 }
    );
  }
}
