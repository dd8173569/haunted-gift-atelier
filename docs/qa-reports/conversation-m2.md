# QA report: conversation spec, Milestone 2 (Wave 5, T5.5)

Role: qa-auditor (read-only on code). Scope: `/find`, `/picks`, `/atelier`, `lib/conversation.ts`, `lib/model-param.ts`, `lib/picks-view.ts`, `lib/browse.ts`, `lib/catalog-store.ts`.
Audited state: Waves 1 to 4 plus `tests/journey.golden.test.tsx` (T5.1 to T5.3). One build fix made during T5.4 before the audit is listed under "Changes made outside the audit".

## Checks run

| Check | Result |
|---|---|
| `npm test` | pass: 22 files, 455 tests (436 before Wave 5, plus 19 in `tests/journey.golden.test.tsx`) |
| `npm run typecheck` | pass |
| `npm run lint` | pass: 0 errors, 1 warning (`AgeBand` unused in `packages/mcp-catalog/src/index.ts`, outside this milestone) |
| `npm run validate-catalog` | pass: 22 products, 2 warnings (TNZ-1058 and TNZ-1056 width "not stated on the listing") |
| `npm run build` | pass after the fix below; routes `/`, `/_not-found` static, `/atelier`, `/find`, `/picks` partial prerender |
| Coverage (`vitest --coverage`, four lib files) | lines: `browse.ts` 100%, `conversation.ts` 99.54% (line 354 uncovered), `model-param.ts` 100%, `picks-view.ts` 100%. `coverage/` removed afterwards. |
| Production server (`next start`, port 3112, stopped) | see "Served-HTML checks" |

## Golden cases through MCP `matching_explain`

Three client calls to the `catalog` MCP server's `matching_explain` tool were made from this session, one per golden model (the models the tapped journeys produce). Results:

| Case | Picks (score) | Disclosures | Shortfall | Match with REQ-MC-33 to 35 |
|---|---|---|---|---|
| 1 | TBZ-1013 (6), TNZ-1056 (6), TBZ-1017 (6) | none | none | yes |
| 2 | THP-1001 (7), THP-1017 (6) | none | "Only 2 pieces in the atelier are listed for Mom", browse link on | yes |
| 3 | TPN-1141 (9), TPN-1147 (7), TPN-1143 (7) | both sentences as pinned; TPN-1141 note "Your Ganesha pendant sits just below your budget at ₹14,249, so we widened the search slightly." | none | yes |

The same values are asserted through the UI in `tests/journey.golden.test.tsx` (taps, then `parseModelParam`, `match()`, `toPickViews`, and the rendered `/picks` page).

## Served-HTML checks (production build)

- `/find`, `/atelier`, `/picks?m=<golden 1>` return 200. The golden-1 page lists the three catalog names and prices ₹2,324, ₹1,674, ₹2,099. Footnote and "Buy on Tiny Tiaraa" counts are 3 times the visible number because the streamed RSC payload repeats the markup, so they were not used as evidence; the jsdom tests count visible nodes (3 footnotes, 3 buy links).
- `/atelier`: 21 "Buy on Tiny Tiaraa", 1 "Out of stock", one footnote in the grid price region. `/atelier?metal=junk`: 21 buy links (invalid value falls back to All).
- `/find?notice=incomplete` contains "start again".

## Refusal checks

