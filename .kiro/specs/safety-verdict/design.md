# Safety Verdict — Design

*Implements REQ-SV-01 to REQ-SV-42 (`requirements.md`). Source: PRD §5, architecture §7–§8, steering `product.md` and `catalog-rules.md`. Depends on `catalog-data` (`Product`, `ParsedCatalog`, `Dims`) and `matching-core` (`AgeBand`, `AGE_LABEL`, `AGE_GROUP_LABEL`). Nothing in `lib/matching.ts`, `lib/matching/`, `lib/catalog.ts`, `data/catalog.json`, or `data/*.ts` changes.*

## 1. Overview

```
Product + ParsedCatalog + (AgeBand | null)
        │
        ▼
 computeVerdict()  ── lib/safety.ts ─────────────► SafetyVerdict { verdict, rows[], flagged[], disclaimer }
   ├─ decodeMaterials()  lib/safety-materials.ts ─ check 2
   ├─ weightContext()    lib/safety-weight.ts ──── check 3
   ├─ rules lookup       lib/safety-rules.ts ───── guidance text + severity (mirror of data/safety-rules.md)
   └─ rows for checks 1, 4, 5, 6 built in lib/safety.ts
        │
        ▼
 <SafetyVerdict verdict={…} />   components/SafetyVerdict.tsx  (presentational, server-renderable)
```

The verdict is computed on the server by `/piece/[sku]` (see `gift-presentation`) and passed to the component as a plain, serialisable object. The card is a fit check: it describes what the listing states and attaches labeled general guidance. It does not certify, rank, or recommend.

### File map

| File | Contents | Pure? |
|---|---|---|
| `data/safety-rules.md` | The 15 curated guidance rules, version, changelog. Human-edited. | data |
| `lib/safety-rules.ts` | `SAFETY_RULES` (typed const), `SAFETY_RULES_VERSION`, `ruleById()`, `RULE_IDS` | yes |
| `lib/safety-materials.ts` | `decodeMaterials(materials)` | yes |
| `lib/safety-weight.ts` | `weightPool()`, `median()`, `weightContext()`, `referenceBand()` | yes |
| `lib/safety.ts` | `FIT_CHECK_LINE`, types, `computeVerdict()` | yes |
| `components/SafetyVerdict.tsx` | the card | UI |
| `tests/safety*.test.ts(x)` | see §8 | |

Three small `lib/` files plus `lib/safety.ts` keep one concept per file. The `matching-tests` hook matches `lib/safety.ts` only, so tasks extend its matcher to `lib/safety(-[a-z]+)?.ts` (tasks T4.4).

## 2. Types (`lib/safety.ts`)

```ts
import type { AgeBand } from "./matching/types";
import type { ParsedCatalog, Product } from "./catalog";

export const FIT_CHECK_LINE =
  "A fit check from the atelier — guidance, not a safety certification. When in doubt, check with the brand or the child's parents.";

export type Verdict = "Good fit" | "Check this";
export type RowSeverity = "pass" | "flag" | "note";
export type CheckId = "age-fit" | "materials" | "weight" | "certifications" | "wear" | "not-stated";

/** Catalog field names a row may cite. */
export type CatalogField =
  | "age_groups" | "materials" | "weight" | "weight_g" | "claims" | "category" | "dimensions" | "chain";

export interface DecodedSegment { raw: string; display: string; ruleId: string | null }

export interface VerdictRow {
  id: string;                       // 'age-fit' | 'materials' | 'weight' | 'certifications' | 'wear:SR-…' | 'not-stated:nickel' | …
  check: CheckId;
  severity: RowSeverity;
  label: string;                    // "Age fit", "Materials", "Weight", "Certifications", "Wear note", "Nickel", …
  text: string;                     // the main sentence, atelier-written or a verbatim quote
  asListed?: string;                // verbatim catalog value shown as "As listed: …"
  segments?: DecodedSegment[];      // materials only
  guidance: string[];               // rule texts shown under "General guidance" (may be empty)
  sources: string[];                // CatalogField names and/or rule IDs; length ≥ 1
}

export interface WeightContext { band: AgeBand; median_g: number; n: number; threshold_g: number }

export interface SafetyVerdict {
  sku: string;
  verdict: Verdict;
  context: { kind: "recipient"; band: AgeBand } | { kind: "none" };
  rows: VerdictRow[];
  flagged: string[];                // ids of rows with severity 'flag', in row order
  weight: WeightContext | null;     // null when no context could be computed
  disclaimer: string;               // always FIT_CHECK_LINE
  rulesVersion: string;             // SAFETY_RULES_VERSION
}

export function computeVerdict(product: Product, catalog: ParsedCatalog, band: AgeBand | null): SafetyVerdict;
```

