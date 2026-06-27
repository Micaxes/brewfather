import { ShoppingCart } from "lucide-react";

import type { ShoppingListItem } from "@/lib/matcher/types";
import { formatQuantity } from "@/components/brew/format";

/** The shortfalls a user needs to buy to make an "almost" recipe brewable. */
export function ShoppingList({ items }: { items: ShoppingListItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="border-border/60 rounded-lg border bg-muted/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <ShoppingCart className="size-4 shrink-0" aria-hidden="true" />
        Shopping list
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((item, index) => (
          <li
            key={`${item.name}-${index}`}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="truncate">{item.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatQuantity(item.amount, item.unit)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
