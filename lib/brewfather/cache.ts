/**
 * Per-user cache of normalized Brewfather data (server-only).
 *
 * Backed by the `brewfather_data_cache` table (owner-only RLS). The BFF serves
 * cached inventory/recipes when they are fresher than {@link CACHE_TTL_MS},
 * otherwise it refetches and repopulates the cache. This keeps repeated
 * dashboard loads well under Brewfather's 500 calls/hr limit.
 */
import type { BrewfatherData } from "@/lib/brewfather/client";
import { createClient } from "@/lib/supabase/server";

/** How long cached data stays fresh (10 minutes). */
export const CACHE_TTL_MS = 10 * 60 * 1000;

/** The current user's cached data if present and still fresh, else null. */
export async function getFreshCachedData(now: number = Date.now()): Promise<BrewfatherData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("brewfather_data_cache")
    .select("data, fetched_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;

  const fetchedAt = new Date(data.fetched_at as string).getTime();
  if (!Number.isFinite(fetchedAt) || now - fetchedAt > CACHE_TTL_MS) return null;
  return data.data as BrewfatherData;
}

/**
 * When the current user's cache row was last written (`fetched_at`), i.e. the
 * last successful Brewfather sync, or null when no row exists. Unlike
 * {@link getFreshCachedData} this ignores the TTL — it powers the dashboard's
 * "Last synced" label and the manual-sync cooldown.
 */
export async function getLastSyncedAt(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("brewfather_data_cache")
    .select("fetched_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data?.fetched_at) return null;
  return data.fetched_at as string;
}

/**
 * Upsert the current user's cached data with a fresh timestamp.
 *
 * Returns the `fetched_at` that was written, or null when the write did not
 * land (no authenticated user, or the upsert failed) — callers that need a
 * success signal (e.g. "Last synced") must not treat a resolved promise as
 * proof the row updated.
 */
export async function setCachedData(
  payload: BrewfatherData
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const fetchedAt = new Date().toISOString();
  const { error } = await supabase.from("brewfather_data_cache").upsert({
    user_id: user.id,
    data: payload,
    fetched_at: fetchedAt,
  });
  if (error) {
    console.error("brewfather cache write failed:", error.message);
    return null;
  }
  return fetchedAt;
}
