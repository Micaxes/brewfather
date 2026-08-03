# Hop varieties and substitutions

Source of truth for how Brewable reasons about hop substitutions.

**Origin:** `docs/reference/Hop_Comparison_Chart_Detailed.pdf` — "Hop
Comparison Chart, Detailed Reference", compiled from the **Brouwland Hopguide
2025** (brouwland.com). Alpha, beta, total oil, cohumulone and the four oil
fractions are the guide's own published figures. All values are typical ranges
that vary by crop year and producer; the source says so itself, and nothing
here replaces a certificate of analysis.

The machine-readable version lives in
[`lib/matcher/hop-equivalents.ts`](../lib/matcher/hop-equivalents.ts). Edit the
data there; keep this document in sync as the human-readable rationale.

This is the hop-side companion to [malt equivalences](./malt-substitutions.md),
but the two are built on genuinely different sources and deliberately do not
share a shape:

| | Malt guide | Hop chart |
|---|---|---|
| What the source publishes | *Equivalence rows* — sets of malts the maltsters treat as interchangeable | An explicit, named **Substitutes column** per variety |
| How a substitution is derived | Inferred from malt class + EBC proximity | Read directly off the chart |
| Direction | Symmetric — a row is a set | **One-way** — the lists are not reciprocal |
| Quantity adjustment | 1:1, except colourants above 250 EBC (−15%) | Scaled by the alpha-acid ratio |

## Reading the fields

- **Type** — `Bitter`, `Aroma` or `Dual`. The most important field after
  alpha, because a bittering swap and a late-aroma swap are different problems.
  A variety bought for clean bitterness (Apollo, Herkules) is a poor stand-in
  for one bought for its aroma however close the alpha is, and vice versa.
- **Alpha %** — alpha acids, the bittering potential. Always a range, and the
  only field guaranteed present on all 70 varieties. This is what the weight
  maths below works from.
- **Beta %** — beta acids. Contribute to bitterness slowly during ageing
  rather than in the boil.
- **Oil ml/100g** — total oil. Broadly, aroma intensity.
- **Cohumulone %** — the guide's note: *lower = smoother bitterness*. Two hops
  can hit identical IBU and still taste different because of this.
- **Myrcene / Humulene / Caryophyllene / Farnesene %** — oil fractions. The
  guide's note: *myrcene high = fruity/citrus; humulene high = noble/earthy*.
- **Beer styles** and **Aroma profile** — the chart's own words, split on its
  own commas.
- **Substitutes** — the chart's explicit per-variety list. See below.

Some cells are published as a bare upper bound (`<40`, `<2.6`) where the lower
end is simply unstated. The data records those with no `min` at all rather than
inventing a floor of zero, so consumers must handle a missing lower bound.

## The substitution rules this data supports

### 1. The Substitutes column is the primary signal

It is an explicit, named, per-variety recommendation from the source — not
something inferred from oil chemistry. `substitutesFor(name)` returns it in the
chart's printed order, which reads as a preference ranking.

### 2. The lists are **not** symmetric, and are never auto-symmetrised

Cascade lists Ahtanum; nothing points back the other way. Cashmere lists
Cascade, but Cascade does not list Cashmere. The chart is transcribed exactly
as printed.

The reverse direction — "which varieties list *this* hop as their substitute?"
— is genuinely useful but is a weaker, inferred signal, so it lives in a
separate function, `reverseSubstitutesFor(name)`. The integrator opts into it
knowingly. It also works for names with no row of their own, which is the
point: nothing in the chart describes Ahtanum, yet it still tells us Cascade
and Triskel accept it.

### 3. Substituting changes the weight, not just the name

Swapping a 4% alpha hop for a 15% one at the same weight nearly quadruples the
bitterness. `bitternessEquivalentAmount(wanted, amount, candidate)` returns the
candidate weight for equal bitterness:

```
amountCandidate = alphaMid(wanted) × amountWanted ÷ alphaMid(candidate)
```

from the midpoint of each published band, unit-agnostic. So 100 g of Magnum
(10–15%, mid 12.5) needs ~187 g of Cascade (4.5–8.9%, mid 6.7) to land the same
bitterness. Any hop suggestion that does not restate the weight is actively
misleading.

### 4. Type gates the role

`suitableFor(entry, role)` reads the Type column: `Dual` serves either role,
`Bitter` and `Aroma` only their own.

## What this data does **not** tell you

