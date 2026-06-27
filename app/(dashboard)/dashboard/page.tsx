import type { Metadata } from "next";

import { DashboardView } from "@/components/brew/DashboardView";
import { mockBrewCandidates } from "./mock-brew-candidates";

export const metadata: Metadata = {
  title: "What can I brew now? — Brewable",
};

/**
 * The "what can I brew now?" dashboard.
 *
 * Renders against a local mock fixture for now. At integration (Task 6) the
 * mock is replaced with a fetch to `GET /api/brew-candidates`, feeding the
 * `loading` / `error` states that {@link DashboardView} already supports.
 */
export default function DashboardPage() {
  return <DashboardView state={{ status: "ready", data: mockBrewCandidates }} />;
}
