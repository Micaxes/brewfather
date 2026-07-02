import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { signOut } from "@/app/login/actions";
import { Logo } from "@/components/brand/Logo";
import { SidebarNav } from "@/components/nav/SidebarNav";
import { getBrewfatherConnection } from "@/lib/brewfather/user-credentials";
import { createClient } from "@/lib/supabase/server";

/** The signed-in app shell: a Brewable sidebar rail + the routed content. */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const connection = await getBrewfatherConnection();

  const email = user?.email ?? "";
  const initial = (email[0] ?? "B").toUpperCase();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex flex-col gap-6 border-b border-white/[0.06] p-4 md:sticky md:top-0 md:h-screen md:w-[236px] md:flex-none md:gap-0 md:border-b-0 md:border-r md:p-6">
        <div className="flex items-center justify-between md:block">
          <div className="px-1 md:pb-6">
            <Logo />
          </div>
        </div>

        <div className="hidden px-2.5 pb-2 text-[11px] font-semibold tracking-[0.08em] text-faint md:block">
          MENU
        </div>
        <SidebarNav />

        <div className="hidden flex-1 md:block" />

        <div className="mb-3 hidden rounded-2xl border p-3.5 md:block">
          <div
            className={`mb-1.5 flex items-center gap-2 text-xs font-semibold ${
              connection.connected ? "text-teal-bright" : "text-amber"
            }`}
          >
            <RefreshCw className="size-3.5" strokeWidth={2} />
            {connection.connected ? "Connected" : "Not connected"}
          </div>
          <div className="text-xs leading-snug text-dim">
            {connection.connected
              ? `Brewfather · ${connection.bfUserId}`
              : "Connect Brewfather in Settings"}
          </div>
        </div>

        <form
          action={signOut}
          className="flex items-center gap-3 rounded-xl px-1 py-1 md:px-3 md:py-2"
        >
          <div className="flex size-8 flex-none items-center justify-center rounded-[10px] border border-teal/25 bg-teal/15 font-display text-[13px] font-bold text-teal-bright">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{email}</div>
            <button type="submit" className="text-[11px] text-faint hover:text-ink">
              Sign out
            </button>
          </div>
        </form>
      </aside>

      <div className="min-w-0 flex-1 px-5 py-7 sm:px-8 md:px-8 md:py-8">
        {children}
      </div>
    </div>
  );
}