This is the important half of the document. The chart is a bitterness-and-
character reference, not a recipe engine.

- **The weight maths is bitterness-equivalent only. It says nothing about
  aroma.** It is meaningful for a bittering addition, where alpha acids are
  isomerised over a long boil. For a late, whirlpool or dry-hop addition the
  point of the hop is its oil and aroma, and scaling weight by alpha is the
  *wrong* adjustment — it changes aroma intensity for no reason.
- **Equal IBU is not equal bitterness.** Cohumulone tracks the *quality* of
  the bitterness, and the formula ignores it.
- **Midpoints inherit the width of both bands.** Chinook (11–15%) against
  Simcoe (12–14%) is a tight comparison. Hallertau Perle (3–11%) against
  anything is not — take the real figure off the certificate of analysis.
- **Utilisation is not modelled.** The formula assumes the substitution happens
  at the same point in the boil. Utilisation changes with time and gravity.
- **No IBU, no recipe scaling, no boil times.** Nothing here computes IBU.
- **A substitute is not a clone.** The chart names Cascade for Cashmere; that
  is a judgement about broad character, not an assertion that the beer will
  taste the same.
- **Origin is as published**, and reflects where the guide's supplier sources
  the variety — not its horticultural provenance. The chart lists Fuggles as
  `FR` and Goldings as `BE`, which is not where either hop was bred. Transcribed
  verbatim; do not read it as terroir.
- **These are not the substitution *rules* the malt guide has.** The malt
  source publishes five numbered rules; this chart publishes none. Everything
  above is either read straight off a column or is arithmetic on alpha.

## Name resolution

`lookupHop(name)` mirrors `lookupMalt`: exact normalized match first, then a
whole-word containment pass so messy inventory names still land
(`"Citra (US) - Pellets"` → `Citra`).

**Containment is deliberately one-directional.** The queried name may contain a
chart name, never the reverse. This is the same trap the malt guide documents
after `Munich I` resolved onto `Caramel Munich I`, and it bites harder here
because hop names nest so heavily. Allowing the reverse would resolve a bare
`Styrian` onto Styrian Wolf (one of six Styrians), `Hallertau` onto whichever of
eight Hallertaus sorted first, and `Golding` onto Whitbread Golding — each a
different hop with a different alpha, which then silently produces a wrong
*weight*. A query that is only a fragment of a variety name is genuinely
ambiguous, so it resolves to nothing.

Names are scanned longest-first, so `Hallertau Cascade` resolves to itself
rather than to `Cascade`.

### Spelling aliases — the only data added beyond the chart

The chart refers to two of its own varieties by different spellings in its
Substitutes column. Four aliases reconcile the source with itself; no value,
range or relationship is invented.

| Alias used in the Substitutes column | Chart row |
|---|---|
| Styrian Goldings | Styrian Goldings Celeia |
| Styrian Golding | Styrian Goldings Celeia |
| Celeia | Styrian Goldings Celeia |
| Fuggle | Fuggles |

The Styrian aliases also close a real trap: `Styrian Goldings` ends with the
chart name `Goldings`, a different Belgian hop, so without the alias the
containment pass would resolve it wrongly. Because the index is scanned
longest-first, the alias wins.

## Known gaps

**Five names appear only in the Substitutes column and have no row of their
own.** They are kept as printed rather than dropped or invented — "the chart
suggests Ahtanum and we have no data on it" is a truthful answer; a silent
omission is not. They are exported as `SUBSTITUTES_NOT_IN_CHART`.

| Name | Named by |
|---|---|
| Ahtanum | Cascade, Triskel |
| Kent Golding | Bramling Cross |
| Progress | Bramling Cross |
| Sterling | Motueka |
| Zeus | Apollo |

**Two hops in real inventory here cannot be resolved at all:**

- **Ahtanum** — named twice as a substitute but never described, so it has no
  alpha figure. `lookupHop("Ahtanum")` returns `undefined` and no weight can be
  offered for it. `reverseSubstitutesFor("Ahtanum")` still reports that Cascade
  and Triskel accept it.
- **Warrior** — does not occur anywhere in the source, not even as a
  substitute. It is deliberately absent rather than filled in from elsewhere.

The other twelve stocked varieties — Motueka, El Dorado, Mosaic, Citra, Simcoe,
Cascade, Amarillo, Chinook, Magnum, Saaz, Columbus, Nelson Sauvin — all resolve.

