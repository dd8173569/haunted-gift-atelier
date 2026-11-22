# Reliability (Milestone 5) — Requirements

*Spec for architecture §9 row "Tue 1 Dec, M5: Reliability: PBT suite + counterexamples documented, error handling, LLM-off pass, optional LLM layer (only if key available)", and the architecture §7 testing strategy and performance budget. It adds route-level error boundaries and loading states, hardens and tests every edge state of the journey, adds property and exhaustive-sweep suites only where the 10 existing property files leave a gap, adds a coverage script with thresholds, records a performance baseline, and records the LLM-off pass. It changes `app/` (new boundary files), `package.json` (scripts), `vitest.config.ts`, and `tests/`. It changes no product logic.*

Terms: **boundary** = a Next.js special file that catches a thrown error or an unmatched URL and renders a fallback (`error.tsx`, `global-error.tsx`, `not-found.tsx`). **Fallback** = the UI a boundary or `loading.tsx` renders. **Framework signal** = the error Next.js throws for `redirect()` (digest starting `NEXT_REDIRECT`) and `notFound()` (digest `NEXT_HTTP_ERROR_FALLBACK;404`); these are control flow, not failures. **Edge state** = a state the happy path never reaches: missing or invalid input, an empty or short result, a failed load, an out-of-stock piece, an unknown SKU. **Sweep** = a test that enumerates a finite input space exhaustively instead of sampling it. **Route function** = the async default export of a `page.tsx`, called as a plain function in a test (the technique `tests/piece.route.test.tsx` and `tests/helpers/pages.tsx` already use). **Baseline** = measurements taken at HEAD `dd2e064` before any Milestone 5 change (REQ-REL-43). **UNBUILT** = a feature the specs describe that no code implements.

