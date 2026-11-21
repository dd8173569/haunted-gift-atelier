# Matching Core — Requirements

*Spec for PRD §3. Implemented in `lib/matching.ts` (pure functions, no LLM). Catalog facts come from `data/catalog.json` via `lib/catalog.ts` (see `catalog-data`, REQ-CD-01 to REQ-CD-26). Curated maps: `data/product-tags.ts`, `data/occasion-map.ts`.*

Terms: **eligible** = passes all hard filters under the current relaxation state. **Original band** = the budget band the user chose, before any relaxation. **In stock** = `availability === 'In Stock'`.

---

## 1. Recipient model and age mapping

**[REQ-MC-01] Recipient model shape**
The matching function SHALL accept a `RecipientModel` with fields `relationship`, `ageBand` (`infants` | `kids` | `teens` | `mom`), optional `ageYears`, `occasion`, `budgetBand` (`under-2500` | `2500-15000` | `15000-25000` | `25000-plus` | `no-limit`), `metal` (`gold` | `silver` | `any`), `symbols` (`any` | `none-religious` | `zodiac` | `evil-eye` | `religious`), optional `symbolList`, and `category` (`pendant` | `bracelet` | `earrings` | `set` | `tabeez` | `any`), and SHALL run only from a complete model.

**[REQ-MC-02] Age bands are half-open**
WHEN `ageYears` is converted to `ageBand`, the system SHALL apply the half-open intervals `[0,3)` → `infants`, `[3,12)` → `kids`, `[12,19)` → `teens`. Age exactly 3 SHALL map to `kids`. Age exactly 12 SHALL map to `teens`. Fractional ages (for example 0.5 for a 6-month-old) SHALL map by the same intervals.

**[REQ-MC-03] Adults and invalid ages**
WHEN `ageYears ≥ 19`, the system SHALL NOT produce an age band; the conversation SHALL ask "Is this for Mom?" and map "yes" to `mom`. WHEN the answer is no, the system SHALL show "This atelier specialises in babies, kids, and Mom" and the browse link, and SHALL NOT run matching. WHEN `ageYears` is negative or not a finite number, the system SHALL reject it.

**[REQ-MC-04] Relationship does not score**
The `relationship` field SHALL NOT affect eligibility, score, or rank. It MAY be used only for the summary card and gift-message text.

---

## 2. Budget bands

**[REQ-MC-05] Budget band boundaries**
The system SHALL use exactly these bands, matching REQ-CD-15: `under-2500` for price < ₹2,500; `2500-15000` for ₹2,500 to ₹15,000 inclusive; `15000-25000` for ₹15,001 to ₹25,000 inclusive; `25000-plus` for price > ₹25,000. `no-limit` SHALL match any price.

**[REQ-MC-06] Band depth against the real catalog**
Against catalog v1.0.0, the in-stock counts SHALL be 6 (`under-2500`, ₹1,674–₹2,400), 5 (`2500-15000`, ₹2,750–₹14,399), 5 (`15000-25000`, ₹15,149–₹24,649), and 5 (`25000-plus`, ₹25,249–₹61,599). A unit test SHALL pin these counts so a catalog edit that changes band depth is noticed.

---

## 3. Hard filters

All of the following must pass for a product to be eligible.

**[REQ-MC-07] Stock filter**
The system SHALL exclude every product whose `availability` is not `In Stock`. This filter SHALL NOT be relaxed at any ladder step. (Same invariant as REQ-CD-25.)

**[REQ-MC-08] Age filter**
The system SHALL require the product's `age_groups` to include the label for the recipient band: `infants` → `Infants 0-3 years`, `kids` → `Kids 3-12 years`, `teens` → `Teens 12-19 years`, `mom` → `Mom`. This filter SHALL NOT be relaxed.

**[REQ-MC-09] Budget filter**
WHEN `budgetBand` is not `no-limit`, the system SHALL require the product's `price_band` to be in the current allowed set of bands (initially only the original band).

**[REQ-MC-10] Category filter**
WHEN `category` is not `any`, the system SHALL require the product's category to equal it (case-insensitive match against the catalog's `Pendant`, `Bracelet`, `Earrings`, `Set`, `Tabeez`).

**[REQ-MC-11] Symbol rule: religious pieces need explicit opt-in**
The system SHALL treat a product as religious when it carries any of the tags `symbol:om`, `symbol:sikh`, `symbol:cross`, `symbol:ganesha`, `symbol:trishul`, `symbol:jain`, `symbol:swastik`, `symbol:third-eye` (8 products). A religious product SHALL be eligible only when the user explicitly chose `symbols = 'any'`, `symbols = 'religious'`, or a specific symbol in `symbolList`. The system SHALL NOT infer religious intent from the occasion, relationship, a name, or a festival.

