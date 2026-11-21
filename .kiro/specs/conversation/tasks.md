# Conversation — Tasks

*Implements `requirements.md` (REQ-CV-01 to REQ-CV-60) per `design.md`. Tasks in one wave touch different files and can run in parallel. A wave starts only when the previous wave's checks pass. Prerequisites: `catalog-data` and `matching-core` are done (`parseCatalog`, `match()`, `RecipientModel`, `formatInr`). This spec changes none of `lib/matching.ts`, `lib/matching/*`, `lib/catalog.ts`, `data/catalog.json`, or `data/*.ts`; any task that seems to need that is a spec question, not an edit.*

*Before writing any route or client component, re-read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (`searchParams`), `04-functions/redirect.md`, `04-functions/use-search-params.md`, and `02-guides/single-page-applications.md` (design §7). AGENTS.md says this Next.js version has breaking changes.*

*Common checks, run at the end of every wave unless the wave says otherwise:* `npm test`, `npm run typecheck`, `npm run lint`. The existing 225 tests stay green throughout.

## Wave 1 — Pure logic (4 parallel tasks, no React)

- [ ] **T1.1 Conversation state machine** in `lib/conversation.ts` per design §2: chip tables (`RELATIONSHIP_CHIPS`, `AGE_CHIPS`, `OCCASION_CHIPS`, `BUDGET_CHIPS`, `METAL_CHIPS`, `SYMBOL_CHIPS`, `SYMBOL_SUBCHIPS`, `CATEGORY_CHIPS`), runtime enum lists with compile-time exhaustiveness checks, question definitions and prompts, `applicable`, `normalize`, `reduce`, `toModel`, `validateModel`, `stateFromModel`, `chipForYears`, `describeModel`, `momSkipNote`. It imports the `RecipientModel` type and never redefines it. No React, no I/O, no clock, no randomness. *(REQ-CV-01 to 17, REQ-CV-46)*
- [ ] **T1.2 Model transport** in `lib/model-param.ts` per design §3: `MODEL_PARAM = 'm'`, `MAX_PARAM_LENGTH = 1000`, `encodeModelParam`, `modelHref`, `parseModelParam` (missing / invalid / ok, never throws). Depends on `validateModel` from T1.1 (write against its signature; wire in when T1.1 lands). *(REQ-CV-18 to 22)*
- [ ] **T1.3 Picks view** in `lib/picks-view.ts` per design §5: `PickView`, `MARKER_LABEL`, `toPickViews` with the three loud failures (SKU not in catalog, not In Stock, more than 3 or duplicate SKUs). *(REQ-CV-23, 25, 29, 30)*
- [ ] **T1.4 Browse logic** in `lib/browse.ts` per design §6: `BrowseItem`, `BrowseFilters`, `toBrowseItems`, `parseBrowseFilters`, `filterItems`, `filtersToQuery`, option labels (reuse `AGE_GROUP_LABEL`, `BAND_LABEL`, `METAL_LABEL`, `CATEGORY_LABEL` from `lib/matching/templates.ts`). *(REQ-CV-34 to 37)*

Tests written with each task (node environment):
- `tests/conversation.test.ts`: every chip table against REQ-CV-04; each reducer transition; Mom skips age and piece; adult + No ends at `adult-end` with no model; adult + Yes continues as Mom; Religious → Zodiac clears `symbolList`; Back never changes answers; edit returns to the card, and asks a new question first when branching changed; `toModel` canonical key order and omitted optional keys; `validateModel` rejects an unknown key, a wrong type, `symbolList` without `religious`, `ageYears` of -1, 19, `NaN`, a mismatch with `ageBand`, `relationship = 'mom'` with a non-mom band and the reverse; `momSkipNote` against the real catalog ("Only earrings are listed for Mom, so we skipped the piece question.") and against a fixture with two Mom categories.
- `tests/model-param.test.ts`: the golden 1 model encodes to the example string in design §3; repeated `m`, 1,001-character value, `{`, `null`, `[]`, `"x"`, an extra key all give `invalid`; `undefined` and `''` give `missing`.
- `tests/picks-view.test.ts`, `tests/browse.test.ts`: the three golden models, a forged `MatchResult` with an unknown SKU, with TNZ-1058, and with 4 picks (each must throw); 22 items with 21 in-stock first; every boundary of `parseBrowseFilters`.
- `tests/conversation.property.test.ts`: P-CV-1 to P-CV-9, P-CV-11 (logic part), P-CV-12, P-CV-13, seed fixed, `numRuns ≥ 200` (P-CV-4 and P-CV-9 ≥ 500).
- `tests/conversation.static.test.ts`: the grep tests of design §10.2 for the four new `lib/` files (the `components/` and `app/` greps run now and pass vacuously for the files that exist; they bite as later waves add files).

