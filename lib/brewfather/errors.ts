/**
 * Maps upstream Brewfather failures to the wire-level `errorCode` the BFF
 * routes return (see `lib/api-contract.ts`), so the dashboard can drive the
 * right UI: reconnect (revoked/invalid key) vs. wait (rate limit) vs. retry
 * (transient upstream trouble).
 */
import type { UpstreamErrorCode } from "@/lib/api-contract";
import { BrewfatherError } from "@/lib/brewfather/client";

/**
 * Classify an error thrown while talking to Brewfather.
 *
 * - `401`/`403` → `"reconnect"` — the stored key was rejected (revoked,
 *   expired, or insufficient scope); the user must reconnect in Settings.
 * - `429` → `"rate_limited"` — Brewfather is throttling; wait, don't reconnect.
 * - anything else → `"upstream"` — transient failure worth a plain retry.
 */
export function classifyUpstreamError(error: unknown): UpstreamErrorCode {
  if (error instanceof BrewfatherError && error.status !== undefined) {
    if (error.status === 401 || error.status === 403) return "reconnect";
    if (error.status === 429) return "rate_limited";
  }
  return "upstream";
}
