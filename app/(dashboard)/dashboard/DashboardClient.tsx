"use client";

import { useEffect, useState } from "react";

import type { BrewCandidatesResponse } from "@/lib/api-contract";
import {
  DashboardView,
  type DashboardState,
} from "@/components/brew/DashboardView";

/**
 * Client wrapper that fetches `GET /api/brew-candidates` and drives the
 * dashboard's loading / error / ready states. The mock fixture
 * (`mock-brew-candidates.ts`) is retained for tests but no longer used here.
 */
export function DashboardClient() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

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

  return <DashboardView state={state} />;
}
