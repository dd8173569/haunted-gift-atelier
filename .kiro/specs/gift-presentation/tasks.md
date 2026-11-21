# Gift Presentation — Tasks

*Implements `requirements.md` (REQ-GP-01 to REQ-GP-41) per `design.md`. Tasks in one wave touch different files and can run in parallel. A wave starts only when the previous wave's checks pass. Prerequisites: `catalog-data`, `matching-core`, `conversation`, `safety-verdict`, and `true-size-viewer` are done: `computeVerdict`, `SafetyVerdict`, `buildSizeSpec`, `TrueSizeViewer`, `parseModelParam`, `modelHref`, `lib/catalog-store.ts`, `AtelierButton` with `external`, `PriceFootnote`, `ProductPhoto`, `tests/helpers/dom.ts`. This spec changes none of `lib/matching.ts`, `lib/matching/*`, `lib/catalog.ts`, `data/catalog.json`, or `data/*.ts`, and does not change what `match()` returns; any task that seems to need that is a spec question, not an edit.*

*Before writing the route (Wave 3), re-read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` and `dynamic-routes.md` (promise `params`, Cache Components with `generateStaticParams`), `02-route-segment-config/dynamicParams.md`, `04-functions/not-found.md`, and `04-functions/generate-static-params.md` (design §6.1). AGENTS.md: this Next.js version has breaking changes. Before writing `GiftWrap`, re-read the `'use client'` guide under `01-app/`.*

*Common checks, run at the end of every wave unless the wave says otherwise:* `npm test`, `npm run typecheck`, `npm run lint`. The existing tests stay green throughout, including the three golden cases and the property tests of every spec.

## Wave 1 — Pure logic (3 parallel tasks, then 1 test task)

- [ ] **T1.1 Gift message** `lib/gift-message.ts` per design §3: constants, `giftContext`, `draftMessage` (4 lines, salutation and occasion tables, curly-quoted name), `presentationFor` (table of §3.2). Imports `Relationship`, `Occasion`, `RecipientModel` as types only. No React, no I/O, no clock, no randomness. Unit tests `tests/gift-message.test.ts`: every salutation and occasion line; the exact draft for (niece-nephew, naming, "Third Eye Protection - Tabeez, blessed by Lord Shiva, a shield of divine protection.") and for (null, null, "Gold with Diamond Om Pendant"); name with a trailing full stop kept verbatim; `presentationFor` rows; `WRAP_REVEAL_MS + CARD_FADE_MS ≤ WRAP_REVEAL_MAX_MS ≤ 3000`. *(REQ-GP-15, 18, 21, 22, 23)*
- [ ] **T1.2 Piece view** `lib/piece-view.ts` per design §2: `Fact`, `PieceView`, `toPieceView` with the ordered rows, Chain and Rating only when non-null, labels through `METAL_LABEL` and `AGE_GROUP_LABEL`. Unit tests `tests/piece-view.test.ts`: TPN-1149 (Chain row present, no Rating row), TNZ-1056 (no Chain row, Rating "4.7/5 (3 reviews)", Materials "925 Silver"), THP-1027 (neither row), TNZ-1058 (Availability "Out of stock", `inStock` false); no value from `mrp_inr`, `claims`, `design_application_no`, `sku_extra`. *(REQ-GP-05)*
- [ ] **T1.3 `pieceHref`** in `lib/model-param.ts` per design §4 (new export only; the existing exports and tests are untouched). Tests added to `tests/model-param.test.ts`: `pieceHref("TBZ-1013")` is `/piece/TBZ-1013`; with the golden-1 model it starts `/piece/TBZ-1013?m=` and `parseModelParam` of the decoded value returns the model. *(REQ-GP-10)*
- [ ] **T1.4 Property tests** (after T1.1 to T1.3): `tests/gift-message.property.test.ts` for P-GP-2, P-GP-3, P-GP-7, P-GP-8; `tests/piece-view.property.test.ts` for P-GP-5; P-GP-6 added to `tests/model-param.test.ts` or a new `tests/model-param.property.test.ts`. Seeded, `numRuns ≥ 200`. A counterexample is logged in the evidence log with its fix; the test is never loosened. *(REQ-GP-34, 35, 37, 38, 39, 40)*

Check: `npx vitest run tests/gift-message tests/piece-view tests/model-param`, then common checks, and coverage of `lib/gift-message.ts` and `lib/piece-view.ts` ≥ 80% (`npx vitest run --coverage --coverage.include='lib/{gift-message,piece-view,model-param}.ts'`, then confirm no `coverage/` directory is left behind).

## Wave 2 — Components (3 parallel tasks)

- [ ] **T2.1 Gift wrap** `components/GiftWrap.tsx` (`'use client'`) per design §5, plus the four wrap classes and keyframes in `app/globals.css` per §5.3 (transform and opacity only; the reduced-motion block; no colour added). Props `{ name, url, initialMessage, presentation }`. Phases, timer effect with `setState` inside the timeout callback, reduced-motion read in the click handler, "Skip", status lines, the presentation card, the editor (`maxLength` 500, label, "Reset to draft", "Copy message", privacy line), the buy `AtelierButton external` in all phases (secondary before reveal, primary after). Tokens only; no `<img>`, no `fetch`, no storage, no `<form`. *(REQ-GP-14 to 25, 29, 30)*
- [ ] **T2.2 Facts component** `components/PieceFacts.tsx`: renders `PieceView.facts` as a `<dl>` with `data-source` on each `<dt>`/`<dd>` pair. Presentational, server-renderable. Tokens only. *(REQ-GP-05)*
- [ ] **T2.3 Card links** edit `components/PickCard.tsx` (optional `detailHref?: string`; a secondary `AtelierButton` "See details" above the buy button when given) and `components/BrowseCard.tsx` ("See details" to `pieceHref(item.sku)` on every card, out-of-stock included; the out-of-stock card keeps its muted surface and gets no buy control). Update the comment in `PickCard.tsx` that says "No link to /piece/[sku] in this milestone (REQ-CV-33)" to point at REQ-GP-10. Do not change the buy links or any text the existing tests assert. *(REQ-GP-10, 11, 12)*

Tests (jsdom, each file starts `// @vitest-environment jsdom` and imports `tests/helpers/dom.ts`):
- `tests/gift-wrap.ui.test.tsx` with `vi.useFakeTimers()`: idle shows "Wrap this gift", the buy link, no textarea, no card; click → `aria-busy="true"` and "Wrapping your gift…"; at 2399 ms still wrapping; at 2400 ms revealed (card heading, textarea prefilled with `initialMessage`, "Your gift is wrapped"); "Skip" reaches revealed at 0 ms; with `window.matchMedia` stubbed to `matches: true`, click goes straight to revealed; typing in the textarea changes the card text in the same render; "Reset to draft" restores `initialMessage`; `maxLength` is 500; "Copy message" with `navigator.clipboard.writeText` mocked resolves to "Copied", and with it undefined or rejecting shows "Select the text and copy it yourself." without throwing; the buy link `href` equals `url` in all three phases for all 22 catalog URLs (including the percent-encoded TPN-1459, TNZ-1058, TNZ-1056 and the comma URL TBZ-1013), with `target="_blank"` and `rel` containing `noopener`; spies on `fetch`, `XMLHttpRequest.prototype.open`, and `Storage.prototype.setItem` are never called; the component has no `<img>`. *(REQ-GP-14 to 25; P-GP-1, P-GP-4)*
- `tests/piece.links.ui.test.tsx`: `PickCard` with `detailHref` renders "See details" with that exact `href`, and the buy link is unchanged; without the prop there is no "See details"; `BrowseCard` renders `/piece/<sku>` for an in-stock item and for TNZ-1058, and the TNZ-1058 card still has no `a[href^="https://www.tinytiaraa.com"]` and no "Buy on Tiny Tiaraa". *(REQ-GP-10, 11)*

