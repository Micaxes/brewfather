import type { Metadata } from "next";
import Link from "next/link";

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

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <Link href="/dashboard" className="text-sm text-muted-foreground underline">
          ← Dashboard
        </Link>
      </div>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border p-5">
        <div>
          <h2 className="font-medium">Brewfather connection</h2>
          <p className="text-sm text-muted-foreground">
            {connection.connected
              ? `Connected as Brewfather user "${connection.bfUserId}". Re-submit to update your key.`
              : "Connect your Brewfather account to load your inventory and recipes."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate a read key in Brewfather → Settings → API (requires Premium).
            Your key is stored encrypted and only used server-side.
          </p>
        </div>

        <form action={connectBrewfather} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Brewfather user id
            <input
              name="bf_user_id"
              required
              defaultValue={connection.bfUserId ?? ""}
              className="rounded-md border border-input bg-background p-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Brewfather API key
            <input
              name="api_key"
              type="password"
              required
              autoComplete="off"
              placeholder={connection.connected ? "•••••••• (enter to replace)" : ""}
              className="rounded-md border border-input bg-background p-2"
            />
          </label>
          <button className="rounded-md bg-primary p-2 text-sm font-medium text-primary-foreground">
            {connection.connected ? "Update key" : "Connect"}
          </button>
        </form>

        {connection.connected ? (
          <form action={disconnectBrewfather}>
            <button className="text-sm text-red-700 underline">Disconnect</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
