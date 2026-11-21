# Matching Core — Design

*Implements REQ-MC-01 to REQ-MC-42 (`requirements.md`). Source: PRD §3, architecture §7. Depends on `catalog-data` (`Product`, `band_quartiles`, `tags`).*

## 1. Pipeline

```
RecipientModel ─► [1 filter] ─► [2 relax?] ─► [3 score] ─► [4 rank] ─► [5 diversity] ─► [6 explain] ─► MatchResult
                       ▲            │
                       └── re-check ┘   (ladder re-runs the filter after each step)
```

One exported entry point in `lib/matching.ts`:

```ts
function match(model: RecipientModel, catalog: ParsedCatalog): MatchResult
```

The catalog is passed in, never imported inside the function, so tests can supply fixtures and the function stays pure (REQ-MC-31). Everything below is a pure helper in the same file or in `lib/matching/` (no I/O, clock, randomness, or network).

```ts
type Relaxation =
  | 'budget-below' | 'budget-above' | 'symbol-broadened' | 'metal-dropped' | 'category-dropped';

interface Constraints {            // the mutable-by-ladder view of the model
  bands: Set<PriceBand> | 'any';   // allowed price bands; starts as {original}
  symbolMode: 'any' | 'none-religious' | 'zodiac' | 'evil-eye' | 'religious' | 'list';
  symbolTags: Set<string>;         // required tags when mode is zodiac / evil-eye / religious / list
  metal: 'gold' | 'silver' | 'any';
  category: Category | 'any';
}

interface ScoreBreakdown { occasion: 0|3; symbol: 0|1|3; metal: 0|2; rating: 0|1; centrality: 0|1 }

interface Pick {
  sku: string;
  score: number;                   // sum of breakdown, 0..10
  breakdown: ScoreBreakdown;
  reasons: Reason[];               // 2..4, template-rendered
  relaxations: Relaxation[];       // markers (REQ-MC-25)
  relaxationNote?: string;         // "Your Ganesha pendant sits just below your budget at ₹14,249, ..."
}

interface MatchResult {
  picks: Pick[];                   // length 0..3, never padded
  disclosures: string[];           // one sentence per ladder step that added products (REQ-MC-24)
  shortfallNote?: string;          // REQ-MC-26
  showBrowseLink: boolean;         // true when picks.length < 3
  trace: LadderTrace[];            // step, eligible-count-before/after (for tests and matching_explain)
}
interface Reason { type: 'age'|'budget'|'occasion'|'symbol'|'metal'|'rating'; text: string; source: string } // source = field name or map entry
```

`trace` is not shown to users. It exists so tests and the MCP tool `matching_explain` can show why a ladder step ran.

## 2. Step 1: hard filters

`initialConstraints(model)` builds `Constraints`. `eligible(constraints, model, catalog)` is a single `catalog.products.filter(...)` that requires, for each product `p`:

1. `p.availability === 'In Stock'` (REQ-MC-07)
2. `p.age_groups.includes(AGE_LABEL[model.ageBand])` (REQ-MC-08)
3. `bands === 'any' || bands.has(p.price_band)` (REQ-MC-09)
4. `category === 'any' || p.category.toLowerCase() === category` (REQ-MC-10)
5. Symbol rule (REQ-MC-11 to 13), with `RELIGIOUS = {symbol:om, symbol:sikh, symbol:cross, symbol:ganesha, symbol:trishul, symbol:jain, symbol:swastik, symbol:third-eye}`:

| `symbolMode` | Passes when |
|---|---|
| `none-religious` | product has no tag in `RELIGIOUS` |
| `any` | always (religious pieces allowed: explicit opt-in) |
| `zodiac` / `evil-eye` | product has `symbol:zodiac` / `symbol:evil-eye` |
| `religious` | product has any tag in `RELIGIOUS` |
| `list` | product has any tag in `symbolTags` |

6. `metal === 'any' || p.metal === metal`

