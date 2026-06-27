import { AlertTriangle, Check, X, type LucideIcon } from "lucide-react";

import type { IngredientMatch, MatchStatus } from "@/lib/matcher/types";
import { cn } from "@/lib/utils";
import { formatQuantity } from "@/components/brew/format";

const STATUS_META: Record<
  MatchStatus,
  { label: string; Icon: LucideIcon; className: string }
> = {
  satisfied: {
    label: "In stock",
    Icon: Check,
    className: "text-green-600 dark:text-green-400",
  },
  short: {
    label: "Short",
    Icon: AlertTriangle,
    className: "text-amber-600 dark:text-amber-400",
  },
  missing: {
    label: "Missing",
    Icon: X,
    className: "text-red-600 dark:text-red-400",
  },
};

function detail(match: IngredientMatch): string {
  const { status, have, need, ingredient } = match;
  if (status === "short") {
    return `${formatQuantity(have, ingredient.unit)} of ${formatQuantity(need, ingredient.unit)}`;
  }
  if (status === "missing") {
    return `need ${formatQuantity(need, ingredient.unit)}`;
  }
  return formatQuantity(need, ingredient.unit);
}

/** Per-ingredient availability for a recipe: matched / short / missing. */
export function IngredientList({ matches }: { matches: IngredientMatch[] }) {
  if (matches.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No ingredients listed.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {matches.map((match, index) => {
        const meta = STATUS_META[match.status];
        const { Icon } = meta;
        return (
          <li
            key={`${match.ingredient.id || match.ingredient.name}-${index}`}
            className="flex items-center gap-2 text-sm"
          >
            <Icon
              className={cn("size-4 shrink-0", meta.className)}
              aria-hidden="true"
            />
            <span className="flex-1 truncate">{match.ingredient.name}</span>
            <span className="sr-only">{meta.label}:</span>
            <span className="text-muted-foreground tabular-nums">
              {detail(match)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