Check: `npm test`, `npm run typecheck`, `npm run lint` pass; `lib/conversation.ts`, `lib/model-param.ts`, `lib/picks-view.ts`, `lib/browse.ts` at ≥ 80% line coverage (`npx vitest run --coverage --coverage.include='lib/{conversation,model-param,picks-view,browse}.ts'`, then confirm no `coverage/` directory is left behind).

## Wave 2 — `/find`: conversation and recipient card (install first, then 4 parallel tasks)

- [ ] **T2.0 Install component-test dependencies** (serial, first): `npm install --save-dev @testing-library/react @testing-library/jest-dom jsdom`. `package.json` and `package-lock.json` change only to add these three. Do NOT change `environment: "node"` in `vitest.config.ts`. Add `tests/helpers/dom.ts` (`import '@testing-library/jest-dom/vitest'`; `afterEach(cleanup)`). Each `.tsx` test starts with the docblock `// @vitest-environment jsdom` and imports the helper (design §10.1). Prove it: a 5-line `tests/dom-env.test.tsx` renders `<button aria-pressed="true">x</button>` and asserts `toHaveAttribute('aria-pressed','true')`, while `npm test` still runs the 225+ node tests unchanged. Keep this test file (it guards the setup). If the docblock does not take effect under the installed Vitest, apply the `test.projects` fallback from design §10.1 in this task and note it in the evidence log.
- [ ] **T2.1 Chip and progress components**: `components/ChipGroup.tsx` (button per chip, `aria-pressed`, `role="group"`, 44 px targets, single or multi) and `components/ProgressMoon.tsx` (crescent SVG as in `app/page.tsx`, `text-gold`, text equivalent "Question n of 6"). Tokens only. *(REQ-CV-02, 48, 50)*
- [ ] **T2.2 Recipient card**: `components/RecipientCard.tsx` per design §4 (headline, lines with Edit buttons, mom note, "Reveal my picks" as `AtelierButton href={modelHref('/picks', model)}`, Back). *(REQ-CV-14 to 17)*
- [ ] **T2.3 Conversation**: `components/Conversation.tsx` (`'use client'`, `useReducer(reduce, init)`, all screens of design §4, the `notice` note, focus moves to the new prompt heading on each step change). Depends on T2.1 and T2.2 for imports, so write after them or together. *(REQ-CV-01 to 13, 16, 22, 50)*
- [ ] **T2.4 `/find` route**: replace the M1 shell `app/find/page.tsx` with the async server component of design §4 (awaits `searchParams`, parses `m`, passes `initialModel`, `notice`, and `momNote = momSkipNote(catalog)`). Add `lib/catalog-store.ts` (`export const catalog = parseCatalog(raw as unknown as RawCatalog)`; no other logic). Keep the existing header/brand text style; "Tiny Tiaraa" stays a text wordmark. *(REQ-CV-20, 22, 47)*

Tests:
- `tests/conversation.flow.test.tsx` (jsdom): tap all 6 questions → card shows the headline "A naming gift for your niece or nephew, 0–1 years" and 7 Edit buttons; the "Reveal my picks" link `href` starts `/picks?m=` and decodes to the golden-1 model; the five conversational prompts match PRD §4 verbatim; religious sub-chips absent until "Religious" is tapped and gone after "Zodiac"; Mom path never shows question 6 or the age question and shows the mom note; adult + No shows the exact message and a link to `/atelier` and renders no "Reveal my picks"; Back keeps the earlier chip pressed; Edit on the budget line returns to the card with the new value; changing Mom → Grandchild from the card asks the age question before returning to the card; `notice="incomplete"` shows the note; no `<input type="text">` and no `<textarea>` in the tree (REQ-CV-01, 44).
- Static test (Wave 1 file) now covers the new components: no hex, no `catalog.json` import.

Checks: common checks; then the dev-server check (kill the server afterwards, never leave it running):
```
npm run dev -- --port 3111 > /tmp/dev.log 2>&1 &   # note the PID, wait until "Ready"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/find                      # 200
curl -s http://localhost:3111/find | grep -c "Who are we finding a gift for?"            # 1
curl -s "http://localhost:3111/find?notice=incomplete" | grep -c "start again"           # 1
curl -s "http://localhost:3111/find?m=$(node -e 'console.log(encodeURIComponent(JSON.stringify({relationship:"niece-nephew",ageBand:"infants",ageYears:0,occasion:"naming",budgetBand:"under-2500",metal:"silver",symbols:"any",category:"any"})))')" | grep -c "Reveal my picks"   # ≥ 1
kill <PID>
```
Remove `/tmp/dev.log` afterwards.

