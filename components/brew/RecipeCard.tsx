import type { RecipeMatch } from "@/lib/api-contract";
import { cn } from "@/lib/utils";
import { BUCKET_META } from "@/components/brew/buckets";
import { formatScore } from "@/components/brew/format";
import { IngredientList } from "@/components/brew/IngredientList";
import { ShoppingList } from "@/components/brew/ShoppingList";

/** A single recipe: name, style, brewability score, ingredients, shopping list. */
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
    <article className="glass flex flex-col gap-3 rounded-[18px] p-4">
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

      <IngredientList matches={ingredientMatches} />

      {shoppingList.length > 0 ? <ShoppingList items={shoppingList} /> : null}
    </article>
  );
}
