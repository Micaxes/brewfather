/**
 * HTTP contract for the BFF route `GET /api/brew-candidates`.
 *
 * This is the boundary both the route handler (Task 2) and the dashboard UI
 * (Task 4) code against, so neither reaches into matcher internals. The
 * response is the matcher's `MatchResult` plus sync metadata:
 *
 *   {
 *     candidates: RecipeMatch[];
 *     generatedAt: string;
 *     warnings: string[];
 *     syncedAt: string | null;
 *     cooldownSeconds?: number;
 *   }
 *
 * Extending `MatchResult` keeps the wire shape and the matcher output from
 * drifting apart while leaving room for response-level fields the matcher
 * doesn't know about (sync metadata here; error classification in #23).
 */
import type { MatchResult } from "@/lib/matcher/types";

export type { RecipeMatch } from "@/lib/matcher/types";

/**
 * Minimum interval between manual force-refreshes (`?refresh=true`).
 *
 * The route rejects faster re-syncs on the refresh branch only (serving the
 * cache plus `cooldownSeconds` instead of calling Brewfather), and the client
 * disables the "Sync now" button while `now - syncedAt` is inside this
 * window. Normal (param-less) dashboard loads are never throttled.
 */
export const SYNC_COOLDOWN_MS = 60 * 1000;

/**
 * Classification of an upstream Brewfather failure (#23), carried on failed
 * responses so the client can drive the right UI:
 *
 * - `"reconnect"` — Brewfather rejected the stored key (401/403: revoked,
 *   expired, or insufficient scope). Prompt the user to reconnect in Settings.
 * - `"rate_limited"` — Brewfather returned 429. Wait it out; the key is fine.
 * - `"upstream"` — transient upstream/network trouble. Plain retry.
 */
export type UpstreamErrorCode = "reconnect" | "rate_limited" | "upstream";

/** Response body of `GET /api/brew-candidates`. */
export interface BrewCandidatesResponse extends MatchResult {
  /**
   * `fetched_at` of the user's Brewfather cache row — the last *successful*
   * sync, written only after a full upstream fetch resolved. `null` when the
   * user has never synced (no cache row) or isn't connected.
   */
  syncedAt: string | null;
  /**
   * Present only when a `?refresh=true` request was rejected by the sync
   * cooldown: seconds until a manual re-sync is allowed again. The response
   * still carries the (cached) candidates, so this is a signal, not an error.
   */
  cooldownSeconds?: number;
  /**
   * Present only on failed (non-2xx) responses: classifies the upstream
   * Brewfather failure so the dashboard shows a reconnect prompt / wait
   * notice / retry hint instead of one generic error.
   */
  errorCode?: UpstreamErrorCode;
}
