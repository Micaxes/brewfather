import type { Metadata } from "next";

import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = {
  title: "What can I brew now? — Brewable",
};

/**
 * The "what can I brew now?" dashboard. Fetches live results from
 * `GET /api/brew-candidates` via {@link DashboardClient}, which drives the
 * loading / error / ready states.
 */
export default function DashboardPage() {
  return <DashboardClient />;
}
