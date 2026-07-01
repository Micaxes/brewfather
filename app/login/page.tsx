import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { signIn, signUp } from "./actions";

export const metadata: Metadata = {
  title: "Sign in — Brewable",
};

/**
 * Email + password sign-in / sign-up. Already-authenticated users are sent
 * straight to the dashboard. The two buttons submit the same form to different
 * server actions.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const { error, message, next } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Brewable</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to see what you can brew right now.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </p>
      ) : null}

      <form className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-md border border-input bg-background p-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="current-password"
            className="rounded-md border border-input bg-background p-2"
          />
        </label>
        <div className="flex gap-2">
          <button
            formAction={signIn}
            className="flex-1 rounded-md bg-primary p-2 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </button>
          <button
            formAction={signUp}
            className="flex-1 rounded-md border border-input p-2 text-sm font-medium"
          >
            Create account
          </button>
        </div>
      </form>
    </main>
  );
}
