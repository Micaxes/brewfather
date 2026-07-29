import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/Logo";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import {
  EXPIRED_SESSION_MESSAGE,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set a new password — Brewable",
};

/**
 * Where a `type=recovery` link lands. The recovery token has already been
 * exchanged for a session by `app/auth/confirm` (or, for links that still use
 * Supabase's stock template, by {@link RecoveryRedirect} on the landing page),
 * so "signed in" is the proof that the link was valid. No session means the
 * link expired, was already used, or was never followed — bounce to /login with
 * that explanation rather than showing a form that cannot work.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?error=${encodeURIComponent(EXPIRED_SESSION_MESSAGE)}`);
  }

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
            Set a new password
          </h1>
          <p className="mb-6 mt-1.5 text-sm leading-relaxed text-dim">
            Choose a new password for{" "}
            <span className="text-ink">{user.email}</span>. You’ll go straight to
            your dashboard once it’s saved.
          </p>

          <ResetPasswordForm initialError={error} />
        </div>

        <p className="mt-5 text-center text-[13px] text-faint">
          At least {MIN_PASSWORD_LENGTH} characters. This replaces your old
          password everywhere.
        </p>
      </div>
    </main>
  );
}