Check: `npx vitest run tests/gift-wrap tests/piece.links`, then common checks.

## Wave 3 — The route (2 parallel tasks, then tests)

- [ ] **T3.1 Detail page** `app/piece/[sku]/page.tsx` per design §6: `generateStaticParams` over `catalog.products`; await `params` then `searchParams`; `notFound()` right after the lookup, outside any `try/catch`; `parseModelParam(sp.m)` where `missing` and `invalid` both mean no recipient (no redirect); `toPieceView`, `computeVerdict(product, catalog, band)`, `buildSizeSpec`, `giftContext`, `draftMessage`, `presentationFor`; layout of §6 (header text wordmark, back link via `modelHref('/picks', model)` or `/atelier`, title block with `data-price-region` and `PriceFootnote`, "Out of stock" badge from `availability`, `ProductPhoto` with its caption "Photo as listed — shown enlarged, not to scale.", `PieceFacts`, `SafetyVerdict`, `TrueSizeViewer`, then `GiftWrap` for in-stock or the out-of-stock note with a browse link); `print:hidden` on every section except the viewer's own print sheet. Edit `app/picks/page.tsx` only to pass `detailHref={pieceHref(v.sku, model)}` to each `PickCard`. No `match()` call in the new page. *(REQ-GP-01 to 09, 10, 13)*
- [ ] **T3.2 Not-found UI** `app/piece/[sku]/not-found.tsx` per design §6.2: header, "We couldn't find that piece.", "Browse the atelier" and "Find a gift" links. *(REQ-GP-02)*

