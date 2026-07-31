import type { RecipeMatch } from "@/lib/api-contract";
import { cn } from "@/lib/utils";
import { buildVerdict, selectBlockers } from "@/components/brew/blockers";
import {
  ingredientDetail,
  ingredientStatusMeta,
} from "@/components/brew/IngredientList";

/**
 * The always-visible part of a recipe card (issue #39): a one-line verdict and
 * the handful of ingredients that actually decide whether you can brew it.
 *
 * Everything else — satisfied rows, substitution reasoning, the shopping list —
 * lives behind the card's disclosure. This keeps a card scannable at roughly a
 * quarter of its previous height without hiding any recipe from the page.
 */
export function RecipeSummary({ match }: { match: RecipeMatch }) {
  const verdict = buildVerdict(match);
  const { blockers, remaining } = selectBlockers(match);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-dim">{verdict}</p>

      {blockers.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {blockers.map((blocker, index) => {
            const meta = ingredientStatusMeta(blocker);
            const { Icon } = meta;
            const swaps = blocker.substitutes?.length ?? 0;
            const substituted = blocker.matchedBy === "equivalent";

            return (
              <li
                key={`${blocker.ingredient.id || blocker.ingredient.name}-${index}`}
                className="flex items-center gap-2 text-sm"
              >
                <Icon
                  className={cn("size-4 shrink-0", meta.className)}
                  aria-hidden="true"
                />
                <span className="sr-only">{meta.label}:</span>
                <span className="min-w-0 flex-1 truncate">
                  {blocker.ingredient.name}
                </span>

                {/* A swap exists — say so while scanning; the reasoning is one
                    interaction away rather than a paragraph on every card. */}
                {!substituted && swaps > 0 ? (
                  <span className="shrink-0 rounded-full border border-teal/25 bg-teal/10 px-1.5 py-px text-[11px] text-teal-bright">
                    {swaps === 1 ? "1 swap" : `${swaps} swaps`}
                  </span>
                ) : null}

                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {substituted
                    ? `→ ${blocker.inventoryItem?.name ?? "substitute"}`
                    : ingredientDetail(blocker)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Never let a truncated list read as complete. */}
      {remaining > 0 ? (
        <p className="text-xs text-faint">
          +{remaining} more {remaining === 1 ? "ingredient" : "ingredients"} to
          check
        </p>
      ) : null}
    </div>
  );
}