`computeVerdict` takes the parsed catalog (not a pool) so the median is computed from the same data the rest of the app uses and the function stays pure (REQ-SV-05, REQ-SV-30). It never reads `product.price_inr`, `rating`, or `availability` (REQ-SV-31); availability only matters for pool membership.

## 3. The six checks

Row order is fixed (REQ-SV-08). Row texts are templates over catalog fields; a template never interpolates a free-form string other than a verbatim catalog value.

### 3.1 Check 1: age fit (`age-fit`)

| Case | Severity | Text | Sources |
|---|---|---|---|
| band given, `AGE_LABEL[band] ∈ age_groups` | `pass` | "Listed by Tiny Tiaraa for {AGE_GROUP_LABEL[label]}" | `age_groups` |
| band given, not listed | `flag` | "Not listed for {band label}. Tiny Tiaraa lists this piece for {labels joined ", "}." | `age_groups` |
| no band | `note` | "No recipient selected — age fit shown against all listed age groups: {labels joined ", "}." | `age_groups` |

Labels come from the existing `AGE_GROUP_LABEL` ("infants 0–3 years"). The page passes `model.ageBand` as `band`; matching already guarantees a pick lists that band, so on a normal journey this row is the confirmation the PRD asks for. A hand-edited URL can pair a piece with a band it does not list; then the row flags (V2).

### 3.2 Check 2: materials (`materials`)

Severity `note`, text "Materials as listed, with plain-language notes.", `asListed = product.materials`, `segments = decodeMaterials(materials)`, `guidance` = the rule texts of the recognised segments (de-duplicated, in order of first use), `sources = ['materials', ...ruleIds]`.

```ts
export function decodeMaterials(materials: string): DecodedSegment[]
```

Split on `;`, trim each, drop empty. For each segment, the first matching pattern wins:

| Pattern (case-insensitive, whole segment) | `display` | `ruleId` |
|---|---|---|
| `^18KT Gold$` | "18KT gold" | SR-MAT-GOLD18 |
| `^925 Silver(\s*\(.*\))?$` | "925 sterling silver" + the parenthetical verbatim when present | SR-MAT-SILVER925 |
| `^Diamond(?:\s+(\d+(?:\.\d+)?)\s*Cts?)?(?:,\s*Quality\s+([A-Z]{2}-[A-Z0-9]+))?$` | "Diamond" + " {ct} ct" when captured + ", {grade}" when captured | SR-MAT-DIAMOND |
| contains `pearl` | the raw segment | SR-MAT-PEARL |
| `^CZ$` | "CZ (cubic zirconia)" | SR-MAT-CZ |
| contains `black beads` | the raw segment | SR-MAT-BEADS |
| anything else | the raw segment | `null` |

The PRD display is "18KT gold · Diamond 0.06 ct, GH-VS": the card joins `display` values with " · ". For sets the materials string is `Diamond, Quality GH-VS` (no carat); the display is "Diamond, GH-VS" and the carats stay in the verbatim weight line, where the catalog states them. The decoder is a closed template, so `18KT Gold; Diamond 0.06 Cts, Quality GH-VS` becomes "18KT gold · Diamond 0.06 ct, GH-VS" and an unseen segment such as `black thread (as listed in description)` passes through unchanged. Numbers are copied from the match groups, never recomputed (V9).

Real-catalog segments, for the unit test: gold + diamond (11 pieces), gold + diamond + black beads (3), gold + diamond + pearl (2 sets), gold + diamond with a free-text tail (THP-1001: `triple-tone floral hoops (Yellow/White gold)` passes through), silver (TNZ-1058, TNZ-1056, TPN-1433), `925 Silver (sterling silver Libra balance-symbol pendant)`, `925 Silver (925 sterling silver)`, `925 Silver; CZ`, `925 Silver; black thread (as listed in description)`, `925 Silver; openable locket, black thread (as listed in description)`.

