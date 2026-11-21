# Safety Verdict — Requirements

*Spec for PRD §5 and open question 2 (landing-copy framing). Milestone 3. Implemented in `lib/safety.ts` (+ `lib/safety-materials.ts`, `lib/safety-weight.ts`, `lib/safety-rules.ts`), the curated rules file `data/safety-rules.md`, and `components/SafetyVerdict.tsx`. Catalog facts come from `lib/catalog.ts` (`Product`, `ParsedCatalog`; see `catalog-data`, REQ-CD-01 to REQ-CD-26). The recipient's age band is the `AgeBand` type from `lib/matching/types.ts` (see `matching-core`); this spec never redefines it.*

Terms: **verdict** = the object `computeVerdict()` returns. **Row** = one line of the card. **Source** = a catalog field name or a guidance-rule ID. **Guidance rule** = an entry of `data/safety-rules.md` with an ID `SR-…`. **Flag** = a row with severity `flag`. **Band context** = the recipient's `AgeBand`, or none. **Pool** = the in-stock products that list a band and have a non-null `weight_g`. **Fit check** = what this card is; it is not a certification.

Scope: the detail page that hosts the card (`/piece/[sku]`) belongs to `gift-presentation`. This spec does not change `lib/matching.ts`, `lib/matching/*`, `lib/catalog.ts`, `data/catalog.json`, or `data/*.ts`, and matching never reads a verdict.

---

## 1. Framing and verdicts

**[REQ-SV-01] Two verdicts only**
The system SHALL produce exactly one of two verdict labels for a piece: `Good fit` or `Check this`. It SHALL NOT produce a third label, a score, a star rating, or a percentage.

**[REQ-SV-02] The fit-check line**
Every card SHALL carry this exact line, as a single text node, regardless of verdict: "A fit check from the atelier — guidance, not a safety certification. When in doubt, check with the brand or the child's parents."

**[REQ-SV-03] Never "safe" or "unsafe"**
No text the atelier writes on the card (verdict label, row labels, row text, guidance text, the fit-check line, headings, aria-labels) SHALL contain the word "safe" or "unsafe" (case-insensitive, whole word). A verbatim quote of a catalog field is not atelier-written text and is exempt; today no catalog field contains either word.

**[REQ-SV-04] Verdict computation**
The verdict SHALL be `Check this` if and only if at least one row has severity `flag`. Otherwise it SHALL be `Good fit`. Flags come from: age fit when a recipient band is not listed (REQ-SV-09), weight context (REQ-SV-14), and wear notes (REQ-SV-18). Materials, certifications, and not-stated rows never flag (see REQ-SV-20 for the not-stated rows).

**[REQ-SV-05] Deterministic and pure**
`computeVerdict(product, catalog, band)` SHALL return the identical result for equal arguments, SHALL NOT mutate its arguments, and SHALL NOT use I/O, the clock, randomness, the network, or an LLM. The same product and the same band SHALL always give the same verdict.

**[REQ-SV-06] The verdict is not a ranking signal**
`match()` SHALL NOT read, import, or depend on `lib/safety.ts`. The verdict SHALL NOT change which pieces are picked, their order, or their score.

---

## 2. Rows and sources

**[REQ-SV-07] Every row cites a source**
Every row SHALL carry at least one source. Each source SHALL be either a field name of the catalog record (`age_groups`, `materials`, `weight`, `weight_g`, `claims`, `category`, `dimensions`, `chain`) or the ID of a guidance rule that exists in `data/safety-rules.md`. The card SHALL display each row's sources as text ("Source: materials", "Source: SR-WEAR-TABEEZ").

**[REQ-SV-08] Fixed row set and order**
The verdict SHALL contain these rows, in this order: age fit (1), materials (1), weight (1), certifications (1), wear notes (0 to 1 for the current rules), not-stated (exactly 3: nickel, plating or finish, clasp or closure). No other row SHALL appear.

---

## 3. The six checks

**[REQ-SV-09] Check 1: age fit**
WHEN a band context exists and the product's `age_groups` includes the label of that band, the age row SHALL have severity `pass` and the text "Listed by Tiny Tiaraa for {band label}" (labels from `AGE_GROUP_LABEL`, for example "Listed by Tiny Tiaraa for infants 0–3 years"). WHEN the band is not listed, the row SHALL have severity `flag` and the text "Not listed for {band label}. Tiny Tiaraa lists this piece for {listed labels, comma-separated}." The row SHALL cite `age_groups`. A verdict SHALL NEVER be `Good fit` when the recipient band is not in `age_groups`.