`symbolTags` for `list` mode come from `SYMBOL_CHIP_TAGS` in `data/product-tags.ts` (curated, human-authored): `om → symbol:om`, `ganesha → symbol:ganesha`, `cross → symbol:cross`, `sikh → symbol:sikh`, `trishul → symbol:trishul`, `jain → symbol:jain`, `tabeez → symbol:swastik, symbol:third-eye`. A `symbols = 'religious'` model whose `symbolList` is non-empty is `list` mode; with an empty list it is `religious` mode.

The age check compares to catalog strings, so the "Mom" group is matched as data, not hard-coded to category.

## 3. Step 2: relaxation ladder

```ts
const LADDER: Step[] = [
  widenBelow,       // 1a  REQ-MC-21 step 1
  widenAbove,       // 1b  REQ-MC-21 step 2
  broadenSymbol,    // 2   REQ-MC-22
  dropMetal,        // 3
  dropCategory,     // 4
];
```

```
c = initialConstraints(model); n = |eligible(c)|
for step in LADDER:
    if n >= 3: break
    c2 = step(c, model)               // returns c unchanged (same reference) when nothing to change
    if c2 === c: continue             // no-op: skip, no disclosure
    n2 = |eligible(c2)|
    trace.push({step, before: n, after: n2})
    if n2 > n: disclosures.push(render(step, n, c, model))   // pass (a): disclose steps that added products
    c = c2; n = n2
// step 6: whatever is eligible (0..n) is shown; picks = top min(3, n)
// after ranking (pass b): finalDisclosures(model, relaxed, usedSteps(picks))
for step in LADDER (in order):
    if step in trace and (step was disclosed in pass (a) or a final pick carries step's marker):
        disclose step with n = trace[step].before
```

**Two-pass disclosure rule.** (a) During the ladder, each step that added products is disclosed. (b) After ranking, `finalDisclosures()` (`lib/matching/relax.ts`, called from `match()`) also discloses any step whose marker (`budget-above`, `symbol-broadened`, and so on) appears on a final pick, even if that step added nothing when it ran. Disclosures stay in ladder order.

Rationale (counterexample from the session 2b property run): infants / naming / under-2500 / gold / set / religious `['om']`. `widenAbove` and `broadenSymbol` added nothing at their turn, because `category = set` still blocked everything. Only the later `dropCategory` step brought in products, and only it was disclosed. The final picks nonetheless carried `budget-above` and `symbol-broadened` markers with no matching disclosure, breaking invariants I3 and I4. A step can add nothing to the eligible set at its turn and still be necessary for the final picks. The intent of the rule is unchanged: never disclose a step that affected neither the eligible set nor any pick. In golden case 3, `widenAbove` adds nothing and no pick carries `budget-above`, so it stays undisclosed and the golden output is unchanged. The regression test is in `tests/matching.personas.test.ts`.

Step definitions (each returns a new `Constraints`):

| Step | Change | No-op when |
|---|---|---|
| `widenBelow` | add the band immediately below the original band to `bands` | `budgetBand` is `no-limit` or `under-2500` |
| `widenAbove` | add the band immediately above the original band | `no-limit` or `25000-plus` |
| `broadenSymbol` | `list` mode → `religious` mode (same class) | mode is anything but `list` (including `none-religious`, `zodiac`, `evil-eye`, `any`, and `religious`) |
| `dropMetal` | `metal = 'any'` | already `any` |
| `dropCategory` | `category = 'any'` | already `any` |

Band order for "adjacent": `under-2500 < 2500-15000 < 15000-25000 < 25000-plus`.

Rules the ladder cannot break, enforced by construction: no step touches `availability` or the age check, and `broadenSymbol` is a no-op under `none-religious`, so a `none-religious` model never reaches a religious product (REQ-MC-12, REQ-MC-23). A product added by a step stays eligible under later steps, since each step only loosens the constraints.

