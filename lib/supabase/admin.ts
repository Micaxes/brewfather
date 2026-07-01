/**
 * Admin Supabase client (server-only). Uses the SECRET key, which bypasses RLS,
 * so it must never reach the browser or be used with untrusted input. Intended
 * for privileged server work (e.g. reading a user's Vault-encrypted Brewfather
 * key at call time). No session persistence.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.");
  }
  return createSupabaseClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
