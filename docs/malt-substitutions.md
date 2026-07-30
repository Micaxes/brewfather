# Malt equivalences and substitutions

Source of truth for how Brewable matches and substitutes malts.

**Origin:** `docs/reference/Equivalenze-Malti-Malterie.pdf` — "Equivalenze e
sostituzioni malti", cross-maltster correspondence tables for Malteries
Soufflet (FR), Malterie du Château (BE), Bestmalz (DE), Weyermann (DE) and
Crisp / Simpsons / Thomas Fawcett (UK). EBC figures come from the maltsters'
own specifications, compiled by autobrasseur.fr (malt guide, April 2026).
Values vary slightly batch to batch.

The machine-readable version of these tables lives in
[`lib/matcher/malt-equivalents.ts`](../lib/matcher/malt-equivalents.ts). Edit
the data there; keep this document in sync as the human-readable rationale.

## Reading EBC

EBC (European Brewery Convention) measures malt colour: higher is darker. To
substitute, pick a malt from another maltster with a similar EBC band **and the
same function in the mash** (base, caramel, light kilned, roasted).

```
EBC = SRM × 1.97      SRM = EBC ÷ 1.97
```

In practice, work from the midpoint of the band.

## Substitution rules

These five rules are implemented in
[`lib/matcher/substitutions.ts`](../lib/matcher/substitutions.ts).

1. **Same category.** Base for base, caramel for caramel, roasted for roasted.
   A Caramunich Type 2 does *not* replace a Biscuit even at similar EBC — the
   first brings caramel sweetness, the second dry toasted bread.
2. **EBC band within ±10%.** A 5–10% deviation is imperceptible on the palate.
   Beyond that, adjust quantities or blend two malts to hit the target EBC.
3. **Style-origin coherence.** Belgian → Château; Märzen or Helles → Weyermann
   or Bestmalz; English Pale Ale → Maris Otter (Crisp, Simpsons, Fawcett). Malt
   terroir affects the final character. Used as a ranking tiebreak, never a
   hard filter.
4. **1:1 ratio in 95% of cases.** Exceptions: Special B, Special W, and
   colourants above 250 EBC generally — dose at −15% if the colour comes out
   too strong.
5. **Roasted Barley is its own case.** Unmalted roasted barley gives the
   grilled Guinness-style bitterness. It is **not** fully interchangeable with
   Black Malt, which is cleaner and less harsh. To soften, substitute with
   Chocolate Malt instead.

> Rule 5 is the one hard exception in the engine: Roasted Barley and Black Malt
> are never auto-matched to each other even though their EBC bands overlap.
>
> Rule 5 is also **directional**. The guide sanctions only the softening
> direction — "to soften, substitute with Chocolate Malt" — so Roasted Barley
> may be *replaced by* a malted equivalent, but is never offered as a stand-in
> *for* one. It is unmalted: no diastatic power, and a markedly harsher,
> grain-forward character. Without this, a dry run against real data proposed
> swapping Roasted Barley into a recipe calling for Chocolate Malt.

## How Brewable applies this

**Matching (affects score and bucket).** A recipe malt matches an inventory
malt when both resolve to this guide and they share a malt class with EBC
midpoints within 10% (or overlapping bands). Malts in the same equivalence row
are the strongest case — the guide lists them as direct 1:1 counterparts — and
are ranked first. Such matches are tagged `matchedBy: "equivalent"` so the UI
can show that a substitute was used rather than the exact malt.

**Suggestions.** When a malt is missing or short, the engine proposes up to
**three** substitutes drawn from **what is already in the user's inventory**,
each with a justification naming the rule that produced it. Candidates that
fully cover the required amount rank above ones that do not.

**Coverage limit.** Both sides must be identifiable — either by name in the
tables below or, for inventory items, by malt-class keyword plus a colour value
from Brewfather. A malt that resolves to neither is matched by name only, as
before, and gets no substitution suggestions.

**Name resolution is deliberately one-directional.** A queried name may contain
a guide name ("Pilsner Malt" → `Pilsner`), never the reverse. Allowing the
reverse resolved `Munich I` — a 12–18 EBC *base* malt — onto `BEST Caramel
Munich I` at 131–200 EBC, which would have swapped a crystal malt into a
pilsner. Matches are also whole-word, so `Blackcurrant` cannot resolve via
`Black`. The cost is coverage: on a real 59-malt inventory, 40 resolve. Malts
that don't (`Caramel/Crystal Malt 110`, `Oats, Flaked`, `Chateau Crystal`)
simply behave as they did before this feature.