The ladder also runs when strict filtering returns 1 or 2 products, not only 0. Golden case 3 starts from 0; golden case 2 starts from 2 and every step is a no-op or adds nothing, so the result stays at 2.

### Disclosure rendering

`render(step, n, …)` fills "Only {n} {plural} matched your {constraint}, so we {action} — your picks are marked." (`{plural}` is `piece` when n=1, else `pieces`; n=0 uses "No pieces matched your …").

| Step | `{constraint}` | `{action}` |
|---|---|---|
| `widenBelow` | `{band label} budget` | `widened it to the band just below` |
| `widenAbove` | `{band label} budget` | `widened it to the band just above` |
| `broadenSymbol` | `{symbol label} request` | `broadened it to other religious symbols` |
| `dropMetal` | `{metal label} preference` | `set it aside` |
| `dropCategory` | `{category label} choice` | `set it aside` |

Band labels: `under-2500` → "under ₹2,500", `2500-15000` → "₹2,500–₹15,000", `15000-25000` → "₹15,000–₹25,000", `25000-plus` → "₹25,000+". Prices are formatted with a small hand-written Indian-grouping function (₹2,324; ₹61,599), not `toLocaleString`, so output does not depend on the runtime's ICU data.

Pick markers (`relaxations`) are derived after ranking by comparing each pick to the original model: price band outside the original → `budget-below`/`budget-above`; religious tag outside `symbolList` while the mode was `list` → `symbol-broadened`; `metal` differs from a requested metal → `metal-dropped`; category differs from a requested category → `category-dropped`. A pick that is inside every original constraint has none.

### Shortfall note

When `picks.length < 3`: `showBrowseLink = true`. Let `m` be the number of in-stock products whose `age_groups` include the recipient's age label. If `m < 3`, `shortfallNote = "Only {m} pieces in the atelier are listed for {age label}"` (Mom → "Only 2 pieces in the atelier are listed for Mom"). Otherwise the note is "Only {picks.length} {plural} fit this recipient even after widening — browse the full atelier."

## 4. Step 3: scoring

`scoreProduct(p, model, constraints, catalog) → ScoreBreakdown`, summed by `sum()`:

| Signal | Points | Rule |
|---|---|---|
| Occasion | +3 | `OCCASION_MAP[model.occasion]` has a rule matching `p`. A rule is an object `{category?, tag?, metal?}`; a product matches a rule when every field present on the rule matches. A product matches the occasion when any rule matches. |
| Symbol | +3 / +1 | Requested tags = `symbolTags` of the **original** model (list mode), or `RELIGIOUS` (`religious` mode), or `{symbol:zodiac}` / `{symbol:evil-eye}`. +3 if `p` carries a requested tag. Else +1 if the current constraints are in `religious` mode because `broadenSymbol` ran (original mode was `list`) and `p` carries any `RELIGIOUS` tag. 0 for `any` and `none-religious`. |
| Metal | +2 | `model.metal !== 'any' && p.metal === model.metal`. Uses the **original** metal, so a product kept after `dropMetal` of the wrong metal scores 0 here. |
| Rating | +1 | `p.rating_value !== null && p.rating_value >= 4.5` |
| Centrality | +1 | See §5. |

`data/occasion-map.ts` (curated, human-authored):

| Occasion | Rules (any matches) |
|---|---|
| naming | `{tag:'symbol:evil-eye'}`, `{tag:'material:black-beads'}`, `{category:'Tabeez'}` |
| baby-shower | `{category:'Bracelet'}`, `{tag:'symbol:evil-eye'}` |
| birthday | `{category:'Pendant'}`, `{category:'Earrings'}`, `{tag:'symbol:zodiac'}` |
| first-birthday | `{category:'Set'}`, `{category:'Bracelet'}` |
| festival | `{category:'Pendant', metal:'gold'}` |
| rakhi | `{category:'Bracelet'}` |
| just-because, other | no rules |

Worked totals (hand-computed; the golden unit tests assert them):