**[REQ-MC-12] None-religious is never relaxed**
WHEN `symbols = 'none-religious'`, the system SHALL exclude all 8 religious products from every candidate set, including after every relaxation step. No ladder step SHALL cross this line.

**[REQ-MC-13] Symbol restriction**
WHEN `symbols = 'zodiac'`, the system SHALL require tag `symbol:zodiac`. WHEN `symbols = 'evil-eye'`, it SHALL require `symbol:evil-eye`. WHEN `symbols = 'religious'` and `symbolList` is empty or absent, it SHALL require any religious tag. WHEN `symbolList` names symbols, it SHALL require at least one of the corresponding tags. WHEN `symbols` is `any` or `none-religious`, no symbol restriction applies beyond REQ-MC-11 and REQ-MC-12.

---

## 4. Soft scoring (maximum 10)

**[REQ-MC-14] Scoring signals**
The system SHALL compute an integer score from exactly these signals and no others:

| Signal | Points | Condition |
|---|---|---|
| Occasion match | +3 | Product matches the occasion's entry in `data/occasion-map.ts` |
| Symbol match | +3 | A symbol was requested and the product carries a requested tag |
| Symbol broadened | +1 | Symbol relaxation is active and the product carries a religious tag not in the requested list (replaces the +3, never added to it) |
| Metal match | +2 | `metal ≠ any` and product `metal` equals it |
| High rating | +1 | `rating_value ≥ 4.5`; a null rating scores 0 and is not otherwise penalised |
| Price centrality | +1 | See REQ-MC-15 |

The maximum is 3 + 3 + 2 + 1 + 1 = 10.

**[REQ-MC-15] Price centrality (locked definition)**
Price centrality SHALL award +1 when the price lies within the interquartile range [P25, P75] of the in-stock prices in the recipient's budget band (linear-interpolation percentiles, inclusive bounds), computed at build time from `data/catalog.json`. It SHALL be skipped for the `no-limit` budget band. After relaxation, centrality SHALL still be computed against the ORIGINAL budget band the user chose. Against catalog v1.0.0 the bounds are: `under-2500` ₹1,880.25 to ₹2,267.75; `2500-15000` ₹10,199 to ₹14,249; `15000-25000` ₹18,299 to ₹24,499; `25000-plus` ₹25,299 to ₹27,949.

**[REQ-MC-16] Occasion map**
The occasion signal SHALL read only `data/occasion-map.ts`: naming → nazariya (`symbol:evil-eye`), black beads (`material:black-beads`), Tabeez; baby-shower → Bracelet, nazariya; birthday → Pendant, Earrings, zodiac; first-birthday → Set, Bracelet; festival → gold Pendants; rakhi → Bracelet; just-because and other → no match, so no boost.

**[REQ-MC-17] Scoring uses only catalog and curated data**
No scoring signal SHALL use data outside `catalog.json` and the curated maps. No signal SHALL use an LLM or any random value.

---

## 5. Ranking, tie-breaking, and diversity

**[REQ-MC-18] Tie-break order**
The system SHALL order eligible products by: (1) score descending; (2) `rating_value` descending, null ratings last; (3) |price − band midpoint| ascending, using the original band's midpoint (`under-2500` ₹2,000; `2500-15000` ₹8,750; `15000-25000` ₹20,000; `25000-plus` ₹30,000; this key is skipped for `no-limit`); (4) SKU ascending. The order SHALL be total, so two products never compare equal.

**[REQ-MC-19] Exactly three picks when three or more are eligible**
WHEN 3 or more products are eligible after relaxation, the system SHALL return exactly 3 picks. WHEN fewer are eligible, it SHALL return all of them (0, 1, or 2) and SHALL NOT add a filler pick.

**[REQ-MC-20] Diversity rule**
The system SHALL NOT return more than 2 of 3 picks from the same category IF a different-category alternative exists within 2 points of the third pick's score. WHEN the top 3 are all one category AND such an alternative exists, the system SHALL replace the third pick with the highest-ranked different-category product whose score is ≥ (third pick's score − 2). WHEN no such alternative exists (for example a specific-symbol search), 3 of one category is correct and SHALL be returned.

---

## 6. Relaxation ladder

**[REQ-MC-21] Ladder trigger and order**
WHEN fewer than 3 products are eligible, the system SHALL apply these steps in order, re-checking the eligible count after each step and stopping as soon as 3 are eligible:
1. Widen the budget to the adjacent band below the original band.
2. Widen the budget to the adjacent band above the original band.
3. Broaden the symbol within its class.
4. Drop the metal preference.
5. Drop the category preference.
6. WHEN still fewer than 3, show the 1 or 2 eligible products (or none) honestly with a "Browse the full atelier" link.