Unmalted adjuncts — flaked oats, flaked barley, torrefied wheat, `Wheat
Unmalted` — are **not** mapped onto their malted counterparts. Like Roasted
Barley they lack diastatic power, so treating them as equivalents would be
wrong in the same direction rule 5 warns about. A name carrying an unmalted
token (`unmalted`, `flaked`/`flakes`, `torrefied`, `rolled`, `raw`, `green`)
never resolves to a malted row. The tokens are matched **per whole word**: as a
raw substring, `raw` hides inside "Weyermann Ca·raw·heat".

**"Colour is close" means one of two things**, and the justification says
which. Bands that *overlap* can still be far apart at the midpoint — Pale Ale
(4.5–6.5) and Château Pale Ale (6–8) overlap yet sit 21% apart — so a swap
accepted on overlap is described as "their colour ranges overlap", and only a
genuine midpoint match claims "inside the guide's ±10% band".

Run `npm run subs:dryrun` to see what the rules do against live Brewfather
data before shipping a change to the tables.

## Base malts

70–100% of the grist: fermentable sugars and the aromatic backbone.

| Soufflet (FR) | EBC | Château (BE) | EBC | Bestmalz (DE) | EBC | Weyermann (DE) | EBC | UK | EBC |
|---|---|---|---|---|---|---|---|---|---|
| Pilsen 2RP | 3–4 | Château Pilsen 2RP | 3–4 | BEST Pilsen | 3–4.9 | Weyermann Pilsner | 2.5–4.5 | Crisp Europils / Fawcett Pilsner | 3–4.5 |
| Pale Ale | 4.5–6.5 | Château Pale Ale 2RP | 7–10 | BEST Pale Ale | 5–7 | Weyermann Pale Ale | 5.5–7.5 | Simpsons Golden Promise / Crisp Maris Otter / Fawcett Maris Otter | 5–8 |
| Lager / Maris Otter | 4–6 | Château Pale Ale | 6–8 | BEST Heidelberg | 3–5 | Weyermann Barke Pilsner | 3–4 | Crisp Best Ale / Simpsons Best Pale Ale | 5–7 |
| Vienne 10 | 7–10 | Château Vienna | 4–7 | BEST Vienna | 6–9 | Weyermann Vienna | 6–9 | Crisp Vienna / Simpsons Vienna | 6–10 |
| Munich 15 | 12–18 | Château Munich Light | 12–18 | BEST Munich | 11–20 | Weyermann Munich Type 1 | 12–18 | Crisp Munich / Fawcett Munich | 15–20 |
| Munich 25 | 20–30 | Château Munich | 20–25 | BEST Munich Dark | 21–35 | Weyermann Munich Type 2 | 20–25 | Simpsons Munich / Crisp Dark Munich | 25–35 |

## Melanoidin malts

Reinforce malty aroma and colour. 1–10%, typical of ambers and reds.

| Soufflet | EBC | Château | EBC | Bestmalz | EBC | Weyermann | EBC | UK | EBC |
|---|---|---|---|---|---|---|---|---|---|
| — | | Château Melanoidin | 60–80 | BEST Melanoidin | 61–80 | Weyermann Melanoidin | 60–80 | Simpsons Aromatic | 45–60 |

## Caramel / Crystal malts

Residual sweetness, body, roundness, notes of caramel, honey and dried fruit.
From 2% (light beers) to 15% (rich beers).

| Soufflet | EBC | Château | EBC | Bestmalz | EBC | Weyermann | EBC | UK | EBC |
|---|---|---|---|---|---|---|---|---|---|
| — | | Château Cara Clair | 7–9 | BEST Caramel Pils | 3–7 | Weyermann Carapils | 2.5–6.5 | Crisp Carapils / Simpsons Low Color Crystal | 4–8 |
| Caramel Pilsen | 20–30 | Château Cara Blond | 17–24 | BEST Caramel Hell | 20–30 | Weyermann Carahell | 20–30 | Crisp Crystal 15 / Simpsons Crystal Light | 20–30 |
| Caramel Vienne | 50–60 | Château Cara Ruby | 45–55 | BEST Caramel Aromatic | 41–60 | Weyermann Carared | 40–60 | Crisp Crystal 55 / Simpsons Crystal Medium / Fawcett Crystal 55 | 45–60 |
| — | | Château Cara Honey | 60–80 | — | | — | | Simpsons Heritage Crystal | 70–90 |
| — | | Château Cara Arôme | 80–100 | BEST Caramel Munich I | 81–100 | Weyermann Caramunich Type 1 | 80–100 | Crisp Crystal 95 / Fawcett Crystal 90 | 80–100 |
| Caramel Ambrée | 100–120 | Château Cara Gold | 110–130 | BEST Caramel Munich II | 110–130 | Weyermann Caramunich Type 2 | 110–130 | Crisp Crystal 120 / Simpsons Dark Crystal / Fawcett Crystal II | 110–130 |
| Caramel Munich | 140–160 | Château Cara Crystal | 140–160 | BEST Caramel Munich III | 131–200 | Weyermann Caramunich Type 3 | 140–160 | Crisp Crystal 150 / Simpsons Double Roasted Crystal | 140–180 |
| — | | Château Special B | 250–350 | BEST Special X | 300 | Weyermann Special W | 280–320 | Simpsons Extra Dark Crystal / Fawcett Dark Crystal | 220–320 |

