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
    <section aria-labelledby={`bucket-${bucket}`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2
          id={`bucket-${bucket}`}
          className="flex items-center gap-2 text-xl font-semibold"
        >
          <span aria-hidden="true">{meta.emoji}</span>
          {meta.title}
          <span className="text-muted-foreground text-sm font-normal">
            ({matches.length})
          </span>
        </h2>
        <p className="text-muted-foreground text-sm">{meta.description}</p>
      </div>

      {matches.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <RecipeCard key={match.recipe.id || match.recipe.name} match={match} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          No recipes here yet.
        </p>
      )}
    </section>
  );
}