### 3.3 Check 3: weight context (`weight`)

```ts
export const WEIGHT_FLAG_RATIO = 1.5;     // more than 50% above the median
export const MIN_POOL = 3;

export function referenceBand(product: Product, band: AgeBand | null): AgeBand | null
export function weightPool(catalog: ParsedCatalog, band: AgeBand): number[]    // ascending weight_g, in-stock, lists band
export function median(sortedAsc: readonly number[]): number                    // mean of the two middles when even
export function weightContext(weightG: number, pool: readonly number[], band: AgeBand): WeightContext & { flag: boolean }
```

`referenceBand` returns `band` when given, else the youngest band in `product.age_groups` by the order infants, kids, teens, mom (every product lists at least one). Reasoning: with no recipient, the most cautious reading is the smallest wearer the listing names.

Integer arithmetic. `weight_g` values have at most two decimals, so work in hundredths: `W = Math.round(weight_g × 100)`, `pool' = pool × 100` rounded. Let `median2` = twice the median in hundredths (for odd n, `2 × middle`; for even n, `a + b`). `flag = n ≥ MIN_POOL && 4 × W > 3 × median2`. At exactly 1.5 × median, `4W = 3·median2`, so it does not flag (V6). `median_g` shown = `median2 / 200` formatted with up to 3 decimals, trailing zeros trimmed ("1.51", "1.23", "0.86"); `threshold_g = 1.5 × median_g` ("2.265", "1.845", "1.29").

Row cases (REQ-SV-13 to REQ-SV-15):

| Case | Severity | Text |
|---|---|---|
| `weight_g = null` | `note` | "A single weight could not be read from the listing, so no weight comparison is shown." |
| pool n < 3 | `note` | "Too few comparable pieces listed for {band label} to give weight context." |
| flag | `flag` | "{w} g — more than 50% above the median of {m} g for {band label} pieces here ({n} pieces); check comfort with the parents." |
| no flag | `pass` | "{w} g — not more than 50% above the median of {m} g for {band label} pieces here ({n} pieces)." |

All cases set `asListed = product.weight`, `guidance = [SR-WEIGHT-MEDIAN text]`, `sources = ['weight', 'weight_g', 'SR-WEIGHT-MEDIAN']` (just `['weight', 'SR-WEIGHT-MEDIAN']` when `weight_g` is null). `{w}` prints `weight_g` trimmed ("6", "4.05", "1.06"; the table below writes 6.0 for readability).

**Honest limits, stated on the card through SR-WEIGHT-MEDIAN.** The listed weights are not like for like. For gold pieces `weight_g` is the gold weight only, for silver pieces it is a gross weight (a range midpoint for several), sets sum two components, and metals differ in density. TPN-1459 and TPN-1433 also state "weight approx 2.5-3 gms" in their `chain` field, which may or may not be an extra figure; `weight_g` follows the `weight` field only (catalog-data REQ-CD-16). The median therefore gives context, not a limit. See open questions Q2 to Q4.

#### Real flag cases (catalog v1.0.0, hand-computed, pinned in tests)

| Reference band | Pool n | Median | Flag above | Flagged |
|---|---|---|---|---|
| infants | 18 | 1.51 | 2.265 | TNZ-1056 6.0 · TPN-1459 4.05 · TOB-1009 3.94 · TBZ-1013 3.1 · TPN-1433 3.0 · TBZ-1017 2.75 · TOB-1008 2.5 · (TNZ-1058 7.0, out of stock) |
| kids | 15 | 1.23 | 1.845 | TPN-1459 · TOB-1009 · TBZ-1013 · TBZ-1017 |
| teens | 9 | 0.86 | 1.29 | THP-1001 1.55 · THP-1017 1.5 · THP-1027 1.5 |
| mom | 2 | n/a | n/a | none; pool below 3 gives a `note` |

The test recomputes these from the parsed catalog independently of `lib/safety-weight.ts` (a second, naive median in the test) and compares with this table. A catalog edit that moves a median fails the test, as intended.

