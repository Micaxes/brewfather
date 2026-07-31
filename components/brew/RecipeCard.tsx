import { ChevronRight } from "lucide-react";

import type { RecipeMatch } from "@/lib/api-contract";
import { cn } from "@/lib/utils";
import { BUCKET_META } from "@/components/brew/buckets";
import { formatScore } from "@/components/brew/format";
import { IngredientList } from "@/components/brew/IngredientList";
import { RecipeSummary } from "@/components/brew/RecipeSummary";
import { ShoppingList } from "@/components/brew/ShoppingList";

/**
 * A single recipe: identity, score, a scannable verdict, and — behind a
 * disclosure — the full ingredient breakdown and shopping list.
 *
 * Issue #39: rendering every ingredient made the median card 909px against an
 * 828px viewport, so no recipe fit on screen and the board ran to 14 screens.
 * The detail is reference material consulted *after* choosing a recipe, so it
 * moves behind a native `<details>`: keyboard, `aria-expanded` and focus order
 * come free, and every engine now auto-expands it for find-in-page, which a
 * JS accordion would break.
 *
 * The `<h3>` deliberately sits OUTSIDE the `<summary>`. WebKit exposes
 * `<summary>` as a disclosure triangle rather than a button and VoiceOver skips
 * it when navigating by control; `role="button"` fixes that but then hides a
 * nested heading. Keeping the name outside sidesteps both and leaves the
 * heading list — a screen-reader user's scanning surface — intact.
 */
export function RecipeCard({ match }: { match: RecipeMatch }) {
  const { recipe, bucket, score, ingredientMatches, shoppingList } = match;
  const meta = recipe.style
    ? recipe.batchSize
      ? `${recipe.style} · ${recipe.batchSize} L`
      : recipe.style
    : recipe.batchSize
      ? `${recipe.batchSize} L`
      : null;

  return (
    <article className="glass card-defer flex flex-col gap-3 rounded-[18px] p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display font-bold leading-tight">
            {recipe.name}
          </h3>
          {meta ? <p className="truncate text-xs text-faint">{meta}</p> : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
            BUCKET_META[bucket].badgeClass
          )}
          aria-label={`Brewability ${formatScore(score)}`}
        >
          {formatScore(score)}
        </span>
      </header>

      <RecipeSummary match={match} />

      <details className="group border-t border-white/8 pt-2">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-teal-bright marker:content-none [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
          Ingredients &amp; substitutions
        </summary>

        <div className="mt-3 flex flex-col gap-3">
          <IngredientList matches={ingredientMatches} />
          {shoppingList.length > 0 ? <ShoppingList items={shoppingList} /> : null}
        </div>
      </details>
    </article>
  );
}
