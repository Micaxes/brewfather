import { AlertCircle, Beer } from "lucide-react";

import type { BrewCandidatesResponse, RecipeMatch } from "@/lib/api-contract";
import type { MatchBucket } from "@/lib/matcher/types";
import { BUCKET_ORDER } from "@/components/brew/buckets";
import { BucketSection } from "@/components/brew/BucketSection";

export type DashboardState =
  | { status: "loading" }
  | { status: "error"; message?: string }
  | { status: "ready"; data: BrewCandidatesResponse };

/** The full "what can I brew now?" dashboard, across loading/error/empty/ready states. */
export function DashboardView({ state }: { state: DashboardState }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">
          What can I brew now?
        </h1>
        <p className="text-muted-foreground">
          Your saved recipes ranked against your current Brewfather inventory.
        </p>
      </header>
      {renderBody(state)}
    </main>
  );
}

function renderBody(state: DashboardState) {
  switch (state.status) {
    case "loading":
      return <LoadingState />;
    case "error":
      return <ErrorState message={state.message} />;
    case "ready":
      return <ReadyState data={state.data} />;
  }
}

function ReadyState({ data }: { data: BrewCandidatesResponse }) {
  if (data.candidates.length === 0) {
    return <EmptyState />;
  }

  const byBucket = groupByBucket(data.candidates);
  return (
    <div className="flex flex-col gap-10">
      {data.warnings.length > 0 ? <Warnings warnings={data.warnings} /> : null}
      {BUCKET_ORDER.map((bucket) => (
        <BucketSection key={bucket} bucket={bucket} matches={byBucket[bucket]} />
      ))}
    </div>
  );
}

function groupByBucket(
  candidates: RecipeMatch[]
): Record<MatchBucket, RecipeMatch[]> {
  const groups: Record<MatchBucket, RecipeMatch[]> = {
    brew_now: [],
    almost: [],
    not_yet: [],
  };
  for (const candidate of candidates) {
    groups[candidate.bucket].push(candidate);
  }
  return groups;
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading brew candidates…</span>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm"
        >
          <div className="bg-muted h-5 w-1/3 animate-pulse rounded" />
          <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
          <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message }: { message?: string }) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-3 rounded-lg border p-4"
    >
      <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">Could not load your brew candidates</p>
        <p className="text-sm">
          {message ??
            "Something went wrong while contacting Brewfather. Please try again."}
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
      <Beer className="text-muted-foreground size-10" aria-hidden="true" />
      <h2 className="text-lg font-semibold">No brew candidates yet</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        Connect your account by setting BF_USER_ID and BF_API_KEY in your .env,
        then save some recipes in Brewfather. They will show up here ranked by
        what you can brew.
      </p>
    </div>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300"
    >
      {warnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
    </div>
  );
}