### 3.4 Check 4: certifications (`certifications`)

```ts
claims.length === 0
  ? text = "No certifications are stated on this product's page."
  : text = "Stated on this product's page:" , one `asListed` line per claim = the claim verbatim
```

Severity `note`; sources `['claims', 'SR-CLAIMS-ONLY']`; `guidance = [SR-CLAIMS-ONLY text]`. The row never uses the words "certified" or "tested" itself. The only text that can contain BIS, hallmark, hypoallergenic, or nickel-free is a quoted `claims` entry. Site boilerplate ("BIS Hallmarked", "Hypoallergenic", "Safe for sensitive skin") is not in `claims[]` for any SKU and is never shown (PRD §5 claims discipline). If a later extraction populates `claims[]`, the verbatim line then appears with no code change.

### 3.5 Check 5: wear notes (`wear`)

`wearRuleFor(product): RuleId | null`:

```ts
if (product.category === 'Tabeez') return 'SR-WEAR-TABEEZ';
if (product.dims.kind === 'string-bracelet') return 'SR-WEAR-BRACELET';
if (product.dims.kind === 'bangle') return 'SR-WEAR-BANGLE';
if (product.category === 'Set') return 'SR-WEAR-SET-EARRINGS';
return null;
```

Row id `wear:<ruleId>`, label "Wear note", severity from the rule (`flag` for all four), `text` = the rule text, `guidance = [text]`, `sources = ['category', ('dimensions' for bracelets and bangles), ruleId]`. The unit (inches or mm) in `dimensions` decides bracelet vs bangle, as in `catalog-data` REQ-CD-19/20. Real counts: Tabeez 2, string bracelets 5, bangles 2, sets 2: 11 of 22 pieces get a wear flag and so show `Check this`. The 11 others are 8 pendants and 3 earrings; they get no wear row. Standalone earrings listed for infants (THP-1001, THP-1027) get no note because the PRD lists only the three cases above; see Q6.

### 3.6 Check 6: what is not stated (`not-stated:*`)

For each topic in order nickel, plating, clasp:

```ts
const TOPIC = {
  nickel:  { re: /nickel/i,                         rule: 'SR-NS-NICKEL',  label: 'Nickel' },
  plating: { re: /plated|plating|rhodium/i,         rule: 'SR-NS-PLATING', label: 'Plating or finish' },
  clasp:   { re: /clasp|closure|hook|lobster|screw[- ]?back/i, rule: 'SR-NS-CLASP', label: 'Clasp or closure' },
};
const FIELDS = ['materials', 'chain', 'dimensions', 'weight'] as const;
```

For each field, split the value on `;` and test each segment. If a segment matches, the row quotes it ("The listing says: “{segment}”"), cites that field and the rule, and keeps the rule's severity. Otherwise the row is the rule's "… is not stated on the listing." sentence, with `sources = [rule id]` (the topic is an absence, so the guidance rule is the only citable source; the row also cites the field names it searched, `materials, chain, dimensions, weight`, so a reader can see where the absence was checked). The regexes avoid `lock` so "openable locket" (TBZ-1013) does not count as a clasp. Against v1.0.0 no field mentions any topic, so all three rows are the "not stated" sentences for all 22 pieces.

Severity comes from the rule. All three are `note` in rules v1.0.0 (REQ-SV-20, Q1). The verdict code never hard-codes `note`; it reads `ruleById(id).severity`, so a rules change that makes one a `flag` flows through without a code change, and a test with an injected rules table proves it.

## 4. Guidance rules

### 4.1 `data/safety-rules.md` (human-edited, versioned)

Format: a header `version: 1.0.0`, then one `### SR-…` section per rule with the fields below, then a `## Changelog`. The sync test parses these sections.

```md
# Safety guidance rules
version: 1.0.0

### SR-WEAR-TABEEZ
- check: wear
- applies: category = Tabeez
- severity: flag
- text: Worn on a black thread — tie securely and check the knot regularly.
```

### 4.2 The 15 rules (v1.0.0)

