"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Whether an account already exists for `email` (server-side, service-role only). */
export async function checkEmail(
  email: string
): Promise<{ exists?: boolean; error?: string }> {
  const clean = email.trim().toLowerCase();
  if (!clean) return { exists: false };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("email_exists", { p_email: clean });
  if (error) {
    console.error("email_exists rpc failed:", error.message);
    return { error: "Something went wrong checking that email. Please try again." };
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

/**
 * Create a new account with email + password. Email confirmation is disabled on
 * the Supabase project, so this returns a live session (no email is sent) and
 * lands the user straight in the dashboard.
 */
export async function signUpWithPassword(
  email: string,
  password: string
): Promise<{ error?: string; accountExists?: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) {
    if (error.code === "user_already_exists") {
      return {
        accountExists: true,
        error: "That account already exists — sign in with your password instead.",
      };
    }
    return { error: error.message };
  }
  if (!data.session) {
    // Happens when "Confirm email" is still ON in the Supabase dashboard: the
    // user row is created but no session comes back. Fail loudly instead of
    // redirecting into the route guard's silent bounce.
    return {
      error:
        "The server still requires email confirmation. Turn off “Confirm email” in Supabase (Authentication → Sign In / Providers → Email) and try again.",
    };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
