# Brewfather — Concept & Design Notes

_Living document. Captures the decisions from the initial brainstorm (2026-06-26)._

## The problem

Homebrewers (the project owner included) accumulate ingredients and save recipes, but answering *"what can I actually brew with what's in my cabinet right now?"* is manual and tedious. A past attempt to have an LLM **generate** recipes produced hallucinated, unbalanced results and **wasted real brewing materials**. The lesson: recommendations must come from **real, vetted recipes** — never invented.

## The product

A web app that connects to the user's Brewfather account and answers **"what can I brew now?"** by matching **live inventory** against the user's **saved recipe library**.

Core loop:

```
Brewfather account ──API──> [ inventory ] + [ saved recipes ]
                                   │
                            matching engine
                                   │
                     ranked "what can I brew" list
                 ✅ brew now · 🟡 almost (shopping list) · ⚪ not yet
```

## Key constraint: the Brewfather API (verified)

Source: https://docs.brewfather.app/api

- **Auth:** HTTP Basic, `userid:apikey` base64-encoded. One key per account. **Requires Brewfather Premium.**
- **Scopes:** `recipes`, `batches`, `inventory` × `read`/`write`/`delete` (delete is separate from write).
- **Rate limit:** 500 calls/hour/key; `Retry-After` on 429.
- **Units:** all metric (kg, L, g, °C, SG).
- **Pagination:** default 10, max 50/page; `limit` + `start_after`.

Available endpoints we rely on:

| Need | Endpoint | Notes |
|---|---|---|
| Inventory w/ quantities | `GET /v2/inventory/{fermentables,hops,yeasts,miscs}` | Only returns items the user has stocked/edited (i.e. their real on-hand stock) |
| Saved recipes (list) | `GET /v2/recipes` | summary fields |
| Saved recipe (full) | `GET /v2/recipes/:id` | full ingredient arrays w/ amounts |
| Batches | `GET /v2/batches` | for future "push planned batch" feature |

❌ **Not available:** the public/community recipe catalog. The API is account-scoped only. **Decision:** match against the user's **own saved library**, which they build by copying catalog recipes into their account in the Brewfather app ("copy to my recipes"). Sanctioned, reliable, no scraping.

## Matching engine (the heart of the app)

For each saved recipe:

1. Take its ingredient arrays — `fermentables[]`, `hops[]`, `yeasts[]`, `miscs[]` — each with a required `amount` (scaled to the recipe's batch size).
2. Match each required ingredient to an inventory item:
   - Prefer stable `_id` match (reliable when both came from the Brewfather catalog).
   - Fall back to normalized-name match (fuzzy) for manually-entered items.
3. Compare `have >= need` per ingredient.
4. Compute a **brewability score** — fraction of requirements satisfied, weighted by importance (base malt + yeast critical; small misc additions minor).
5. Bucket the recipe: **Brew now** (all satisfied) · **Almost** (missing 1–2, mostly minor) · **Not yet**.

Output enrichments:
- **Shopping list** for "Almost" recipes (exact shortfall amounts).
- **Scale-to-stock** (optional): largest batch size the current inventory supports.
- **Grounded substitutions** (later): if short on hop/grain X, suggest inventory item Y with a similar profile and an alpha-acid- or color-adjusted amount. Uses only real ingredient data; nothing generated. This is the *only* place AI is considered, and strictly over retrieved real data.

Edge cases to handle: unit normalization (all metric, good), name collisions, recipes that reference ingredients not in inventory at all (treated as "need to buy"), and quantity-but-no-amount items.

## Architecture

Brewfather API calls must run **server-side** — both because the API likely won't send browser CORS headers, and to keep the user's secret API key off the client.

- **v0 (personal):** Next.js (App Router) + TS. API key in a local `.env` (gitignored). Server route handlers call Brewfather; React UI renders the matches. No DB, no auth. Goal: prove the core value against real data fast.
- **v1 (product):** add Supabase (Postgres + Auth + RLS). Store accounts and the **encrypted** Brewfather API key; cache inventory/recipes to respect rate limits; persist match history/preferences. Deploy on Vercel.

## Decisions so far

- **Concept:** companion to Brewfather (not a competitor). ✅
- **Audience:** both beginners and experienced (broad), approachable but deep. ✅
- **Recipe source:** user's own saved Brewfather library. ✅
- **Premium:** owner has Premium + can mint an API key. ✅
- **Repo:** public, https://github.com/Micaxes/brewfather. ✅
- **Stack:** _proposed_ Next.js + TS + Tailwind/shadcn, Supabase for v1 — **pending confirmation.**

## Open questions / later

- Final product name (trademark — currently shares name with upstream app).
- How much of the substitution intelligence is rules-based vs. Claude-assisted.
- Whether v0 stays local or deploys early behind a single-user gate.