## Wave 3 — `/picks`: cards, reasons, buy links (3 parallel tasks)

- [ ] **T3.1 External button**: add the optional `external` prop to `components/AtelierButton.tsx` (design §8): `target="_blank"`, `rel="noopener noreferrer"`, `href` untouched. Existing usages render identically (a test pins the non-external output). *(REQ-CV-32)*
- [ ] **T3.2 Pick card and disclosure note**: `components/PickCard.tsx` and `components/DisclosureNote.tsx` per design §5: `data-price-region`, `ProductPhoto` with no overlay, name verbatim, `formatInr`, `PriceFootnote`, rating only when non-null, marker labels, `relaxationNote`, the reasons list, the external buy button. No link to `/piece/[sku]`. *(REQ-CV-26 to 33)*
- [ ] **T3.3 `/picks` route**: new `app/picks/page.tsx` per design §5: await `searchParams`; `missing` → `redirect('/find')`; `invalid` → `redirect('/find?notice=incomplete')` (both outside `try/catch`); `match()` called here and nowhere else; `toPickViews`; headline from `describeModel`; `DisclosureNote`; cards; `shortfallNote` plus browse `AtelierButton`; "Change my answers" to `modelHref('/find', model)`. *(REQ-CV-17, 20 to 24, 33)*

Tests (`tests/picks.ui.test.tsx`, jsdom):
- Render `PickCard` for the golden-1 views: 3 cards in order TBZ-1013, TNZ-1056, TBZ-1017; each shows its catalog name verbatim, `₹2,324` / `₹1,674` / `₹2,099`, the footnote text exactly, 2–4 reasons equal to the `match()` texts, an `<img>` whose `src` resolves to `/catalog/<image_file>` (via the `next/image` URL or a `vi.mock` of `next/image` to a plain `<img>`), alt equal to the name, no element positioned over the photo, and a buy link whose `href` equals the catalog `url` exactly, with `target="_blank"` and `rel` containing `noopener`.
- Golden 3: the relaxation sentence for TPN-1141 and the labels "Just below your budget" and "A related symbol" appear; both disclosure sentences appear verbatim in `DisclosureNote`.
- Golden 2: 2 cards, the shortfall text, the browse link, no third card.
- P-CV-10 (price regions and banned words) over `PickCard` for all 21 in-stock products.
- The static grep: no `app/api/` directory, no LLM client import anywhere (REQ-CV-43).

Checks: common checks; dev-server check (port 3111 again, kill after):
```
M=$(node -e 'console.log(encodeURIComponent(JSON.stringify({relationship:"niece-nephew",ageBand:"infants",ageYears:0,occasion:"naming",budgetBand:"under-2500",metal:"silver",symbols:"any",category:"any"})))')
curl -s "http://localhost:3111/picks?m=$M" | grep -o "TBZ-1013\|Third Eye[^<]*\|₹2,324" | head   # golden-1 pick 1 text present
curl -s "http://localhost:3111/picks?m=$M" | grep -c "Price as listed on tinytiaraa.com on 21 Nov 2026"   # 3
curl -s "http://localhost:3111/picks?m=$M" | grep -c "Buy on Tiny Tiaraa"                                # 3
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3111/picks                       # 307 …/find
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3111/picks?m=%7Bnope"           # 307 …/find?notice=incomplete
```
Read the product names and prices in the HTML against `data/catalog.json` by hand for the three golden-1 SKUs. (The product names come from the catalog, so grep for the verbatim `name` strings rather than the guesses above if they differ.)

## Wave 4 — `/atelier`: browse grid and filters (3 parallel tasks)

- [ ] **T4.1 Browse card**: `components/BrowseCard.tsx` per design §6: photo, name, price, category · metal, rating only when listed, buy link for in-stock, and for out-of-stock the muted surface (`bg-plum/5 text-plum/50`), the "Out of stock" badge beside the name, no buy control, no filter or opacity on the photo. Derived from `availability`, never from a SKU. *(REQ-CV-38, 39)*
- [ ] **T4.2 Catalog grid**: `components/CatalogGrid.tsx` (`'use client'`) per design §6: four `ChipGroup` filters with "All", result count, `history.replaceState` URL mirror (no `useSearchParams`), empty state with "Clear filters", one `PriceFootnote` above the cards inside one `data-price-region`. Reuses `ChipGroup` from T2.1. *(REQ-CV-34 to 37, 39)*
- [ ] **T4.3 `/atelier` route**: replace the M1 shell `app/atelier/page.tsx`: async server component, `parseBrowseFilters(await searchParams)`, `toBrowseItems(catalog)`, `<CatalogGrid>`. Keep the "← Back to the atelier" style header link to `/`. *(REQ-CV-34, 36)*

