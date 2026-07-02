import type { Metadata } from "next";

import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = {
  title: "What can I brew now? — Brewable",
};

/**
 * The "what can I brew now?" dashboard. Access is gated by the auth middleware;
 * the app shell (sidebar) is provided by the (dashboard) layout. Live results
 * come from `GET /api/brew-candidates` via {@link DashboardClient}.
 */
export default function DashboardPage() {
  return <DashboardClient />;
}