| ID | Check | Applies | Severity | Text |
|---|---|---|---|---|
| SR-MAT-GOLD18 | materials | segment `18KT Gold` | note | 18KT gold is 18 parts gold in 24 (75% gold). The listing does not name the other metals. |
| SR-MAT-SILVER925 | materials | segment `925 Silver` | note | 925 sterling silver is 92.5% silver. The listing does not name the other metal. |
| SR-MAT-DIAMOND | materials | segment `Diamond …` | note | Carat (ct) is the diamond's weight, not its size. GH-VS is a colour and clarity grade as stated on the listing; the listing does not say who graded it. |
| SR-MAT-PEARL | materials | segment contains `pearl` | note | The listing says pearl and does not say whether it is natural or cultured. |
| SR-MAT-CZ | materials | segment `CZ` | note | CZ is cubic zirconia, a lab-made stone. It is not diamond. |
| SR-MAT-BEADS | materials | segment contains `black beads` | note | The listing says black beads and does not say what they are made of. |
| SR-WEIGHT-MEDIAN | weight | always | note | Compared with the median weight of in-stock pieces listed for the same age group. Listed weights use different bases (gold only for some pieces, gross weight for others) and different metals, so this is context, not a limit. |
| SR-CLAIMS-ONLY | certifications | always | note | Only certifications stated on this product's own page are shown. Store-wide wording is not treated as a claim for this piece. |
| SR-WEAR-TABEEZ | wear | `category = Tabeez` | flag | Worn on a black thread — tie securely and check the knot regularly. |
| SR-WEAR-BRACELET | wear | `dims.kind = string-bracelet` | flag | Check the fit as the child grows, and take it off for sleep. |
| SR-WEAR-BANGLE | wear | `dims.kind = bangle` | flag | A bangle does not stretch. Check that it slips over the hand comfortably and still fits as the child grows, and take it off for sleep. |
| SR-WEAR-SET-EARRINGS | wear | `category = Set` | flag | The earrings are small parts. Supervise young children and check them regularly. |
| SR-NS-NICKEL | not-stated | always | note | Nickel content is not stated on the listing. |
| SR-NS-PLATING | not-stated | always | note | Plating or finish is not stated on the listing. |
| SR-NS-CLASP | not-stated | always | note | Clasp or closure type is not stated on the listing. |

None of the texts contains "safe" or "unsafe", a certification term, or a number other than 75%, 92.5%, and 50% (REQ-SV-03, REQ-SV-31). The decoder rules (GOLD18, SILVER925, DIAMOND, CZ) are general knowledge with a fixed wording; they are labeled "General guidance" on the card so a reader can tell them from the listing's own words.

### 4.3 `lib/safety-rules.ts`

```ts
export const SAFETY_RULES_VERSION = "1.0.0";
export interface SafetyRule {
  id: string; check: "materials" | "weight" | "certifications" | "wear" | "not-stated";
  applies: string; severity: "flag" | "note"; text: string;
}
export const SAFETY_RULES: readonly SafetyRule[] = [ /* the 15 rows above, in table order */ ];
export const RULE_IDS: ReadonlySet<string>;
export function ruleById(id: string): SafetyRule;   // throws on an unknown id (a programming error)
```

`tests/safety.rules.test.ts` reads `data/safety-rules.md` with `fs` (tests may; `lib/` may not), parses it, and asserts: same version; same set of IDs; per ID the same check, applies, severity, and text. It also asserts IDs are unique and match `^SR-[A-Z0-9]+(-[A-Z0-9]+)*$`, and that no rule text contains "safe"/"unsafe" or a certification term. Duplicating the rules in a Markdown file and a constant is the cost of keeping `lib/` free of file I/O (open question Q5).

## 5. `computeVerdict()` flow

```
band' = band
rows = []
1. age row                         (§3.1)
2. materials row                   (§3.2)
3. ref = referenceBand(product, band)
   ctx = weight_g === null ? none : weightContext(weight_g, weightPool(catalog, ref), ref)
   weight row                      (§3.3)
4. certifications row              (§3.4)
5. wear row if wearRuleFor(product) (§3.5)
6. three not-stated rows           (§3.6)
flagged = rows.filter(severity === 'flag').map(id)
verdict = flagged.length > 0 ? "Check this" : "Good fit"
```

`verdict` depends only on row severities (REQ-SV-04, V5). Nothing else, such as price or rating, can influence it.

