import { NextResponse } from "next/server";

import { BrewfatherError, createBrewfatherClient } from "@/lib/brewfather/client";
import { getUserBrewfatherCredentials } from "@/lib/brewfather/user-credentials";

// Resolves the signed-in user's key and calls the upstream API, so it must run
// on the Node.js runtime (needs Buffer) and must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/brewfather-data
 *
 * Returns the signed-in user's normalized inventory + full recipes. The
 * Brewfather key (decrypted server-side from Vault) and raw upstream payloads
 * never leave the server: only normalized contract shapes are returned.
 */
export async function GET() {
  const credentials = await getUserBrewfatherCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: "Brewfather account not connected." },
      { status: 503 }
    );
  }

  try {
    const client = createBrewfatherClient(credentials);
    const data = await client.getData();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BrewfatherError) {
      console.error("Brewfather upstream request failed:", error.message);
      return NextResponse.json(
        { error: "Failed to load data from Brewfather." },
        { status: 502 }
      );
    }
    console.error("Unexpected error loading Brewfather data:", error);
    return NextResponse.json(
      { error: "Unexpected error while loading Brewfather data." },
      { status: 500 }
    );
  }
}
