"use client";

import { type FormEvent, useState, useTransition } from "react";

import { updatePassword } from "@/app/reset-password/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

const inputClass =
  "w-full rounded-xl border border-input bg-white/5 px-3.5 py-3 text-sm text-ink outline-none placeholder:text-faint focus:border-teal/60";

/**
 * Set-a-new-password form. Mirrors {@link LoginForm}'s conventions: the server
 * action returns `{ error }` for inline rendering and redirects on success.
 */
export function ResetPasswordForm({ initialError }: { initialError?: string }) {
  const [error, setError] = useState<string | undefined>(initialError);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirm_password") ?? "");

    startTransition(async () => {
      const res = await updatePassword(password, confirmPassword);
      if (res?.error) setError(res.error);
      // On success the action redirects to /dashboard.
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs text-dim">
          New password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          required
          autoFocus
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="confirm_password"
          className="mb-1.5 block text-xs text-dim"
        >
          Confirm new password
        </label>
        <input
          id="confirm_password"
          type="password"
          name="confirm_password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient w-full rounded-xl py-3 text-[15px] font-bold disabled:opacity-70"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
