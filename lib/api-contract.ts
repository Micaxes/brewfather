/**
 * HTTP contract for the BFF route `GET /api/brew-candidates`.
 *
 * This is the boundary both the route handler (Task 2) and the dashboard UI
 * (Task 4) code against, so neither reaches into matcher internals. The
 * response is exactly the matcher's `MatchResult`:
 *
 *   { candidates: RecipeMatch[]; generatedAt: string; warnings: string[] }
 *
 * Defined as an alias of `MatchResult` to keep the wire shape and the matcher
 * output from drifting apart.
 */
import type { MatchResult } from "@/lib/matcher/types";

export type { RecipeMatch } from "@/lib/matcher/types";

/** Response body of `GET /api/brew-candidates`. */
export type BrewCandidatesResponse = MatchResult;
