"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  EXPIRED_SESSION_MESSAGE,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/server";

/**
 * Set a new password for the currently-signed-in user.
 *
 * Reached with the session a `type=recovery` link established (see
 * `app/auth/confirm`), or by an already-signed-in user changing their password.
 * Returns `{ error }` for the client form to render; redirects on success.
 */
export async function updatePassword(
  password: string,
  confirmPassword: string
): Promise<{ error?: string }> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password !== confirmPassword) {
    return { error: "Those passwords don’t match." };
  }

  const supabase = await createClient();

  // getUser() revalidates with Supabase — a recovery session that expired
  // between page load and submit fails here rather than silently no-op'ing.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: EXPIRED_SESSION_MESSAGE };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
