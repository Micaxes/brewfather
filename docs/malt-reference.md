# Malt property reference

Per-malt properties: colour, extract, enzymes, dosage ceiling, and what
Weyermann and Briess call the same thing.

**Origin:** `docs/reference/Malt_Comparison_Chart_Detailed.pdf` — "Malt
Comparison Chart, Detailed Reference", compiled August 2026 from the Weyermann,
Briess, Dingemans, Simpsons, Crisp and Bestmalz datasheets plus the MoreBeer
Brewing Malt Comparison Chart, the Hogtown Brewers Club reference and the
Grainmother / Wild About Hops cross-reference charts. PPG figures are laboratory
conditions; expect 70–80% efficiency in practice.

The machine-readable version lives in
[`lib/matcher/malt-profiles.ts`](../lib/matcher/malt-profiles.ts). Edit the data
there; keep this document in sync as the human-readable rationale.

## How this relates to `docs/malt-substitutions.md`

**Complementary, not a replacement. Neither file supersedes the other and this
one changes nothing about how the engine behaves today.**

|  | `malt-substitutions.md` / `malt-equivalents.ts` | `malt-reference.md` / `malt-profiles.ts` |
|---|---|---|
| Question it answers | Which maltster's product equals which? | What are this malt *type's* properties? |
| Shape | One row per equivalence class, many maltster names on it | One row per malt type |
| Data | Name + EBC band only | Colour, extract, enzymes, mash requirement, ceiling, moisture, protein, flavour, styles, cross-references |
| Coverage | 193 named products on 36 equivalence rows, 7 maltsters | 53 generic malt types |
| Used by the engine | Yes — rules 1–5, matching and suggestions | Not yet; wiring is a separate change |