**[REQ-SV-10] No recipient selected**
WHEN no band context exists, the age row SHALL have severity `note` and the text "No recipient selected — age fit shown against all listed age groups: {listed labels, comma-separated}." The system SHALL NOT invent a recipient or a band.

**[REQ-SV-11] Check 2: material transparency**
The materials row SHALL show `materials` verbatim as one line ("As listed: …") and a decoded line per `;`-separated segment, using the template decoder of REQ-SV-12. It SHALL have severity `note` and cite `materials` plus the ID of every rule used.

**[REQ-SV-12] The template decoder**
The decoder SHALL recognise exactly these segment patterns: `18KT Gold` (SR-MAT-GOLD18), `925 Silver` with an optional parenthetical (SR-MAT-SILVER925), `Diamond` with an optional `N Cts` and an optional `Quality XX-YY` (SR-MAT-DIAMOND), a segment containing `pearl` (SR-MAT-PEARL), `CZ` (SR-MAT-CZ), and a segment containing `black beads` (SR-MAT-BEADS). A recognised segment SHALL be shown as its template display plus the rule's guidance text, labeled "General guidance". An unrecognised segment SHALL be shown verbatim with no decoding. The decoder SHALL NOT add, drop, or change a number that appears in `materials`, and joining the raw segments SHALL reproduce `materials`.

**[REQ-SV-13] Weight context: pool and median**
For a band, the pool SHALL be every product with `availability = In Stock`, `weight_g ≠ null`, and the band's label in `age_groups`. The median SHALL be the middle `weight_g` of the pool sorted ascending (the mean of the two middle values when the pool has an even count). WHEN the pool has fewer than 3 products, the weight row SHALL have severity `note` and say "Too few comparable pieces listed for {band label} to give weight context", and SHALL NOT flag.

**[REQ-SV-14] Weight context: the flag**
WHEN the pool has 3 or more products and the piece's `weight_g` is more than 50% above the median (`weight_g > 1.5 × median`, compared in integer hundredths of a gram), the weight row SHALL have severity `flag` and the text "{weight_g} g — more than 50% above the median of {median} g for {band label} pieces here ({n} pieces); check comfort with the parents." Exactly 1.5 × median SHALL NOT flag. Otherwise the row SHALL have severity `pass` and the text "{weight_g} g — not more than 50% above the median of {median} g for {band label} pieces here ({n} pieces)." The row SHALL also show `weight` verbatim ("As listed: …") and the sentence of rule SR-WEIGHT-MEDIAN, and SHALL cite `weight`, `weight_g`, and SR-WEIGHT-MEDIAN. A piece outside the pool (for example the out-of-stock TNZ-1058) SHALL be compared with the same median.

**[REQ-SV-15] Weight context: reference band**
The reference band for check 3 SHALL be the recipient band when one exists, else the youngest band the product lists (order: infants, kids, teens, mom). WHEN `weight_g` is null, the weight row SHALL have severity `note`, show `weight` verbatim, and say "A single weight could not be read from the listing, so no weight comparison is shown." It SHALL NOT show 0.

**[REQ-SV-16] Weight flag cases against catalog v1.0.0**
Against catalog v1.0.0 the flagged pieces SHALL be exactly these, and a unit test SHALL pin them:

| Reference band | Pool n | Median | Flag above | Flagged pieces (`weight_g`) |
|---|---|---|---|---|
| infants | 18 | 1.51 g | 2.265 g | TNZ-1056 (6.0), TPN-1459 (4.05), TOB-1009 (3.94), TBZ-1013 (3.1), TPN-1433 (3.0), TBZ-1017 (2.75), TOB-1008 (2.5); also TNZ-1058 (7.0, out of stock, outside the pool) |
| kids | 15 | 1.23 g | 1.845 g | TPN-1459 (4.05), TOB-1009 (3.94), TBZ-1013 (3.1), TBZ-1017 (2.75) |
| teens | 9 | 0.86 g | 1.29 g | THP-1027 (1.5), THP-1017 (1.5), THP-1001 (1.55) |
| mom | 2 | — | — | none (pool smaller than 3) |

TNZ-1056, the case the PRD names, SHALL be flagged for infants (6.0 g against a median of 1.51 g).

**[REQ-SV-17] Check 4: certification claims**
The certifications row SHALL assert only entries of the product's `claims[]`. WHEN `claims` is empty, the row SHALL say "No certifications are stated on this product's page." WHEN `claims` is non-empty, the row SHALL list each entry verbatim, each prefixed "Stated on this product's page:". The row SHALL have severity `note`, cite `claims` and SR-CLAIMS-ONLY, and SHALL NOT contain any of the terms BIS, hallmark, hypoallergenic, nickel-free, certified, or tested unless that term occurs in a `claims` entry. Against catalog v1.0.0, `claims` is empty for all 22 SKUs, so every certifications row SHALL be the "No certifications…" sentence.