| Rule | Evidence | Result |
|---|---|---|
| Footnote on every price | `tests/picks.ui.test.tsx` P-CV-10 over all 21 in-stock products; `tests/atelier.ui.test.tsx` grid region; `PickCard` carries `data-price-region` plus `PriceFootnote` | pass |
| No OOS buy control | `BrowseCard` renders the buy button only when `availability === "In Stock"`; `tests/atelier.ui.test.tsx` checks TNZ-1058 has no store link; `grep TNZ-1058 components app lib` is empty (no SKU hardcoding); persona 3 page text contains neither the SKU nor the name | pass |
| No OOS pick | all 8 personas and 3 golden cases assert TNZ-1058 absent from `views` | pass |
| No hex or arbitrary colour in components | `grep -rnE '#[0-9a-fA-F]{3,8}\|rgb\(\|\[#\|bg-\[\|text-\[' components app --include=*.tsx` is empty; hex values exist only in `app/globals.css` (token file) | pass |
| No discount, strike-through, MRP | grep of `components`, `app`, `lib` (non-matching) finds none in conversation components; the tests assert no `% off`, `save ₹`, `MRP`, `del`, `s`, `strike`, `.line-through` | pass |
| Religious only by opt-in | persona 3 (`Any` is an explicit tap) and persona 8 (`No religious symbols`): persona 8 and 7 assert no religious SKU; flow case 11 clears `symbolList` | pass |
| Photo untouched | `PickCard` and `BrowseCard` use `ProductPhoto` with nothing layered; tests assert one child in the wrapper and no `opacity`/`filter` on the OOS image | pass |
| Buy link verbatim and new tab | `tests/picks.ui.test.tsx`, `tests/atelier.ui.test.tsx`: `href` equals catalog `url`, `target="_blank"`, `rel` contains `noopener` | pass |
| No LLM, no `app/api` | `tests/picks.ui.test.tsx` LLM boundary test; `tests/conversation.static.test.ts` | pass |
| Ratings only when listed | `tests/picks.ui.test.tsx`, `tests/atelier.ui.test.tsx` | pass |
| Tap budget | `tests/journey.golden.test.tsx`: golden 1 is 8 taps, golden 3 is 10 taps (including "Reveal my picks") | pass |

## Findings

No blocker, major, or minor bug was found in the conversation, picks, or browse code. Items below are open questions, not fixed.

| ID | Severity | Item | Evidence |
|---|---|---|---|
| OQ-1 | minor (spec) | The tasks.md dev-server checks expect `/picks` with no `m` to return `307` to `/find`, and an invalid `m` to return `307` to `/find?notice=incomplete`. With `cacheComponents: true` the response starts as 200 with the prerendered shell, and the redirect streams afterwards (`NEXT_REDIRECT;replace;/find;307;` plus `<meta http-equiv="refresh" content="1;url=/find">` in the body). The redirect does work for a browser; only the HTTP status differs. Next.js docs: `loading.md`, "Status codes". The jsdom guard test still passes because it calls the page function directly. | `curl -s -o /dev/null -w "%{http_code}" localhost:3112/picks` gives 200; body contains the redirect markers |
| OQ-2 | minor (brand copy, pre-M2) | The M1 landing page and page metadata say "prove it's safe" and "or if it's safe" (`app/layout.tsx:20`, `app/page.tsx:86`). The product rule says the safety card never says "safe" or "unsafe"; it does not mention the landing, so this is a copy decision for the builder. | grep of `app`, `components`, `lib` |
| OQ-3 | note | `/picks` has no link to `/piece/[sku]` (design Q7); expected until `gift-presentation` and `safety-verdict` land. | `PickCard` |
| OQ-4 to OQ-7 | open (M1) | The four matching questions (personas 2, 3, 6, 8) remain open for the Tue 24 Nov checkpoint. The UI shows what `match()` returns, and the journey tests pin it. | `tests/matching.personas.test.ts` |

## Changes made outside the audit

During T5.4, `npm run build` failed on `/atelier` ("uncached or runtime data during prerendering", `searchParams` read outside `<Suspense>`). This is a build failure, not an audit finding. Fix: `app/layout.tsx` now wraps `{children}` in `<Suspense fallback={null}>`. It is also the cause of OQ-1. After the fix the build passes and all 455 tests still pass.

## Not done

- Manual timed browser run of golden 1 (REQ-CV-08, under 2 minutes): DEFERRED to the M6 clean-browser pass. A non-interactive session cannot drive a browser, and no time was recorded. The tap-count test covers the tap budget and the jsdom journey tests cover the flow.
- No MCP call other than the three `matching_explain` calls above was made; `catalog_get` and `catalog_search` were not used.

## Verdict

Pass for the conversation milestone, with OQ-1 and OQ-2 for the builder's decision.
