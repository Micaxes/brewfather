/** Display metadata for the three brewability buckets. */
import type { MatchBucket } from "@/lib/matcher/types";

export interface BucketMeta {
  title: string;
  description: string;
  /** Tailwind classes for the recipe's score badge in this bucket. */
  badgeClass: string;
  /** Tailwind classes for the colored status dot next to the section title. */
  dotClass: string;
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
    description: "Everything these recipes need is in your inventory.",
    badgeClass: "border border-teal/25 bg-teal/12 text-teal-bright",
    dotClass: "bg-teal shadow-[0_0_8px_var(--teal)]",
  },
  almost: {
    title: "Almost",
    description: "A short shopping list away from brewable.",
    badgeClass: "border border-amber/25 bg-amber/12 text-amber",
    dotClass: "bg-amber shadow-[0_0_8px_rgba(245,166,35,0.6)]",
  },
  not_yet: {
    title: "Not yet",
    description: "Missing several key ingredients.",
    badgeClass: "border border-white/10 bg-white/5 text-dim",
    dotClass: "bg-[#3a4250]",
  },
};
