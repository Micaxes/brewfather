# Spike: `_id` vs name matching (task-005 / #10)

_Generated 2026-07-01T09:11:30.419Z by `npm run spike` against real Brewfather data._

## Data sampled
- **Inventory:** 92 items (53 fermentable, 22 hop, 11 yeast, 6 misc)
- **Recipes:** 38
- **Recipe ingredients probed:** 526

## Resolution breakdown (current threshold 0.3)

| scope | ingredients | by `_id` | by fuzzy name | unmatched |
|---|---|---|---|---|
| **all** | 526 | 242 (46.0%) | 70 (13.3%) | 214 (40.7%) |
| fermentable | 155 | 64 (41.3%) | 32 (20.6%) | 59 (38.1%) |
| hop | 155 | 83 (53.5%) | 34 (21.9%) | 38 (24.5%) |
| yeast | 37 | 12 (32.4%) | 2 (5.4%) | 23 (62.2%) |
| misc | 179 | 83 (46.4%) | 2 (1.1%) | 94 (52.5%) |

**Verdict (PRD §9):** `_id` is the primary match *method* — 78% of the 312 successful matches. But `_id` alone resolves only 46.0% of all ingredients, so normalized-name fuzzy matching is a **necessary** fallback, recovering 13.3% that `_id` misses. **PRD §9 confirmed:** `_id` matching is insufficient on its own and the fuzzy path is load-bearing and must stay. The 40.7% unmatched are largely miscs and yeasts the user does not stock (expected), plus a few naming near-misses beyond the threshold (see samples).

## Fuzzy score distribution
Best fuzzy score per non-`_id` ingredient (lower = closer; the default threshold accepts ≤ 0.3). 2 had no same-category candidate at all.

| score band | count | |
|---|---|---|
| 0.0–0.1 | 64 | ████████████████████████████████████████████████████████████████ |
| 0.1–0.2 | 0 |  |
| 0.2–0.3 | 4 | ████ |
| 0.3–0.4 | 11 | ███████████ |
| 0.4–0.5 | 25 | █████████████████████████ |
| 0.5–0.6 | 36 | ████████████████████████████████████ |
| 0.6–0.7 | 68 | ████████████████████████████████████████████████████████████████████ |
| 0.7–0.8 | 61 | █████████████████████████████████████████████████████████████ |
| 0.8–0.9 | 13 | █████████████ |
| 0.9–1.0 | 0 |  |

## Threshold sweep
How many ingredients resolve as the fuzzy threshold varies (`_id` matches are threshold-independent: 242).

| threshold | name matches | total matched | unmatched |
|---|---|---|---|
| 0.1 | 64 | 306 (58.2%) | 220 (41.8%) |
| 0.2 | 64 | 306 (58.2%) | 220 (41.8%) |
| 0.3 (current) | 70 | 312 (59.3%) | 214 (40.7%) |
| 0.4 | 87 | 329 (62.5%) | 197 (37.5%) |
| 0.5 | 105 | 347 (66.0%) | 179 (34.0%) |
| 0.6 | 140 | 382 (72.6%) | 144 (27.4%) |

## Recommendation
**`FUZZY_NAME_THRESHOLD` = 0.3** (no change)

Keep the conservative default (0.3). Loosening to 0.4 would add ~17 name matches and 0.5 ~35, but the (0.3, 0.5] band mixes true synonyms with false positives between genuinely different ingredients (see the Borderline samples below — e.g. distinct hops/malts that merely share a prefix). In a "what can I brew now?" tool a false match produces a false "brew now" and wastes a real brew day — the failure PRD §1 exists to avoid — so favor precision: ingredients past the threshold are better surfaced as "missing" (shopping list) than mis-matched. Revisit per-category if recall becomes a pain point.

> Set in `lib/matcher/match.ts`. After any change, re-run `npm test` and re-run this spike.

## Borderline name matches (score in (0.3, 0.45])
_A looser threshold would newly accept these. Eyeball them — real matches argue for loosening; near-misses argue against._