**[REQ-SV-18] Check 5: wear notes**
A wear row SHALL be added, with severity `flag`, labeled "General guidance", citing `category` (and `dimensions` for bracelets and bangles) plus its rule ID, in these cases only:

| Applies when | Rule | Text |
|---|---|---|
| `category = Tabeez` | SR-WEAR-TABEEZ | "Worn on a black thread — tie securely and check the knot regularly." |
| `dims.kind = string-bracelet` | SR-WEAR-BRACELET | "Check the fit as the child grows, and take it off for sleep." |
| `dims.kind = bangle` | SR-WEAR-BANGLE | "A bangle does not stretch. Check that it slips over the hand comfortably and still fits as the child grows, and take it off for sleep." |
| `category = Set` (has earrings) | SR-WEAR-SET-EARRINGS | "The earrings are small parts. Supervise young children and check them regularly." |

No other category SHALL get a wear row. A piece with no applicable rule SHALL have no wear row.

**[REQ-SV-19] Check 6: what is not stated**
The verdict SHALL contain exactly three not-stated rows, each with severity `note`: nickel (SR-NS-NICKEL), plating or finish (SR-NS-PLATING), clasp or closure (SR-NS-CLASP). WHEN none of `materials`, `chain`, `dimensions`, `weight` mentions the topic (nickel: `nickel`; plating: `plated`, `plating`, `rhodium`; clasp: `clasp`, `closure`, `hook`, `lobster`, `screw back`), the row SHALL say "Nickel content is not stated on the listing.", "Plating or finish is not stated on the listing.", or "Clasp or closure type is not stated on the listing." WHEN a field does mention the topic, the row SHALL quote the `;`-separated segment verbatim ("The listing says: “…”") and cite that field. The system SHALL NEVER assume a value for a topic the listing does not state.

**[REQ-SV-20] Not-stated rows do not flip the verdict (deviation from PRD §5, recorded)**
PRD §5 lists check 6 among the flag sources. Because the catalog schema has no nickel, plating, or clasp field, all 22 pieces state none of the three, so a flag here would make every verdict `Check this` and `Good fit` unreachable. The severity of each not-stated rule SHALL therefore be `note` in `data/safety-rules.md`, and the severity is read from the rule, so a human can change it by editing the rules file and bumping the version. This is open question Q1 in `design.md`.

---

## 4. Guidance rules

**[REQ-SV-21] Rules file**
`data/safety-rules.md` SHALL list every guidance rule with a stable ID (`SR-…`), the check it belongs to, when it applies, its severity (`flag` or `note`), and its text. The file SHALL carry a `version` (semver, starting at `1.0.0`) and a changelog section. IDs SHALL NOT be reused or renumbered; a retired rule is marked retired, not deleted.

**[REQ-SV-22] Rules mirror**
`lib/safety-rules.ts` SHALL hold the same rules as a typed constant (pure code cannot read the Markdown file). A test SHALL parse `data/safety-rules.md` and fail when any ID, severity, applies-to, text, or the version differs from the constant.

**[REQ-SV-23] Rules are human-edited**
Rules SHALL be edited only on a human instruction that names the rule and the reason (steering `catalog-rules.md`). Any edit SHALL bump the version and add a changelog line. No LLM and no generator SHALL write a rule.

**[REQ-SV-24] Guidance is labeled**
Every row that comes from a guidance rule (decoded material lines, the weight rule sentence, wear notes, not-stated rows) SHALL be visibly labeled "General guidance" and show its rule ID. A row grounded only in a catalog field (age fit, the verbatim materials line, the certifications row) SHALL NOT carry that label.

---

## 5. The card (component)

**[REQ-SV-25] Renders from the verdict only**
`components/SafetyVerdict.tsx` SHALL receive a `SafetyVerdict` object and render it. It SHALL NOT read the catalog, import `data/catalog.json`, compute a verdict, or call `computeVerdict()`.

**[REQ-SV-26] Look and tokens**
The card SHALL use only colour tokens from `app/globals.css`. `Good fit` SHALL use `bg-sage`; `Check this` SHALL use `bg-champagne`. The card SHALL NOT use red, a warning triangle, a shield, a padlock, or a tick-in-circle badge. Spooky elements SHALL NOT sit over any text of the card.