Tests (`tests/atelier.ui.test.tsx`, jsdom):
- 22 cards render with no filter; exactly 1 card has the "Out of stock" text, it is TNZ-1058, it has no `a[href^="https://www.tinytiaraa.com"]` and no buy text, and its `<img>` has no `style` or class that sets `opacity`, `filter`, or `grayscale`; the 21 others each have a buy link equal to their catalog `url`.
- Filters: Infants → only products whose `age_groups` include "Infants 0-3 years"; Pendant + 18KT gold + ₹15,000–₹25,000 → the expected SKUs computed independently from the catalog; a combination with no match shows "No piece matches those filters." and "Clear filters" restores 22; initial filters from props (as parsed from `?metal=silver`) pre-select the chip; tapping a chip calls `history.replaceState` with the query from `filtersToQuery`.
- Ratings: a card shows its `rating` string only when non-null (TPN-1141 shows its rating; a null-rating SKU shows none).
- P-CV-10 for the grid; P-CV-11 render part (OOS never has a buy link for every single-filter combination).

Checks: common checks; dev-server check:
```
curl -s http://localhost:3111/atelier | grep -c "Buy on Tiny Tiaraa"                 # 21
curl -s http://localhost:3111/atelier | grep -c "Out of stock"                         # ≥ 1
curl -s "http://localhost:3111/atelier?metal=silver&category=bracelet" | grep -c "TNZ-"   # compare with the catalog by hand
curl -s "http://localhost:3111/atelier?metal=junk" | grep -c "Buy on Tiny Tiaraa"      # 21 (invalid → All)
```

## Wave 5 — Integration and acceptance (parallel)

- [ ] **T5.1 Golden cases through the UI**: `tests/journey.golden.test.tsx` (jsdom). For golden cases 1–3, tap through `Conversation` (Testing Library), read the "Reveal my picks" `href`, decode `m`, run `parseModelParam` → `match()` → `toPickViews`, render the cards, and assert SKU order, scores (from `match()` output), disclosures, shortfall note, and the TPN-1141 sentence against the values in REQ-CV-40 and `matching-core` REQ-MC-33 to 35. The test fails if any value drifts; never loosen it (tech steering). *(REQ-CV-40)*
- [ ] **T5.2 Personas**: in the same file, the 8 personas and the 3 flow cases of design §12, each by taps. Expected values equal those in `tests/matching.personas.test.ts`. Persona 3 asserts TNZ-1058 absent; persona 8 asserts no religious SKU. *(REQ-CV-41)*
- [ ] **T5.3 Time and taps**: a test counts the taps for golden 1 (8) and golden 3 (8 + Ganesha + Continue = 10) against REQ-CV-08. Then a manual timed run of golden 1 against the dev server, under 2 minutes with the LLM off, recorded in the evidence log with the time. *(REQ-CV-08)*
- [ ] **T5.4 Whole-suite and build**: `npm test`, `npm run typecheck`, `npm run lint`, `npm run validate-catalog`, and `npm run build` all pass (the build proves no missing-Suspense or prerender error). Coverage: `lib/conversation.ts`, `lib/model-param.ts`, `lib/picks-view.ts`, `lib/browse.ts` ≥ 80% lines; no `coverage/` directory left behind.
- [ ] **T5.5 QA audit and evidence log**: invoke the read-only `qa-auditor` agent on the milestone: UI text against `catalog.json`, golden cases through `matching_explain`, footnote on every price, no OOS buy control, no hex in components. It writes `docs/qa-reports/conversation-m2.md`; fixes happen in a separate pass. Add a session entry to `docs/kiro-evidence-log.md`: files with line counts, test counts, any property counterexample with its fix, the dependency install, the `test.projects` fallback if it was used, and the unresolved questions of design §13. Update `.kiro/steering/structure.md` to list `lib/catalog-store.ts`, `lib/model-param.ts`, `lib/picks-view.ts`, `lib/browse.ts` only if the builder approves open question Q6.

## Done when

`npm test` passes every conversation test with the 225 existing matching and catalog tests unchanged; golden cases 1–3 and the 8 personas reproduce through the UI flow with the exact SKUs, order, and scores; C1–C9 hold over the generated inputs; `/find`, `/picks`, `/atelier` respond as the dev-server checks expect; `npm run build` succeeds; no dev server, temp log, or `coverage/` directory remains; and the open questions of design §13 are in the evidence log for the builder.
