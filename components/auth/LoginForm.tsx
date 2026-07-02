"use client";

import { MailCheck } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";

import {
  checkEmail,
  passwordSignIn,
  sendSignInLink,
  sendSignupLink,
} from "@/app/login/actions";

type Step = "email" | "password" | "sent";

const inputClass =
  "w-full rounded-xl border border-input bg-white/5 px-3.5 py-3 text-sm text-ink outline-none placeholder:text-faint focus:border-teal/60";

/**
 * Email-first auth: one email field → Continue. If an account exists we reveal a
 * password field; if not, we email a passwordless magic sign-in link.
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
      const { exists } = await checkEmail(value);
      if (exists) {
        setStep("password");
        return;
      }
      const res = await sendSignupLink(value);
      if (res.error) setError(res.error);
      else setStep("sent");
    });
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const password = String(
      new FormData(event.currentTarget).get("password") ?? ""
    );
    startTransition(async () => {
      const res = await passwordSignIn(email, password);
      if (res?.error) setError(res.error);
      // On success the action redirects to /dashboard.
    });
  }

  function magicLinkInstead() {
    setError(undefined);
    startTransition(async () => {
      const res = await sendSignInLink(email);
      if (res.error) setError(res.error);
      else setStep("sent");
    });
  }

  if (step === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="flex size-11 items-center justify-center rounded-2xl border border-teal/25 bg-teal/12">
          <MailCheck className="size-5 text-teal-bright" strokeWidth={2} />
        </div>
        <h2 className="font-display text-lg font-semibold">Check your email</h2>
        <p className="text-sm text-dim">
          We sent a sign-in link to <span className="text-ink">{email}</span>.
          Open it on this device to continue.
        </p>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setError(undefined);
          }}
          className="mt-1 text-sm font-semibold text-teal-bright"
        >
          Use a different email
        </button>
      </div>
    );
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
            <label className="mb-1.5 block text-xs text-dim">Password</label>
            <input
              type="password"
              name="password"
              required
              autoFocus
              minLength={6}
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="brand-gradient w-full rounded-xl py-3 text-[15px] font-bold disabled:opacity-70"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={magicLinkInstead}
            disabled={pending}
            className="text-center text-[13px] font-semibold text-teal-bright"
          >
            Email me a sign-in link instead
          </button>
        </form>
      )}
    </div>
  );
}
