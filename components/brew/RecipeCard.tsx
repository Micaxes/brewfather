import type { RecipeMatch } from "@/lib/api-contract";
import { cn } from "@/lib/utils";
import { BUCKET_META } from "@/components/brew/buckets";
import { formatScore } from "@/components/brew/format";
import { IngredientList } from "@/components/brew/IngredientList";
import { ShoppingList } from "@/components/brew/ShoppingList";

/** A single recipe: name, style, brewability score, ingredients, shopping list. */
export function RecipeCard({ match }: { match: RecipeMatch }) {
  const { recipe, bucket, score, ingredientMatches, shoppingList } = match;

  return (
    <article className="bg-card text-card-foreground flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold leading-tight">{recipe.name}</h3>
          {recipe.style ? (
            <p className="text-muted-foreground truncate text-sm">{recipe.style}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
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
