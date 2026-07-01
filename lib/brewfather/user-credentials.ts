/**
 * Per-user Brewfather credential access (server-only).
 *
 * Reads/writes the signed-in user's Brewfather key via Supabase RPCs backed by
 * Vault (see supabase/migrations/0001_brewfather_credentials.sql). The decrypted
 * API key is only ever handled here on the server (the BFF), never sent to the
 * browser. Import from server code only.
 */
import { createClient } from "@/lib/supabase/server";

export interface UserBrewfatherCredentials {
  /** Brewfather user id (BF_USER_ID). */
  userId: string;
  /** Brewfather API key (decrypted from Vault). */
  apiKey: string;
}

/** The current user's decrypted Brewfather credentials, or null if not connected. */
export async function getUserBrewfatherCredentials(): Promise<UserBrewfatherCredentials | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("get_brewfather_credentials");
  if (error) {
    console.error("get_brewfather_credentials failed:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? (data[0] as { bf_user_id?: string; api_key?: string } | undefined) : null;
  if (!row?.bf_user_id || !row?.api_key) return null;
  return { userId: row.bf_user_id, apiKey: row.api_key };
}

/** Store (or replace) the current user's Brewfather credentials (key → Vault). */
export async function saveUserBrewfatherCredentials(
  bfUserId: string,
  apiKey: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("store_brewfather_credentials", {
    p_bf_user_id: bfUserId,
    p_api_key: apiKey,
  });
  if (error) throw new Error(error.message);
}

/** Remove the current user's stored Brewfather credentials. */
export async function deleteUserBrewfatherCredentials(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_brewfather_credentials");
  if (error) throw new Error(error.message);
}

/** Whether the current user has connected Brewfather (without decrypting the key). */
export async function getBrewfatherConnection(): Promise<{
  connected: boolean;
  bfUserId?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { connected: false };

  const { data } = await supabase
    .from("brewfather_credentials")
    .select("bf_user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.bf_user_id ? { connected: true, bfUserId: data.bf_user_id } : { connected: false };
}
