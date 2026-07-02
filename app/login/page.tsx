import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/Logo";
import { createClient } from "@/lib/supabase/server";
import { signIn, signUp } from "./actions";

export const metadata: Metadata = {
  title: "Sign in — Brewable",
};

/**
 * Email + password sign-in / sign-up in the Brewable glass-card style.
 * Already-authenticated users are sent straight to the dashboard.
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

  const inputClass =
    "w-full rounded-xl border border-input bg-white/5 px-3.5 py-3 text-sm text-ink outline-none placeholder:text-faint focus:border-teal/60";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-8">
      <div className="pointer-events-none absolute -top-36 right-[-120px] h-[420px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(245,166,35,0.22),transparent_66%)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-40px] left-[-120px] h-[420px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(77,208,225,0.18),transparent_66%)] blur-3xl" />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-7 flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="glass rounded-[22px] p-8 shadow-[0_40px_90px_rgba(3,10,22,0.5)]">
          <h1 className="font-display text-2xl font-bold tracking-[-0.01em]">
            What can you brew tonight?
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-dim">
            Sign in to match your Brewfather inventory against every recipe in
            your library.
          </p>

          {error ? (
            <p className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-5 rounded-xl border border-teal/25 bg-teal/10 p-3 text-sm text-teal-bright">
              {message}
            </p>
          ) : null}

          <form className="mt-6 flex flex-col gap-3.5">
            <input type="hidden" name="next" value={next ?? "/dashboard"} />
            <div>
              <label className="mb-1.5 block text-xs text-dim">Email address</label>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@brewhaus.co"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-dim">Password</label>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete="current-password"
                className={inputClass}
              />
            </div>
            <div className="mt-1 flex flex-col gap-2.5">
              <button
                formAction={signIn}
                className="brand-gradient w-full rounded-xl py-3 text-[15px] font-bold"
              >
                Sign in
              </button>
              <button
                formAction={signUp}
                className="w-full rounded-xl border border-input bg-white/5 py-3 text-sm font-semibold text-ink"
              >
                Create account
              </button>
            </div>
          </form>
        </div>

        <p className="mt-5 text-center text-[13px] text-faint">
          Your Brewfather key is stored encrypted and only used server-side.
        </p>
      </div>
    </main>
  );
}