### 5.1 What the verdicts come out as (catalog v1.0.0, hand-computed, pinned in tests)

`Good fit` needs: band listed (or none), no weight flag, no wear rule. Counting against a recipient band:

| Band | `Good fit` pieces |
|---|---|
| infants | TPN-1149, TPN-1147, TPN-1145, TPN-1141, TPN-1143, TPN-1144, THP-1001, THP-1027 (8) |
| kids | TPN-1149, TPN-1147, TPN-1145, TPN-1141, TPN-1143, TPN-1144, THP-1017, THP-1001, THP-1027 (9) |
| teens | TPN-1149, TPN-1147, TPN-1145, TPN-1141, TPN-1143, TPN-1144 (6) |
| mom | THP-1017, THP-1001 (2) |

Every other piece listed for the band is `Check this` (weight flag, wear note, or both); a piece not listed for the band is `Check this` through the age row. For example, with infants: TNZ-1056 is `Check this` for weight (6.0 g) and the bracelet wear note, and TBZ-1013 for weight (3.1 g) and the tabeez thread note. With no recipient, the weight reference is the youngest listed band, so the 8 pendants and 3 earrings are `Good fit` except TPN-1459 and TPN-1433 (weight), and the three earrings listing teens are judged against their youngest band (infants or kids), not teens. A test pins the four lists above and the no-band behaviour for two pieces.

`Good fit` therefore stays reachable for pendants and earrings, which is the honest outcome of the PRD rule: the data gives no reason to look twice at them, and the card still lists materials and what is not stated.

## 6. The component

`components/SafetyVerdict.tsx` takes `{ verdict: SafetyVerdict }`. No `'use client'`: it is static markup, so it renders on the server in `/piece/[sku]`.

```
┌─ <section role="region" aria-labelledby="fit-check-title"> ─────────────────────┐
│ Fit check                                                                       │
│ <h2 id="fit-check-title">Good fit</h2>  |  <h2>Check this</h2>                  │
│ (Check this) "Worth a look: Weight, Wear note"   ← flagged row labels, text     │
│                                                                                 │
│ ── Age fit ──            Listed by Tiny Tiaraa for infants 0–3 years            │
│                          Source: age_groups                                     │
│ ── Materials ──          As listed: 18KT Gold; Diamond 0.06 Cts, Quality GH-VS  │
│                          18KT gold · Diamond 0.06 ct, GH-VS                     │
│                          General guidance (SR-MAT-GOLD18): …                    │
│                          Source: materials, SR-MAT-GOLD18, SR-MAT-DIAMOND       │
│ ── Weight ── (Worth a look)  6 g — more than 50% above the median of …          │
│ ── Certifications ──     No certifications are stated on this product's page.   │
│ ── Wear note ── (Worth a look)  General guidance (SR-WEAR-BRACELET): …          │
│ ── Nickel / Plating or finish / Clasp or closure ──  … is not stated on the listing. │
│                                                                                 │
│ A fit check from the atelier — guidance, not a safety certification. …          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Rules: the card is a `<section>` with rows in a `<dl>` (label `dt`, content `dd`). Surface `bg-sage/60` for `Good fit`, `bg-champagne` for `Check this`, text `text-plum`; rows separated by `border-plum/15`. A flagged row shows the text "Worth a look" in `font-semibold`, never colour alone. A guidance block is introduced by the words "General guidance" and the rule ID in `text-plum/60`. Sources render as "Source: a, b". The fit-check line is the last element, `text-sm`, as one text node. `data-row-id`, `data-severity`, and `data-sources` attributes carry the row data for tests. The card contains no image, icon, or decorative haunted element.

## 7. Failure behaviour

| Situation | Behaviour |
|---|---|
| `weight_g` is null | `note` row with the verbatim `weight`; no comparison; never `0`. |
| Pool smaller than 3 (Mom today) | `note` row; no flag. |
| Product lists no age group | Cannot happen (catalog REQ-CD-06); the youngest-band function throws a programming error. |
| Unknown rule ID in code | `ruleById` throws; the sync test would have failed first. |
| `claims` non-empty after a future extraction | Entries are quoted verbatim; no other code change. |
| Band not listed (hand-edited URL) | Age row flags; verdict `Check this`. |

## 8. Testing

| File | Env | Covers |
|---|---|---|
| `tests/safety.test.ts` | node | each check (§3), verdict computation, the pinned flag cases (REQ-SV-16), the pinned Good fit lists (§5.1), no-band behaviour, an injected rules table where a `not-stated` rule is a `flag` |
| `tests/safety.materials.test.ts` | node | decoder over all 22 real `materials` strings and synthetic segments |
| `tests/safety.weight.test.ts` | node | median (odd/even), integer threshold at exactly 1.5×, pool < 3, null weight, reference band |
| `tests/safety.rules.test.ts` | node | md ↔ constant sync, ID format, forbidden words in rule text |
| `tests/safety.property.test.ts` | node | V1 to V10, seed fixed, `numRuns ≥ 200` |
| `tests/safety.ui.test.tsx` | jsdom (`// @vitest-environment jsdom`, `tests/helpers/dom.ts`) | the card for TNZ-1056 (infants), TPN-1149 (infants), a no-band verdict: label, rows, sources text, exact disclaimer, "Worth a look" on flags, no "safe" |
| `tests/safety.copy.test.ts` | node | the static copy test of REQ-SV-29 |