Tests:
- `tests/piece.route.test.tsx` (node environment, `renderToStaticMarkup` from `react-dom/server`; `next/image` and `next/link` mocked as in the component tests if the environment needs it): `PiecePage` with `sku: "NOPE-0000"` rejects with the Next.js not-found error; with `sku: "TNZ-1056"` and no `m` the markup contains the exact fit-check line, "No recipient selected — age fit shown against all listed age groups", the exact approximate-size label once and no other `true size`, "Wrap this gift", and a buy `href` equal to the catalog URL; with the golden-1 model as `m` it contains "Listed by Tiny Tiaraa for infants 0–3 years" for TBZ-1013; an invalid `m` renders like no `m`; `sku: "TNZ-1058"` contains "Out of stock", no `tinytiaraa.com/product` href, no "Buy on Tiny Tiaraa", no "Wrap this gift", and still the fit-check line. If rendering the full page in Vitest is impractical, keep the not-found and prop-building assertions and rely on the Wave 4 dev-server checks for the rendered HTML (design §9). *(REQ-GP-01 to 09; P-GP-9)*
- `tests/gift-presentation.static.test.ts` per design §9: CSS durations versus the constants; purity of `lib/gift-message.ts` and `lib/piece-view.ts`; `GiftWrap` has no `fetch`, `XMLHttpRequest`, `localStorage`, `sessionStorage`, `<form`, `<img`, `catalog.json`, `catalog-store`; the new page imports `lib/matching` nowhere; no `#hex`, `rgb(`, `[#` in `components/` or `app/` (the check from `conversation.static.test.ts` already covers this; this test adds the new files); no `app/api/` directory; no LLM client import; no discount words (`/% off|save ₹|MRP|was ₹/i`) in the new components. *(REQ-GP-16, 19, 27, 28, 29; P-GP-10)*

Check: common checks; `npx vitest run tests/piece tests/gift`; `npm run lint` clean on the new files.

## Wave 4 — End-to-end check (serial; dev server, build, QA)

Run the steps in order. The dev server runs on port 3115 and is killed at the end. `curl` output is stripped of `<script>` blocks (the RSC payload repeats props), counts use `grep -o | wc -l` because the HTML is one line, and patterns avoid the apostrophe (React escapes it).

```
cd <repo root>
npm run dev -- --port 3115 > /tmp/dev-gp.log 2>&1 &  echo $! > /tmp/dev-gp.pid
until grep -q "Ready" /tmp/dev-gp.log; do sleep 1; done
P=http://localhost:3115
strip() { perl -0pe 's/<script.*?<\/script>//gs'; }
URL=$(node -e 'console.log(require("./data/catalog.json").products.find(p=>p.sku==="TNZ-1056").url)')
M=$(node -e 'console.log(encodeURIComponent(JSON.stringify({relationship:"niece-nephew",ageBand:"infants",ageYears:0,occasion:"naming",budgetBand:"under-2500",metal:"silver",symbols:"any",category:"any"})))')

# 1. TNZ-1056: verdict + viewer + wrap + buy link
curl -s -o /dev/null -w "%{http_code}\n" $P/piece/TNZ-1056                                          # 200
H=$(curl -s $P/piece/TNZ-1056 | strip)
grep -o "Check this" <<<"$H" | wc -l                                                                # ≥ 1
grep -o "A fit check from the atelier — guidance, not a safety certification." <<<"$H" | wc -l      # 1
grep -o "No certifications are stated on this product" <<<"$H" | wc -l                              # 1
grep -o "No recipient selected — age fit shown against all listed age groups" <<<"$H" | wc -l       # 1
grep -o "Approximate size — calibrate with a card for true size." <<<"$H" | wc -l                   # 1
grep -o -i "true[- ]size" <<<"$H" | wc -l                                                           # 1 (inside that label only)
grep -o "Wrap this gift" <<<"$H" | wc -l                                                            # 1
grep -F -o "href=\"$URL\"" <<<"$H" | wc -l                                                          # 1 (the buy link)
grep -o "Out of stock" <<<"$H" | wc -l                                                              # 0

# 2. With a recipient: the band reaches the verdict
curl -s "$P/piece/TBZ-1013?m=$M" | strip | grep -o "Listed by Tiny Tiaraa for infants 0–3 years" | wc -l   # 1

# 3. Out-of-stock piece
H=$(curl -s $P/piece/TNZ-1058 | strip)
grep -o "Out of stock" <<<"$H" | wc -l                                                              # ≥ 1
grep -o "tinytiaraa.com/product" <<<"$H" | wc -l                                                    # 0
grep -o "Buy on Tiny Tiaraa\|Wrap this gift" <<<"$H" | wc -l                                        # 0

# 4. Unknown SKU
curl -s -o /tmp/nope.html -w "%{http_code}\n" $P/piece/NOPE-0000                                    # 404 (record 200 + noindex if the root Suspense wins, design Q15)
grep -o "find that piece" /tmp/nope.html | wc -l                                                    # ≥ 1
grep -o "noindex" /tmp/nope.html | wc -l                                                            # ≥ 1

# 5. /picks golden 1 unchanged, no detail content, links in order
curl -s "$P/picks?m=$M" | strip | grep -o '/piece/[A-Z]\{3\}-[0-9]\{4\}' | awk '!s[$0]++'           # /piece/TBZ-1013, /piece/TNZ-1056, /piece/TBZ-1017 in that order
curl -s "$P/picks?m=$M" | strip | grep -o "Fit check\|Size on your screen\|Wrap this gift" | wc -l   # 0
curl -s "$P/picks?m=$M" | strip | grep -o "Buy on Tiny Tiaraa" | wc -l                              # 3

# 6. /atelier still has 21 buy links and a "See details" link on all 22 cards
curl -s $P/atelier | strip | grep -o "Buy on Tiny Tiaraa" | wc -l                                   # 21
curl -s $P/atelier | strip | grep -o 'href="/piece/[A-Z]\{3\}-[0-9]\{4\}"' | wc -l                   # 22

kill $(cat /tmp/dev-gp.pid); rm -f /tmp/dev-gp.pid /tmp/dev-gp.log /tmp/nope.html
```

