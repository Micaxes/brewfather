import type { Metadata } from "next";

import { getBrewfatherConnection } from "@/lib/brewfather/user-credentials";
import { connectBrewfather, disconnectBrewfather } from "./actions";

export const metadata: Metadata = {
  title: "Settings — Brewable",
};

/**
 * Connect (or replace / disconnect) the user's Brewfather API key. The key is
 * stored encrypted in Supabase Vault via a server action; it is never rendered
 * back to the browser.
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
        <p className="mb-4 text-sm leading-relaxed text-dim">
          {connection.connected
            ? `Connected as Brewfather user “${connection.bfUserId}”. Re-submit to replace your key.`
            : "Generate a read-only API key in Brewfather under Settings → API (requires Premium), then paste your User ID and key here."}
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
              {connection.connected ? "Update key" : "Save & sync"}
            </button>
          </div>
        </form>
      </section>

      {connection.connected ? (
        <section className="mt-4 rounded-[20px] border border-danger/20 bg-danger/[0.05] p-5">
          <div className="mb-1 font-display text-[15px] font-semibold text-danger">
            Disconnect Brewfather
          </div>
          <p className="mb-3.5 text-sm text-dim">
            Removes your API key. Your recipes and inventory stay in Brewfather.
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