| Case | SKU | Occ | Sym | Met | Rat | Cen | Score |
|---|---|---|---|---|---|---|---|
| 1 | TBZ-1013 | 3 | 0 | 2 | 1 | 0 | 6 |
| 1 | TNZ-1056 | 3 | 0 | 2 | 1 | 0 | 6 |
| 1 | TBZ-1017 | 3 | 0 | 2 | 0 | 1 | 6 |
| 1 | TOB-1008 | 0 | 0 | 2 | 0 | 1 | 3 |
| 1 | THP-1027 / TPN-1433 | 0 | 0 | 2 | 0 | 0 | 2 |
| 2 | THP-1001 | 3 | 0 | 2 | 1 | 1 | 7 |
| 2 | THP-1017 | 3 | 0 | 2 | 0 | 1 | 6 |
| 3 | TPN-1141 Ganesha | 3 | 3 | 2 | 1 | 0 | 9 |
| 3 | TPN-1147 Sikh | 3 | 1 | 2 | 1 | 0 | 7 |
| 3 | TPN-1143 Trishul | 3 | 1 | 2 | 1 | 0 | 7 |
| 3 | TPN-1149 Om | 3 | 1 | 2 | 0 | 1 | 7 |
| 3 | TPN-1145 Cross / TPN-1144 Jain | 3 | 1 | 2 | 0 | 0 | 6 |

## 5. Price centrality (LOCKED definition)

> Price centrality awards +1 when the price lies within the interquartile range [P25, P75] of the in-stock prices in the recipient's budget band (linear-interpolation percentiles, inclusive bounds), computed at build time from data/catalog.json. It is skipped for the no-limit budget band. After relaxation, centrality is still computed against the ORIGINAL budget band the user chose.

**Rationale.** "Middle 50% of the budget band" in the PRD is ambiguous: it could mean the middle half of the price range (min to max), the middle half of the nominal band bounds, or the middle half of the products. The interquartile range of the band's actual in-stock prices is the literal middle 50%. It is robust to the ₹61,599 outlier in the 25000-plus band (a min-to-max range definition would put the four other products in that band outside the middle). It fires in every band, since each band has at least 5 in-stock prices and so a non-empty IQR containing at least one price. And it reproduces golden case 1 exactly: the under-2500 IQR is ₹1,880.25–₹2,267.75, so TBZ-1017 at ₹2,099 gets +1 and scores 6, while TBZ-1013 at ₹2,324 and TNZ-1056 at ₹1,674 do not and also score 6.

Implementation notes:
- `band_quartiles` comes from `parseCatalog()` (catalog-data design §3.7): sorted ascending in-stock prices `x₀…xₙ₋₁`; percentile `p` is at position `h = p·(n−1)`, value `x⌊h⌋ + (h − ⌊h⌋)·(x⌈h⌉ − x⌊h⌋)`.
- Bounds are inclusive: `P25 ≤ price ≤ P75`. TPN-1149 at ₹18,299 (exactly the 15000-25000 P25) and THP-1017 at ₹27,949 (exactly the 25000-plus P75) both score +1.
- Quartiles are computed over in-stock products of the whole band, not over the eligible set, so they do not change with the other filters. Out-of-stock TNZ-1058 (₹2,674) is excluded from the 2500-15000 quartiles.
- Pinned values at v1.0.0: under-2500 [1880.25, 2267.75]; 2500-15000 [10199, 14249]; 15000-25000 [18299, 24499]; 25000-plus [25299, 27949].
- A catalog edit that moves a quartile can change a score. The catalog-data versioning workflow (step 6) requires re-running the golden tests.

## 6. Step 4: ranking and Step 5: diversity

```ts
const compare = (a, b) =>
  b.score - a.score
  || (b.rating_value ?? -1) - (a.rating_value ?? -1)               // null last
  || Math.abs(a.price_inr - mid) - Math.abs(b.price_inr - mid)     // skipped (0) for no-limit
  || (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0);
```

