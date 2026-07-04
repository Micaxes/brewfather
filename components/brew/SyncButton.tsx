"use client";

/**
 * "Sync now" control for the dashboard header.
 *
 * Renders the idle / syncing / success / error states, the post-sync cooldown
 * countdown, and the auto-ticking "Last synced" label. The actual request —
 * and the brief `justSynced` success flash — live in
 * `DashboardClient.refresh()`; this component only reflects that status and
 * calls `onSync`.
 *
 * This is pending UI, not optimistic UI: the button never claims "Synced"
 * until the fetch has actually resolved.
 */
import { AlertCircle, Check, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { SYNC_COOLDOWN_MS } from "@/lib/api-contract";
import { formatRelativeTime } from "@/components/brew/format";

/** Re-render cadence for the relative "Last synced" label while idle. */
const RELATIVE_TICK_MS = 30_000;

/** Manual-sync status owned by `DashboardClient`, consumed by the button. */
export interface SyncStatus {
  /** True while the manual `?refresh=true` request is in flight. */
  syncing: boolean;
  /** Persistent message when the last manual sync failed, else null. */
  error: string | null;
  /** True for ~2 s after a manual sync settles cleanly ("Synced" flash). */
  justSynced?: boolean;
  /** Starts a manual sync (no-ops while one is already in flight). */
  onSync: () => void;
}

export function SyncButton({
  syncedAt,
  syncing,
  error,
  justSynced = false,
  onSync,
}: SyncStatus & {
  /** Server `fetched_at` of the last successful sync; null = never synced. */
  syncedAt: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  // Cooldown is computed from the authoritative server timestamp, mirroring
  // the route's own `now - fetched_at` check, so the button disables itself
  // exactly while the server would reject a re-sync.
  const syncedAtMs = syncedAt ? Date.parse(syncedAt) : Number.NaN;
  const elapsedMs = Number.isFinite(syncedAtMs)
    ? Math.max(0, now - syncedAtMs)
    : Number.POSITIVE_INFINITY;
  const cooldownSecondsLeft =
    elapsedMs < SYNC_COOLDOWN_MS
      ? Math.ceil((SYNC_COOLDOWN_MS - elapsedMs) / 1000)
      : 0;
  const inCooldown = cooldownSecondsLeft > 0;

  // Auto-tick so "Last synced" never silently goes stale; tick every second
  // while a cooldown countdown is visible.
  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now()),
      inCooldown ? 1000 : RELATIVE_TICK_MS
    );
    return () => clearInterval(timer);
  }, [inCooldown]);

  // Disabled is enforced in logic (not visually): while in flight, and while
  // the server-side cooldown would reject a re-sync. An error keeps the
  // button enabled so it can act as "Retry".
  const disabled = syncing || (inCooldown && error === null);

  let label = "Sync now";
  let icon = <RefreshCw className="size-4" aria-hidden="true" />;
  if (syncing) {
    label = "Syncing…";
    icon = <RefreshCw className="size-4 animate-spin" aria-hidden="true" />;
  } else if (error !== null) {
    label = "Sync failed — Retry";
    icon = <AlertCircle className="size-4" aria-hidden="true" />;
  } else if (justSynced) {
    label = "Synced";
    icon = <Check className="size-4" aria-hidden="true" />;
  }

  // Polite announcements for state transitions only. The error is announced
  // by its own role="alert" below, and the per-second countdown deliberately
  // stays out of the live region so it doesn't spam screen readers.
  const announcement = syncing ? "Syncing…" : justSynced ? "Synced" : "";

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={onSync}
        disabled={disabled}
        aria-busy={syncing}
        className={`inline-flex min-w-[128px] items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-bright disabled:cursor-not-allowed disabled:opacity-60 ${
          error !== null
            ? "border-danger/40 bg-danger/[0.08] text-danger hover:bg-danger/[0.14]"
            : justSynced
              ? "border-teal/40 bg-teal/10 text-teal-bright"
              : "border-white/12 bg-white/[0.04] hover:border-teal/40 hover:text-teal-bright"
        }`}
      >
        {icon}
        {label}
      </button>

      {/* Live region present before its text changes, so transitions announce. */}
      <span role="status" aria-atomic="true" className="sr-only">
        {announcement}
      </span>

      <span
        className="text-xs text-faint"
        title={syncedAt ? new Date(syncedAt).toLocaleString() : undefined}
      >
        {syncedAt
          ? `Last synced ${formatRelativeTime(syncedAt, now)}`
          : "Never synced"}
      </span>

      {inCooldown && !syncing && error === null && !justSynced ? (
        <span className="text-xs text-dim">
          You can sync again in {cooldownSecondsLeft}s
        </span>
      ) : null}

      {error !== null ? (
        <p role="alert" className="max-w-xs text-xs text-danger sm:text-right">
          {error}
        </p>
      ) : null}
    </div>
  );
}
