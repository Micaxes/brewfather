import { AlertCircle, Beer } from "lucide-react";
import Link from "next/link";

import type {
  BrewCandidatesResponse,
  RecipeMatch,
  UpstreamErrorCode,
} from "@/lib/api-contract";
import type { MatchBucket } from "@/lib/matcher/types";
import { BUCKET_ORDER } from "@/components/brew/buckets";
import { BucketSection } from "@/components/brew/BucketSection";
import type { SubstituteActions } from "@/components/brew/IngredientList";
import { SyncButton, type SyncStatus } from "@/components/brew/SyncButton";

export type DashboardState =
  | { status: "loading" }
  | { status: "error"; message?: string; errorCode?: UpstreamErrorCode }
  | { status: "ready"; data: BrewCandidatesResponse };

/** The full "what can I brew now?" dashboard, across loading/error/empty/ready states. */
export function DashboardView({
  state,
  sync,
  actions,
}: {
  state: DashboardState;
  /** Manual-sync wiring for the header's "Sync now" button (ready state only). */
  sync?: SyncStatus;
  actions?: SubstituteActions;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl animate-[fadein_0.4s_ease] flex-col gap-7">
      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "error" ? (
        <ErrorState message={state.message} errorCode={state.errorCode} />
      ) : null}
      {state.status === "ready" ? (
        <ReadyState {...(actions ? { actions } : {})} data={state.data} sync={sync} />
      ) : null}
    </main>
  );
}

function ReadyState({
  data,
  sync,
  actions,
}: {
  data: BrewCandidatesResponse;
  sync?: SyncStatus;
  actions?: SubstituteActions;
}) {
  const { candidates, warnings, syncedAt } = data;

  if (candidates.length === 0) {
    // The onboarding empty-state has no header, but a connected user with an
    // empty library still needs sync access. `syncedAt` doubles as the
    // connected signal: a cache row only exists after a successful sync, so
    // the not-connected onboarding (syncedAt === null) stays button-free.
    return (
      <>
        {warnings.length > 0 ? <Warnings warnings={warnings} /> : null}
        {sync && syncedAt !== null ? (
          <div className="flex justify-end">
            <SyncButton syncedAt={syncedAt} {...sync} />
          </div>
        ) : null}
        <EmptyState />
      </>
    );
  }

  const counts = countByBucket(candidates);
  const grouped = groupByBucket(candidates);

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-dim">
            Your brew board · {candidates.length} recipes ranked by what your stock
            can make
          </p>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            You can brew{" "}
            <span className="text-teal-bright">
              {counts.brew_now} recipe{counts.brew_now === 1 ? "" : "s"}
            </span>{" "}
            now
          </h1>
        </div>
        {sync ? <SyncButton syncedAt={syncedAt} {...sync} /> : null}
      </header>

      {warnings.length > 0 ? <Warnings warnings={warnings} /> : null}

      <StatCards counts={counts} total={candidates.length} />

      <div className="flex flex-col gap-8">
        {BUCKET_ORDER.map((bucket) =>
          grouped[bucket].length > 0 ? (
            <BucketSection
              key={bucket}
              bucket={bucket}
              matches={grouped[bucket]}
              {...(actions ? { actions } : {})}
            />
          ) : null
        )}
      </div>
    </>
  );
}

function StatCards({
  counts,
  total,
}: {
  counts: Record<MatchBucket, number>;
  total: number;
}) {
  const cards = [
    { label: "Brew now", value: counts.brew_now, note: "ready with current stock", dot: "bg-teal shadow-[0_0_8px_var(--teal)]" },
    { label: "Almost there", value: counts.almost, note: "a short shopping list away", dot: "bg-amber shadow-[0_0_8px_rgba(245,166,35,0.6)]" },
    { label: "Not yet", value: counts.not_yet, note: "missing key ingredients", dot: "bg-[#3a4250]" },
    { label: "Library", value: total, note: "saved recipes", dot: "bg-teal-bright" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="glass rounded-[18px] p-5">
          <div className="flex items-center gap-2 text-[13px] text-dim">
            <span className={`size-2 rounded-full ${c.dot}`} aria-hidden="true" />
            {c.label}
          </div>
          <div className="mt-2 font-display text-[38px] font-bold leading-none">
            {c.value}
          </div>
          <div className="mt-1.5 text-xs text-faint">{c.note}</div>
        </div>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Loading brew candidates…</span>
      <div className="h-9 w-72 animate-pulse rounded-lg bg-white/5" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-[18px] bg-white/5" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-[18px] bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({
  message,
  errorCode,
}: {
  message?: string;
  errorCode?: UpstreamErrorCode;
}) {
  // A revoked/expired key is not a transient failure — prompt the fix
  // (reconnect in Settings) instead of a generic "try again".
  if (errorCode === "reconnect") {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-[20px] border border-danger/25 bg-danger/[0.06] p-5 text-sm backdrop-blur-md"
      >
        <AlertCircle className="size-5 flex-none text-danger" aria-hidden="true" />
        <div>
          <div className="font-semibold">Reconnect your Brewfather account</div>
          <p className="mt-0.5 text-dim">
            Brewfather rejected your API key — it may have been revoked or
            expired. Reconnect it in{" "}
            <Link
              href="/dashboard/settings"
              className="font-semibold text-teal-bright underline"
            >
              Settings
            </Link>{" "}
            to load your brew board again.
          </p>
        </div>
      </div>
    );
  }

  const fallback =
    errorCode === "rate_limited"
      ? "Brewfather is rate-limiting requests right now. Wait a few minutes, then reload."
      : "Something went wrong contacting Brewfather. Please try again.";
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[20px] border border-danger/25 bg-danger/[0.06] p-5 text-sm backdrop-blur-md"
    >
      <AlertCircle className="size-5 flex-none text-danger" aria-hidden="true" />
      <div>
        <div className="font-semibold">Couldn’t load your brew board</div>
        <p className="mt-0.5 text-dim">{message ?? fallback}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-white/12 bg-white/[0.03] p-12 text-center backdrop-blur-md">
      <div className="brand-gradient flex size-12 items-center justify-center rounded-2xl">
        <Beer className="size-6" strokeWidth={2} aria-hidden="true" />
      </div>
      <h2 className="font-display text-lg font-semibold">No brew candidates yet</h2>
      <p className="max-w-md text-sm text-dim">
        Connect your Brewfather account in{" "}
        <Link
          href="/dashboard/settings"
          className="font-semibold text-teal-bright underline"
        >
          Settings
        </Link>
        , then save some recipes in Brewfather. They’ll show up here ranked by
        what you can brew.
      </p>
    </div>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-1 rounded-[16px] border border-amber/25 bg-amber/[0.08] p-3.5 text-sm text-amber"
    >
      {warnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
    </div>
  );
}

function countByBucket(candidates: RecipeMatch[]): Record<MatchBucket, number> {
  const counts: Record<MatchBucket, number> = {
    brew_now: 0,
    almost: 0,
    not_yet: 0,
  };
  for (const c of candidates) counts[c.bucket] += 1;
  return counts;
}

function groupByBucket(
  candidates: RecipeMatch[]
): Record<MatchBucket, RecipeMatch[]> {
  const grouped: Record<MatchBucket, RecipeMatch[]> = {
    brew_now: [],
    almost: [],
    not_yet: [],
  };
  for (const c of candidates) grouped[c.bucket].push(c);
  return grouped;
}