`mid` is the ORIGINAL band's midpoint: 2000, 8750, 20000, 30000. SKUs are unique (REQ-CD-01), so the comparator is a total order. Sorting a copy keeps the catalog arrays unmodified.

**Diversity** runs on the sorted list `L`:

```
top = L.slice(0, 3)
if top.length === 3 and all top share one category:
    floor = top[2].score - 2
    alt = L.slice(3).find(p => p.category !== top[0].category && p.score >= floor)   // first = best by compare
    if alt: top[2] = alt
picks = top
```

`find` returns the highest-ranked qualifying item because `L` is sorted. The rule swaps at most one pick, so the result has at most 2 of one category whenever it swaps. If `alt` is absent, three of one category stands (golden case 3). Diversity does not run when fewer than 3 products are eligible.

## 7. Step 6: why-reason rendering

`explain(pick, model, constraints, catalog) → Reason[]` uses only templates in `lib/matching/templates.ts` and fields of the pick's `Product` or curated-map entries.

| Label map | Values |
|---|---|
| age label | `Infants 0-3 years` → "infants 0–3 years", `Kids 3-12 years` → "kids 3–12 years", `Teens 12-19 years` → "teens 12–19 years", `Mom` → "Mom" (en dash in output only; the lookup key stays the catalog string) |
| budget label | as in §3 disclosure labels, except the reason form of under-2500 is "under-₹2,500" |
| occasion label | naming → "a naming ceremony", birthday → "a birthday", first-birthday → "a first birthday", baby-shower → "a baby shower", festival → "a festival", rakhi → "Rakhi" |
| metal label | gold → "18KT gold", silver → "925 silver" |
| symbol label | from the tag, e.g. `symbol:evil-eye` → "evil eye", `symbol:ganesha` → "Ganesha" |
| rating text | the part of `rating` before the first space, e.g. "5.0/5", "4.8/5" |

Selection (REQ-MC-29): `age` and `budget` always. Then, from `[occasion-or-symbol, metal, rating]`, include those whose breakdown value is > 0, in that order, up to 2 more. When both occasion and symbol scored, the symbol reason is preferred first only if the user requested a symbol (a specific request is the stronger statement); otherwise occasion first. This yields 2 to 4 reasons. Each `Reason.source` names the catalog field or map entry used (`age_groups`, `price_inr`, `occasion-map:naming`, `product-tags:symbol:evil-eye`, `materials`, `rating`), which is what invariant I7 checks.

Examples that the golden tests assert: TBZ-1013 → "Listed for infants 0–3 years", "₹2,324 — inside your under-₹2,500 budget", "Our atelier's pick for a naming ceremony", "925 silver, as you preferred". TPN-1141 → includes "Carries the Ganesha you asked for" and the relaxed budget reason "₹14,249 — just below your ₹15,000–₹25,000 budget".

Reasons never state a discount, certification, or any fact not in the product record.

## 8. Correctness properties (fast-check + Vitest, seeded; `tests/matching.property.test.ts`)

Generator `arbModel`: `ageBand` from the 4 bands, `occasion` from 8, `budgetBand` from 5, `metal` from 3, `category` from 6, `symbols` from 5; `symbolList` drawn from the 7 chip symbols and only when `symbols = 'religious'`. Catalog: the real `data/catalog.json` parsed by `parseCatalog`. `numRuns ≥ 500`.