**Seven varieties name no substitute at all** (the chart prints `-`, or leaves
the cell blank for Barbe Rouge): Barbe Rouge, Huell Melon, Krush HBC586, Sabro,
Styrian Cardinal, Styrian Kolibri, Styrian Wolf.

## Transcription notes

The whole value of this dataset is that the numbers are right — a mistyped
alpha silently produces a wrong weight rather than a visible failure. Every
deviation from a clean read is recorded here and at the entry in the data file.

- **The chart's own header claims "68 hop varieties"; its tables contain 70.**
  All 70 are transcribed. The count is pinned by a test.
- **Mistral, humulene** — prints as `9.5-1.8`, an inverted range. Omitted
  rather than guessed at.
- **Elixir, farnesene** — the cell is blank in the source. Omitted. Elixir's
  caryophyllene of 0.1–0.2 is an order of magnitude below every other variety,
  but it sits squarely in the caryophyllene column of the PDF, so it is
  transcribed as printed.
- **Barbe Rouge, substitutes** — blank cell rather than the `-` used elsewhere;
  both mean "no substitute named".
- **Centennial, aroma profile** — prints "Citrus" twice. Kept verbatim.
- **Hallertau Hersbrücker / Hersbrucker** — the chart spells it with an umlaut
  in Crystal's substitutes and without one in the variety row and in
  Strisselspalt's substitutes. Both are kept as printed; name normalization
  strips diacritics, so they resolve to the same variety.

Every row was extracted from the PDF's table structure and then cross-checked
against an independent flat-text extraction of the same file; alpha, origin and
type agree on all 70.

## Specifications

