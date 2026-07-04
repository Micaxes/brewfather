import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { formatRelativeTime } from "@/components/brew/format";
import { getBrewfatherConnection } from "@/lib/brewfather/user-credentials";
import { connectBrewfather, disconnectBrewfather, testConnection } from "./actions";

export const metadata: Metadata = {
  title: "Settings — Brewable",
};

/** Brewfather's own settings screen (the API tab lives there). */
const BREWFATHER_SETTINGS_URL = "https://web.brewfather.app/tabs/settings";

/**
 * Connect (or replace / disconnect) the user's Brewfather API key. Submitted
 * keys are verified against Brewfather before being stored (encrypted in
 * Supabase Vault, via a server action); the key is never rendered back to the
 * browser. Shows connection health (last verified) with an on-demand
 * "Test connection" re-validation.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const connection = await getBrewfatherConnection();

  const inputClass =
    "w-full rounded-xl border border-input bg-white/5 px-3.5 py-3 font-display text-sm text-ink outline-none placeholder:text-faint focus:border-teal/60";
  const strongClass = "font-semibold text-ink";

  return (
    <main className="mx-auto flex w-full max-w-2xl animate-[fadein_0.4s_ease] flex-col">
      <h1 className="font-display text-[28px] font-bold tracking-[-0.02em]">
        Settings
      </h1>
      <p className="mt-1.5 text-sm text-dim">
        Connect Brewable to your Brewfather account.
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

      <section className="glass mt-6 rounded-[20px] p-6">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="font-display text-base font-semibold">
            Brewfather connection
          </span>
          {connection.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/25 bg-teal/12 px-3 py-1 text-xs font-semibold text-teal">
              <span className="size-1.5 rounded-full bg-teal shadow-[0_0_8px_var(--teal)]" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/25 bg-amber/12 px-3 py-1 text-xs font-semibold text-amber">
              <span className="size-1.5 rounded-full bg-amber" />
              Not connected
            </span>
          )}
        </div>

        {connection.connected ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="text-sm text-dim">
              Connected as{" "}
              <span className={strongClass}>“{connection.bfUserId}”</span>
              <span
                className="mt-0.5 block text-xs text-faint"
                title={connection.lastValidatedAt ?? undefined}
              >
                {connection.lastValidatedAt
                  ? `Key verified ${formatRelativeTime(connection.lastValidatedAt)} ✓`
                  : "Key not verified yet — run a test."}
              </span>
            </div>
            <form action={testConnection}>
              <button className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-[13px] font-semibold transition-colors hover:border-teal/40 hover:text-teal-bright">
                Test connection
              </button>
            </form>
          </div>
        ) : null}

        <p className="mb-4 text-sm leading-relaxed text-dim">
          {connection.connected
            ? "Enter a new User ID and key below to replace the stored one — we verify with Brewfather before saving."
            : "Paste your Brewfather User ID and API key (see the steps below). We verify them with Brewfather before saving anything."}
          <span className="mt-1 block text-xs text-faint">
            Your User ID is the short token shown next to the key — not your
            account email. Keys are stored encrypted and used only server-side.
          </span>
        </p>

        <form action={connectBrewfather} className="flex flex-col gap-3.5">
          <div>
            <label className="mb-1.5 block text-xs text-dim">User ID</label>
            <input
              name="bf_user_id"
              required
              defaultValue={connection.bfUserId ?? ""}
              placeholder="8kR2mQx…"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-dim">API key</label>
            <input
              name="api_key"
              type="password"
              required
              autoComplete="off"
              placeholder={
                connection.connected ? "•••••••••• (enter to replace)" : ""
              }
              className={inputClass}
            />
          </div>
          <div className="mt-1">
            <button className="brand-gradient rounded-xl px-5 py-2.5 text-sm font-bold">
              {connection.connected ? "Update key" : "Connect"}
            </button>
          </div>
        </form>
      </section>

      <section className="glass mt-4 rounded-[20px] p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold">
            How to get your Brewfather API key
          </h2>
          <a
            href={BREWFATHER_SETTINGS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal-bright hover:underline"
          >
            Open Brewfather settings
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-dim">
          <li>
            Brewfather requires an active{" "}
            <strong className={strongClass}>Premium</strong> subscription to use
            its API.
          </li>
          <li>
            In Brewfather (web or app), open{" "}
            <strong className={strongClass}>Settings → API</strong>.
          </li>
          <li>
            Click <strong className={strongClass}>Generate</strong> to create a
            key, and grant <strong className={strongClass}>read</strong> access
            to <strong className={strongClass}>Recipes</strong> and{" "}
            <strong className={strongClass}>Inventory</strong> — Brewable is
            read-only and never writes to your account.
          </li>
          <li>
            Copy your <strong className={strongClass}>User ID</strong> — the
            short token shown next to the key (e.g.{" "}
            <code className="rounded bg-white/5 px-1 py-0.5 text-xs">
              aBcD1234xyz
            </code>
            ). It is <strong className={strongClass}>not</strong> your account
            email — using the email is the most common mistake.
          </li>
          <li>
            Copy the <strong className={strongClass}>API key</strong> —
            Brewfather shows it <strong className={strongClass}>once</strong>,
            so save it right away.
          </li>
          <li>
            Paste both into the form above and click{" "}
            <strong className={strongClass}>Connect</strong>. We verify them
            with Brewfather before saving, and store the key encrypted — it is
            only ever used server-side.
          </li>
        </ol>
        <p className="mt-3 text-xs text-faint">
          Brewfather allows roughly 500 API calls per hour; Brewable caches your
          data so normal use stays well under that limit.
        </p>
      </section>

      {connection.connected ? (
        <section className="mt-4 rounded-[20px] border border-danger/20 bg-danger/[0.05] p-5">
          <div className="mb-1 font-display text-[15px] font-semibold text-danger">
            Disconnect Brewfather
          </div>
          <p className="mb-3.5 text-sm text-dim">
            Removes your API key and its encrypted copy. Your recipes and
            inventory stay in Brewfather.
          </p>
          <form action={disconnectBrewfather}>
            <button className="rounded-xl border border-danger/25 bg-danger/12 px-4 py-2.5 text-[13px] font-semibold text-danger">
              Disconnect
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