Scope: this spec adds `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `app/loading.tsx`, a `coverage` script, coverage thresholds, a `prebuild` script, and new test files. It does not change `lib/matching.ts`, `lib/matching/*`, `lib/catalog.ts`, `lib/safety*.ts`, `lib/true-size.ts`, `lib/size-spec.ts`, `lib/conversation.ts`, `lib/model-param.ts`, `lib/browse.ts`, `lib/picks-view.ts`, `lib/piece-view.ts`, `lib/page-meta.ts`, `data/*`, `public/catalog/*`, `app/globals.css`, any existing component, or any existing page's behaviour. The three golden cases, the eight personas, and every pinned string (REQ-PD-16) stay as they are.

**Frozen until the Tue 24 Nov checkpoint. This spec references these items and does not resolve them.** (1) The four matching questions of the M1 personas (Q-M1 to Q-M4: personas 2, 3, 6, 8). (2) Q-PD18: whether "every `₹` node carries the footnote" means budget-band text too. (3) M2 OQ-1: `/picks` with a missing or invalid `m` answers HTTP 200 with a meta-refresh, not a 307, under `cacheComponents`; M6 owns it. (4) `/piece/NOPE-0000` answers 200 in dev and 404 in production; the clean-browser pass in M6 owns it. A test or check here that touches one of these SHALL pin the current behaviour and say so; it SHALL NOT change it.

**Out of scope, recorded so nobody re-opens it here:** the optional Gemini phrasing layer (REQ-REL-51 records it as UNBUILT); `.github/workflows/ci.yml` (the token lacks workflow scope and CI is not a submission requirement); the physical calibration check T4.3 of `gift-presentation` (needs a human with a card and a ruler; it stays "not run" and no number is invented); any manual or browser check (no browser exists on the build machine; every such check stays "NOT RUN" in the QA note); Netlify deployment and the clean-browser, second-device pass (M6); a retry-with-backoff client, error-reporting service, analytics, or any runtime network call (`tech.md`).

**Contradictions with earlier work, stated up front.** (1) Architecture §9 lists "≥1 PBT counterexample found + fixed + logged" as an M5 exit criterion. A counterexample is a finding, not a deliverable, and this spec does not manufacture one: REQ-REL-37 requires that any counterexample the new suites find is logged, and the evidence log already holds counterexamples from M1, M2, and M4 that the final report cites. (2) REQ-PD-23 says focus SHALL NOT move on page load. An error fallback replaces a page that was already loading; it follows the same rule and does not take focus (REQ-REL-08). (3) The brief lists candidate property suites (browse filters over all combinations, picks-view, model-param over arbitrary strings, price and footnote over 22 SKUs, conversation transitions). Most are already pinned (design §3 lists where). REQ-REL-26 drops the duplicates and design §3 names only the gaps.

---

## 1. Error boundaries

**[REQ-REL-01] A segment boundary for every route**
`app/error.tsx` SHALL exist as a Client Component (`'use client'`) and SHALL be the fallback for an unexpected error thrown while rendering any route segment under the root layout (`/`, `/find`, `/picks`, `/atelier`, `/piece/[sku]`). It SHALL render inside the root layout, so the skip link and the document shell are present. It SHALL contain a minimal inline `<header>` (a plain-text "Tiny Tiaraa" wordmark as a plain `<a href="/">` plus a `<nav aria-label="Primary">` with a plain `<a href="/atelier">` "Browse the atelier" link), one `<main id="main-content" tabIndex={-1}>`, exactly one `h1`, one sentence of explanation, and the three controls of REQ-REL-03. It SHALL receive the props `error` and `retry` (Next.js 16.4.6; `retry` is stable since 16.3.0). It SHALL NOT use the `reset` prop. (Size fix, 21 Nov 2026: the header was `SiteHeader` until the REQ-REL-45 fix — the shared header compiled into the boundary's client chunk at +4.4 kB, so the fallback now inlines the same classes with plain anchors. The wordmark classes and the nav link classes are the ones `SiteHeader` uses; a change to those styles must be mirrored here.)

**[REQ-REL-02] The fallback is static and data-free**
Every boundary and `loading.tsx` fallback SHALL render fixed strings only. None SHALL import `lib/catalog-store.ts`, `lib/catalog.ts`, `data/*`, `lib/matching*`, `lib/picks-view.ts`, `lib/piece-view.ts`, `lib/model-param.ts`, or read `searchParams`, `params`, or `localStorage`. None SHALL show a product name, a price, a `₹` amount, a rating, a photo, a catalog fact, or a safety wording. A fallback therefore still renders when the catalog itself failed to load (REQ-REL-20), and it cannot show a wrong fact.

**[REQ-REL-03] The way forward is always offered**
`app/error.tsx` SHALL offer exactly three controls: "Try again" (an `ActionButton`, `variant="primary"`, whose click calls `retry()`), "Find a gift" (a link to `/find`), and "Browse the atelier" (a link to `/atelier`). Every control SHALL be a native `button` or `a[href]` of at least 44 px height (REQ-PD-28) and SHALL be reachable by keyboard in DOM order. No fallback SHALL be a dead end: each SHALL offer at least one link that leaves the failed segment.

**[REQ-REL-04] What is shown, what is logged**
The fallback SHALL show only fixed copy and, when `error.digest` is a non-empty string, one line "Reference: {digest}". It SHALL NOT render `error.message`, `error.stack`, or any other property of `error` (a Server Component error carries a generic message in production and the original message in development, and the fallback SHALL NOT depend on which). The boundary SHALL narrow `error` before reading it (`error` may be any thrown value; the Next.js docs say to narrow with `instanceof Error`). In an effect, the boundary SHALL write one `console.error` line containing the fixed prefix `[atelier] route error` and the digest, and nothing else from `error`. No error-reporting service, `fetch`, beacon, or storage write SHALL be added.

**[REQ-REL-05] A root boundary for the layout itself**
`app/global-error.tsx` SHALL exist as a Client Component that renders its own `<html lang="en">` and `<body>`, imports `./globals.css` so the colour tokens apply, uses only token classes, and renders one `h1`, one sentence, a "Reload" `button` that calls `retry()`, and one plain `<a href="/">` (a full-page navigation, which resets all client state). It SHALL also contain `<head><title>The atelier couldn't open</title></head>` — axe flags `document-title` (serious) without it, and `global-error` cannot export `metadata`, so the React `<title>` element is the fix the docs point to (M5 Wave 1 finding). It SHALL NOT import `next/font`, `SiteHeader`, `SkipLink`, or any component that needs the root layout's font variables or `<Suspense>`. It SHALL NOT render the "Tiny Tiaraa" wordmark (the display serif is not available there; the wordmark SHALL appear only in the display serif, `product.md`).

**[REQ-REL-06] A root 404 for unmatched URLs**
`app/not-found.tsx` SHALL exist and SHALL render, inside the root layout, a minimal inline `<header>` (a plain-text "Tiny Tiaraa" wordmark as a plain `<a href="/">` plus a `<nav aria-label="Primary">` with a plain `<a href="/atelier">` "Browse the atelier" link), one `<main id="main-content" tabIndex={-1}>`, one `h1` "We couldn't find that page.", a link "Browse the atelier" to `/atelier`, and a link "Find a gift" to `/find`. The two main links are plain `<a>` elements carrying the `AtelierButton` primary and secondary classes respectively. `app/piece/[sku]/not-found.tsx` SHALL stay exactly as it is: its heading "We couldn't find that piece." is pinned (REQ-PD-16). (Size fix, 21 Nov 2026: the header was `SiteHeader` and the links were `AtelierButton` until the REQ-REL-45 fix — `AtelierButton` pulls the `next/link` chunk (+3.3 kB) into the first-load set of routes that otherwise never load it, so the fallback now inlines the same classes with plain anchors.)

**[REQ-REL-07] Framework signals pass through**
No boundary SHALL catch, inspect, rethrow, or render a framework signal. `redirect()` and `notFound()` SHALL keep their present behaviour on every route (`/picks` redirects; `/piece/[sku]` for an unknown SKU renders the piece not-found page). No `try`/`catch` SHALL be added around any page body to "handle" an error: the boundary does that.

**[REQ-REL-08] Fallbacks are accessible**
Each fallback SHALL have exactly one `h1`, exactly one `main`, and no skipped heading level (REQ-PD-24); SHALL pass axe at the REQ-PD-38 tag set with zero violations; SHALL NOT move focus on mount (REQ-PD-23); SHALL carry `tabIndex={-1}` only on `main`; SHALL use `text-plum` or `text-plum/N` with `N ≥ 75` and `border-plum/N` with `N ≥ 60`; and SHALL satisfy the contrast and class scans of `tests/a11y.contrast.test.ts` and `tests/a11y.static.test.ts` without edits to those tests beyond adding the new files to the scanned set (they already scan all of `app/` and `components/`).

**[REQ-REL-09] The design lock holds**
The fallbacks SHALL use only the six colour tokens and the non-colour tokens already in `app/globals.css`, the type scale of REQ-PD-03, the spacing and radii of REQ-PD-04, and the existing `ActionButton` component for their buttons ("Try again", "Reload"). `app/error.tsx` and `app/not-found.tsx` SHALL NOT use `SiteHeader` or `AtelierButton`: the two fallbacks inline the header and the link classes as plain markup with plain `<a>` anchors, because the shared components cost +4.4 kB (`SiteHeader` compiled into the error boundary's client chunk) and +3.3 kB (the `next/link` chunk via `AtelierButton`) — the REQ-REL-45 breach itself (size fix, 21 Nov 2026). The inline class strings duplicate the `SiteHeader` and `AtelierButton` classes and must be mirrored if those change. No new colour, token, shadow, radius, or component SHALL be added. No haunted element (motes, moon, cobweb) SHALL appear in a fallback (REQ-PD-14). No logo, watermark, image, or icon SHALL appear. New fallback copy SHALL NOT contain "safe", "unsafe", "certified", "hypoallergenic", "true size", a `₹` amount, "off", or "save" (design §4.5 lists the copy).

---

## 2. Loading states

**[REQ-REL-10] One text-only loading fallback**
`app/loading.tsx` SHALL exist and SHALL render one element with `role="status"` and `aria-busy="true"` containing the text "Opening the atelier…". It SHALL contain no skeleton card, no fake price, no placeholder photo, no pinned string, and no `₹`. It SHALL contain no animation, so the REQ-PD-27 reduced-motion rule has nothing to cover. It SHALL take no props and read no request data. This keeps REQ-PD-48: "A Suspense fallback, if added, SHALL contain no pinned string, SHALL carry `aria-busy="true"`, and SHALL NOT render a fake card or a fake price."

**[REQ-REL-11] Loading changes no behaviour**
After `app/loading.tsx` exists: `/picks` with no `m` SHALL still answer 200 with a meta-refresh to `/find`; `/picks` with the golden-case-1 `m` SHALL still render TBZ-1013, TNZ-1056, TBZ-1017 in that order; `npm run build` SHALL still print `/` as static and `/find`, `/picks`, `/atelier`, `/piece/[sku]` (22 paths) as Partial Prerender; and the static page count SHALL equal the baseline (REQ-REL-43) unless the QA note explains the difference. IF any of these fails, `app/loading.tsx` SHALL be removed, the failure SHALL be recorded in the evidence log, and no workaround SHALL be added (open question Q-REL2).

**[REQ-REL-12] Scope of loading states**
No other `loading.tsx` SHALL be added. No `<Suspense>` boundary SHALL be added to a page. The `instant = false` decision of M4 (REQ-PD-47, decision (a)) SHALL stand.

---

## 3. Edge states

**[REQ-REL-13] `/picks` with a missing or invalid `m`**
The route function SHALL throw a redirect whose digest targets exactly `/find` when `parseModelParam` returns `missing`, and exactly `/find?notice=incomplete` when it returns `invalid`, for every value of `searchParams.m` (REQ-CV-20). It SHALL throw no other error for any `searchParams` object. The served HTTP behaviour (200 plus meta-refresh) is the frozen M2 OQ-1 and SHALL NOT be changed or asserted differently here.

**[REQ-REL-14] Every model gets an answer, including a short or empty one**
For every `RecipientModel` in the finite space of design §4.2, `match()` SHALL return without throwing, with at most 3 picks, with no duplicate SKU, and with `shortfallNote` defined and `showBrowseLink` true whenever fewer than 3 picks return (the I5 invariant extended to the whole space, not a sample). The `/picks` body for every model that returns fewer than 3 picks SHALL render the picks that exist, the `shortfallNote` verbatim, the "Browse the full atelier" link, and "Change my answers", and SHALL render no filler card (REQ-CV-24). The test SHALL record how many models returned 0, 1, 2, and 3 picks. WHEN no model returns 0 picks, the test SHALL state that, and the 0-pick rendering SHALL be checked through the pure functions (`toPickViews` of an empty result gives `[]`) instead.

**[REQ-REL-15] `/find` with arbitrary parameters**
The `/find` route function SHALL resolve, never throw, for any `searchParams` object, and SHALL render the incomplete-link notice when `m` is invalid or `notice` equals `incomplete`, and no notice otherwise (REQ-CV-20, REQ-CV-22). It SHALL never render a notice for a `notice` value other than `incomplete`.

**[REQ-REL-16] `/atelier` with arbitrary parameters and every filter combination**
The `/atelier` route function SHALL resolve, never throw, for any `searchParams` object. For every one of the 450 filter combinations (5 age × 6 category × 3 metal × 5 budget values, each including "all"), the rendered grid SHALL contain exactly the products an independent reference filter selects, in order, with the out-of-stock product (when selected) after every in-stock one; SHALL show the empty-state sentence "No piece matches those filters." if and only if the selection is empty; SHALL show exactly one price footnote per grid — the grid is one price region, and its budget chips print `₹` ranges on every render, so the footnote is present even when the selection is empty (M5 Wave 3 finding; whether budget-band text needs the footnote is the frozen Q-PD18, referenced here and not resolved); and SHALL show no "Buy on Tiny Tiaraa" control on the out-of-stock card (REQ-CV-35 to REQ-CV-39).

**[REQ-REL-17] Unknown SKU**
For every string that is not exactly a catalog SKU (including lower-case, padded, empty, very long, and percent-encoded variants of real SKUs), the `/piece/[sku]` route function SHALL throw the 404 framework signal and no other error, whatever `searchParams.m` holds. For each of the 22 real SKUs it SHALL resolve. The dev-versus-production status of `/piece/NOPE-0000` is the frozen item (4) and is not tested or changed here.

**[REQ-REL-18] Out-of-stock pieces never get a buy or wrap control**
Wherever an out-of-stock product renders (the `/atelier` card, `/piece/TNZ-1058`), no "Buy on Tiny Tiaraa" link and no gift-wrap control SHALL render (REQ-CV-38, REQ-GP-09). For `/piece/TNZ-1058`, this SHALL hold for every `m` value (absent, valid, invalid, repeated), because the recipient context SHALL NOT change what a piece page offers. `/picks` SHALL never render an out-of-stock product for any model (REQ-CV-25; the sweep of REQ-REL-14 checks `toPickViews` over the whole space). The out-of-stock state SHALL be derived from `availability`, never from a SKU literal.

**[REQ-REL-19] A failed catalog fails the build, loudly**
A catalog that does not parse or validate (`data/catalog.json` with a duplicate SKU, a bad enum, a missing photo, a wrong `count`) SHALL make `npm run build` exit non-zero, and the output SHALL name the failing check (a REQ-CD id and a SKU). `package.json` SHALL gain a `prebuild` script `npm run validate-catalog`, so the validator's report is the first failure the builder sees, before the Next.js stack trace from `parseCatalog` at import. A deployable build SHALL NOT exist for a catalog that fails validation. The `validate-catalog` script and `scripts/validate-catalog.ts` SHALL stay unchanged. (Q-REL5, ANSWERED 22 Nov 2026: the `prebuild` hook ran in the Netlify build — the build log shows CATALOG OK, 22 products. The Vercel variant of the question is moot: the deploy platform switched to Netlify in M6.)

**[REQ-REL-20] A failed catalog at runtime shows a fallback, not a blank page**
`lib/catalog-store.ts` parses the catalog when it is first imported. WHEN that import throws, every route that imports it SHALL end in `app/error.tsx` (or `app/global-error.tsx`), and the fallback SHALL render, because it imports none of the catalog modules (REQ-REL-02). A test SHALL corrupt a copy of the raw catalog through `vi.doMock`, import `lib/catalog-store.ts`, and assert that the import rejects with `CatalogBuildError` naming the failing check, and SHALL assert that the fallback modules render with the same module registry. The test SHALL NOT change `data/catalog.json` on disk. This failure cannot occur after a build that passed REQ-REL-19, because the JSON is bundled; the requirement covers a corrupted deployment artefact and nothing more, and the QA note SHALL say so.

**[REQ-REL-21] No substitute photo**
A catalog photo that fails to load at runtime SHALL show the browser's alt text (the product name, REQ-PD-29). This milestone SHALL NOT add a fallback image, placeholder, or generated picture, because a substitute photo is an invented photo (`product.md`). The existence and image type of every `image_file` stays a build-time check (`validate-catalog`).

**[REQ-REL-22] Browser APIs that can fail**
A `localStorage` that throws on read or write, a corrupted calibration value, and a missing or rejecting `navigator.clipboard` SHALL leave the viewer in its honest approximate mode and the gift wrap with "Select the text and copy it yourself.", with no uncaught error. These behaviours are pinned by existing tests (`tests/true-size.ui.test.tsx`, `tests/gift-wrap.ui.test.tsx`, P-TS-4); this milestone SHALL verify those tests still run and SHALL NOT duplicate them.

---

## 4. Redirects, rejections, and swallowed errors

**[REQ-REL-23] No `redirect()` or `notFound()` inside a `try`**
No file under `app/` or `components/` SHALL call `redirect`, `permanentRedirect`, `notFound`, `forbidden`, or `unauthorized` inside a `try` block, a `catch` block, or a function passed to `.then`/`.catch`. A static test SHALL parse each file's source and assert it (design §6). The two present call sites (`app/picks/page.tsx` `redirect`, `app/piece/[sku]/page.tsx` `notFound`) SHALL pass it unchanged.

**[REQ-REL-24] No unhandled promise rejection**
A full `npm test` run SHALL report no unhandled errors and no unhandled rejections (Vitest fails the run on them by default; the check is that the summary has no "Unhandled" line and `dangerouslyIgnoreUnhandledErrors` is not set). Every `async` function and `await` in `components/` and `app/` SHALL be either inside a `try`/`catch` that leaves the UI in a defined state, or be a Server Component body whose failure is the boundary's job. A static test SHALL list every `.then(` and every `async` event handler in `components/`, and assert each has a handler or is on a reviewed allow-list that names the reason (design §6). The present case is `GiftWrap`'s `copyMessage`, which catches.

**[REQ-REL-25] No swallowed error**
No `catch` block in `app/` or `components/` SHALL have an empty body. A `catch` SHALL set a defined fallback state, return a defined value, or rethrow. The one exception is `components/useCalibration.ts` `write()`, whose `catch` body is a comment only and whose fallback (`memory = raw`) is assigned before the `try`; the static test pins it on a reviewed list of exactly that site, with a check on the fallback assignment (M5 Wave 2 finding). In `lib/`, the only `catch` blocks SHALL be those that return a typed "invalid" result (`parseModelParam`, `parseCalibration`, `catalog` parsing); the static test SHALL list them so a new one is a conscious decision.

---

## 5. Property and sweep suites

Every suite below is seeded (`seed: 20261201`), runs at least 300 times (the route-function properties R1 to R4 at least 300; the others as stated), and takes its catalog from `tests/helpers/matching-fixtures.ts` or `lib/catalog-store.ts` (the real 22 SKUs). Test files declare their DOM environment per file, as the existing suites do.

**[REQ-REL-26] Non-duplication**
A new suite SHALL pin an invariant that no existing test pins. Design §3 lists the existing coverage by file and the candidates dropped for that reason. A reviewer SHALL be able to check each new invariant against that list.

**[REQ-REL-27] R1 `/picks` route totality**
For any `searchParams` object (keys drawn from `m`, `notice`, and arbitrary strings; `m` drawn from the `arbParam` mix of valid, mutated, truncated, repeated, arbitrary-JSON, arbitrary-string, and absent values), the `/picks` route function either (a) throws a framework redirect whose digest target is `/find` exactly when `parseModelParam(m).status === 'missing'`, and `/find?notice=incomplete` exactly when it is `invalid`, or (b) when the status is `ok`, resolves to an element that renders to markup with exactly one `h1`, no more than 3 `article` pick cards, and the exact `match()` picks in order. It never throws anything else. (REQ-REL-13.)

**[REQ-REL-28] R2 `/find` route totality**
For any `searchParams` object, the `/find` route function resolves and renders one `h1`; it renders the incomplete notice if and only if `m` is invalid or `notice === 'incomplete'`; for a valid `m` it renders the recipient card for that model when resume is complete (the model has `occasion` other than `"other"` and, unless Mom, a defined `ageYears`) and otherwise renders the first unanswered question — resume lands on the first unanswered question by design (conversation design §2.6, P-CV-8), so a valid `m` with `occasion: "other"` or no `ageYears` does NOT show the card (M5 Wave 3 finding C-R2-1). (REQ-REL-15.)

**[REQ-REL-29] R3 `/atelier` route totality**
For any `searchParams` object, the `/atelier` route function resolves, renders one `h1`, and renders between 0 and 22 cards where the card count equals the independent reference count for `parseBrowseFilters(searchParams)`. (REQ-REL-16, route half.)

**[REQ-REL-30] R4 `/piece/[sku]` route totality**
For any `sku` string and any `searchParams`, the `/piece/[sku]` route function resolves if and only if `sku` is one of the 22 catalog SKUs, and otherwise throws the 404 signal and nothing else. When it resolves, the markup has one `h1` equal to the product name and exactly one price footnote. (REQ-REL-17.)

**[REQ-REL-31] R5 Out-of-stock pieces carry no purchase control, for any `m`**
For any `m` from the `arbParam` mix, `/piece/TNZ-1058` renders no "Buy on Tiny Tiaraa" link, no element from `GiftWrap`, and the text "This piece is out of stock on the listing."; and for every in-stock SKU with any valid `m`, exactly one buy link equal to the catalog `url` verbatim. (REQ-REL-18.)

**[REQ-REL-32] E1 Whole-space model sweep (exhaustive, not sampled)**
`tests/reliability.matching.sweep.test.ts` SHALL enumerate the finite model space of design §4.2 and assert, for every model: `match()` does not throw; at most 3 picks; no duplicate SKU; every pick In Stock; `toPickViews(match(m))` does not throw and has the same SKUs in the same order; fewer than 3 picks implies a defined `shortfallNote` and `showBrowseLink`; and `symbols = 'none-religious'` implies no religious piece (I4 over the whole space). It SHALL record the count of models per pick count (REQ-REL-14). This is a sweep, so it has no seed and no run count.

**[REQ-REL-33] B1 Whole-space filter sweep (exhaustive, rendered)**
`tests/reliability.browse.sweep.test.tsx` SHALL render `CatalogGrid` to static markup for each of the 450 combinations and assert REQ-REL-16 against an independent reference (a filter written in the test from raw catalog fields, not through `lib/browse.ts`). It SHALL assert the out-of-stock card never has a buy control in any combination (the existing test covers single-filter combinations only).

**[REQ-REL-34] M1 Money formatting**
`tests/money.property.test.ts` SHALL pin `formatInr` over generated integers in `[0, 10^9]` (and the 22 catalog prices): the output matches `^₹(\d{1,3}|\d{1,2}(,\d{2})*,\d{3})$` (Indian grouping: the last group has 3 digits, earlier groups 2); removing `₹` and commas returns the integer exactly; it contains no `.`, no `NaN`, no `Infinity`; it is deterministic; digit count is monotone in the input; and negative inputs render `-₹…` with the same digits as the absolute value. Money being an integer number of rupees formatted by one helper is a `tech.md` rule that no property pins today.

**[REQ-REL-35] S1 Static reliability rules**
`tests/reliability.static.test.ts` SHALL pin REQ-REL-02 (fallbacks import no catalog module), REQ-REL-23 (no framework signal in a `try`), REQ-REL-24 and REQ-REL-25 (promise and `catch` lists), REQ-REL-49 (no LLM client, key, network call, or `app/api/`), and REQ-REL-01/05/06/10 (the four files exist with the required exports and directives).

**[REQ-REL-36] F1 Fallback rendering**
`tests/reliability.fallbacks.ui.test.tsx` SHALL render `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, and `app/loading.tsx` in jsdom and assert: the structure and copy of REQ-REL-01 to REQ-REL-10; `retry` is called once per "Try again" activation and by nothing else; the digest line appears only for a non-empty string digest; `error.message` and `error.stack` never appear for an `Error`, a string, `null`, and an object thrown value; `console.error` is called once with the fixed prefix and the digest; axe reports zero violations for each; no `₹`, no forbidden word (REQ-REL-09), no `img`; every control is a native element with a 44 px class.

**[REQ-REL-37] Counterexamples are logged, not forced**
A counterexample found by any new suite SHALL be fixed in the code under test where the code is wrong, or in the generator where the generator is wrong, and SHALL be logged in `docs/kiro-evidence-log.md` with its fix. A test SHALL NOT be loosened, skipped, or disabled to pass (`tech.md`). IF no new suite finds a counterexample, the QA note SHALL say "none found" and SHALL cite the existing counterexample entries (M1, M2, M4) for the architecture §9 criterion, with their line references in the log.

---

## 6. Coverage

**[REQ-REL-38] A coverage script**
`package.json` SHALL gain `"coverage": "vitest run --coverage"`. `npm test` SHALL stay `vitest run --passWithNoTests` and SHALL NOT collect coverage. The existing `@vitest/coverage-v8` devDependency SHALL be the provider; no package SHALL be added.

**[REQ-REL-39] What is measured**
`vitest.config.ts` SHALL set `test.coverage` with `provider: 'v8'`, `include: ['lib/**/*.ts']`, `exclude: ['lib/**/*.d.ts']`, `reporter: ['text-summary', 'json-summary']`, and `reportsDirectory: 'coverage'`. The gate SHALL cover `lib/` only (`tech.md`: "Coverage target ≥ 80% on `lib/`"). `app/`, `components/`, `scripts/`, and `packages/` SHALL NOT be in the gate (design §7.3 says why); the implementation SHALL still measure `components/**` and `app/**` once with a CLI `--coverage.include` override and record the figures in the QA note as information.