## Kilned malts (high-temperature dried)

Toasted bread, biscuit and crust. 2–10% in ambers, reds and stouts.

| Soufflet | EBC | Château | EBC | Bestmalz | EBC | Weyermann | EBC | UK | EBC |
|---|---|---|---|---|---|---|---|---|---|
| — | | Château Abbaye | 41–49 | — | | Weyermann Abbey | 40–50 | Simpsons Aromatic Monastic | 40–55 |
| Tourambrée | 45–55 | Château Biscuit | 45–55 | BEST Biscuit | 45–55 | — | | Simpsons Amber / Fawcett Amber | 45–65 |
| — | | Château Cara Pils Dextrine | 2–4 | — | | Weyermann Carafoam | 3–5 | Crisp Dextrin Malt | 3–5 |
| — | | — | | — | | — | | Simpsons Brown Malt / Fawcett Brown | 130–180 |

## Roasted malts

Very dark: coffee, chocolate, cocoa, grilled notes sometimes astringent. Use
sparingly (0.5–10%) in porters, stouts, brown ales and black beers.

| Soufflet | EBC | Château | EBC | Bestmalz | EBC | Weyermann | EBC | UK | EBC |
|---|---|---|---|---|---|---|---|---|---|
| Café | 400–650 | Château Café | 420–520 | — | | — | | Crisp Pale Chocolate / Simpsons Coffee Malt | 400–600 |
| Chocolat | 800–1000 | Château Chocolat | 900–1000 | BEST Chocolate | 800–1000 | Weyermann Carafa I | 800–1000 | Crisp Chocolate Malt / Simpsons Chocolate / Fawcett Chocolate | 800–1100 |
| Black | 1200–1400 | Château Black | 1150–1400 | BEST Black Malt | 1100–1200 | Weyermann Carafa II | 1050–1250 | Crisp Black Malt / Simpsons Black Malt / Fawcett Black | 1100–1400 |
| — | | Château Roasted Barley\* | 1000–1400 | BEST Roasted Barley\* | 1200–1400 | Weyermann Roasted Barley\* | 1000–1300 | Crisp / Simpsons / Fawcett Roasted Barley | 1000–1400 |
| — | | — | | — | | Weyermann Carafa III | 1300–1500 | Simpsons Black Malt Debittered | 1250–1450 |

\* Roasted Barley = unmalted roasted barley, used above all in Irish stouts.

## Wheat malts

Essential for Weizen and Witbier; stable head and creamy texture. From 5%
(support) to 60% (Weissbier). Above 60% add rice hulls — wheat has no husk.

| Soufflet | EBC | Château | EBC | Bestmalz | EBC | Weyermann | EBC | UK | EBC |
|---|---|---|---|---|---|---|---|---|---|
| Malt de blé | 2.4–4 | Château Froment Blanc | 3.5–5.5 | BEST Wheat | 3–5 | Weyermann Pale Wheat | 3–5 | Crisp Wheat Malt / Fawcett Pale Wheat | 3–5 |
| — | | Château Froment Munich | 15–20 | BEST Wheat Dark | 15–20 | Weyermann Dark Wheat | 15–19 | Simpsons Dark Wheat | 15–20 |
| Caramel de blé | 90–110 | Château Froment Crystal | 140–160 | BEST Caramel Wheat | 100–140 | Weyermann CaraWheat | 110–140 | Simpsons Crystal Wheat | 90–140 |
| — | | Château Froment Chocolat | 800–1100 | — | | Weyermann Chocolate Wheat | 900–1200 | Simpsons Roasted Wheat | 900–1200 |
| — | | Château Froment Black | 1100–1400 | — | | — | | — | |

## Diastatic, smoked and acidulated malts

Technical uses: enzymatic push, smoke aroma (Rauchbier), natural wort
acidification (Reinheitsgebot-compliant).

| Soufflet | EBC | Château | EBC | Bestmalz | EBC | Weyermann | EBC | UK | EBC |
|---|---|---|---|---|---|---|---|---|---|
| — | | Château Diastasique | 2.5–4 | — | | Weyermann Diastatic Barley | 2.5–4 | — | |
| — | | Château Fumé | 3–8 | BEST Smoked | 3–10 | Weyermann Beech Smoked | 4–8 | Simpsons Peated Malt | 3–6 |
| — | | Château Acide | 6–13 | BEST Acidulated | 3–10 | Weyermann Acidulated | 2.5–12 | — | |

