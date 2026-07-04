/**
 * Per-user Brewfather credential access (server-only).
 *
 * Reads/writes the signed-in user's Brewfather key via Supabase RPCs backed by
 * Vault (see supabase/migrations/0001_brewfather_credentials.sql). The decrypted
 * API key is only ever handled here on the server (the BFF), never sent to the
 * browser. Import from server code only.
 */
import {
  BrewfatherError,
  createBrewfatherClient,
  type BrewfatherClientOptions,
} from "@/lib/brewfather/client";
import { createClient } from "@/lib/supabase/server";

export interface UserBrewfatherCredentials {
  /** Brewfather user id. */
  userId: string;
  /** Brewfather API key (decrypted from Vault). */
  apiKey: string;
}

/** Why a credential validation attempt failed. */
export type CredentialValidationFailure = "invalid" | "rate_limited" | "unreachable";

export type CredentialValidationResult =
  | { ok: true }
  | { ok: false; reason: CredentialValidationFailure };

/**
 * Test a User ID + API key pair against Brewfather with one cheap
 * authenticated read (a single-item inventory request). Never throws — maps
 * failures to a reason the Settings UI can phrase:
 *
 * - `invalid` — Brewfather rejected the pair (401/403): wrong values, revoked
 *   key, or insufficient scope. Do not store.
 * - `rate_limited` — Brewfather returned 429; the pair may be fine, try later.
 * - `unreachable` — network/5xx trouble; verdict unknown, try again.
 *
 * The key is used only to build the auth header and is never logged or
 * included in the result.
 */
export async function validateBrewfatherCredentials(
  bfUserId: string,
  apiKey: string,
  options: Pick<BrewfatherClientOptions, "fetchImpl" | "baseUrl"> = {}
): Promise<CredentialValidationResult> {
  try {
    const client = createBrewfatherClient({
      userId: bfUserId,
      apiKey,
      // Fail fast: a validation answer should be immediate, not sleep through
      // 429 backoff inside a server action.
      maxRetries: 0,
      ...options,
    });
    await client.ping();
    return { ok: true };
  } catch (error) {
    if (error instanceof BrewfatherError) {
      if (error.status === 401 || error.status === 403) {
        return { ok: false, reason: "invalid" };
      }
      if (error.status === 429) {
        return { ok: false, reason: "rate_limited" };
      }
    }
    return { ok: false, reason: "unreachable" };
  }
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

/**
 * Remove the current user's stored Brewfather credentials. The underlying RPC
 * (`delete_brewfather_credentials`, migration 0001) deletes both the row and
 * its Vault secret, so no orphaned secret survives a disconnect.
 */
export async function deleteUserBrewfatherCredentials(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_brewfather_credentials");
  if (error) throw new Error(error.message);
}

/**
 * Stamp `last_validated_at = now()` on the current user's credentials row
 * after a successful "Test connection" (RPC from migration 0004).
 */
export async function touchBrewfatherValidated(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("touch_brewfather_validated");
  if (error) throw new Error(error.message);
}

export interface BrewfatherConnection {
  connected: boolean;
  bfUserId?: string;
  /** When the key was last verified against Brewfather (ISO), null if never. */
  lastValidatedAt?: string | null;
}

/** The current user's connection status + health (without decrypting the key). */
export async function getBrewfatherConnection(): Promise<BrewfatherConnection> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { connected: false };

  const { data, error } = await supabase
    .from("brewfather_credentials")
    .select("bf_user_id, last_validated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  let row = data as
    | { bf_user_id?: string; last_validated_at?: string | null }
    | null;
  if (error) {
    // `last_validated_at` ships in migration 0004 — if that migration hasn't
    // been applied yet, still report the connection itself.
    const { data: bare } = await supabase
      .from("brewfather_credentials")
      .select("bf_user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    row = bare as { bf_user_id?: string } | null;
  }

  if (!row?.bf_user_id) return { connected: false };
  return {
    connected: true,
    bfUserId: row.bf_user_id,
    lastValidatedAt: row.last_validated_at ?? null,
  };
}