- [ ] **T4.1 Dev-server checks** above all pass (or the 404 status is recorded as Q15 with its real value). Paste the observed numbers into the evidence log.
- [ ] **T4.2 Whole suite** (after the dev server is killed): `npm test` green (golden cases 1 to 3, the personas, and every new test), `npm run typecheck` clean, `npm run lint` clean, `npm run validate-catalog` OK, and `npm run build` succeeds (this proves `generateStaticParams`, the promise `params`, and the root `Suspense` fit Cache Components; any build error is a spec question, Q19). Coverage: `lib/gift-message.ts`, `lib/piece-view.ts`, `lib/model-param.ts` ≥ 80%; no `coverage/` directory left behind.
- [ ] **T4.3 Physical checks** (a human, with a card and a ruler; the numbers go in `docs/qa-reports/true-size-m3.md`): REQ-TS-30 on `/piece/TPN-1459` (box 18.6 mm ± 5%), `/piece/TNZ-1056` (ring Ø about 42.5 mm ± 5%), calibration under 15 seconds, the 1:1 print sheet; once on a phone and once on a desktop screen. If no human is available, the report records "not run" for these lines and the evidence log says so; the automated tests do not stand in for them.
- [ ] **T4.4 QA audit** by the read-only `qa-auditor` agent, writing `docs/qa-reports/gift-presentation-m3.md` (it never fixes code): every fact on `/piece/[sku]` for all 22 SKUs against `data/catalog.json` (use the catalog MCP `catalog_get`); every buy `href` against the catalog `url`; no discount or MRP; no "safe" or "unsafe"; no certification term outside `claims[]`; TNZ-1058 has no buy control; no `#hex` in components; golden 1 through `matching_explain`; the approximate-size label rule on all 22 pages. Fixes happen in a separate pass.
- [ ] **T4.5 Evidence log and steering** in `docs/kiro-evidence-log.md`: a session entry for the three Milestone 3 specs (files with line counts, test counts, property counterexamples and fixes, the dev-server numbers of T4.1, the build result, the agent runs), the supersession of REQ-CV-33 (design §7), the resolution of M2 OQ-2 (see `safety-verdict` T4.3), and the open questions Q1 to Q22 of the three design documents for the Tue 24 Nov checkpoint. Update `.kiro/steering/structure.md` to list the new `lib/` files (`safety*.ts`, `true-size.ts`, `size-spec.ts`, `gift-message.ts`, `piece-view.ts`) and components only if the builder approves.

## Done when

`/piece/[sku]` serves the safety card, the viewer, the wrap, the facts, and the buy link for all 22 SKUs and the not-found UI for anything else; TNZ-1058 shows "Out of stock" with no buy control and no wrap; `/picks` still returns golden case 1 exactly (TBZ-1013, TNZ-1056, TBZ-1017) and now links each card to its detail page; `npm test`, `npm run typecheck`, `npm run lint`, `npm run validate-catalog`, and `npm run build` pass; no dev server, temp file, or `coverage/` directory remains; and the open questions are in the evidence log for the builder.
