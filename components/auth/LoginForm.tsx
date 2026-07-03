"use client";

import { type FormEvent, useState, useTransition } from "react";

import {
  checkEmail,
  passwordSignIn,
  signUpWithPassword,
} from "@/app/login/actions";

type Step = "email" | "password" | "create";

const inputClass =
  "w-full rounded-xl border border-input bg-white/5 px-3.5 py-3 text-sm text-ink outline-none placeholder:text-faint focus:border-teal/60";

/**
 * Email-first auth: one email field → Continue. If an account exists we reveal a
 * password field to sign in; if not, we reveal one to create the account on the
 * spot (email confirmation is disabled — no emails are ever sent).
 */
export function LoginForm({ initialError }: { initialError?: string }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>(initialError);
  const [pending, startTransition] = useTransition();

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
    </div>
  );
}