They overlap on colour and disagree on taxonomy (see
[Categories are not malt classes](#categories-are-not-malt-classes)). Where they
overlap on colour they broadly agree: the equivalence guide puts Weyermann
Caramunich Type 2 at 110–130 EBC and this chart puts Caramunich II at 110–130
EBC; both put Carahell at 20–30 and Chocolate at 800–1000.

The equivalence tables remain the right place for **product naming** — "BEST
Caramel Hell is the same malt as Weyermann Carahell". This file deliberately
does not duplicate that; it carries only the names the chart itself prints.

## Fields

| Field | Meaning |
|---|---|
| `category` | The chart's own six-way grouping. **Not** `MaltClass` — see below. |
| `ebc` | Published colour band, EBC. `min === max` where the chart prints one figure. |
| `lovibond` | Published colour band in degrees Lovibond. The chart heads this column "°Lov (SRM)", treating Lovibond and SRM as one scale. |
| `ppg` | Extract potential in points per gallon, at laboratory efficiency. |
| `mashRequired` | Whether the grain must be mashed to convert. |
| `maxPercent` | Sane ceiling as a percentage of the grist. |
| `moisturePercent`, `proteinPercent` | As published. |
| `diastaticPower` | Degrees Lintner. **0 = no enzymes at all.** |
| `flavor`, `styles`, `notes` | The chart's prose, verbatim. |
| `weyermann`, `briess` | Named counterpart, with the chart's `*` preserved as `approximate: true`. Omitted where the chart prints "—". |

### Diastatic power is the measurement behind `unmalted`

`MaltRow.unmalted` in `malt-equivalents.ts` is a boolean that exists to stop raw
grain being offered as a stand-in for malt: no enzymes, harsher character. It is
set on exactly two rows, because those are the two the source guide happened to
footnote.

Diastatic power says the same thing quantitatively, for all 53 rows. Every row
outside the Base category reads 0 °Lintner — all 35 of them — and so do three
rows inside it (Acidulated, Melanoidin, Oat Malt), with a fourth, Dark Wheat
Malt, bottoming out at 0. The chart's own footnote gives the two thresholds that
matter: **>35 = self-converting, >70 = can convert adjuncts.**

Two subtleties the data forces:

- **Dark Wheat Malt is 0–30.** The band spans zero, so a batch at the bottom of
  it brings nothing. `hasDiastaticPower` therefore reads the band *max* ("might
  have enzymes") while `isSelfConverting` reads the *min* ("reliably converts").
  A midpoint would call it enzymatic, which it may not be.
- **Oat Malt is 0 °Lintner but `mashRequired: true` and filed under Base.** It
  is malted — the equivalence guide is right to keep it apart from raw oats —
  but it still cannot carry a mash alone. A boolean cannot express that; a
  number can.

### `maxPercent` is a dosage ceiling

A substitution that pushes a malt past its sane maximum is a bad suggestion
however well the colour matches. Every one of the 53 rows states a ceiling:

| Ceiling | Malts |
|---|---|
| 5% | CaraAroma, Black Patent Malt |
| 10% | Acidulated, CaraPils/Dextrin, Caramunich III, Crystal 120L, Special B, Rice Hulls, and every roasted malt except Black Patent |
| 15% | Brown, CaraAmber, CaraRed, Carahell, Caramunich I & II, Crystal 60L, Honey, Chocolate Wheat |
| 20% | Melanoidin, Amber, Biscuit, Victory, Caramel Wheat, Flaked Barley, Flaked Rye |
| 30% | Oat Malt, Peated Malt, Flaked Oats |
| 40% | Flaked Corn/Maize, Flaked Rice, Flaked Wheat, Torrified Wheat |
| 50% | Rye Malt |
| 70% | Wheat Malt, Dark Wheat Malt |
| 80% | Munich Malt I & II |
| 100% | 2-Row, 6-Row, Golden Promise, Maris Otter, Mild Ale, Pale Ale, Pilsner, Smoked, Vienna |

Note that "base malt" is no guarantee of a high ceiling: Acidulated Malt is
filed under Base and capped at 10%.

## Reading a colour number

The chart states its own conversion in the footnote:

```
°L = (EBC + 1.2) / 2.65        EBC = °L × 2.65 − 1.2
```

**It does not reproduce the chart's own rows.** Two rows pin the relation
exactly, because they are *named* for their Lovibond rating:

| Row | Printed EBC | Printed °Lov | Stated formula gives | `EBC = SRM × 1.97` gives |
|---|---|---|---|---|
| Crystal Malt 60L (US) | 115–130 | 60 | 43.9–49.5 °L | 58.4–66.0 °L |
| Crystal Malt 120L (US) | 230–260 | 120 | 87.3–98.6 °L | 116.8–132.0 °L |

The stated formula lands 18–27% low on both; inverted it is worse still, putting
60 °L at 157.8 EBC against a band that tops out at 130. The 1.97 relation —
already documented in `docs/malt-substitutions.md` — lands inside both published
bands. The 2.65 figure is the historical pre-1990 EBC scale; the chart looks to
have carried an old footnote onto modern EBC figures.

Both are exported from `malt-profiles.ts`: `ebcToLovibond` / `lovibondToEbc` for
the chart's stated formula, and `srmToEbc` / `ebcToSrm` for the 1.97 relation,
each documented with which is which. **Prefer the 1.97 pair when interpreting a
real colour number.** The stated formula is exported because it is what the
source says and the discrepancy is only demonstrable if both are available.

### What this settles about `Caramel/Crystal Malt 110` and `Crystal 150L`

Not the names — the chart does not list either product — but the *number*. Read
as EBC, `110` and `150` are Caramunich II (110–130 EBC, 15% ceiling) and
Caramunich III (150–180 EBC, 10%). Read as Lovibond they are ≈217 and ≈296 EBC:
a very dark crystal near Crystal 120L, and something at the CaraAroma / Special B
end. That is a two-row difference in colour, so the reading matters.

The chart's evidence: a US crystal malt whose name carries a number followed by
`L` is quoting **Lovibond**, and its EBC band is ~1.95× that number — which is
exactly what "Crystal Malt 60L" and "Crystal Malt 120L" do. `Crystal 150L`
carries the `L` explicitly and should be read the same way, putting it near
296 EBC rather than 150.

`Caramel/Crystal Malt 110` carries no `L` and stays genuinely ambiguous; nothing
in the chart resolves it. The engine should not guess silently either way — if a
future change resolves names like this from their number, it should record which
unit it assumed so the justification copy can say so.

## Categories are not malt classes

The chart's `category` and `MaltClass` from `malt-equivalents.ts` are different
taxonomies. **Mapping one onto the other naively breaks substitution rule 1.**

| Malt | Chart category | Engine `MaltClass` | Why it matters |
|---|---|---|---|
| Biscuit, Amber, Brown, Victory | `caramel` | `kilned` | Rule 1 exists to stop exactly this swap: "a Caramunich Type 2 does *not* replace a Biscuit — the first brings caramel sweetness, the second dry toasted bread." Colour and enzymes cannot tell them apart (both 0 °Lintner, overlapping EBC). |
| Melanoidin | `base` | `melanoidin` | 0 °Lintner and a 20% ceiling. The chart's own numbers describe a colour-and-aroma malt, not a base malt. |
| Acidulated, Peated, Smoked | `base` | `technical` | Acidulated is 0 °Lintner with a 10% ceiling. |
| Wheat Malt, Dark Wheat Malt | `base` | `wheat` | The guide gives wheat its own caramel, chocolate and black rows. |
| Rye Malt, Oat Malt | `base` | `adjunct-grain` | The guide additionally discriminates by `grain`, because rye/spelt/oat bands overlap. |
| Honey Malt | `special` | — | No counterpart class. |

`MALT_CATEGORY_LABEL` is for display copy only. Do not feed `category` into
`canSubstitute`.

## Name resolution

`lookupMaltProfile` uses the **same one-directional whole-word containment** as
`lookupMalt`: the queried name must contain a chart name, never the reverse. A
bare `Amber` does not resolve to `Amber Malt`, and a bare `Munich` resolves to
nothing. The cost is coverage; the benefit is that a 12–18 EBC base malt never
resolves onto a 131–200 EBC crystal, which is the failure that produced the rule
in the first place. Matches are whole-word, so `Blackcurrant` cannot reach
`Black Patent Malt`.

One addition over `lookupMalt`: among containment matches the longest wins, and
**ties are broken leftmost-first**. `Pale Chocolate Malt` contains both
`pale chocolate` and `chocolate malt` — same length, 500–650 vs 800–1000 EBC —
and without a defined tiebreak the answer would depend on the order the table
happens to be written in.

Aliases are derived mechanically from the chart's own names, so no product name
appears that the chart does not print:

- the origin/German marker dropped — `2-Row Pale (US)` → `2-Row Pale`;
- each half of a slashed name — `CaraPils / Dextrin` → `CaraPils`, `Dextrin`;
- Brewfather's inverted adjunct spelling — `Flaked Barley` → `Barley, Flaked`;
- a trailing `Malt` where the name lacks one — `Pale Chocolate` →
  `Pale Chocolate Malt`.

**There is no unmalted guard here, unlike `lookupMalt`.** That guard exists
because the equivalence tables carry only two unmalted grains — roasted barley
and raw oats — so any other raw adjunct could only resolve onto a *malted* row:
`Flaked Wheat` used to land on Weyermann Pale Wheat. This chart carries all eight
of its adjuncts explicitly with their own numbers, so `Flaked Wheat` resolves to Flaked
Wheat and reports 0 °Lintner honestly. **Anything consuming both tables must not
assume the same query returns nothing from both** — `lookupMalt("Flaked Wheat")`
is `undefined` while `lookupMaltProfile("Flaked Wheat")` is a full row, and that
is correct in both cases.

### Inventory names that still fail

Of the seven names the owner stocks that resolve against neither the equivalence
tables nor the keyword fallback, this chart fixes **one**:

| Name | Result | Why |
|---|---|---|
| `Barley, Flaked` | ✅ → Flaked Barley | The chart lists Flaked Barley; the alias handles Brewfather's inverted spelling. |
| `Karamelmalt Hell` | ❌ | German trade name. The chart prints only `Carahell`. The malt is the same one — the equivalence guide already puts BEST Caramel Hell and Weyermann Carahell on one row at 20–30 EBC, matching this chart's Carahell exactly — but the *name* belongs in `malt-equivalents.ts`, which is the file that answers "who calls it what". |
| `Chateau Melano Light` | ❌ | Castle Malting product name; not printed here. Same argument. |
| `BEST Chit Malt` | ❌ | Chit malt is not in the chart at all, under any name. |
| `Gladfield American Ale Malt` | ❌ | Maltster-specific product. Closest chart rows are Pale Ale Malt (6–9 EBC) and Mild Ale Malt (6–9 EBC), but the chart does not say which and guessing would attach a wrong diastatic power and ceiling. |
| `Caramel/Crystal Malt 110` | ❌ | Generic Brewfather name; no chart row matches. The chart does settle how to read the `110` — see above. |
| `Crystal 150L` | ❌ | The chart carries 60L and 120L only. Reading `150L` as Lovibond puts it at ~296 EBC, i.e. between Caramunich III and Special B. |

Adding the missing six would mean writing down product names the chart does not
contain. That is the equivalence tables' job, and doing it here would blur the
boundary between the two files for no gain.

## Transcription notes

Values are transcribed **as printed**. Where the chart contradicts itself the
printed value is kept and the contradiction is flagged in a code comment.

- **Row count.** The chart's header line claims "52 malt types across 6
  categories". The table itself prints **53**. All 53 are transcribed; the
  header is not.
- **Victory Malt (US) colour is internally inconsistent.** 25 °Lov against a
  25–30 EBC band is off by ~2.5× under either conversion (the chart's formula
  gives 9.9–11.8, the 1.97 relation 12.7–15.2). Briess publish Victory at ~28 °L,
  which would put the EBC band near 55 — but that is inference, not the source.
  Both figures stand as printed. **Treat this row's colour as unreliable in
  either unit.**
- **The stated EBC↔Lovibond formula does not hold** for the chart's own crystal
  rows, as set out above.
- **Rice Hulls read 0 for colour, extract, protein and enzymes.** Structurally
  unambiguous in the source (each is its own column cell) and physically
  reasonable for husk, but the protein figure in particular is a printed 0
  rather than a measurement.
- **"Torrified Wheat" is the chart's spelling.** The engine's unmalted-token
  prefixes already cover both `torref` and `torrif`, but a query spelled
  `Torrefied Wheat` will not resolve against this table by containment.
- **Nothing was omitted.** Every cell of all 53 rows is present in
  `malt-profiles.ts`. No field was dropped for illegibility.
- **One thing is added beyond the chart:** `EBC_PER_SRM` / `srmToEbc` /
  `ebcToSrm`. Not from this PDF — it is the relation already documented in
  `docs/malt-substitutions.md`, restated here because it is what reproduces this
  chart's crystal rows. Marked as such in the code.

## The chart

Categories, malt order and prose are the source's own.

### Base malts

| Malt | EBC | °Lov | PPG | Mash | Max% | Moist% | Prot% | °Lintner | Flavour / aroma | Styles | Weyermann | Briess | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2-Row Pale (US) | 3–5 | 1.5–2 | 37 | Yes | 100 | 4–5 | 11–13 | 120–160 | Light malt, grainy, clean | All styles | Pilsner | 2-Row Brewers Malt | Standard US base malt, high enzymatic power |
| 6-Row Pale (US) | 3–5 | 1.5–2 | 35 | Yes | 100 | 4–5 | 12–14 | 160–200 | Light malt, grainy | Lagers, Cream Ale | Pilsner | 6-Row Brewers Malt | Higher protein & enzymes than 2-row, good with adjuncts |
| Acidulated Malt (Sauermalz) | 2–4 | 1.5 | 35 | Yes | 10 | 5–7 | 8–10 | 0 | Slightly sour/tart | Adjusts mash pH | Acidulated | Acid Malt | 1-5% lowers mash pH ~0.1 per 1% |
| Dark Wheat Malt | 15–20 | 6–8 | 35 | Yes | 70 | 4–6 | 13–16 | 0–30 | Dark bread, earthy, slightly smoky | Dunkelweizen, Dunkel | Dark Wheat | — | Kilned wheat, rich dark character |
| Golden Promise | 5–7 | 2.5 | 37 | Yes | 100 | 3–4 | 9–11 | 60–90 | Sweet, clean, slightly grainy | Scottish Ale, Lager | — | Golden Promise | Scottish heritage barley, smooth malt character |
| Maris Otter | 6–8 | 3 | 38 | Yes | 100 | 3–4 | 9–11 | 60–90 | Rich, nutty, biscuity, clean | English Ales, Bitter, Stout | Pale Ale | Maris Otter | Premium English variety, classic ale base |
| Melanoidin | 60–80 | 25–33 | 34 | Yes | 20 | 3–5 | 12–14 | 0 | Intense malty, honey, toffee, raisin | Bock, Amber, Brown Ale | Melanoidin | Aromatic | Maillard reaction product, deep malt aroma |
| Mild Ale Malt | 6–9 | 3–4 | 37 | Yes | 100 | 3–4 | 9–11 | 70–90 | Nutty, slightly sweet | Mild Ale, Brown Ale | Pale Ale | — | Lower kilned than Pale Ale, softer flavor |
| Munich Malt I | 14–18 | 6–8 | 35 | Yes | 80 | 4–5 | 11–13 | 40–70 | Malty, bready, toasty, aromatic | Bock, Dunkel, Märzen | Munich I | Munich 10L | Light Munich, rich malt backbone |
| Munich Malt II | 20–25 | 9–11 | 34 | Yes | 80 | 4–5 | 11–13 | 30–60 | Intense malt, bready, sweet | Bock, Doppelbock, Dunkel | Munich II | Munich 20L | Dark Munich, deeper malt flavor |
| Oat Malt | 3–5 | 1.5–2 | 28 | Yes | 30 | 4–6 | 13–16 | 0 | Creamy, smooth, silky | Oatmeal Stout, NEIPA | Malted Oats | — | Adds body and smoothness, max 30% |
| Pale Ale Malt | 6–9 | 3–4 | 38 | Yes | 100 | 3–5 | 9–11 | 80–120 | Biscuity, slightly toasty, full | Pale Ale, IPA, Bitter | Pale Ale | Pale Ale | Slightly kilned vs Pilsner, richer malt character |
| Peated Malt | 3–5 | 2 | 36 | Yes | 30 | 4–5 | 10–12 | 50–80 | Peat smoke, medicinal, iodine | Scottish Ale, Smoked Beer | Peated Malt | Peated | Strong peat smoke, 5-10% typical |
| Pilsner Malt | 3–4 | 1.5 | 37 | Yes | 100 | 4–5 | 9–11 | 100–120 | Very light, sweet, delicate | Pils, Lager, Witbier | Pilsner Malt | Pilsen | Lightest base malt, finest flavor |
| Rye Malt | 5–8 | 2–3 | 36 | Yes | 50 | 5–6 | 13–16 | 60–100 | Spicy, earthy, dry | Roggenbier, Rye Pale Ale | Rye Malt | Rye | Max 50%, high beta-glucan, can cause stuck sparge |
| Smoked Malt (Rauch) | 3–5 | 2 | 37 | Yes | 100 | 4–5 | 10–12 | 60–90 | Intense smoke, campfire, bacon | Rauchbier, Smoked Porter | Smoked Malt | Special Roast* | Beechwood smoked, use 30-100% for rauchbier |
| Vienna Malt | 8–12 | 3.5–5 | 36 | Yes | 100 | 4–5 | 10–12 | 60–90 | Toasty, light amber, biscuity | Vienna Lager, Märzen, Amber | Vienna Malt | Vienna | Fuller than Pilsner, lighter than Munich |
| Wheat Malt | 3–5 | 1.5–2 | 37 | Yes | 70 | 4–6 | 13–16 | 100–130 | Grainy, slightly tart, clean | Weizen, Witbier, NEIPA | Pale Wheat | White Wheat | No husk, needs rice hulls in thick mash |

### Caramel / crystal malts (as the chart files them)

| Malt | EBC | °Lov | PPG | Mash | Max% | Moist% | Prot% | °Lintner | Flavour / aroma | Styles | Weyermann | Briess | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Amber Malt | 50–70 | 22–30 | 34 | No | 20 | 3–5 | 10–12 | 0 | Biscuit, toast, nutty, dry | Brown Ale, Porter, ESB | — | Amber | UK specialty, dry toasted character |
| Biscuit Malt | 45–55 | 20–23 | 34 | No | 20 | 3–5 | 10–12 | 0 | Biscuit, toast, bread crust, nutty | Amber, Brown Ale, IPA | Melanoidin | Victory Malt | Lightly roasted, dry roasty character |
| Brown Malt | 150–200 | 60–80 | 33 | No | 15 | 3–5 | 10–12 | 0 | Dry biscuit, dark bread, toast | Brown Ale, Porter, Dark Belgian | Melanoidin | Brown | UK traditional malt, porter style |
| CaraAmber | 50–70 | 20–30 | 34 | No | 15 | 4–6 | 10–13 | 0 | Caramel, bread, amber | Amber Ale, Scottish Ale | CaraAmber | — | Mid-range crystal malt |
| CaraAroma | 300–400 | 120–160 | 33 | No | 5 | 4–6 | 10–13 | 0 | Dark fruit, plum, raisin, caramel | Dubbel, Quad, Dark Ale | CaraAroma | Special B* | Very dark crystal, fruitcake character |
| CaraPils / Dextrin | 2–6 | 1–2 | 33 | No | 10 | 4–6 | 10–13 | 0 | Neutral, boosts head/body | All styles | CaraPils | Dextrin Malt | No color, pure body/foam enhancement |
| CaraRed | 40–60 | 16–25 | 34 | No | 15 | 4–6 | 10–13 | 0 | Light caramel, berry, red color | Red Ale, Amber | CaraRed | Crystal 30 | Imparts red/amber color |
| Carahell | 20–30 | 8–12 | 33 | No | 15 | 4–6 | 10–13 | 0 | Light caramel, sweet, honey | Lager, Blond, Wheat | CaraHell | Crystal 10 | Very pale crystal, subtle sweetness |
| Caramunich I | 90–110 | 35–45 | 34 | No | 15 | 4–6 | 10–13 | 0 | Caramel, biscuit, toffee | Märzen, Amber, Red Ale | CaraMunich I | Crystal 40 | Light-medium crystal, caramel sweet |
| Caramunich II | 110–130 | 45–55 | 34 | No | 15 | 4–6 | 10–13 | 0 | Rich caramel, toffee, plum | Bock, Red Ale, Amber | CaraMunich II | Crystal 60 | Medium crystal, richer character |
| Caramunich III | 150–180 | 60–75 | 34 | No | 10 | 4–6 | 10–13 | 0 | Dark caramel, dried fruit, raisin | Doppelbock, Brown Ale | CaraMunich III | Crystal 80 | Dark crystal, plum/raisin notes |
| Crystal Malt 120L (US) | 230–260 | 120 | 33 | No | 10 | 4–6 | 10–13 | 0 | Dark caramel, dried fruit, burnt sugar | Porter, Stout, Dark Ale | CaraAroma | Crystal 120 | Very dark crystal, use sparingly |
| Crystal Malt 60L (US) | 115–130 | 60 | 34 | No | 15 | 4–6 | 10–13 | 0 | Caramel, toffee, light jam | Pale Ale, Amber, IPA | CaraMunich II | Crystal 60 | Classic US crystal malt |
| Special B | 300–450 | 125–180 | 33 | No | 10 | 4–6 | 10–13 | 0 | Raisin, plum, dark fruit, chocolate | Dubbel, Quad, Dark Ale | CaraAroma | Special B | Dingemans specialty, unique dark crystal |
| Victory Malt (US) | 25–30 | 25 | 35 | No | 20 | 3–5 | 10–12 | 0 | Biscuit, bread, toast, nutty | Amber, Brown Ale | Melanoidin | Victory | Briess version of Biscuit/Amber |

### Roasted malts

| Malt | EBC | °Lov | PPG | Mash | Max% | Moist% | Prot% | °Lintner | Flavour / aroma | Styles | Weyermann | Briess | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Black Patent Malt | 1300–1500 | 500–650 | 28 | No | 5 | 3–5 | 10–12 | 0 | Burnt, harsh roast, sharp bitter | Stout, Porter | Carafa III | Black Malt | Aggressive roast, use <5% |
| Carafa Special I | 600–900 | 250–375 | 30 | No | 10 | 3–5 | 10–12 | 0 | Mild roast, coffee, dark bread | Schwarzbier, Dark Lager | Carafa I | Chocolate* | De-bittered, smoother roast |
| Carafa Special II | 1100–1300 | 450–550 | 29 | No | 10 | 3–5 | 10–12 | 0 | Coffee, chocolate, roast | Stout, Porter, Dark Ale | Carafa II | Chocolate | De-bittered version of Chocolate |
| Carafa Special III | 1300–1500 | 550–650 | 28 | No | 10 | 3–5 | 10–12 | 0 | Intense dark roast, espresso, dark chocolate | Stout, Porter, Black IPA | Carafa III | Black Patent* | Darkest de-bittered malt |
| Chocolate Malt | 800–1000 | 350–450 | 29 | No | 10 | 3–5 | 10–12 | 0 | Chocolate, coffee, nutty roast | Stout, Porter, Brown Ale | Carafa II | Chocolate | Sharp roast flavor, bitter finish |
| Coffee Malt | 250–450 | 100–180 | 30 | No | 10 | 3–5 | 10–12 | 0 | Coffee, espresso, mocha | Stout, Porter, Brown Ale | Carafa I | Coffee Malt | Simpsons specialty, coffee character |
| De-bittered Black | 1400–1600 | 550–650 | 28 | No | 10 | 3–5 | 10–12 | 0 | Dark color with smooth roast | Schwarzbier, Dark Lager, Black IPA | Carafa Special III | Midnight Wheat* | Color without harsh bitterness |
| Pale Chocolate | 500–650 | 200–275 | 30 | No | 10 | 3–5 | 10–12 | 0 | Mild chocolate, coffee | Stout, Porter | Carafa I | Chocolate* | Lighter version, more restrained roast |
| Roasted Barley | 1200–1400 | 500–575 | 25 | No | 10 | 3–5 | 10–12 | 0 | Dry roast, coffee, sharp bitter | Stout (esp. Irish Dry Stout) | — | Roasted Barley | Unmalted barley, drier than Black Malt |

### Wheat malts

| Malt | EBC | °Lov | PPG | Mash | Max% | Moist% | Prot% | °Lintner | Flavour / aroma | Styles | Weyermann | Briess | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Caramel Wheat | 60–80 | 25–35 | 33 | No | 20 | 4–6 | 12–15 | 0 | Caramel, honey, wheat | Dunkelweizen, Weizenbock | Caramel Wheat | — | Crystal malt from wheat, sweet |
| Chocolate Wheat | 800–900 | 350–400 | 28 | No | 15 | 4–6 | 12–15 | 0 | Chocolate, dark bread, earthy | Dunkelweizen, Dark Wheat Beer | Chocolate Wheat | — | Roasted wheat, smooth character |

### Specialty malts

| Malt | EBC | °Lov | PPG | Mash | Max% | Moist% | Prot% | °Lintner | Flavour / aroma | Styles | Weyermann | Briess | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Honey Malt | 20–25 | 8–10 | 33 | No | 15 | 4–6 | 8–10 | 0 | Sweet honey, malt, caramel | Any style needing honey character | Melanoidin | Honey Malt | Gambrinus specialty, unique honeyed flavor |

### Adjuncts

| Malt | EBC | °Lov | PPG | Mash | Max% | Moist% | Prot% | °Lintner | Flavour / aroma | Styles | Weyermann | Briess | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Flaked Barley | 2–3 | 1–1.5 | 32 | No | 20 | 8–10 | 11–14 | 0 | Grainy, full body | Stout, Porter, Bitter | — | Flaked Barley | Unmalted, improves head retention |
| Flaked Corn / Maize | 1–2 | 0.5–1 | 37 | No | 40 | 8–12 | 8–10 | 0 | Neutral, light, corn | Cream Ale, American Lager | — | Flaked Maize | ABV boost without flavor |
| Flaked Oats | 2–3 | 1–1.5 | 33 | No | 30 | 8–10 | 13–16 | 0 | Creamy, smooth, silky | Oatmeal Stout, NEIPA | — | Flaked Oats | Adds body, creaminess, haze |
| Flaked Rice | 1–2 | 0.5–1 | 37 | No | 40 | 8–10 | 6–8 | 0 | Very neutral, light, dry | American Lager, Light Beer | — | Flaked Rice | Lightest adjunct, crisp dry finish |
| Flaked Rye | 2–3 | 1–1.5 | 36 | No | 20 | 8–10 | 13–16 | 0 | Spicy, dry, crisp | Rye Pale Ale, Saison | — | Flaked Rye | Gelatinized rye, spicy character |
| Flaked Wheat | 2–3 | 1–1.5 | 36 | No | 40 | 8–10 | 13–16 | 0 | Grainy, tart, hazy | NEIPA, Witbier, Weizen | — | Flaked Wheat | Gelatinized, no mash needed. Haze agent |
| Rice Hulls | 0 | 0 | 0 | No | 10 | 8–12 | 0 | 0 | No flavor | All styles with sticky mash | — | — | Lautering aid, no extract, use with wheat/rye/oat |
| Torrified Wheat | 2–3 | 1–1.5 | 36 | No | 40 | 8–10 | 12–15 | 0 | Neutral, boosts head retention | Bitter, ESB, Mild | — | — | Puffed wheat, no mash needed |
