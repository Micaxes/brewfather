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

/** The right-hand quantity text for an ingredient row. */
export function ingredientDetail(match: IngredientMatch): string {
  const { status, have, need, ingredient } = match;
  if (status === "short") {
    return `${formatQuantity(have, ingredient.unit)} of ${formatQuantity(need, ingredient.unit)}`;
  }
  if (status === "missing") {
    return `need ${formatQuantity(need, ingredient.unit)}`;
  }
  return formatQuantity(need, ingredient.unit);
}

/**
 * Icon + label for a match, accounting for substitution. Shared so the
 * collapsed summary (issue #39) and the full list cannot drift apart.
 */
export function ingredientStatusMeta(match: IngredientMatch) {
  return match.matchedBy === "equivalent" || match.matchedBy === "accepted"
    ? SUBSTITUTED_META
    : STATUS_META[match.status];
}

function SubstituteRow({
  substitute,
  unit,
  inUse,
  onAccept,
  pending,
}: {
  substitute: MaltSubstitute;
  unit: string;
  inUse: boolean;
  onAccept?: () => void;
  pending?: boolean;
}) {
  const name = onAccept ? (
    <button
      type="button"
      onClick={onAccept}
      disabled={pending}
      className="rounded font-medium underline decoration-dotted underline-offset-2 hover:text-teal-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
      aria-label={`Use ${substitute.inventoryItem.name} instead`}
    >
      {substitute.inventoryItem.name}
    </button>
  ) : (
    <span className="font-medium">{substitute.inventoryItem.name}</span>
  );

  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {name}
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

export interface SubstituteActions {
  /** Accept this stand-in for this ingredient; readiness recalculates. */
  onAccept: (match: IngredientMatch, substitute: MaltSubstitute) => void;
  /** Undo an acceptance, returning the line to whatever the engine infers. */
  onRevoke: (match: IngredientMatch) => void;
  /** Ingredient keys with a request in flight, for disabling their controls. */
  pending: ReadonlySet<string>;
}

/** Per-ingredient availability for a recipe: matched / short / missing. */
export function IngredientList({
  matches,
  actions,
}: {
  matches: IngredientMatch[];
  actions?: SubstituteActions;
}) {
  if (matches.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No ingredients listed.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {matches.map((match, index) => {
        const accepted = match.matchedBy === "accepted";
        const substituted = match.matchedBy === "equivalent" || accepted;
        const rowKey = `${match.ingredient.category} ${match.ingredient.name}`;
        const meta = ingredientStatusMeta(match);
        const { Icon } = meta;
        const substitutes = match.substitutes ?? [];
        const substitutesLabel = accepted
          ? "You accepted this swap"
          : substituted
            ? "Substituted from your inventory"
            : "Substitutes in your inventory";

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
                {ingredientDetail(match)}
              </span>
            </div>

            {substitutes.length > 0 ? (
              <div className="mt-1 ml-6 border-l border-border/60 pl-3">
                {/*
                  Sighted users get the grouping from the indent, the rule, and
                  this caption. A screen reader gets none of that, so the same
                  words — plus the malt they belong to — become the nested
                  list's accessible name ("Substitutes in your inventory for
                  Weyermann Caramunich Type 2, list"). The caption itself is
                  hidden from assistive tech so the label is not announced
                  twice, and no `id`/`aria-labelledby` pair is needed (several
                  recipe cards render this component on one page, so generated
                  ids would collide).
                */}
                <p
                  aria-hidden="true"
                  className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-wide uppercase"
                >
                  {substitutesLabel}
                </p>
                {accepted && actions ? (
                  <button
                    type="button"
                    onClick={() => actions.onRevoke(match)}
                    disabled={actions.pending.has(rowKey)}
                    className="mb-1 text-[11px] font-semibold text-faint underline decoration-dotted underline-offset-2 hover:text-ink disabled:opacity-60"
                  >
                    Undo this swap
                  </button>
                ) : null}
                <ul
                  aria-label={`${substitutesLabel} for ${match.ingredient.name}`}
                  className="flex flex-col gap-1.5"
                >
                  {substitutes.map((substitute, subIndex) => {
                    const inUse =
                      (substituted || accepted) && subIndex === 0;
                    return (
                      <SubstituteRow
                        key={
                          substitute.inventoryItem.id ||
                          `${substitute.inventoryItem.name}-${subIndex}`
                        }
                        substitute={substitute}
                        unit={match.ingredient.unit}
                        inUse={inUse}
                        {...(actions && !inUse
                          ? { onAccept: () => actions.onAccept(match, substitute) }
                          : {})}
                        {...(actions
                          ? { pending: actions.pending.has(rowKey) }
                          : {})}
                      />
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