**[REQ-SV-27] Not colour alone**
The verdict SHALL be conveyed by its text label, not by colour. The card SHALL be a labelled region (`role="region"` with `aria-labelledby` pointing at the verdict heading). Each flagged row SHALL be marked in text ("Worth a look").

**[REQ-SV-28] No recipient: the fallback line**
WHEN the verdict has no band context, the card SHALL show "No recipient selected — age fit shown against all listed age groups" once, in the age row (REQ-SV-10), and SHALL NOT show any recipient detail.

---

## 6. Copy alignment (PRD open question 2, decided by the PRD framing)

**[REQ-SV-29] Landing copy matches the fit-check framing**
The landing page and the site metadata SHALL NOT promise that a piece "is safe" or that the atelier "proves" safety. `app/page.tsx` ("or if it's safe", and the nearby "then proves it" and "plain-language safety check" lines) and `app/layout.tsx` metadata ("prove it's safe") SHALL be reworded to the fit-check framing (for example "a plain-language fit check"). The existing line "Safety notes are fit checks, not certifications." SHALL stay unchanged. A static test SHALL fail if `app/**/*.tsx`, `components/**/*.tsx`, or `lib/safety*.ts` contains the word "safe" or "unsafe" (whole word, case-insensitive) or the phrase "prove it" in an atelier-written string. The change SHALL be recorded in `docs/kiro-evidence-log.md` as the resolution of M2 OQ-2.

---

## 7. Purity, boundaries, tests

**[REQ-SV-30] Pure logic**
`lib/safety*.ts` SHALL export pure functions and types only: no React import, no I/O, no clock, no randomness, no network, no LLM. The catalog SHALL be passed in as an argument.

**[REQ-SV-31] No new product facts**
The card SHALL NOT state a price, discount, rating, availability, or any product fact beyond the fields named in REQ-SV-07. Every number on the card SHALL be a catalog value, a value derived from catalog values (median, count, threshold), or a number inside a guidance rule's fixed text (for example 75%, 92.5%, 50%).

**[REQ-SV-32] Tests**
Unit tests SHALL cover each check and the verdict computation. Property tests SHALL cover the invariants of §8 (seeded, `numRuns ≥ 200`). A component test SHALL cover the card. `lib/safety*.ts` SHALL reach ≥ 80% line coverage. Test files SHALL be named `tests/safety*.test.ts(x)` so the existing `matching-tests` hook (`npx vitest run tests/matching tests/safety`) runs them.

---

## 8. Property-test invariants

Each SHALL hold for every generated product and band, and for all 22 real products against every band and against no band.

**[REQ-SV-33] V1 No unsourced certification.** A verdict never asserts a certification that is not in the product's `claims[]`: no row other than the certifications row contains a certification term (REQ-SV-17 list), and the certifications row contains a term only when a `claims` entry contains it.
**[REQ-SV-34] V2 Age mismatch is never Good fit.** WHEN a band context exists and the band's label is not in `age_groups`, the verdict is `Check this`.
**[REQ-SV-35] V3 Every row is sourced.** Every row has at least one source, and each source is a known catalog field name or an ID in the rules constant.
**[REQ-SV-36] V4 Determinism.** The same product, catalog, and band give a deep-equal verdict, and the inputs are unchanged by the call.
**[REQ-SV-37] V5 Verdict follows the flags.** The verdict is `Check this` exactly when at least one row has severity `flag`; `flagged` lists exactly those row IDs.
**[REQ-SV-38] V6 Weight flag is a monotone threshold.** For a fixed pool, raising a piece's `weight_g` never turns a flag into a non-flag; a weight of exactly 1.5 × median does not flag; one hundredth of a gram above does.
**[REQ-SV-39] V7 No absolute words.** No atelier-written text contains "safe" or "unsafe" (REQ-SV-03), and the fit-check line is present and exact (REQ-SV-02).
**[REQ-SV-40] V8 Not-stated never assumes.** A not-stated row says the exact sentence of REQ-SV-19 unless a catalog field mentions the topic, and then it quotes that field verbatim.
**[REQ-SV-41] V9 Decoder round trip.** Joining the decoded segments' raw text with `; ` reproduces `materials` (trimmed), and no number in a decoded display is absent from `materials` or from the decoder's fixed templates.
**[REQ-SV-42] V10 Completeness.** The row IDs are always `age-fit`, `materials`, `weight`, `certifications`, then `wear:<rule ID>` for each applicable wear rule (0 or 1), then `not-stated:nickel`, `not-stated:plating`, `not-stated:clasp`.