Steps 1 and 2 are cumulative (step 2 keeps the band added in step 1). Each later step keeps the earlier ones. A step with nothing to change (for example no band below `under-2500`, no band above `25000-plus`, `metal = any`) SHALL be skipped without a disclosure.

**[REQ-MC-22] Symbol broadening stays inside its class**
Step 3 SHALL broaden a specific religious symbol to any religious symbol only. A requested `zodiac` or `evil-eye` has no wider class, so step 3 is a no-op for them. Step 3 SHALL NOT run, and SHALL NOT add any religious product, WHEN `symbols = 'none-religious'` (REQ-MC-12). Step 3 SHALL NOT turn `none-religious`, `zodiac`, or `evil-eye` into `any`.

**[REQ-MC-23] Stock and age never relax**
No ladder step SHALL relax the stock filter (REQ-MC-07) or the age filter (REQ-MC-08).

**[REQ-MC-24] Disclosure of every applied step**
The system SHALL return a disclosure sentence for each ladder step that added at least one eligible product, AND for each ladder step whose marker appears on a final pick even if that step added nothing when it ran (a step can add nothing at its turn yet be necessary for a later step's products to qualify). A step that affected neither the eligible set nor any pick SHALL NOT be disclosed. Each sentence follows the template: "Only {n} {plural} matched your {constraint}, so we {action} — your picks are marked." where `{n}` is the number eligible before the step. WHEN `{n}` is 0 the sentence SHALL begin "No {plural} matched your {constraint}". Example: "Only 1 piece matched your Ganesha request, so we broadened it to other religious symbols — your picks are marked."

**[REQ-MC-25] Pick-level markers**
Each pick that is outside the original constraints SHALL carry a marker: `budget-below`, `budget-above`, `symbol-broadened`, `metal-dropped`, or `category-dropped`. A pick priced outside the original band SHALL carry the sentence "Your {symbol} {category} sits just {below|above} your budget at ₹{price}, so we widened the search slightly." (for example "Your Ganesha pendant sits just below your budget at ₹14,249, so we widened the search slightly.").

**[REQ-MC-26] Shortfall note**
WHEN the final result has fewer than 3 picks, the result SHALL include a shortfall note and a browse link. WHEN fewer than 3 in-stock products are listed for the recipient's age band, the note SHALL read "Only {n} pieces in the atelier are listed for {age label}" (for Mom, n = 2).

---

## 7. "Why this one" reasons

**[REQ-MC-27] Template-only reasons**
Every reason SHALL be rendered from a fixed template plus fields of that pick's catalog record or curated-map entry. No reason SHALL be written by an LLM.

**[REQ-MC-28] Reason templates**

| Type | Template | Shown when |
|---|---|---|
| Age fit | "Listed for {age label}" | Always |
| Budget fit | "₹{price} — inside your {band label} budget" | Price is inside the original band |
| Budget fit (relaxed) | "₹{price} — just {below\|above} your {band label} budget" | Price is outside the original band |
| Budget fit (no limit) | "₹{price} — no budget limit set" | `budgetBand = no-limit` |
| Occasion | "Our atelier's pick for {occasion label}" | Occasion points were earned |
| Symbol | "Carries the {symbol} you asked for" | Symbol +3 earned |
| Symbol (broadened) | "A {symbol} piece, in the same family as the {requested} you asked for" | Symbol +1 earned |
| Metal | "{metal label}, as you preferred" | Metal points were earned |
| Rating | "Rated {rating}/5 by customers" | Rating point was earned |

**[REQ-MC-29] Reason count and order**
Each pick SHALL show 2 to 4 reasons: the age-fit reason and one budget-fit reason always; then up to 2 more from occasion/symbol, metal, rating, in that order, taking the first two that apply. Reasons SHALL NOT be padded with generic text.

**[REQ-MC-30] Every reason traceable**
Every reason SHALL cite a catalog field (`age_groups`, `price_inr`, `metal` from `materials`, `rating`) or a curated-map entry (`product-tags.ts`, `occasion-map.ts`) that exists for that pick. A reason for a signal that scored 0 SHALL NOT appear.

---

## 8. Purity and determinism

**[REQ-MC-31] Pure and deterministic**
`lib/matching.ts` SHALL be pure: no I/O, no clock, no randomness, no network, no LLM, no mutation of its inputs. The same model and catalog SHALL return the identical result on every call.

**[REQ-MC-32] No banned content in output**
The result SHALL NOT contain a discount, a strike-through price, or a certification claim (REQ-CD-03, REQ-CD-13).

---

## 9. Golden cases (acceptance; hand-computed; implementation MUST reproduce)

**[REQ-MC-33] Golden case 1: infant naming gift, exact result**
GIVEN `ageBand = infants`, `occasion = naming`, `budgetBand = under-2500`, `metal = silver`, `symbols = any`, `category = any`, the system SHALL return exactly, in order:
1. TBZ-1013 Third Eye tabeez, ₹2,324, rating 5.0
2. TNZ-1056 Blue Evil Eye nazariya bracelet, ₹1,674, rating 4.7
3. TBZ-1017 Swastik tabeez, ₹2,099, rating 3.9

with each pick scoring exactly 6, no relaxation, and no diversity swap. The 6 eligible products are TBZ-1013, TNZ-1056, TBZ-1017, THP-1027, TOB-1008, TPN-1433 (TNZ-1058 excluded as out of stock). Breakdown: TBZ-1013 = 3 occasion + 2 metal + 1 rating + 0 centrality (₹2,324 > ₹2,267.75). TNZ-1056 = 3 + 2 + 1 + 0 (₹1,674 < ₹1,880.25). TBZ-1017 = 3 + 2 + 0 (3.9 < 4.5) + 1 (₹2,099 inside [₹1,880.25, ₹2,267.75]). The remaining three score 2 (THP-1027), 3 (TOB-1008), 2 (TPN-1433). The three 6s are separated by rating: 5.0 > 4.7 > 3.9.

**[REQ-MC-34] Golden case 2: Mom returns exactly two picks**
GIVEN `ageBand = mom`, `occasion = birthday`, `budgetBand = 25000-plus`, `metal = gold`, `symbols = any`, `category = any`, the system SHALL return exactly 2 picks, in order: 1. THP-1001 Blossom Glow Diamond Hoops (₹26,649, score 7), 2. THP-1017 Little Starline Diamond Hoops (₹27,949, score 6). It SHALL include the shortfall note "Only 2 pieces in the atelier are listed for Mom" and the browse link, SHALL NOT add a third pick, and SHALL NOT show a disclosure (no ladder step added a product).

**[REQ-MC-35] Golden case 3: budget widening plus symbol broadening**
GIVEN `ageBand = teens`, `occasion = festival`, `budgetBand = 15000-25000`, `metal = gold`, `symbols = religious`, `symbolList = ['ganesha']`, `category = any`, strict filtering SHALL yield 0 eligible products (TPN-1141 costs ₹14,249, below the band). The ladder SHALL then: widen the budget below (1 eligible: TPN-1141), widen above (still 1), broaden the symbol to other religious symbols (6 eligible). The system SHALL return exactly, in order:
1. TPN-1141 Ganesha (₹14,249), score 9 = 3 occasion + 3 symbol + 2 metal + 1 rating (4.9) + 0 centrality
2. TPN-1147 Sikh (₹15,149), score 7 = 3 + 1 broadened + 2 + 1 (4.8) + 0
3. TPN-1143 Trishul (₹14,399), score 7 = 3 + 1 + 2 + 1 (4.5) + 0

The 7-point tie between TPN-1147, TPN-1143, and TPN-1149 Om (3 + 1 + 2 + 0 rating + 1 centrality, because ₹18,299 sits on the P25 bound) is broken by rating: 4.8 > 4.5 > null. TPN-1145 Cross and TPN-1144 Jain score 6. The result SHALL include the budget disclosure and the symbol disclosure, the pick marker for TPN-1141 ("Your Ganesha pendant sits just below your budget at ₹14,249, so we widened the search slightly."), `budget-below` on TPN-1141 and TPN-1143, and `symbol-broadened` on TPN-1147 and TPN-1143. All 3 picks are pendants, and no different-category alternative exists, so the diversity rule does not swap.

---

## 10. Property-test invariants

Each SHALL hold for every recipient model generated by fast-check (all age bands, budget bands, metals, symbol modes, categories, occasions), against the real catalog.

**[REQ-MC-36] I1 In stock.** Every returned pick is In Stock. *(REQ-CD-25)*
**[REQ-MC-37] I2 Age.** Every returned pick lists the recipient's age band.
**[REQ-MC-38] I3 Budget or disclosed.** Every returned pick is inside the original band, OR the result discloses the budget relaxation and the pick carries `budget-below` or `budget-above`.
**[REQ-MC-39] I4 Religious opt-in.** No returned pick is religious unless `symbols` is `any`, `religious`, or a `symbolList` entry; and under `none-religious` no pick is religious, relaxed or not.
**[REQ-MC-40] I5 Exactly three.** The result has exactly 3 picks whenever at least 3 products are eligible after the ladder; it never has more than 3, and never has duplicate SKUs.
**[REQ-MC-41] I6 Determinism.** Calling the function twice with equal input returns deep-equal output, and the input is unchanged.
**[REQ-MC-42] I7 Reasons are grounded.** Every reason for a pick cites a catalog field or curated-map entry that exists for that pick, and no reason appears for a signal that scored 0.