| ID | Invariant (PRD §3) | Property | Requirement |
|---|---|---|---|
| I1 | Every pick In Stock | `∀ model, ∀ p ∈ picks: product(p).availability === 'In Stock'` (TNZ-1058 never appears) | REQ-MC-36, REQ-CD-25 |
| I2 | Age band match | `∀ p ∈ picks: product(p).age_groups ∋ AGE_LABEL[model.ageBand]` | REQ-MC-37 |
| I3 | Within budget or disclosed | `∀ p ∈ picks: inOriginalBand(p) ∨ (disclosures includes a budget sentence ∧ p.relaxations ∩ {budget-below, budget-above} ≠ ∅)`; for `no-limit` always in band | REQ-MC-38 |
| I4 | No religious without opt-in | `symbols ∈ {zodiac, evil-eye, none-religious} ⇒ no pick has a RELIGIOUS tag`; `symbols = 'religious'` with list ⇒ picks religious only; none-religious holds after every ladder step | REQ-MC-39, REQ-MC-12 |
| I5 | Exactly 3 when ≥3 eligible | `|picks| = min(3, N)` where `N` = eligible count after the ladder (recomputed by an independent reference filter in the test); no duplicate SKUs | REQ-MC-40 |
| I6 | Determinism | `match(m, c)` deep-equals `match(clone(m), c)`; `m` and `c` deep-equal their pre-call clones | REQ-MC-41 |
| I7 | Reasons grounded | every `reason.source` resolves to an existing field/map entry for that pick; no `occasion`/`symbol`/`metal`/`rating` reason when that breakdown value is 0; `2 ≤ reasons ≤ 4` | REQ-MC-42, REQ-MC-29 |

Additional properties (cheap and they catch real bugs):

| ID | Property | Requirement |
|---|---|---|
| P-MC-8 | Score is the sum of its breakdown and `0 ≤ score ≤ 10`. | REQ-MC-14 |
| P-MC-9 | Picks are in comparator order, except that a diversity swap may place a lower-ranked item third. | REQ-MC-18, 20 |
| P-MC-10 | Diversity: if the unswapped top 3 share a category and an alternative within 2 points exists, the result does not have 3 of one category; otherwise the top 3 are unchanged. | REQ-MC-20 |
| P-MC-11 | Relaxation monotonicity: the eligible set after a ladder step is a superset of the set before it. | REQ-MC-21 |
| P-MC-12 | A model that already has ≥3 strict-eligible products produces no disclosures and no pick markers. | REQ-MC-24, 25 |
| P-MC-13 | Age mapping: for generated ages, `[0,3)` → infants, `[3,12)` → kids, `[12,19)` → teens, and the boundary cases 2.999 / 3 / 11.999 / 12 / 18.999 / 19 map as specified. | REQ-MC-02 |
| P-MC-14 | Centrality uses the original band: for any model, a pick's `centrality` equals 1 iff `P25 ≤ price ≤ P75` of the original band (and always 0 for `no-limit`). | REQ-MC-15 |
| P-MC-15 | Output never contains a discount token (`%`, `off`, `save`, strike-through) or any certification word absent from the product's `claims`. | REQ-MC-32 |

Golden-case unit tests (`tests/matching.golden.test.ts`) assert the exact SKU order, scores, markers, disclosures, and shortfall note of REQ-MC-33 to REQ-MC-35. Any counterexample found by the properties goes in `docs/kiro-evidence-log.md` with its fix.

## 9. File map

| File | Contents |
|---|---|
| `lib/matching.ts` | `match()` entry point only: wires the pipeline |
| `lib/matching/age.ts`, `filters.ts`, `scoring.ts`, `rank.ts`, `relax.ts`, `explain.ts` | pure pipeline stages (age mapping; hard filters; scoring and centrality; ranking and diversity; ladder; reasons) |
| `lib/matching/templates.ts` | disclosure and reason templates, label maps, price formatter |
| `lib/matching/types.ts` | `RecipientModel`, `Constraints`, `Pick`, `MatchResult` |
| `data/product-tags.ts` | `PRODUCT_TAGS` (from catalog-data), `RELIGIOUS`, `SYMBOL_CHIP_TAGS` |
| `data/occasion-map.ts` | `OCCASION_MAP` |
| `tests/matching.test.ts`, `tests/matching.golden.test.ts`, `tests/matching.property.test.ts` | unit, golden, property tests |