### 8.1 Correctness properties (fast-check, seeded)

Generators: `arbBand` (`infants|kids|teens|mom|null`); `arbProduct` draws a real product and overrides `claims` (empty, or strings that may contain BIS/hallmark/hypoallergenic/nickel-free), `weight_g` (null or a 2-decimal number), `age_groups` (non-empty subset), `category`/`dims.kind` (all four kinds), and the free-text fields `materials`, `chain`, `dimensions`, `weight` (from an alphabet that excludes the words "safe"/"unsafe", because a verbatim quote is exempt from V7); `arbCatalog` perturbs the pool weights.

| ID | Property | Requirement |
|---|---|---|
| P-SV-1 (V1) | For any product and band, and any `claims`: every certification term (BIS, hallmark, hypoallergenic, nickel-free, certified, tested) found in any row text, `asListed`, or `guidance` outside the certifications row is absent; inside the certifications row, a term appears only if some `claims` entry contains it (case-insensitive). With `claims = []` the certifications row text equals the exact sentence. | REQ-SV-17, 33 |
| P-SV-2 (V2) | For any product and any band not in its `age_groups`, `verdict === 'Check this'` and the `age-fit` row is a flag. | REQ-SV-09, 34 |
| P-SV-3 (V3) | Every row has `sources.length ≥ 1`; every source is in `CATALOG_FIELDS ∪ RULE_IDS`; every rule ID cited appears in `guidance` or `segments` of that row. | REQ-SV-07, 35 |
| P-SV-4 (V4) | `computeVerdict(p, c, b)` deep-equals a second call, and `p`, `c` deep-equal their pre-call clones. | REQ-SV-05, 36 |
| P-SV-5 (V5) | `verdict === 'Check this'` ⇔ some row has severity `flag`; `flagged` equals the flag row IDs in order. | REQ-SV-04, 37 |
| P-SV-6 (V6) | For a generated pool and weight: if `weightContext(w).flag` then `weightContext(w + 0.01).flag`; `w = 1.5 × median` (when representable in hundredths) is not a flag; `w = 1.5 × median + 0.01` is; a pool under 3 never flags. | REQ-SV-13, 14, 38 |
| P-SV-7 (V7) | No atelier-written string (rows, labels, guidance, disclaimer, verdict) matches `/\b(un)?safe\b/i`; `disclaimer === FIT_CHECK_LINE`. | REQ-SV-02, 03, 39 |
| P-SV-8 (V8) | For generated strings in the four fields with and without topic words: no topic word anywhere ⇒ the three exact "not stated" sentences; a topic word in a segment ⇒ that row quotes the segment and cites the field. | REQ-SV-19, 40 |
| P-SV-9 (V9) | `decodeMaterials(m).map(s => s.raw).join('; ') === m.trim()` for generated `;`-separated segments; every number in a `display` occurs in `m`. | REQ-SV-12, 41 |
| P-SV-10 (V10) | Row IDs always equal `age-fit, materials, weight, certifications, [wear:<rule>], not-stated:nickel, not-stated:plating, not-stated:clasp`; the wear row exists exactly for the four REQ-SV-18 cases. | REQ-SV-08, 18, 42 |
| P-SV-11 | Static: no file in `lib/safety*.ts` imports React, `fs`, or a network/LLM client, or uses `Date`, `Math.random`, `fetch`. `components/SafetyVerdict.tsx` imports no `catalog.json` and no `computeVerdict`. | REQ-SV-25, 30 |
| P-SV-12 | Over all 22 real products × the 5 band contexts: V1 to V10 hold, and the pinned flag and Good fit tables hold. | REQ-SV-16, 33 to 42 |

