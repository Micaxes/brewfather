import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/Logo";
import { LoginForm } from "@/components/auth/LoginForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in — Brewable",
};

/**
 * Email-first sign in / sign up. The interactive flow lives in {@link LoginForm};
 * already-authenticated users are sent straight to the dashboard.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

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
          <p className="mb-6 mt-1.5 text-sm leading-relaxed text-dim">
            Enter your email to sign in, or create an account — we’ll match your
            Brewfather inventory against every recipe in your library.
          </p>

          <LoginForm initialError={error} />
        </div>

        <p className="mt-5 text-center text-[13px] text-faint">
          New here? Just pick a password — no confirmation email needed. Your
          Brewfather key is stored encrypted and only used server-side.
        </p>
      </div>
    </main>
  );
}
