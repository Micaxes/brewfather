"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  deleteUserBrewfatherCredentials,
  getUserBrewfatherCredentials,
  saveUserBrewfatherCredentials,
  touchBrewfatherValidated,
  validateBrewfatherCredentials,
  type CredentialValidationFailure,
} from "@/lib/brewfather/user-credentials";

const SETTINGS = "/dashboard/settings";

/** User-facing copy per validation failure. Never echoes the submitted values. */
const VALIDATION_ERRORS: Record<CredentialValidationFailure, string> = {
  invalid:
    "Brewfather rejected that User ID + API key, so nothing was saved. Double-check both — the User ID is the short token from Brewfather’s Settings → API, not your email.",
  rate_limited:
    "Brewfather is rate-limiting requests right now. Wait a minute and try again.",
  unreachable:
    "Couldn’t reach Brewfather to verify the key, so nothing was saved. Please try again.",
};

function redirectWithError(message: string): never {
  redirect(`${SETTINGS}?error=${encodeURIComponent(message)}`);
}

function redirectWithMessage(message: string): never {
  redirect(`${SETTINGS}?message=${encodeURIComponent(message)}`);
}

/**
 * Connect (or rotate) the user's Brewfather key. The pair is validated with a
 * live Brewfather call FIRST — an unverified key is never stored, so
 * "connected" always means "worked at least once".
 */
export async function connectBrewfather(formData: FormData): Promise<void> {
  const bfUserId = String(formData.get("bf_user_id") ?? "").trim();
  const apiKey = String(formData.get("api_key") ?? "").trim();
  if (!bfUserId || !apiKey) {
    redirectWithError("Both fields are required.");
  }

  const validation = await validateBrewfatherCredentials(bfUserId, apiKey);
  if (!validation.ok) {
    redirectWithError(VALIDATION_ERRORS[validation.reason]);
  }

  try {
    await saveUserBrewfatherCredentials(bfUserId, apiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save credentials.";
    redirectWithError(message);
  }
  revalidatePath("/dashboard", "layout");
  redirectWithMessage("Brewfather connected — key verified and stored encrypted.");
}

/**
 * Re-validate the stored key on demand ("Test connection") and refresh the
 * last-verified timestamp on success.
 */
export async function testConnection(): Promise<void> {
  const credentials = await getUserBrewfatherCredentials();
  if (!credentials) {
    redirectWithError("Connect your Brewfather account first.");
  }

  const validation = await validateBrewfatherCredentials(
    credentials.userId,
    credentials.apiKey
  );
  if (!validation.ok) {
    redirectWithError(
      validation.reason === "invalid"
        ? "Your stored key no longer works — it may have been revoked in Brewfather. Enter a new key below to reconnect."
        : VALIDATION_ERRORS[validation.reason]
    );
  }

  try {
    await touchBrewfatherValidated();
  } catch {
    // The live check itself passed; a failed timestamp write shouldn't turn
    // a healthy connection into an error.
  }
  revalidatePath("/dashboard", "layout");
  redirectWithMessage("Connection verified — your Brewfather key works.");
}

export async function disconnectBrewfather(): Promise<void> {
  try {
    // Deletes the credentials row AND its Vault secret (migration 0001).
    await deleteUserBrewfatherCredentials();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect.";
    redirectWithError(message);
  }
  revalidatePath("/dashboard", "layout");
  redirectWithMessage("Brewfather account disconnected.");
}
