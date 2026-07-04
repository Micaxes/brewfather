"use client";

import { type FormEvent, useState, useTransition } from "react";

import {
  checkEmail,
  passwordSignIn,
  signUpWithPassword,
} from "@/app/login/actions";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "password" | "create";

const inputClass =
  "w-full rounded-xl border border-input bg-white/5 px-3.5 py-3 text-sm text-ink outline-none placeholder:text-faint focus:border-teal/60";

/** Official multi-color Google "G" (branding guidelines: never recolored). */
function GoogleLogo() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      className="flex-none"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/**
 * Email-first auth: one email field → Continue. If an account exists we reveal a
 * password field to sign in; if not, we reveal one to create the account on the
 * spot (email confirmation is disabled — no emails are ever sent). Below the
 * form, "Continue with Google" starts the Supabase OAuth (PKCE) redirect flow.
 */
export function LoginForm({ initialError }: { initialError?: string }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>(initialError);
  const [pending, startTransition] = useTransition();
  const [googleLoading, setGoogleLoading] = useState(false);

  async function signInWithGoogle() {
    setError(undefined);
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      // On success the browser navigates to Google; only re-enable on error.
      if (oauthError) {
        setGoogleLoading(false);
        setError("Could not start Google sign-in. Please try again.");
      }
    } catch {
      setGoogleLoading(false);
      setError("Could not start Google sign-in. Please try again.");
    }
  }

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const value = email.trim();
    if (!value) return;
    startTransition(async () => {
      const res = await checkEmail(value);
      if (res.error) setError(res.error);
      else setStep(res.exists ? "password" : "create");
    });
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const password = String(
      new FormData(event.currentTarget).get("password") ?? ""
    );
    const isNewAccount = step === "create";
    startTransition(async () => {
      const res = isNewAccount
        ? await signUpWithPassword(email, password)
        : await passwordSignIn(email, password);
      if (res?.error) {
        setError(res.error);
        // Someone beat us to this email — switch to the sign-in step.
        if ("accountExists" in res && res.accountExists) setStep("password");
      }
      // On success the action redirects to /dashboard.
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {step === "email" ? (
        <form onSubmit={submitEmail} className="flex flex-col gap-3.5">
          <div>
            <label className="mb-1.5 block text-xs text-dim">Email address</label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              placeholder="you@brewhaus.co"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="brand-gradient w-full rounded-xl py-3 text-[15px] font-bold disabled:opacity-70"
          >
            {pending ? "Checking…" : "Continue"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitPassword} className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate text-ink">{email}</span>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(undefined);
              }}
              className="ml-3 flex-none font-semibold text-teal-bright"
            >
              Change
            </button>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-dim">
              {step === "create" ? "Create a password" : "Password"}
            </label>
            <input
              type="password"
              name="password"
              required
              autoFocus
              minLength={6}
              autoComplete={
                step === "create" ? "new-password" : "current-password"
              }
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="brand-gradient w-full rounded-xl py-3 text-[15px] font-bold disabled:opacity-70"
          >
            {pending
              ? step === "create"
                ? "Creating account…"
                : "Signing in…"
              : step === "create"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-faint">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        or continue with
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>

      {/*
       * Google-branded button (dark variant per the Sign in with Google
       * branding guidelines): fill #131314, 1px stroke #8E918F, text #E3E3E3,
       * 14px/20px medium, unaltered multi-color "G".
       */}
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={googleLoading}
        aria-busy={googleLoading}
        className="flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-[#8E918F] bg-[#131314] px-3.5 py-3 text-sm/5 font-medium text-[#E3E3E3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70"
      >
        {googleLoading ? (
          <span
            aria-hidden="true"
            className="size-5 flex-none animate-spin rounded-full border-2 border-[#8E918F] border-t-[#E3E3E3]"
          />
        ) : (
          <GoogleLogo />
        )}
        Continue with Google
      </button>
      <span aria-live="polite" role="status" className="sr-only">
        {googleLoading ? "Redirecting to Google to continue sign-in." : ""}
      </span>
    </div>
  );
}