**[REQ-REL-40] A threshold set from measurement**
`test.coverage.thresholds` SHALL set `lines`, `statements`, `functions`, and `branches`. Each value SHALL be the measured whole-`lib/` percentage, rounded down to a whole number, minus 1 point, and SHALL NOT be below 80 (`tech.md`) or above the measured figure. The implementation session SHALL run `npm run coverage` first, record the measured figures, then set the thresholds; this spec states no number. IF a measured figure is below 80, the implementation SHALL add tests, not lower the bar (open question Q-REL3 covers per-file versus whole-`lib/`).

**[REQ-REL-41] The threshold is real**
`npm run coverage` SHALL exit non-zero when a threshold is not met. The implementation SHALL show this once, by running the script with one threshold temporarily raised above the measured value through a CLI override (for example `--coverage.thresholds.lines=101`), SHALL observe a non-zero exit, and SHALL NOT commit that override.

**[REQ-REL-42] Recorded and clean**
The measured and chosen numbers (global and the per-file table from `coverage/coverage-summary.json`) SHALL be recorded in `docs/qa-reports/reliability-m5.md` and in the evidence log. `coverage/` is already in `.gitignore`; the session SHALL delete the directory before finishing, so the tree stays clean. The M1 to M4 ad-hoc figures (`lib/matching` 100%, `lib/catalog.ts` 92.7%, `lib/safety*` 100%, `lib/true-size.ts` and `lib/size-spec.ts` 100%, `lib/page-meta.ts` 100%, `lib/conversation.ts` 99.54%, `browse`, `model-param`, `picks-view` 100%) SHALL be cited only as history; the recorded figures SHALL come from this milestone's own run.

