import type { Metadata } from "next";

import { UserBar } from "@/components/auth/UserBar";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = {
  title: "What can I brew now? — Brewable",
};

/**
 * The "what can I brew now?" dashboard. Access is gated by the auth middleware
 * (unauthenticated visitors are redirected to `/login`). Fetches live results
 * from `GET /api/brew-candidates` via {@link DashboardClient}.
 */
export default function DashboardPage() {
  return (
    <>
      <UserBar />
      <DashboardClient />
    </>
  );
}