## Other malted cereals

Spicy rye, silky oats (NEIPA, oatmeal stout), rustic spelt.

| Soufflet | EBC | Château | EBC | Bestmalz | EBC | Weyermann | EBC | UK | EBC |
|---|---|---|---|---|---|---|---|---|---|
| Malt de Seigle (rye) | 4–9 | Château Seigle | 4–10 | BEST Rye | 4–10 | Weyermann Pale Rye | 4–10 | Crisp Rye Malt / Fawcett Rye | 4–10 |
| — | | Château Épeautre (spelt) | 3–7 | BEST Spelt | 3–6 | Weyermann Spelt | 3.5–6 | — | |
| — | | Château Avoine (oat) | 2–4 | — | | Weyermann Oat | 3–6 | Crisp / Simpsons / Fawcett Oat Malt | 3–7 |

## Organic malts

Functionally identical to their conventional counterparts; the point is
labelling and certification. Typically 30–50% more expensive. Because they
carry the same class and EBC band, the engine matches them to the conventional
rows automatically — no special casing.

| Soufflet | EBC | Château | EBC | Bestmalz | EBC | Weyermann | EBC |
|---|---|---|---|---|---|---|---|
| Pilsen Bio | 3–4 | Château Pilsen Nature | 3–3.5 | BEST Organic Pilsen | 3–4.9 | Weyermann Organic Pilsner | 2.8–4 |
| Pale Ale Bio | 4.5–6.5 | Château Pale Ale Nature | 7–10 | BEST Organic Pale Ale | 5–7 | Weyermann Organic Pale Ale | 5.5–7.5 |
| Vienne Bio | 7–10 | Château Vienna Nature | 4–7 | BEST Organic Vienna | 6–9 | Weyermann Organic Vienna | 6–9 |
| Munich Bio | 15–25 | Château Munich Light Nature | 12–18 | BEST Organic Munich | 11–20 | Weyermann Organic Munich | 18–24 |

## Grist composition by style

Reference only — not used by the matcher, but useful for interpreting a recipe.

| Style | Base malt | Special malts | Final EBC |
|---|---|---|---|
| Blonde / Lager | Pilsen 90–100% | Carapils 0–5% | 4–8 |
| Wheat (Weizen) | Wheat 50% + Pilsen 50% | Carahell 0–5% | 6–14 |
| Pale Ale / IPA | Pale Ale 80–90% | Caramunich 5–10%, Munich 5–10% | 15–25 |
| NEIPA | Pale Ale 65%, oats 10–20% | Wheat 10–20%, Carapils 2–5% | 8–15 |
| Amber | Pale Ale 80% | Munich 10%, Cara Ruby 5–8%, Special B 1–2% | 25–40 |
| Red Ale | Pale Ale 75% | Munich 10%, Cara Ruby 8%, Biscuit 2%, Chocolate 0.5% | 35–50 |
| Brown Ale | Pale Ale 75% | Munich 10%, Crystal 120 8%, Chocolate 2–3% | 40–60 |
| Porter | Pale Ale 75% | Munich 8%, Crystal 10%, Chocolate 5%, Black 2% | 80–150 |
| Stout | Pale Ale 70% | Roasted Barley 8–10%, oat flakes 10%, Chocolate 5% | 150–300 |
| Belgian Dubbel | Pilsen 80% | Munich 5%, Cara Aroma 5%, Special B 3–5%, dark candi 10% | 35–50 |
| Belgian Tripel | Pilsen 85–90% | Light candi 10–15%, Carapils 2% | 8–15 |
| Saison | Pilsen 75–85% | Wheat 10–15%, Munich 5% | 6–12 |

## Practical notes

- **Pilsen malts are interchangeable.** The Pilsen malts of the four main
  maltsters are functionally equivalent; a slight aromatic difference is
  perceptible only on very clean profiles (Czech lager, Helles).
- **Caramunich 1 / 2 / 3.** Same Weyermann family, different intensity:
  Type 1 = 80–100 EBC light caramel; Type 2 = 110–130 EBC medium caramel;
  Type 3 = 140–160 EBC dark caramel with dried fruit.
- **Carapils / Carafoam / Dextrine.** Three names for the same lightly
  coloured malt (3–7 EBC) giving body and head without affecting colour.
  Substitutable 1:1. *(The source tables list these across two different
  sections; the engine carries an explicit cross-row equivalence for them.)*
- **Storage.** Milled malt degrades in 2–4 weeks through oxidation and
  humidity. Sealed sack: 6–12 months somewhere cool, dry and dark. Mill only
  shortly before brewing.
