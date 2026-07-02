import type { RecipeMatch } from "@/lib/api-contract";
import type { MatchBucket } from "@/lib/matcher/types";
import { BUCKET_META } from "@/components/brew/buckets";
import { RecipeCard } from "@/components/brew/RecipeCard";

/** One dashboard section (Brew now / Almost / Not yet) with its recipe cards. */
export function BucketSection({
  bucket,
  matches,
}: {
  bucket: MatchBucket;
  matches: RecipeMatch[];
}) {
  const meta = BUCKET_META[bucket];

  return (
    <section aria-labelledby={`bucket-${bucket}`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2
          id={`bucket-${bucket}`}
          className="flex items-center gap-2.5 font-display text-lg font-semibold"
        >
          <span
            className={`size-2.5 rounded-full ${meta.dotClass}`}
            aria-hidden="true"
          />
          {meta.title}
          <span className="text-sm font-normal text-faint">
            ({matches.length})
          </span>
        </h2>
        <p className="text-sm text-dim">{meta.description}</p>
      </div>

      {matches.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <RecipeCard key={match.recipe.id || match.recipe.name} match={match} />
          ))}
        </div>
      ) : (
        <p className="rounded-[16px] border border-dashed p-4 text-sm text-dim">
          No recipes here yet.
        </p>
      )}
    </section>
  );
}