---

## 7. Performance sanity

**[REQ-REL-43] A baseline before any change**
Before any Milestone 5 code change, the session SHALL run `npm run build` at HEAD `dd2e064` (the state in which 1502 tests pass), SHALL save the route table and the static page count, and SHALL compute the per-route client JavaScript sizes of REQ-REL-44. The M4 evidence log records the route table and "30 static pages" but no size figures, so the size baseline does not exist yet and SHALL be created here. The numbers SHALL be labelled "baseline, measured in M5 at dd2e064", never "M4 figures".

**[REQ-REL-44] What is measured**
For each route pattern (`/`, `/find`, `/picks`, `/atelier`, `/piece/[sku]`, `/_not-found`), the session SHALL record: the route table symbol (`○` static, `◐` Partial Prerender); the static page count from the build output; and the first-load client JavaScript as the sum of the gzip sizes of the files a route loads (design §8 gives the method, because the Next.js 16 Turbopack build does not print a size column). It SHALL record the figures in kB with one decimal place. IF the build prints a size column, the printed figures SHALL be recorded as well, labelled as Next.js's own.

**[REQ-REL-45] No regression**
After Waves 1 to 3, the same measurement SHALL show the same route table symbols, the same static page count (REQ-REL-11), and for each route a first-load client JavaScript size that does not exceed the baseline by more than 4.0 kB gzip (open question Q-REL4). The expected increase is the `error.tsx` boundary and `loading.tsx`, which every route's segment tree now includes. A larger increase SHALL be investigated and explained in the QA note, not hidden by changing the threshold.