| Variety | Origin | Type | Alpha % | Beta % | Oil ml/100g | Cohumulone % | Myrcene % | Humulene % | Caryophyllene % | Farnesene % |
|---|---|---|---|---|---|---|---|---|---|---|
| Amarillo | USA | Dual | 6–11 | 6–7 | 1.5–1.9 | 68–70 | 9–11 | 2–4 | 21–24 | 2–4 |
| Apollo | USA | Bitter | 15–19 | 5–8 | 1.5–2.5 | 25–30 | 35–50 | 10–15 | 14–18 | 0 |
| Aramis | FR | Aroma | 6.5–8.5 | 3.5–5.5 | 1.2–1.6 | &lt;40 | 21–28 | &lt;21 | &lt;2.6 | 2–4 |
| Ariana | DE | Dual | 8–14.5 | 3.7–6.6 | 2.1–2.4 | &lt;47 | 40–42 | &lt;18 | &lt;5.4 | &lt;0.1 |
| Azacca | USA | Dual | 10–14 | 4–5.5 | 1.0–2.0 | 35–50 | 15–24 | 9–14 | 36–40 | 0.1–1 |
| Barbe Rouge | FR | Aroma | 7.5–9.5 | 3–3.8 | 1.8–2.2 | 35–52 | 42.1–42.2 | 15–25 | 2.5–2.8 | 2.5–3.5 |
| Bobek | SVN | Aroma | 3.5–7.8 | 4–6.1 | 0.7–3.0 | 45–57 | 26–31 | 13–19 | 4–6 | 4–7 |
| Bramling Cross | UK | Aroma | 5–7 | 2.5–3.5 | 0.8–1.5 | 30–45 | 25–35 | 22–28 | 5–8 | 0.5–1.0 |
| Brewers Gold | BE | Bitter | 4–6.5 | 3.7–6.8 | 1.8 | 40 | 41 | 35 | 35 | &lt;1 |
| Callista | DE | Aroma | 2–5 | 5–10 | 0.7–1.5 | &lt;52.5 | 15–21 | &lt;17.3 | &lt;4.4 | &lt;0.4 |
| Cascade | USA | Aroma | 4.5–8.9 | 3.6–7.5 | 0.8–1.5 | 45–60 | 8–16 | 4–6 | 33–40 | 4–8 |
| Cashmere | USA | Dual | 7.0–10.0 | 5.0–7.0 | 0.5–1.5 | 25–40 | 20–35 | 10–15 | 20–24 | 0.1–0.5 |
| Centennial | USA | Dual | 8.5–12.0 | 3.5–5.5 | 1.0–3.5 | 60–75 | 7–12 | 3–7 | 23–26 | 0.7–1.7 |
| Challenger | BE | Dual | 6.5–9 | 3.2–4.5 | 1.0–1.7 | 30–42 | 20–25 | 25–32 | 8–10 | 1–3 |
| Chinook | USA | Dual | 11.0–15.0 | 3.0–4.5 | 1.0–2.5 | 25–40 | 15–20 | 6.5–11 | 26–31 | 0.1–0.8 |
| Citra | USA | Dual | 10.0–16.0 | 3–4.5 | 1.0–3.0 | 50–70 | 7–12.5 | 4–8 | 20–24 | 0.1–1.0 |
| Columbus | USA | Bitter | 14–18 | 4.5–6 | 2.0–4.0 | 45–60 | 9–14 | 6–10 | 26–30 | 0.1–1.0 |
| Crystal | USA | Aroma | 3.5–6.0 | 6.5–9.0 | 0.8–1.8 | 35–50 | 20–24 | 20–28 | 6–10 | 0.1–1.0 |
| Ekuanot | USA | Dual | 12.9–15.7 | 4–5.5 | 2.5–4.5 | 30–40 | 17–22 | 9–12 | 30–37 | 0.1–1.0 |
| El Dorado | USA | Dual | 13–17 | 5.2–8.0 | 2.2–2.8 | 55–60 | 10–15 | 6–8 | 28–33 | 0.1–1.0 |
| Elixir | FR | Aroma | 5–7 | 4.5–5.5 | 1.8–2.2 | 70–75 | 29–39 | 25–30 | 0.1–0.2 | — |
| Fuggles | FR | Aroma | 4–5.5 | 2.1–2.8 | 0.44–0.83 | 43.4 | 27–33 | 27 | 9.1 | 4.3 |
| Galaxy | AU | Dual | 11–16 | 5–6.9 | 3.5 | 33–67 | 32–42 | 1–2 | 7–9 | 2–4 |
| Goldings | BE | Aroma | 5–6 | 2–3 | 0.85 | 42 | 29 | 27 | 9 | &lt;1 |
| Hallertau Blanc | DE | Aroma | 8.0–12.9 | 4.6–7.0 | 0.8–1.9 | 35–45 | 22–26 | 1–4 | 1–4 | 0.1–1.0 |
| Hallertau Cascade | DE | Aroma | 4.5–7 | 4.5–7 | 0.8–1.5 | 30–55 | 31–40 | 7.0–14 | 2.5–4.7 | 3.2–6.0 |
| Hallertau Hersbrucker | DE | Aroma | 2–5 | 4–6 | 0.5–1.3 | 10–25 | 19–25 | 15–35 | 7–15 | &lt;1 |
| Hallertau Mittelfruh | DE | Aroma | 2.3–6.6 | 3.3–6.5 | 0.5–1.0 | 20–30 | 18–28 | 30–40 | 6–12 | 0.1–1.0 |
| Hallertau Perle | DE | Dual | 3–11 | 2.3–5.2 | 0.5–1.5 | 20–30 | 29–35 | 35–45 | 10–15 | 0.1–1.0 |
| Hallertau Taurus | DE | Dual | 12–17 | 4–6 | 0.9–1.5 | 30–50 | 20–25 | 22–33 | 6–11 | &lt;1 |
| Hallertau Tradition | DE | Aroma | 4–7 | 4–5 | 0.9–1.9 | 20–25 | 23–29 | 40–55 | 10–15 | &lt;1 |
| Herkules | DE | Bitter | 12–17 | 4–6 | 1.4–2.0 | 30–50 | 32–38 | 28–45 | 7–12 | &lt;1 |
| Huell Melon | DE | Dual | 4.9–9.5 | 7.3–12 | 0.7–2.1 | 35–37 | 25–30 | 10–20 | 5–10 | &lt;1 |
| Idaho 7 | USA | Dual | 9–14 | 3.5–9.1 | 1.0–5.0 | 45–55 | 10–15 | 5–8 | 30–40 | 0.1–1.0 |
| Kazbek | CZ | Dual | 5–8 | 4–6 | 0.9–1.8 | 40–55 | 30–40 | 20–35 | 10–15 | &lt;1 |
| Krush HBC586 | USA | Dual | 10–14 | 7–9 | 0.5–3.0 | 40–60 | 10–16 | 10–18 | 36–40 | &lt;1 |
| Magnum | DE/BE | Bitter | 10–15 | 4.5–5.5 | 1.9–2.3 | 30–35 | 24–25 | 34–40 | 8–12 | 0.1–1.0 |
| Mandarina Bavaria | DE | Dual | 7–10 | 5–6.5 | 0.8–2.0 | 35–45 | 31–35 | 10–15 | 6–10 | 1–2 |
| Mistral | FR | Dual | 6.5–8.5 | 3.1–3.8 | 1.0–1.5 | 59–65 | 29–39 | — | 3.0–3.15 | &lt;1 |
| Mosaic | USA | Dual | 10–15 | 3.0–4.5 | 0.5–3.0 | 45–65 | 9–16 | 3–8 | 20–25 | 0.1–1.0 |
| Motueka | NZ | Dual | 6.5–8.5 | 5–5.5 | 0.8–1.5 | 45–60 | 28–32 | 0.8–4.0 | 0.8–2.0 | 10–15 |
| Nectaron | NZ | Dual | 10.5–11.5 | 4.5–5 | 1.5–2.0 | 55–65 | 26–28 | 15–18 | 4.0–5.0 | 0.1–0.2 |
| Nelson Sauvin | NZ | Dual | 10–13 | 5–8 | 0.8–1.5 | 35–45 | 20–24 | 25–35 | 6–10 | 0.1–1.0 |
| Northern Brewer | DE | Dual | 6.0–10.0 | 3.0–5.0 | 1.0–1.6 | 35–45 | 27–32 | 25–35 | 9–14 | 0.1–1.0 |
| Nugget | FR | Bitter | 10–14 | 4–6 | 1.5–3.0 | 48–59 | 22–30 | 12–22 | 7–10 | 0.1–1.0 |
| Opal | DE | Dual | 5–10.5 | 3.5–5.5 | 0.8–1.3 | 15–35 | 13–17 | 20–35 | 7–12 | 0.1–1.0 |
| Pacific Jade | NZ | Dual | 12–14 | 7–9 | 1.0–2.0 | 40–50 | 22–26 | 20–25 | 6–9 | 0.1–1.0 |
| Pekko | USA | Dual | 13–16 | 3.5–5.0 | 1.0–3.0 | 20–30 | 20–28 | 15–20 | 27–30 | 0.1–1.0 |
| Pilgrim | UK | Dual | 9–13 | 4.2–5.2 | 1.0–2.0 | 30–35 | 36–38 | 21–25 | 7–8 | 0.3–1.0 |
| Riwaka | NZ | Aroma | 4.5–6.5 | 4–5 | 0.9–1.5 | 55–65 | 29–36 | 9–13 | 4–7 | 0.5–1.0 |
| Saaz | CZ/SVN/DE | Aroma | 3–4.5 | 3–4.5 | 0.5–1.0 | 25–37 | 24–28 | 23–40 | 7–11 | 9–13 |
| Sabro | USA | Aroma | 12–17 | 5.5–7.5 | 1.0–4.0 | 55–70 | 6–10 | 8–14 | 20–24 | 0.1–1 |
| Simcoe | USA | Dual | 12–14 | 4–5 | 2–2.5 | 60–65 | 10–15 | 5–8 | 15–20 | &lt;1 |
| Sladek | CZ | Aroma | 4.5–8.0 | 4–7 | 1.0–2.0 | 35–50 | 23–30 | 25–35 | 8–13 | 0.1–1.0 |
| Spalt Select | DE/SVN | Aroma | 3–6.5 | 2–5 | 0.5–1.2 | 40–50 | 20–28 | 15–20 | 6–8 | 10–22 |
| Strisselspalt | FR | Aroma | 1.8–2.5 | 4–4.7 | 0.6–0.8 | 35–52 | 20–23 | 13–21 | 8–10 | &lt;1 |
| Styrian Aurora | SVN | Dual | 6.5–9.5 | 3.2–5.5 | 0.9–1.6 | 35–45 | 22–26 | 20–27 | 4–8 | 6–9 |
| Styrian Cardinal | SVN | Aroma | 10–15 | 3–5 | 3.0–4.0 | 40–50 | 31–37 | 15–22 | 8–11 | 5–7 |
| Styrian Dana | SVN | Dual | 11–16 | 4–6 | 2.4–3.9 | 42–60 | 28–31 | 15–21.6 | 5.7–7.6 | 6.9–8.7 |
| Styrian Dragon | SVN | Aroma | 6–11 | 7.5–8.5 | 1.5–2.1 | 58–63 | 22–24 | 22–33 | 12–16 | 0.1–1.0 |
| Styrian Goldings Celeia | SVN | Aroma | 2.8–6 | 2–3 | 0.5–2.0 | 25–35 | 25–30 | 20–25 | 8–10 | 3–7 |
| Styrian Kolibri | SVN | Aroma | 4–6 | 2.8–5.4 | 1–2 | 32 | 21–25 | 16–21 | 5.5–7 | 25–27 |
| Styrian Wolf | SVN | Dual | 10–18.5 | 5–6 | 2.2–3.6 | 60–70 | 22–23 | 5–9 | 2–3 | 4.5–6.5 |
| Tango | DE | Dual | 7.5–12.4 | 6–10 | 2.4–4.0 | 29–30 | 20–25 | 0.1–0.5 | 0.5–0.6 | 4.5–5.5 |
| Target | BE | Bitter | 8–15 | 5–5.5 | 1.2–1.8 | 45–55 | 35–40 | 17–22 | 5–9 | 0.1–1.0 |
| Tettnanger | DE | Aroma | 2.5–5.5 | 3.0–5.0 | 0.5–0.9 | 25–35 | 22–28 | 22–28 | 6–11 | 16–24 |
| Triskel | FR | Aroma | 2.8–4.6 | 4–4.7 | 1.5–2 | 59–61 | 20–23 | 13.4–13.6 | 6–6.2 | &lt;1 |
| Wakatu | NZ | Dual | 6.5–8.5 | 7.5–8.5 | 0.8–1.5 | 35–45 | 28–32 | 15–17 | 6–8.5 | 5–7 |
| Whitbread Golding | UK | Dual | 5–7.5 | 2.5–5.5 | 0.8–1.2 | 19–27 | 33–37 | 35–42 | 11–15 | 1–2.1 |
| Willamette | USA | Aroma | 4–6.5 | 3.5–5.0 | 0.5–1.6 | 25–40 | 28–32 | 25–35 | 10–14 | 6–10 |