- [fermentable] "Wheat Malt" → "Wheat Unmalted" (score 0.321) _(in "Hefeweizen")_
- [fermentable] "CaraGold" → "Carapils" (score 0.375) _(in "Stigbergets West Coast IPA clone")_
- [fermentable] "Medium Crystal Malt" → "Caramel/Crystal Malt" (score 0.407) _(in "Hobgoblin ipa")_
- [fermentable] "Gladfield Rolled Wheat (BLM)" → "Gladfield Rolled Oats (BLM)" (score 0.392) _(in "Pina Colada Hazy")_
- [hop] "BRU-1" → "Hersbrucker" (score 0.400) _(in "Pina Colada Hazy")_
- [hop] "Sabro" → "Hersbrucker" (score 0.400) _(in "Pina Colada Hazy")_
- [hop] "BRU-1" → "Hersbrucker" (score 0.400) _(in "Pina Colada Hazy")_
- [hop] "Sabro" → "Hersbrucker" (score 0.400) _(in "Pina Colada Hazy")_
- [hop] "BRU-1" → "Hersbrucker" (score 0.400) _(in "Pina Colada Hazy")_
- [hop] "Sabro" → "Hersbrucker" (score 0.400) _(in "Pina Colada Hazy")_
- [fermentable] "Caramel/Crystal 90 - US" → "Caramel/Crystal Malt" (score 0.437) _(in "Brewdog Punk IPA Clone")_
- [yeast] "Safale American US 05" → "Safale American Ale" (score 0.437) _(in "Brewdog Punk IPA Clone")_
- [yeast] "Pilsner Lager" → "Saflager Lager" (score 0.435) _(in "Pilsner Urquell clone")_
- [fermentable] "Munich Dark" → "Munich Malt" (score 0.399) _(in "Brooklyn Lager")_
- [fermentable] "Chocolate 6-Row" → "Chocolate" (score 0.400) _(in "Bockbier - Doppelbock")_
- [fermentable] "Chateau Munich" → "Chateau Chocolat" (score 0.412) _(in "Oatmeal Stout")_
- [fermentable] "Carafa II" → "Carapils" (score 0.444) _(in "Baltic Porter")_
- [yeast] "Pilsner Lager" → "Saflager Lager" (score 0.435) _(in "Pilsner Urquell clone from Czech Republic")_
- [fermentable] "Munich II" → "Munich Malt" (score 0.345) _(in "Big Brew Dark Inception Imperial Porter")_
- [fermentable] "DRC® Crystal" → "Chateau Crystal" (score 0.399) _(in "Big Brew Dark Inception Imperial Porter")_
- [fermentable] "Chocolate Malt" → "Chocolate" (score 0.357) _(in "Big Brew Dark Inception Imperial Porter")_
- [fermentable] "Chocolate Wheat" → "Chocolate" (score 0.400) _(in "Big Brew Dark Inception Imperial Porter")_
- [hop] "Apollo" → "Amarillo" (score 0.333) _(in "Heady Topper ")_
- [hop] "Apollo" → "Amarillo" (score 0.333) _(in "Heady Topper ")_

## Unmatched ingredients (current threshold)
_Either genuinely not in inventory, or a matching gap to investigate._

- [fermentable] "Bulgar Wheat" → "Wheat" (score 0.583) _(in "Hoegaarden Clone")_
- [fermentable] "Wheat Malt Pale" → "Wheat Unmalted" (score 0.523) _(in "Hoegaarden Clone")_
- [hop] "East Kent Goldings (EKG)" → "Styrian Goldings" (score 0.613) _(in "Hoegaarden Clone")_
- [yeast] "Belgian Wit Ale" → "Wit Belgian" (score 0.641) _(in "Hoegaarden Clone")_
- [misc] "Campden Tablets" → "Coriander Seed" (score 0.751) _(in "Hoegaarden Clone")_
- [misc] "Electricity" → "Mango Extract" (score 0.651) _(in "Hoegaarden Clone")_
- [misc] "Whirlfloc" → "Calcium Chloride (CaCl2)" (score 0.791) _(in "Hoegaarden Clone")_
- [misc] "Yeast Nutrients" → "Gypsum (CaSO4)" (score 0.803) _(in "Hoegaarden Clone")_
- [misc] "Camomile" → "Calcium Chloride (CaCl2)" (score 0.670) _(in "Hoegaarden Clone")_
- [misc] "Lactic Acid" → "Calcium Chloride (CaCl2)" (score 0.770) _(in "Blue Moon Pilsner")_
- [misc] "Lactic Acid" → "Calcium Chloride (CaCl2)" (score 0.770) _(in "Blue Moon Pilsner")_
- [fermentable] "Chateau Cara Ruby" → "Chateau Crystal" (score 0.479) _(in "Session American IPA")_
- [hop] "Warrior" → "Amarillo" (score 0.571) _(in "Session American IPA")_
- [misc] "Yeast Nutrients" → "Gypsum (CaSO4)" (score 0.803) _(in "Session American IPA")_
- [yeast] "Lallemand Verdant " → "Verdant IPA" (score 0.687) _(in "Verdant IPA")_
- [misc] "Yeast Nutrients" → "Gypsum (CaSO4)" (score 0.803) _(in "Verdant IPA")_
- [yeast] "SafAle English Ale" → "Safale American Ale" (score 0.580) _(in "Oat Stout mod")_
- [misc] "Epsom Salt (MgSO4)" → "Gypsum (CaSO4)" (score 0.613) _(in "Oat Stout mod")_
- [misc] "Epsom Salt (MgSO4)" → "Gypsum (CaSO4)" (score 0.613) _(in "Oat Stout mod")_
- [misc] "Coffee" → "Coriander Seed" (score 0.751) _(in "Oat Stout mod")_
- [fermentable] "Wheat Malt" → "Wheat Unmalted" (score 0.321) _(in "Hefeweizen")_
- [hop] "Hallertauer Mittelfrueh" → "Hallertau Magnum" (score 0.594) _(in "Hefeweizen")_
- [yeast] "Weihenstephan Weizen" → "Hophead" (score 0.800) _(in "Hefeweizen")_
- [misc] "Whirlfloc" → "Calcium Chloride (CaCl2)" (score 0.791) _(in "Hefeweizen")_
- [fermentable] "Wheat Malt (Barrett Burston)" → "Wheat Unmalted" (score 0.741) _(in "Hoegarden original Cloned mia")_
