/** Display metadata for the three brewability buckets. */
import type { MatchBucket } from "@/lib/matcher/types";

export interface BucketMeta {
  title: string;
  emoji: string;
  description: string;
  /** Tailwind classes for the recipe's score badge in this bucket. */
  badgeClass: string;
}

/** Render order for the dashboard sections. */
export const BUCKET_ORDER: readonly MatchBucket[] = [
  "brew_now",
  "almost",
  "not_yet",
];

export const BUCKET_META: Record<MatchBucket, BucketMeta> = {
  brew_now: {
    title: "Brew now",
    emoji: "✅",
    description: "Everything these recipes need is in your inventory.",
    badgeClass: "bg-green-500/15 text-green-700 dark:text-green-400",
  },
  almost: {
    title: "Almost",
    emoji: "🟡",
    description: "A short shopping list away from brewable.",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  not_yet: {
    title: "Not yet",
    emoji: "⚪",
    description: "Missing several key ingredients.",
    badgeClass: "bg-muted text-muted-foreground",
  },
};