Bands written `<n` are published as an upper bound only — the chart states no
lower end. `—` marks a figure the chart does not state readably (see
transcription notes).

## Styles, substitutes and character

| Variety | Type | Alpha % | Beer styles | Substitutes | Aroma profile |
|---|---|---|---|---|---|
| Amarillo | Dual | 6–11 | Ale, IPA, APA | Cascade, Centennial, Chinook, Simcoe | Citrus, Floral, Tropical |
| Apollo | Bitter | 15–19 | Ale, IPA | Chinook, Columbus, Zeus | Citrus, Pine, Resin |
| Aramis | Aroma | 6.5–8.5 | APA, Pale Ale, Pils, Saison, Wheat | Willamette, Challenger, Strisselspalt | Citrus, Spiced |
| Ariana | Dual | 8–14.5 | APA, Pils, Saison, Wheat | Mandarina Bavaria, Huell Melon | Citrus, Stone fruit, Tropical |
| Azacca | Dual | 10–14 | APA, Pale Ale | Amarillo, Citra, Pekko | Citrus, Pine, Spicy, Tropical |
| Barbe Rouge | Aroma | 7.5–9.5 | Altbier, Pils, Porter | — | Citrus, Fruity, Strawberry Sorbet |
| Bobek | Aroma | 3.5–7.8 | Blond, Pale Ale, Pils, Saison, Tripel | Fuggles, Willamette, Styrian Golding | Floral, Citrus, Fruity, Spiced |
| Bramling Cross | Aroma | 5–7 | ESB, Bitter, Pale Ale | Kent Golding, Progress, Whitbread Golding | Mild, Fruity, Currant |
| Brewers Gold | Bitter | 4–6.5 | Blond, Pale Ale, Porter, Stout | Northern Brewer, Chinook | Fruity, Spiced, Spicy |
| Callista | Aroma | 2–5 | APA, Pale Ale | Hallertau Tradition | Citrus, Stone fruit, Tropical, Apricot |
| Cascade | Aroma | 4.5–8.9 | Fruit beer, APA | Centennial, Amarillo, Ahtanum | Floral, Citrus, Grapefruit |
| Cashmere | Dual | 7.0–10.0 | Saison | Cascade | Citrus, Lemon, Lime, Melon |
| Centennial | Dual | 8.5–12.0 | APA | Chinook, Cascade, Columbus, Amarillo | Floral, Citrus, Citrus |
| Challenger | Dual | 6.5–9 | Blond, Bock, Pale Ale, Porter, Stout | Northern Brewer, Target | Floral, Pine, Fruity, Spicy |
| Chinook | Dual | 11.0–15.0 | APA, IPA, Stout, Porter | Columbus, Northern Brewer | Citrus, Pine, Spicy |
| Citra | Dual | 10.0–16.0 | APA | Simcoe, Mosaic, Cascade, Centennial | Citrus, Fruity, Stone fruit, Tropical |
| Columbus | Bitter | 14–18 | APA | Chinook, Hallertau Taurus | Citrus, Resin, Spiced |
| Crystal | Aroma | 3.5–6.0 | Pils | Hallertau Hersbrücker, Strisselspalt | Floral, Spiced, Spicy, Cinnamon |
| Ekuanot | Dual | 12.9–15.7 | Blond, APA, Pils | Huell Melon, El Dorado | Floral, Pine, Fruity, Stone fruit, Tropical |
| El Dorado | Dual | 13–17 | Blond, APA, Pale Ale | Ekuanot | Fruity, Stone fruit, Tropical |
| Elixir | Aroma | 5–7 | APA, Pale Ale, Saison | Kazbek, Mistral | Floral, Spiced, Tropical, Tangerine |
| Fuggles | Aroma | 4–5.5 | APA, Pale Ale, Porter, Stout | Willamette, Styrian Golding | Floral, Grassy, Earthy |
| Galaxy | Dual | 11–16 | Fruit beer, APA, Pale Ale | Simcoe, Citra, Amarillo | Citrus, Fruity, Peach, Passion fruit |
| Goldings | Aroma | 5–6 | Blond, Brown, Pale Ale, Porter, Stout | Fuggles, Styrian Goldings, Willamette | Earthy, Floral, Citrus, Spicy |
| Hallertau Blanc | Aroma | 8.0–12.9 | Blond, APA, Saison | Nelson Sauvin | Citrus, Fruity, Spiced, Wine |
| Hallertau Cascade | Aroma | 4.5–7 | Fruit beer, APA | Centennial, Amarillo | Floral, Citrus, Grapefruit |
| Hallertau Hersbrucker | Aroma | 2–5 | Altbier, Bock, Pils, Weizen | Hallertau Tradition, Spalt Select | Floral, Spiced, Spicy |
| Hallertau Mittelfruh | Aroma | 2.3–6.6 | Pils, Lager | Hallertau Tradition, Spalt Select | Floral, Spiced, Spicy, Noble |
| Hallertau Perle | Dual | 3–11 | Altbier, Blond, Bock, Pils, Tripel | Northern Brewer, Magnum | Floral, Spiced, Spicy |
| Hallertau Taurus | Dual | 12–17 | Altbier, Pils | Magnum, Hallertau Tradition, Herkules | Earthy, Resin |
| Hallertau Tradition | Aroma | 4–7 | Blond, Pils | Hallertau Mittelfruh, Tettnanger | Floral, Grassy, Spiced |
| Herkules | Bitter | 12–17 | Altbier, Pils | Magnum, Hallertau Taurus | Resin, Spiced, Peppery |
| Huell Melon | Dual | 4.9–9.5 | Blond, Saison, Tripel | — | Fruity, Honeydew Melon, Strawberry |
| Idaho 7 | Dual | 9–14 | APA, Pale Ale, IPA | Azacca, El Dorado, Cashmere, Citra | Pine, Stone fruit, Tropical |
| Kazbek | Dual | 5–8 | Pale Ale, Pils | Saaz | Citrus, Spiced, Stone fruit, Tropical |
| Krush HBC586 | Dual | 10–14 | Blond, APA, Pale Ale, Saison | — | Citrus, Stone fruit, Tropical, Mango |
| Magnum | Bitter | 10–15 | Altbier, Blond, Pale Ale, Stout | Columbus, Hallertau Taurus | Citrus, Grassy, Spiced |
| Mandarina Bavaria | Dual | 7–10 | Blond, APA, Pale Ale, Wheat | Cascade, Huell Melon | Citrus, Fruity, Tangerine |
| Mistral | Dual | 6.5–8.5 | Bock, APA, Pale Ale, Pils, Saison | Kazbek, Elixir | Floral, Citrus, Pine, Tropical |
| Mosaic | Dual | 10–15 | APA | Simcoe, Citra | Earthy, Citrus, Resin, Tropical |
| Motueka | Dual | 6.5–8.5 | Blond, Bock, Brown, Tripel | Saaz, Sterling | Citrus, Spiced, Tropical, Mojito |
| Nectaron | Dual | 10.5–11.5 | Pale Ale, Pils | Citra, Mosaic | Fruity, Stone fruit, Tropical |
| Nelson Sauvin | Dual | 10–13 | APA, Pale Ale | Hallertau Blanc, Motueka | Fruity, Wine, Sauvignon Blanc |
| Northern Brewer | Dual | 6.0–10.0 | Blond, Pale Ale, Porter, Stout | Hallertau Perle, Chinook, Magnum | Resin |
| Nugget | Bitter | 10–14 | Blond, Pale Ale, Porter, Stout | Magnum, Columbus | Floral, Resin, Spiced |
| Opal | Dual | 5–10.5 | Brown, Pils, Saison, Weizen | Goldings, Tettnanger | Citrus, Spiced, Herbal |
| Pacific Jade | Dual | 12–14 | APA, Pale Ale | Magnum | Citrus, Spiced, Black Pepper |
| Pekko | Dual | 13–16 | Various | Saaz, Azacca | Floral, Citrus, Spiced, Mint |
| Pilgrim | Dual | 9–13 | Stout, Wheat beer | Target, Challenger | Citrus, Fruity, Spicy |
| Riwaka | Aroma | 4.5–6.5 | APA, Pale Ale, Pils | Saaz | Citrus, Fruity, Grapefruit, Kumquat |
| Saaz | Aroma | 3–4.5 | Altbier, Pils, Wheat, Weizen | Tettnanger, Sladek | Earthy, Floral, Spiced, Noble |
| Sabro | Aroma | 12–17 | APA, Porter, Saison, Stout | — | Citrus, Spiced, Stone fruit, Tropical, Coconut |
| Simcoe | Dual | 12–14 | APA | Amarillo, Cascade, Citra, Mosaic | Earthy, Citrus, Resin, Pine |
| Sladek | Aroma | 4.5–8.0 | Blond, Pale Ale, Pils | Saaz | Citrus, Fruity, Tropical, Grapefruit |
| Spalt Select | Aroma | 3–6.5 | Altbier, Bock, Pils, Weizen | Saaz, Tettnanger | Floral, Spiced, Spicy |
| Strisselspalt | Aroma | 1.8–2.5 | Pale Ale, Saison | Hallertau Hersbrucker, Hallertau Tradition | Earthy, Floral, Spiced |
| Styrian Aurora | Dual | 6.5–9.5 | Blond, Pale Ale, Tripel | Styrian Goldings, Northern Brewer | Floral, Grassy, Super Styrian |
| Styrian Cardinal | Aroma | 10–15 | Blond, APA, Pale Ale | — | Citrus, Fruity, Tropical, Pineapple |
| Styrian Dana | Dual | 11–16 | APA, Pale Ale | Bobek, Celeia, Willamette | Citrus, Fruity, Spiced |
| Styrian Dragon | Aroma | 6–11 | Blond, APA, Pale Ale | Azacca, Galaxy, Idaho 7 | Citrus, Fruity, Tropical, Grapefruit |
| Styrian Goldings Celeia | Aroma | 2.8–6 | Blond, Pale Ale, Tripel | Saaz, Bobek | Earthy, Resin, Spiced |
| Styrian Kolibri | Aroma | 4–6 | APA | — | Floral, Citrus, Fruity, Spiced |
| Styrian Wolf | Dual | 10–18.5 | APA | — | Floral, Citrus, Fruity, Tropical, Mango |
| Tango | Dual | 7.5–12.4 | Altbier, Blond, APA, Tripel | Hallertau Tradition, Hallertau Perle | Citrus, Fruity, Resin |
| Target | Bitter | 8–15 | Pale Ale, Porter, Stout | Willamette, Fuggles | Pine, Resin |
| Tettnanger | Aroma | 2.5–5.5 | Altbier, Bock, Pils, Weizen | Saaz, Spalt Select | Floral, Spiced, Spicy, Noble |
| Triskel | Aroma | 2.8–4.6 | Pils | Strisselspalt, Ahtanum, Centennial | Floral, Citrus, Spiced |
| Wakatu | Dual | 6.5–8.5 | Pale Ale, Pils | Hallertau Mittelfruh | Floral, Citrus |
| Whitbread Golding | Dual | 5–7.5 | Blond, Pale Ale, Tripel | Fuggles | Floral, Fruity, Spiced |
| Willamette | Aroma | 4–6.5 | Various | Fuggle, Styrian Goldings, Tettnanger | Floral, Spiced |