M5 outcome: NOT met — every route grew +4.7 to +8.1 kB gzip over baseline. Cause, measured by removing one file at a time and rebuilding: `error.tsx` +4.4 kB on every route (a Client Component, so it pulls `SiteHeader`/`ActionButton`/`AtelierButton` into client JavaScript); `not-found.tsx` +3.3 kB on `/find`, `/picks`, `/atelier`, `/_not-found` (the `next/link` chunk); `global-error.tsx` +0.3 kB; `loading.tsx` nothing. The limit was NOT raised. Accepted as a known gap for the Tue 24 Nov checkpoint: cutting the cost means rewriting the fallbacks with plain markup instead of the shared components.

Size-fix outcome (21 Nov 2026, session 20, builder's call): MET on every route. `app/error.tsx` and `app/not-found.tsx` were rewritten with an inline minimal header and plain `<a>` links (REQ-REL-01/06/09 updated above); `global-error.tsx` and `loading.tsx` unchanged. First-load gzip after the fix, vs the dd2e064 baseline: `/` 180.3 (+1.8), `/find` 186.6 (+1.7), `/picks` 185.3 (+1.8), `/atelier` 191.4 (+1.8), `/piece/[sku]` 193.5 (+1.7), `/_not-found` 177.0 (+1.8). The limit was NOT raised. The residual +1.7–1.8 kB is the two boundary chunks themselves (error 1,072 B gzip, global-error 854 B gzip, coordinator-measured) — the irreducible cost of having the boundaries at all. The `next/link` chunk is confirmed absent from the `/find`, `/picks`, `/atelier`, and `/_not-found` manifests. Full record: `docs/qa-reports/reliability-size-fix.md`.

**[REQ-REL-46] Honest limits**
The QA note SHALL state that LCP, TTFB on a real network, and 4G behaviour are NOT measured (no browser, no deployed URL), and that the `next start` response times it records come from `curl` on the build machine, as in M4. It SHALL NOT claim the architecture §7 LCP budget (< 2.5 s on 4G) is met. M6 measures it on the deployed URL.

---

## 8. LLM-off pass and the Gemini layer

**[REQ-REL-47] The check is stated, not assumed**
The LLM-off pass SHALL be a set of checks the session runs and records, not a sentence. It consists of REQ-REL-48 to REQ-REL-50.

**[REQ-REL-48] No key, same journey**
The session SHALL start `next start` with every LLM-related variable unset (`GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, run through `env -u …`), and SHALL fetch with `curl`: `/` (200), `/find` (200), `/picks?m=<golden case 1>` (the three SKUs in order, with the footnote), `/picks` with no `m` (200 with a meta-refresh to `/find`; frozen item 3), `/piece/TBZ-1013?m=<golden case 1>` (200, one h1, the fit-check line, one buy link equal to the catalog `url`), `/piece/TNZ-1058` (200, no buy link), and `/atelier` (200, 22 cards). The journey by taps, with no network, SHALL be pinned by `tests/journey.golden.test.tsx` (REQ-CV-40, REQ-CV-41), which SHALL pass unchanged. A browser walkthrough is NOT RUN and SHALL be listed as such.

**[REQ-REL-49] No LLM code, key, or runtime network call exists**
The static test (REQ-REL-35) SHALL assert across `app/`, `components/`, `lib/`, `data/`, and `scripts/`: no `app/api/` directory; no import from or string reference to `@google/generative-ai`, `@google/genai`, `openai`, `@anthropic-ai/sdk`, `ai` (matched as an import specifier only), or `generativelanguage.googleapis.com`; no `process.env` read at all (none exists today, so any new one fails the test and is reviewed); no `fetch(`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon` call. `next/font/google` is build-time self-hosting (`tech.md`) and SHALL be excluded from the network scan with that reason in a comment.

**[REQ-REL-50] The conversation contract still holds with the LLM off**
REQ-CV-43 (no LLM call, no `app/api/chat/route.ts`, no key) and REQ-CV-44 (a free-text field, if one is ever added, shows "I can only take taps right now" and the chips keep working) SHALL stay true. No free-text field exists, so REQ-CV-44 stays a contract for a future change and SHALL be recorded as "not applicable: no free-text input exists".

**[REQ-REL-51] The Gemini layer is recorded as UNBUILT**
The QA note, the evidence log, and (when the README lists features) the README SHALL state: the optional free-tier Gemini phrasing layer (PRD §4, `app/api/chat/route.ts`, `conversation` spec REQ-CV-43 to REQ-CV-45) is UNBUILT in Milestone 5; the reason is that no API key exists and none was provided; the scripted-only journey is the shipped and tested default (PRD §4 ship decision, PRD open question 1); and architecture §9 names the optional LLM layer first in the scope-cut order. No document SHALL describe the layer as present, partial, or "stubbed". No code, route, environment variable name, or test for it SHALL be added.

**[REQ-REL-52] The key question goes to the checkpoint**
Whether to obtain a Google AI Studio key and build the layer at all SHALL be recorded as an open question for the Tue 24 Nov go/no-go checkpoint (Q-REL1). This milestone SHALL NOT decide it, and SHALL NOT be blocked by it.

---

## 9. Boundaries, ownership, regression

**[REQ-REL-53] Behaviour is unchanged**
After the milestone: the three golden cases and the eight personas reproduce; every pinned string of REQ-PD-16 renders byte for byte; `/picks` without `m` still answers 200 with a meta-refresh to `/find`; `/piece/[sku]` still renders for the 22 SKUs and 404s for others; the browse grid, the safety card, the viewer, and the gift wrap are untouched. No existing test SHALL be edited except to extend a scanned file list (REQ-REL-08), and no existing assertion SHALL be loosened or removed. The test count SHALL NOT fall below the baseline of 1502 tests in 55 files.

**[REQ-REL-54] Ownership**
The `design-polish` agent SHALL write only `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, and `app/loading.tsx` (it may edit `app/**` and `components/**`). The builder session or `gift-curator` SHALL write `package.json`, `vitest.config.ts`, every file in `tests/`, and `docs/**`. The `qa-auditor` agent MAY audit read-only and write under `docs/qa-reports/`. A task that needs a change outside an owner's paths SHALL stop and report it. No task in this milestone writes `lib/**` or `data/**`.

**[REQ-REL-55] Purity and no new network**
No file this milestone adds SHALL import an LLM client, read a key, call `fetch`, use the clock or randomness for a behavioural decision, or add a database, auth, or payment. No `app/api/` directory SHALL be added. No `.github/workflows/ci.yml` SHALL be added.

**[REQ-REL-56] Next.js read before writing**
Before writing any boundary, the implementer SHALL re-read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`, `loading.md`, and `not-found.md` (AGENTS.md: this version has breaking changes) and SHALL record in the evidence log which props and conventions were used. Design §5 records what this spec relied on; it does not replace the read.

**[REQ-REL-57] No claim without a run**
Every statement in the QA note and the evidence log about a command SHALL come from a run in that session, with the command and its result. Every browser, screen-reader, physical-display, phone, or second-device check SHALL read "NOT RUN". The T4.3 physical calibration lines SHALL stay "not run". The QA note SHALL NOT contain a number the session did not measure.

**[REQ-REL-58] The workspace stays clean**
At the end of the implementation, no `coverage/` directory, `.next` change committed, dev server, background process, temporary route, temporary test, or `/tmp` reference SHALL remain. Any temporary fault-injection route used for REQ-REL-60 SHALL be deleted, and `git status` SHALL show only the intended files.

---

## 10. Integration acceptance

**[REQ-REL-59] Suite acceptance**
`npm test`, `npm run typecheck`, `npm run lint` (0 errors; the one existing `AgeBand` warning in `packages/mcp-catalog` is accepted and SHALL be the only warning), `npm run validate-catalog`, `npm run coverage`, and `npm run build` SHALL all pass. The test count SHALL exceed 1502.

**[REQ-REL-60] A boundary fires on a real server**
The session SHALL show once, against a real Next.js server, that `app/error.tsx` renders for a thrown error. The method (design §6.4): add one temporary route under `app/` that awaits `searchParams` and then throws, start `next dev` on a free port, `curl` the route, and assert the response HTML contains the fallback `h1` and not the thrown message; then repeat against `next build` plus `next start` if the production build accepts the route; then delete the route and stop the server. The result (including a failure, or "dev only") SHALL be recorded. The unmatched-URL fallback SHALL be checked the same way with `curl` on a URL that matches no route (expected status 404 and the "We couldn't find that page." heading). A browser rendering of any fallback is NOT RUN.

---

## 11. Traceability to the brief

| Brief item | Requirements |
|---|---|
| (a) boundaries and loading states | REQ-REL-01 to REQ-REL-12 |
| (b) edge states | REQ-REL-13 to REQ-REL-22 |
| (c) no unhandled rejection, no `redirect()` in try/catch | REQ-REL-23 to REQ-REL-25 |
| (d) property-test expansion | REQ-REL-26 to REQ-REL-37 |
| (e) coverage | REQ-REL-38 to REQ-REL-42 |
| (f) performance sanity | REQ-REL-43 to REQ-REL-46 |
| (g) LLM-off pass, Gemini UNBUILT | REQ-REL-47 to REQ-REL-52 |
| Constraints and regression | REQ-REL-53 to REQ-REL-60 |