A counterexample from any property is logged in `docs/kiro-evidence-log.md` with its fix.

## 9. Landing-copy alignment (REQ-SV-29)

| File | Current wording | Replace with |
|---|---|---|
| `app/page.tsx` (hero paragraph) | "You can't tell how big it is — or if it's safe. Three taps, and the atelier finds the piece — then proves it." | "You can't tell how big it is — or whether it suits the little one. Three taps, and the atelier finds the piece, then gives you a plain-language fit check." |
| `app/page.tsx` (step 3 body) | "A plain-language safety check and a true-size view on every pick — then a gift wrap and a message." | "A plain-language fit check and a size view you calibrate to your screen, on every piece's page — then a gift wrap and a message." |
| `app/layout.tsx` metadata `description` | "…then prove it's safe, see it true to size, and wrap it beautifully…" | "…then get a plain-language fit check, see it at a size you calibrate, and wrap it beautifully. Real catalog: Tiny Tiaraa." |
| `app/page.tsx` trust strip | "Safety notes are fit checks, not certifications." | unchanged |

The step-3 line is also reworded so the landing page does not use "true-size" before a visitor has calibrated anything (see `true-size-viewer` REQ-TS-12). The PRD's open question 2 asked about claims, not copy; the PRD's framing ("a fit check, not a certification", PRD §5) already decides the copy, so no user approval is needed. `README.md` line 4 carries the same "proves it's safe" sentence; the task updates it to match (Q8).

## 10. Open questions (not resolved by this spec; builder's call)

| ID | Question | Spec's working assumption |
|---|---|---|
| Q1 | PRD §5 says a flag from check 6 makes `Check this`. No catalog field exists for nickel, plating, or clasp, so all 22 pieces would be `Check this` and the verdict would carry no information. | Not-stated rows are severity `note` in rules v1.0.0 and do not flip the verdict. Severity is read from the rule, so one edit flips it. |
| Q2 | With no recipient, which band gives the weight median? | The youngest band the product lists. |
| Q3 | A median over every in-stock piece for a band mixes categories. Teens: the median is 0.86 g (pendant-heavy), so three 1.5 g earrings flag; Mom has only 2 pieces. | Follow the PRD literally (all categories, one median per band); a pool under 3 never flags. A per-category median is a later change. |
| Q4 | Weights are not like for like (gold-only vs gross, metals differ). TPN-1459 (4.05 g) and TPN-1433 (3.0 g) also state "weight approx 2.5-3 gms" in `chain`. | `weight_g` follows the `weight` field; the card shows `weight` verbatim and SR-WEIGHT-MEDIAN says the figure is context only. |
| Q5 | Rules live in `data/safety-rules.md` (curated) and `lib/safety-rules.ts` (runtime). | A sync test keeps them equal; the constant is the runtime source because `lib/` cannot read files. |
| Q6 | Standalone earrings listed for infants (THP-1001, THP-1027) get no small-parts note; the PRD names sets only. | Not added. Adding `SR-WEAR-EARRINGS` is one rule plus one line in `wearRuleFor`. |
| Q7 | The PRD's example weight text "0.8 g — light for everyday wear" asserts a judgement the data does not support. | Replaced by the median comparison text of REQ-SV-14. |
| Q8 | The copy task also rewords the step-3 landing line, the hero's "then proves it", and README line 4. | Yes: they overpromise in the same way. |
| Q9 | With no recipient, the card can still say `Good fit`. | Yes, with the "No recipient selected" age row; the verdict reflects the listing's own data only. |
