import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { RecoveryRedirect } from "@/components/auth/RecoveryRedirect";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Supabase's stock recovery template lands here with the token in the
          URL fragment; forward those visitors to the password form. */}
      <RecoveryRedirect />
      <div className="pointer-events-none absolute -top-32 right-[-120px] h-[420px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(245,166,35,0.22),transparent_66%)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-140px] left-[-120px] h-[420px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(77,208,225,0.18),transparent_66%)] blur-3xl" />

      <div className="relative flex max-w-xl flex-col items-center gap-6">
        <Logo size="lg" />
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
          What can you brew tonight?
        </h1>
        <p className="max-w-md text-lg text-dim">
          Brewable matches your live Brewfather inventory against every recipe in
          your library — so you always know what you can brew right now.
        </p>
        <Link
          href="/dashboard"
          className="brand-gradient rounded-xl px-7 py-3.5 text-[15px] font-bold"
        >
          Open the dashboard →
        </Link>
        <p className="text-sm text-faint">
          New to Brewable?{" "}
          <Link href="/login" className="font-semibold text-teal-bright">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
