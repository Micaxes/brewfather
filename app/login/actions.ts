"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Whether an account already exists for `email` (server-side, service-role only). */
export async function checkEmail(email: string): Promise<{ exists: boolean }> {
  const clean = email.trim().toLowerCase();
  if (!clean) return { exists: false };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("email_exists", { p_email: clean });
  if (error) {
    console.error("email_exists rpc failed:", error.message);
    return { exists: false };
  }
  return { exists: data === true };
}

/** Sign in an existing account with a password. Redirects on success. */
export async function passwordSignIn(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Create a new account passwordlessly by emailing a magic sign-in link. */
export async function sendSignupLink(
  email: string
): Promise<{ error?: string; sent?: boolean }> {
  const origin = await getOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
    },
  });
  if (error) return { error: error.message };
  return { sent: true };
}

/** Email an existing account a one-time sign-in link (password fallback). */
export async function sendSignInLink(
  email: string
): Promise<{ error?: string; sent?: boolean }> {
  const origin = await getOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
    },
  });
  if (error) return { error: error.message };
  return { sent: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
