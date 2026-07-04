"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  BrewCandidatesResponse,
  UpstreamErrorCode,
} from "@/lib/api-contract";
import {
  DashboardView,
  type DashboardState,
} from "@/components/brew/DashboardView";
import type { SyncStatus } from "@/components/brew/SyncButton";

/** Inline sync-failure copy per upstream failure class (#23). */
const SYNC_ERROR_MESSAGES: Record<UpstreamErrorCode, string> = {
  reconnect:
    "Brewfather rejected your API key. Reconnect it in Settings to keep syncing.",
  rate_limited:
    "Brewfather is rate-limiting requests. Try again in a few minutes.",
  upstream: "Couldn’t reach Brewfather. Please retry in a moment.",
};

/**
 * Pull the `errorCode` classification out of a failed BFF response body.
 * Anything unparseable (or an unknown code) degrades to the generic
 * `"upstream"` retry.
 */
async function readUpstreamErrorCode(res: Response): Promise<UpstreamErrorCode> {
  try {
    const body = (await res.json()) as Partial<BrewCandidatesResponse>;
    if (body.errorCode === "reconnect" || body.errorCode === "rate_limited") {
      return body.errorCode;
    }
  } catch {
    // Non-JSON error body — treat as a transient upstream failure.
  }
  return "upstream";
}

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
          // Classified failure (revoked key / rate limit / transient) — let
          // the error state drive the right prompt instead of a generic one.
          const errorCode = await readUpstreamErrorCode(res);
          if (active) setState({ status: "error", errorCode });
          return;
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
        // Keep the last-good candidates on screen; surface a failure-specific
        // inline message (reconnect vs. wait vs. retry) by the button.
        setSyncError(SYNC_ERROR_MESSAGES[await readUpstreamErrorCode(res)]);
        return;
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
      setSyncError(SYNC_ERROR_MESSAGES.upstream);
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
