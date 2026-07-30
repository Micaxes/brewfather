import { AlertTriangle, Check, Repeat2, X, type LucideIcon } from "lucide-react";

import type {
  IngredientMatch,
  MaltSubstitute,
  MatchStatus,
} from "@/lib/matcher/types";
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

/** A line satisfied by a stand-in reads differently from one you actually have. */
const SUBSTITUTED_META = {
  label: "In stock via substitute",
  Icon: Repeat2,
  className: "text-teal-600 dark:text-teal-400",
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

function SubstituteRow({
  substitute,
  unit,
  inUse,
}: {
  substitute: MaltSubstitute;
  unit: string;
  inUse: boolean;
}) {
  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-medium">{substitute.inventoryItem.name}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatQuantity(substitute.have, unit)} on hand
        </span>
        {inUse ? (
          <span className="rounded-full border border-teal/30 bg-teal/10 px-1.5 py-px text-[11px] text-teal-bright">
            using this
          </span>
        ) : substitute.coversNeed ? (
          <span className="rounded-full border border-green-500/25 bg-green-500/10 px-1.5 py-px text-[11px] text-green-600 dark:text-green-400">
            covers it
          </span>
        ) : (
          <span className="rounded-full border border-amber/25 bg-amber/10 px-1.5 py-px text-[11px] text-amber">
            partial
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {substitute.justification}
        {substitute.doseFactor !== 1 ? (
          <>
            {" "}
            Use about {Math.round(substitute.doseFactor * 100)}% of the listed
            amount.
          </>
        ) : null}
      </p>
    </li>
  );
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
        const substituted = match.matchedBy === "equivalent";
        const meta = substituted ? SUBSTITUTED_META : STATUS_META[match.status];
        const { Icon } = meta;
        const substitutes = match.substitutes ?? [];

        return (
          <li
            key={`${match.ingredient.id || match.ingredient.name}-${index}`}
            className="flex flex-col"
          >
            <div className="flex items-center gap-2 text-sm">
              <Icon
                className={cn("size-4 shrink-0", meta.className)}
                aria-hidden="true"
              />
              <span className="flex-1 truncate">{match.ingredient.name}</span>
              <span className="sr-only">{meta.label}:</span>
              <span className="text-muted-foreground tabular-nums">
                {detail(match)}
              </span>
            </div>

            {substitutes.length > 0 ? (
              <div className="mt-1 ml-6 border-l border-border/60 pl-3">
                <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-wide uppercase">
                  {substituted
                    ? "Substituted from your inventory"
                    : "Substitutes in your inventory"}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {substitutes.map((substitute, subIndex) => (
                    <SubstituteRow
                      key={
                        substitute.inventoryItem.id ||
                        `${substitute.inventoryItem.name}-${subIndex}`
                      }
                      substitute={substitute}
                      unit={match.ingredient.unit}
                      inUse={substituted && subIndex === 0}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
