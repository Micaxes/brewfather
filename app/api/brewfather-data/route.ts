import { NextResponse } from "next/server";

import {
  BrewfatherAuthError,
  BrewfatherError,
  createBrewfatherClient,
} from "@/lib/brewfather/client";

// Reads BF_USER_ID/BF_API_KEY and calls the upstream API, so it must run on the
// Node.js runtime (needs Buffer + process.env) and must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/brewfather-data
 *
 * Returns the user's normalized inventory + full recipes. The Brewfather key
 * and raw upstream payloads never leave the server: only normalized contract
 * shapes are returned, and errors are mapped to generic messages.
 */
export async function GET() {
  try {
    const client = createBrewfatherClient();
    const data = await client.getData();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BrewfatherAuthError) {
      return NextResponse.json(
        { error: "Brewfather credentials are not configured." },
        { status: 503 }
      );
    }
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
