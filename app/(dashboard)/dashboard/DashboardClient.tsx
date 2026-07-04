"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { BrewCandidatesResponse } from "@/lib/api-contract";
import {
  DashboardView,
  type DashboardState,
} from "@/components/brew/DashboardView";
import type { SyncStatus } from "@/components/brew/SyncButton";

const SYNC_ERROR_MESSAGE =
  "Couldn’t reach Brewfather. Check your API key or retry.";

/** How long the green "Synced" confirmation stays on the button. */
const SUCCESS_FLASH_MS = 1800;

/**
 * Client wrapper that fetches `GET /api/brew-candidates` and drives the
 * dashboard's loading / error / ready states, plus the manual "Sync now"
 * flow (`?refresh=true`). The mock fixture (`mock-brew-candidates.ts`) is
 * retained for tests but no longer used here.
 */
export function DashboardClient() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [justSynced, setJustSynced] = useState(false);
  // Synchronous single-flight guard so rapid double-clicks (or Enter-key
  // repeats) collapse to one request even before React re-renders.
  const syncInFlight = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drop a pending "Synced" flash timer on unmount.
  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const res = await fetch("/api/brew-candidates");
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data = (await res.json()) as BrewCandidatesResponse;
        if (active) setState({ status: "ready", data });
      } catch (error) {
        if (active) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unknown error loading brew candidates.",
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  /**
   * Manual "Sync now": re-fetches with `?refresh=true`, which forces the
   * route to call Brewfather, repopulate the cache, and return freshly
   * re-ranked candidates — the dashboard updates in place from that one
   * response. Stale-while-revalidate: unlike the initial load's
   * throw-to-error path, a failed sync keeps the last-good candidates on
   * screen and surfaces a non-destructive inline error by the button.
   */
  const refresh = useCallback(async () => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setSyncing(true);
    setSyncError(null);
    setJustSynced(false);
    try {
      const res = await fetch("/api/brew-candidates?refresh=true");
      if (!res.ok) {
        throw new Error(`Sync failed with status ${res.status}`);
      }
      const data = (await res.json()) as BrewCandidatesResponse;
      setState({ status: "ready", data });
      // Flash "Synced" only when the server actually re-synced — a
      // cooldown-rejected refresh served cache and must not claim success.
      if (data.cooldownSeconds === undefined) {
        setJustSynced(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(
          () => setJustSynced(false),
          SUCCESS_FLASH_MS
        );
      }
    } catch {
      setSyncError(SYNC_ERROR_MESSAGE);
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  }, []);

  const sync: SyncStatus = {
    syncing,
    error: syncError,
    justSynced,
    onSync: () => void refresh(),
  };

  return <DashboardView state={state} sync={sync} />;
}
