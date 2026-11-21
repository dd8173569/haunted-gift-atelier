# Reliability (Milestone 5) — QA note

Status: manual and browser checks NOT RUN; every number below was taken by the session that wrote it. This note covers Waves 0 to 5 (T0.1 to T5.4). No browser exists on this machine, so no browser check is claimed.

## Baseline (measured in M5 at dd2e064)

All figures are "baseline, measured in M5", taken at HEAD `dd2e064` with a clean tree (only the untracked `.kiro/specs/reliability/` existed) before any M5 code change.

### Tests

`npm test`: 55 test files passed (55), 1502 tests passed (1502). No "Unhandled" line in the output. Duration 85.8 s.

### Build

`npm run build` (Next.js 16.4.6, Turbopack) passed. Route table:

```
┌ ○ /
├ ○ /_not-found
├ ◐ /atelier
├ ◐ /find
├ ◐ /picks
└   /piece/[sku]
  ├ ◐ /piece/[sku]
  ├ ◐ /piece/TPN-1149
  ├ ◐ /piece/TPN-1459
  └ ◐ [+20 more paths]
```

"Generating static pages using 3 workers (30/30)". The build prints no size column.

### First-load client JavaScript (design §8, steps 2 to 5)

Method: for each route, the file set is `entryJSFiles` + every `clientModules[*].chunks` path from the route's `page_client-reference-manifest.js`, plus `rootMainFiles` and `polyfillFiles` from `.next/build-manifest.json`, de-duplicated, `.js` only. Size is `gzipSync(file).length` summed, in kB (bytes / 1000), one decimal.

| Route | Symbol | Files | gzip kB |
|---|---|---|---|
| `/` | ○ | 8 | 178.5 |
| `/find` | ◐ | 8 | 184.9 |
| `/picks` | ◐ | 8 | 183.5 |
| `/atelier` | ◐ | 8 | 189.6 |
| `/piece/[sku]` | ◐ | 9 | 191.8 |
| `/_not-found` | ○ | 7 | 175.2 |

`du -sk .next/static`: 1140 kB.

### Server response time (design §8 step 7)

`npm run start -- --port 3126`, `curl -s -o /dev/null -w '%{time_total}'`, three requests per URL, on the build machine. This is server time, not LCP. LCP, TTFB on a real network, and 4G behaviour are NOT measured (no browser, no deployed URL).

| URL | Seconds (3 runs) | Median |
|---|---|---|
| `/` | 0.0577, 0.0049, 0.0045 | 0.0049 |
| `/find` | 0.1735, 0.0336, 0.0287 | 0.0336 |
| `/atelier` | 0.0772, 0.0302, 0.0264 | 0.0302 |
| `/piece/TNZ-1056` | 0.0694, 0.0303, 0.0335 | 0.0335 |
| `/picks?m=<golden 1>` | 0.0273, 0.0236, 0.0209 | 0.0236 |

Baseline `/picks` with no `m`: HTTP 200. A `grep -o '<meta http-equiv="refresh"[^>]*>'` on the body matched nothing, so that pattern is not how the tag is written. The Wave 1 check below reads the body again with a looser pattern, on both builds.

## Pre-flight (T0.2)

Next.js docs re-read before writing any `app/` file: `error.md`, `loading.md`, `not-found.md` under `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/` (16.4.6).

Facts confirmed against the docs (they match design §5.8):

- `error.js` props: `error: unknown` (narrow with `instanceof Error` before reading `message` or `digest`) and `retry: () => void`. `reset` also exists; the docs say to prefer `retry()`.
- `error.js` wraps `loading.js`, `not-found.js`, `page.js`, and nested layouts; it does not wrap the layout above it. `global-error.js` replaces the root layout, must define `<html>` and `<body>`, gets no global styles, and cannot export `metadata`.
- `loading.js` takes no parameters and does not wrap `error.js`.
- `not-found.js` takes no props; Next.js injects `noindex`; the status is 404 before streaming and 200 after.

Greps (design §2 finding 4), run at `dd2e064`:

| Check | Result |
|---|---|
| `redirect`, `notFound`, `forbidden(`, `unauthorized(` in `app/ components/ lib/` | Two call sites only: `app/picks/page.tsx:31-32` (`redirect`) and `app/piece/[sku]/page.tsx:55` (`notFound`). Both are outside any `try`. Matches the spec. |
| `try` in `app/` | None (two comments mention it). |
| `process.env`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` in `app components lib data scripts` | No matches. |
| `app/api/` | Does not exist. |
| `catch` in `components/` | `useCalibration.ts:23`, `useCalibration.ts:33`, `GiftWrap.tsx:92`. None empty-bodied by intent; each sets a fallback state. |
| `async`, `.then(`, `await` in `components/` | `GiftWrap.tsx:88` `copyMessage` (inside `try`/`catch`). No `.then(`. |
| `async` in `app/` | The four page default exports (`find`, `atelier`, `picks`, `piece/[sku]`) plus `generateStaticParams` and `generateMetadata` in `piece/[sku]/page.tsx`. |

`lib/` `catch` sites for the S1 allow-list (T2.2): `lib/catalog.ts:297` (`catch (e)`, catalog parsing), `lib/model-param.ts:38` (`parseModelParam`), `lib/true-size.ts:75` (`parseCalibration`). Three sites, matching REQ-REL-25.

Layout-only dependencies of the three reused components (design §5.2): `SiteHeader.tsx` imports `next/link` only; `ActionButton.tsx` imports a React type only; `AtelierButton.tsx` imports `next/link` and a React type only. None imports `next/font` or reads a font variable. `SiteHeader` uses `font-display`, which resolves through the root layout's font variable when present. `SiteHeader` is used in `app/error.tsx` and `app/not-found.tsx` (inside the root layout) and not in `app/global-error.tsx`.

Finding: no difference from the spec. No spec edit was needed.

## Wave 1: boundaries and loading state (T1.1 to T1.5)

### Next.js props and conventions used (REQ-REL-56)

Read from `error.md`, `loading.md`, `not-found.md` (16.4.6) before writing.

- `app/error.tsx`: props `error` (typed `unknown`, narrowed with `instanceof Error` and a local `Error & { digest?: string }`) and `retry`. `reset` is not used. The file is a Client Component (`"use client"`).
- `app/global-error.tsx`: Client Component with its own `<html lang="en">` and `<body>`, imports `./globals.css`, takes `retry` only (the `error` prop is typed but never read). No `next/font`.
- `app/not-found.tsx`: takes no props (per `not-found.md`). Server Component.
- `app/loading.tsx`: takes no parameters (per `loading.md`). Server Component.

### Files written

`app/error.tsx` (52 lines), `app/global-error.tsx` (45), `app/not-found.tsx` (24), `app/loading.tsx` (9), `tests/reliability.fallbacks.ui.test.tsx` (225). No existing file was edited; `tests/a11y.static.test.ts` accepted the `<a href="/">` in `global-error.tsx` without an allow-list change.

### Deviation from the spec

`app/global-error.tsx` also contains `<head><title>The atelier couldn't open</title></head>`. The spec did not list it. Axe reported `document-title` (serious) for the document without it, and `global-error` cannot export `metadata` (`error.md` points to the React `<title>` component as the alternative). The title is fixed text, holds no wordmark, and adds no import. The design §5.2 snippet and REQ-REL-05 should list it; the spec files were not edited in this task.

### Check results (all run in this session)

| Check | Result |
|---|---|
| `npm test` (full) | 56 files, 1533 tests passed (baseline 55 files, 1502; +1 file, +31 tests). No "Unhandled" line. |
| `npx vitest run tests/reliability.fallbacks tests/a11y tests/polish tests/conversation.static tests/gift-presentation.static` | 10 files, 633 tests passed. |
| `npm run typecheck` | clean. |
| `npm run lint` | 0 errors, 1 warning (`packages/mcp-catalog/src/index.ts` `AgeBand`, the known one). `eslint app tests/reliability.fallbacks.ui.test.tsx` clean. |
| `npm run validate-catalog` | `CATALOG OK: 22 products, version 1.0.0, 2 warning(s)` (the two width warnings). |
| `npm run build` | passed; "Generating static pages using 3 workers (30/30)". Route table identical to baseline: `/` ○, `/_not-found` ○, `/atelier`, `/find`, `/picks`, `/piece/[sku]` and its paths ◐. |

### REQ-REL-11 checks (`npm run start -- --port 3126`, server stopped afterwards)

| Check | Result |
|---|---|
| `curl localhost:3126/picks` | HTTP 200; body contains `<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=/find"/>`. Same as baseline (frozen M2 OQ-1, unchanged). |
| `curl "localhost:3126/picks?m=<golden 1>"` (`m` computed by `tsx` from `GOLDEN1_TAPS` through `toModel` and `encodeModelParam`, then URL-encoded) | HTTP 200; first occurrences in order: TBZ-1013, TNZ-1056, TBZ-1017; the price footnote is present. |
| Route table symbols and static page count | equal to the baseline (30). |

`app/loading.tsx` therefore stays (Q-REL2 not triggered). The text "Opening the atelier" now appears in the `/picks` response, as designed.

Also observed, not asserted by the spec: `curl localhost:3126/nope` (no matching route) answers HTTP 404 and the body contains "couldn't find that page" (HTML-escaped as `couldn&#x27;t`). This is the REQ-REL-60 unmatched-URL check run early; Wave 4 owns the formal record.

### First-load JavaScript after Wave 1 (same method as the baseline, gzip kB)

| Route | Baseline kB (files) | After Wave 1 kB (files) | Difference kB |
|---|---|---|---|
| `/` | 178.5 (8) | 183.3 (9) | +4.8 |
| `/find` | 184.9 (8) | 192.9 (10) | +8.0 |
| `/picks` | 183.5 (8) | 191.6 (10) | +8.1 |
| `/atelier` | 189.6 (8) | 197.7 (10) | +8.1 |
| `/piece/[sku]` | 191.8 (9) | 196.5 (10) | +4.7 |
| `/_not-found` | 175.2 (7) | 183.3 (9) | +8.1 |

`du -sk .next/static`: 1172 (baseline 1140).

Finding for T4.2: four routes exceed the +4.0 kB budget of REQ-REL-45 (`/find`, `/picks`, `/atelier`, `/_not-found`, each about +8 kB); `/` and `/piece/[sku]` are +4.8 and +4.7, also above 4.0. REQ-REL-45 is assessed after Wave 3, but the cause was narrowed here with two extra builds (files restored afterwards):

| Build | Files present | Result |
|---|---|---|
| A | all four fallbacks | table above |
| B | `error.tsx`, `global-error.tsx`, `not-found.tsx`, no `loading.tsx` | sizes identical to A, so `app/loading.tsx` adds nothing measurable |
| C | none of the four | sizes identical to the baseline |

So the added bytes come from `error.tsx`, `global-error.tsx`, and/or `not-found.tsx`. B and C did not separate those three, and the cause (framework error-boundary chunks versus this repo's components) is not established. T4.2 must investigate it and either explain it or reduce it; the 4.0 kB threshold is not raised to pass.

### Not run

No browser exists on this machine. Keyboard and screen-reader walkthrough of the fallbacks, forced colours, 320 px and 200% zoom, reduced motion on the loading line, and layout shift from the loading line are NOT RUN. Axe ran in jsdom with the repo's `runAxe` (colour-contrast and target-size rules off, as in `tests/helpers/axe.ts`); contrast and 44 px targets are guarded by the class-based tests only.

### Counterexamples

None found in Wave 1 (no property suite exists yet).

## Wave 2: edge-state hardening (T2.1 to T2.4)

### T2.1 Build-time catalog gate (REQ-REL-19; Q-REL5)

`package.json` gained `"prebuild": "npm run validate-catalog"`; no other script and not `scripts/validate-catalog.ts` changed. Failure path, shown against a temporary root (`/tmp/rel-root` with a copy of `data/catalog.json` whose second product carries the first product's SKU, `public/` symlinked, `data/catalog-changelog.md` copied), `npm run validate-catalog -- --root /tmp/rel-root`:

```
NOTE: version-bump check skipped (no --base)
FAIL [REQ-CD-01] TPN-1149 sku: duplicate sku
CATALOG VALIDATION FAILED: 1 error(s)
```

Exit code 1. Success path, `npm run prebuild` against the real catalog: exit 0, `CATALOG OK: 22 products, version 1.0.0, 2 warning(s)` plus the two width warnings. `cmp` of `data/catalog.json` against the backup: identical; `git diff --stat -- data` empty; the backup and the temporary root were deleted. Whether Vercel accepts a lifecycle script is still Q-REL5 (open; not testable here).

### T2.2 Static reliability rules (`tests/reliability.static.test.ts`, 28 tests, REQ-REL-23 to 25, 35, 49)

Pinned: the four boundary files, their directives and exports; the fallbacks import no catalog, matching, view, or model module and contain no `searchParams`, `params`, `localStorage`, `₹`, `<img`, `<Image`; no `redirect`, `permanentRedirect`, `notFound`, `forbidden`, or `unauthorized` inside a `try`, `catch`, `finally`, or `.then(`/`.catch(` (a brace matcher with its own self-test; the only two call sites in `app/` and `components/` are `app/picks/page.tsx` `redirect` and `app/piece/[sku]/page.tsx` `notFound`); no `.then(`/`.catch(` chain in `app/` or `components/`; the `async` functions are the four page functions, `generateMetadata`, `generateStaticParams`, and `GiftWrap` `copyMessage`, and every `await` in `components/` sits inside a `try`; the `lib/` `catch` sites are exactly `lib/catalog.ts` (rethrows), `lib/model-param.ts`, `lib/true-size.ts`; no `app/api/`, no `app/__fault`, no LLM import, no LLM dependency in `package.json`, no `process.env`, no `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` in `app components lib data scripts`; `package.json` has `prebuild`, `npm test` does not collect coverage; `vitest.config.ts` does not set `dangerouslyIgnoreUnhandledErrors`. The `coverage` script assertion is left to T4.1.

Finding: `components/useCalibration.ts` `write()` has `catch { /* keep the in-memory value; no error is shown */ }`. With comments stripped the body is empty, which a plain "no empty catch" regex flags. The fallback is defined: `memory = raw` is assigned before the `try`. The rule is split into two tests: no catch is empty even counting comments, and the one comment-only catch is on a reviewed list of exactly this site, checked for the `memory = raw` assignment before the `try`. The spec's wording ("no empty catch") was not weakened for any other file. No component was edited.

### T2.3 Catalog failure at runtime (`tests/reliability.catalog-failure.test.ts`, 4 tests, REQ-REL-20)

`vi.doMock('../data/catalog.json', …)` with a duplicated SKU; `import('../lib/catalog-store')` rejects with `CatalogBuildError` (`req` `REQ-CD-01`, `field` `sku`, `message` "duplicate sku"); importing `app/atelier/page` rejects the same way; `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `app/loading.tsx` all render in the same registry, with no `₹` and no error text; `data/catalog.json` on disk is unchanged. `vi.doUnmock` and `vi.resetModules()` run in `afterEach`.

Deviation from design §6.4 wording: the design says the error message "contains the duplicated SKU". `CatalogBuildError` carries the SKU in its `sku` field and its message is only "duplicate sku", so the test asserts `sku`, `req`, `field`, and `message`. The validator's report (T2.1) prints the SKU. This failure cannot occur after a build that passed `prebuild` (the JSON is bundled); the test covers a corrupted deployment artefact and nothing more.

### T2.4 Browser-API tests exist and pass (REQ-REL-22; no test added)

`npx vitest run tests/true-size.ui tests/gift-wrap.ui tests/true-size.property`: 3 files, 73 tests passed. Named tests found:

- `tests/true-size.ui.test.tsx`: "a localStorage.setItem that throws still calibrates in memory, with no error"; "a localStorage that throws on read falls back to memory"; "still calibrates when localStorage.setItem throws".
- `tests/gift-wrap.ui.test.tsx`: "shows the fallback when the clipboard is missing, without throwing"; "shows the fallback when the clipboard rejects".
- `tests/true-size.property.test.ts`: "P-TS-4 calibration storage" (2 properties).

## Wave 3: property and sweep suites (T3.1 to T3.5)

All property suites run at `seed: 20261201`; no browser was used.

| Suite | File | Tests | Runs |
|---|---|---|---|
| Generators | `tests/helpers/route-arbitrary.ts` (+ `tests/helpers/browse-reference.ts`) | helper | |
| R1 to R5 | `tests/reliability.routes.property.test.ts` | 8 | R1 400, others 300 |
| E1 | `tests/reliability.matching.sweep.test.ts` | 1 | exhaustive, 34,560 models |
| B1 | `tests/reliability.browse.sweep.test.tsx` | 2 | exhaustive, 450 combinations |
| M1 | `tests/money.property.test.ts` | 8 | 500 |

`tests/helpers/browse-reference.ts` is an addition beyond the task list: the independent reference filter (raw catalog fields, band edges 2500, 15000, 25000 as literals), shared by R3 and B1 so both check `lib/browse.ts` against one reference and not two copies. It imports neither `lib/browse.ts` nor `lib/catalog.ts`.

Generator coverage, read from the run (`console.info`): R1's 400 runs drew 232 missing, 127 invalid, 41 ok `m` values (all three classes reached; the ok share is low because the mix is the one from `conversation.property`). R4's 300 runs drew 60 known and 240 unknown SKUs.

### E1 whole-space model sweep (REQ-REL-14, 32)

Time first: the full enumeration with all checks took 1.2 to 1.3 s, so no reduction of `occasion` was needed; the full 34,560 models (4 × 8 × 5 × 3 × 6 × 12) were swept. Pick-count distribution, from the run:

| Picks | Models |
|---|---|
| 0 | 10,512 |
| 1 | 1,440 |
| 2 | 5,184 |
| 3 | 17,424 |

Distinct shortfall notes (4), with the number of models: "Only 2 pieces in the atelier are listed for Mom" 8,640; "Only 2 pieces fit this recipient even after widening — browse the full atelier." 4,320; "No pieces fit this recipient even after widening — browse the full atelier." 2,736; "Only 1 piece fits this recipient even after widening — browse the full atelier." 1,440.

**Models returning 0 picks: yes, 10,512.** The design guessed a minimum of 1 or 2. A one-off breakdown (a temporary test, deleted) put 7,776 of them in the Mom band (two in-stock pieces, both earrings, and the Mom flow never asks for a category, so a Mom model with another category is not reachable by taps), 1,440 in teens, 864 in kids, 432 in infants. These are product observations, not failures of any invariant: the I5 invariants hold on all of them (note defined, browse link on). `lib/matching` was not changed. Every model satisfied: no throw, at most 3 picks, no duplicate SKU, every pick In Stock, `toPickViews` has the same SKUs in the same order, a short result implies a note and a browse link, and `none-religious` implies no religious piece. `/picks` was rendered through `PicksPage` for 300 shortfall classes (11 coarse classes of pick count, note, and age band, then disclosure variants up to the cap), each checked for card count equal to the picks, SKU order, the note verbatim, "Browse the full atelier", "Change my answers", and no filler card, including 0-pick classes. The pure-function fallback branch for a zero-model catalog stays in the test but did not run.

### B1 whole-space filter sweep (REQ-REL-16, 33)

450 combinations rendered through `CatalogGrid`; 283 empty selections, 16 selections that include the out-of-stock card. Each matches the reference cards and order; out-of-stock last; the empty-state sentence and "Clear filters" appear once iff the selection is empty; every in-stock card has exactly one buy link equal to the catalog `url`; the out-of-stock card has none.

Deviation from REQ-REL-16 / REQ-REL-33 wording ("exactly one price footnote when it shows any price and none when it shows none"): the grid renders one footnote in all 450 combinations, including the 283 empty ones. `CatalogGrid` is one price region, and its budget chips print `₹` ranges ("Under ₹2,500") on every render, so there is always a `₹` text under that one footnote. The test pins the current behaviour (one footnote and one price region per grid, above the first card) and says so. Whether budget-band text needs the footnote is the frozen Q-PD18, so it is referenced and not resolved. The requirement text should be updated by the coordinator.

### R1 to R5 route totality

No route function threw anything but the redirect or 404 signal, for any generated input. `/piece/TNZ-1058` showed no buy link, no gift wrap, and the out-of-stock sentence for every generated `m`; every in-stock SKU with a valid `m` carried exactly one buy link equal to the catalog `url`.

### M1 money

`formatInr` over integers in [0, 10^9] (plus boundary values at each power of ten, clamped to 10^9) and the 22 catalog prices: pattern `^₹(\d{1,3}|\d{1,2}(,\d{2})*,\d{3})$`, round trip, no `.`/`NaN`/`Infinity`, determinism, monotone digit count, negative form `-₹…` with the digits of the absolute value. No counterexample.

### Counterexamples (Wave 3)

One finding, in the oracle and not in the code:

- **C-R2-1 (R2, `/find`).** Counterexample (seed 20261201, shrunk): `m = {"relationship":"niece-nephew","ageBand":"infants","ageYears":0,"occasion":"other","budgetBand":"under-2500","metal":"gold","symbols":"any","category":"pendant"}`. The first oracle ("for a valid `m` the recipient card renders", REQ-REL-28) failed because the page rendered "Question 2 of 6, What's the occasion?" instead. Cause: `stateFromModel` skips `occasion: "other"` (no chip offers it) and a non-Mom model without `ageYears` has no age chip, so resume lands on the first unanswered question (conversation design §2.6, P-CV-8), not on the card. The code is as designed. Fix: in the test oracle. The card (headline and "Reveal my picks") must appear when `occasion !== "other"` and (Mom or `ageYears` defined); otherwise a question must appear and the card must not. REQ-REL-28 is over-broad and should say so. The test is not loosened: the card is still asserted wherever resume is complete.

Two other edits during this wave were not counterexamples: the T2.2 comment-only `catch` rule split and the T2.3 error-field assertion (both above). No `lib/` defect was found, so the task did not stop.

### Cost of the new suites

`npm test` before Wave 2: 55 files, 1502 tests, 85.8 s (baseline); after Wave 3: 62 files, 1584 tests, 96.5 s (one run on one machine, from the Vitest summary), about +10.7 s. Tests added since the Wave 1 count of 1533: +51 (static 28, catalog-failure 4, routes 8, matching sweep 1, browse sweep 2, money 8). `npx vitest run tests/reliability tests/money` (the Wave 1 fallback file plus the new suites): 7 files, 78 tests, 14.1 s wall. No "Unhandled" line in the full run.

### Wave 2 and 3 checks

| Check | Result |
|---|---|
| `npm test` | 62 files, 1584 tests passed; no "Unhandled" line. |
| `npx vitest run tests/reliability tests/money` | 7 files, 78 tests passed. |
| `npm run typecheck` | clean. |
| `npm run lint` | 0 errors, 1 warning (the known `AgeBand` in `packages/mcp-catalog`). |
| `npm run validate-catalog` | `CATALOG OK: 22 products, version 1.0.0, 2 warning(s)`. |
| `git diff --stat` | `package.json` only (+1 line, the `prebuild`). `data/`, `lib/`, `public/` untouched. |

Not run: no browser check was made. `npm run build` was not re-run in this session; Wave 4 owns the build and size measurements, including the `prebuild` hook running inside `npm run build`.

## Wave 4: coverage, performance, LLM-off, real-server boundary (T4.1 to T4.4)

### T4.1 Coverage (REQ-REL-38 to 42; Q-REL3)

Options used (REQ-REL-56), checked against the installed `@vitest/coverage-v8` 5.1.1 / `vitest` 5.1.1 types (`node_modules/vitest/dist/chunks/plugin.d.*.d.ts`, `CoverageOptions`): `provider: "v8"`, `include`, `exclude`, `reporter` (`text-summary`, `json-summary`), `reportsDirectory`, and `thresholds` with `lines`, `statements`, `functions`, `branches`. All names exist as written in the design; no spec correction was needed. `perFile` exists and is not used (Q-REL3: whole-`lib/`).

`package.json` gained `"coverage": "vitest run --coverage"`; `npm test` is unchanged and does not collect coverage (asserted by `tests/reliability.static.test.ts`, which also asserts the new script). `vitest.config.ts` gained the `test.coverage` block of design §7.1.

Measured in M5 (first run, no thresholds; 62 files, 1584 tests passed), whole `lib/`:

| Metric | Measured | Threshold set (floor(measured) − 1) |
|---|---|---|
| Lines | 99.02% (815/823) | 98 |
| Statements | 98.91% (1004/1015) | 97 |
| Functions | 100% (219/219) | 99 |
| Branches | 97.42% (757/777) | 96 |

Every threshold is at least 80 and no higher than the measured figure. `npm run coverage` with the thresholds: exit 0 (62 files, 1585 tests). `npm run coverage -- --coverage.thresholds.lines=101`: `ERROR: Coverage for lines (99.02%) does not meet global threshold (101%)`, exit 1. No override is committed.

Per-file table (from `coverage/coverage-summary.json`; lines shown as percent and covered/total):

| File | Lines | Statements | Functions | Branches |
|---|---|---|---|---|
| lib/browse.ts | 100 (31/31) | 100 | 100 | 100 (24/24) |
| lib/catalog-store.ts | 100 (1/1) | 100 | 100 | 100 (0/0) |
| lib/catalog.ts | 92.7 (89/96) | 91.74 | 100 | 85.29 (58/68) |
| lib/conversation.ts | 99.54 (218/219) | 99.33 | 100 | 98.26 (283/288) |
| lib/gift-message.ts | 100 (14/14) | 100 | 100 | 100 (8/8) |
| lib/matching.ts | 100 (34/34) | 100 | 100 | 100 (31/31) |
| lib/model-param.ts | 100 (15/15) | 100 | 100 | 100 (12/12) |
| lib/page-meta.ts | 100 (8/8) | 100 | 100 | 100 (4/4) |
| lib/picks-view.ts | 100 (14/14) | 100 | 100 | 100 (10/10) |
| lib/piece-view.ts | 100 (9/9) | 100 | 100 | 100 (6/6) |
| lib/safety-materials.ts | 100 (21/21) | 100 | 100 | 100 (18/18) |
| lib/safety-rules.ts | 100 (6/6) | 100 | 100 | 100 (3/3) |
| lib/safety-weight.ts | 100 (26/26) | 100 | 100 | 100 (15/15) |
| lib/safety.ts | 100 (62/62) | 100 | 100 | 100 (41/41) |
| lib/size-spec.ts | 100 (44/44) | 100 | 100 | 100 (35/35) |
| lib/true-size.ts | 100 (48/48) | 100 | 100 | 100 (39/39) |
| lib/matching/age.ts | 100 (7/7) | 100 | 100 | 100 (11/11) |
| lib/matching/explain.ts | 100 (22/22) | 100 | 100 | 90.9 (20/22) |
| lib/matching/filters.ts | 100 (25/25) | 100 | 100 | 100 (33/33) |
| lib/matching/rank.ts | 100 (19/19) | 100 | 100 | 100 (24/24) |
| lib/matching/relax.ts | 100 (34/34) | 100 | 100 | 100 (24/24) |
| lib/matching/scoring.ts | 100 (13/13) | 100 | 100 | 100 (27/27) |
| lib/matching/templates.ts | 100 (55/55) | 100 | 100 | 91.17 (31/34) |
| lib/matching/types.ts | 100 (0/0) | 100 | 100 | 100 (0/0) |

Files under 80% lines: none. The lowest is `lib/catalog.ts` at 92.7% lines (7 uncovered lines) and 85.29% branches. The session did not inspect those lines, so it gives no reason for them; the figure matches the M1 ad-hoc figure the spec cites as history. No test was added for coverage.

Informational pass (REQ-REL-39), `npm run coverage -- --coverage.include='components/**' --coverage.include='app/**'` with all four thresholds overridden to 0 so the `lib/`-only gate did not apply: 36 files; statements 98.36% (420/427), branches 96.35% (264/274), functions 97.97% (145/148), lines 99.21% (379/382); no file under 80% lines. These are information, not a gate. `coverage/` was deleted after each pass.

### T4.2 Performance after (REQ-REL-43 to 46; Q-REL4)

`npm run build` passed. The `prebuild` hook ran first: the build log opened with `> haunted-gift-atelier@0.1.0 prebuild` and `CATALOG OK: 22 products, version 1.0.0, 2 warning(s)`, then `next build`. "Generating static pages using 3 workers (30/30)". Route table identical to the baseline (`/` ○, `/_not-found` ○, `/atelier`, `/find`, `/picks`, `/piece/[sku]` and its 22 paths ◐). Same method as the baseline (design §8 steps 2 to 5; gzip kB = bytes / 1000). The same figures were produced by three builds (after Wave 1, T4.2, and the final build).

| Route | Symbol (baseline / after) | Baseline kB (files) | After kB (files) | Difference kB | Within +4.0? |
|---|---|---|---|---|---|
| `/` | ○ / ○ | 178.5 (8) | 183.3 (9) | +4.8 | no |
| `/find` | ◐ / ◐ | 184.9 (8) | 192.9 (10) | +8.0 | no |
| `/picks` | ◐ / ◐ | 183.5 (8) | 191.6 (10) | +8.1 | no |
| `/atelier` | ◐ / ◐ | 189.6 (8) | 197.7 (10) | +8.1 | no |
| `/piece/[sku]` | ◐ / ◐ | 191.8 (9) | 196.5 (10) | +4.7 | no |
| `/_not-found` | ○ / ○ | 175.2 (7) | 183.3 (9) | +8.1 | no |

`du -sk .next/static`: 1140 baseline, 1172 after (+32). The build prints no size column, so there is no Next.js-own figure to record.

**REQ-REL-45 result: not met.** Symbols and the static page count (30) match; every route is above the +4.0 kB limit (+4.7 to +8.1). The limit was not raised. The cause is below.

**Cause (measured by removing one file at a time and rebuilding).** Each of `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` was moved out of `app/` for one build and restored afterwards, with the two test files that import them (`tests/reliability.catalog-failure.test.ts`, `tests/reliability.fallbacks.ui.test.tsx`) held aside for the same build because `next build` type-checks `tests/` and failed on the missing imports (the first attempt failed for that reason and changed nothing). Files and tests were restored after each build; `git status` listed the same 13 `app/` and `tests/` entries afterwards. First-load gzip kB:

| Build | `/` | `/find` | `/picks` | `/atelier` | `/piece/[sku]` | `/_not-found` |
|---|---|---|---|---|---|---|
| none of the three (baseline file set) | 178.5 | 184.9 | 183.5 | 189.6 | 191.8 | 175.2 |
| all of them | 183.3 | 192.9 | 191.6 | 197.7 | 196.5 | 183.3 |
| without `error.tsx` | 178.8 | 188.5 | 187.2 | 193.3 | 192.1 | 178.8 |
| without `global-error.tsx` | 182.9 | 192.6 | 191.3 | 197.4 | 196.2 | 182.9 |
| without `not-found.tsx` | 183.3 | 189.6 | 188.3 | 194.4 | 196.5 | 180.0 |

Share of each file (all minus the build without it; the three do not add to the total exactly, because chunks are shared): `error.tsx` +4.4 to +4.5 kB on every route; `not-found.tsx` +3.3 kB on `/find`, `/picks`, `/atelier`, `/_not-found` and 0.0 on `/` and `/piece/[sku]`; `global-error.tsx` +0.3 to +0.4 kB on every route. For `/find`: 4.4 + 3.3 + 0.3 = 8.0, the observed difference.

What those bytes are, read from the built chunks:

- `error.tsx` is a Client Component, so everything it imports is compiled into client JavaScript. Its chunk (`static/chunks/11-2nkkro3ton.js`, 4,438 B gzip) contains the fallback copy ("Something went wrong with that page.") and the code of `SiteHeader`, which is otherwise server-rendered. Next.js lists the error boundary's chunk in every route's client manifest, so every route loads it.
- `not-found.tsx` is a Server Component, but it renders `AtelierButton`, which uses `next/link`. The `next/link` client module chunk (`static/chunks/1elud1o77e445.js`, 3,300 B gzip; module `useLinkStatus` / `default`) is in the first-load set of `/find`, `/picks`, `/atelier`, and `/_not-found` when `not-found.tsx` exists, and not in the baseline set. `/` and `/piece/[sku]` already loaded it, which is why their `not-found.tsx` share is 0.0.
- `global-error.tsx` is its own 854 B gzip chunk (`2a8kbf2c5zqil.js`).
- `app/loading.tsx` adds nothing measurable (Wave 1, build B).

The design expected "well under 2 kB". That estimate did not account for `error.tsx` pulling the shared header and `next/link` into client code. The increase is the cost of the fallbacks reusing `SiteHeader`, `ActionButton`, and `AtelierButton` (REQ-REL-02 and REQ-REL-09 ask for the existing components and tokens). A smaller `error.tsx` (plain markup and `<a>` instead of the shared components) or a decision to accept the cost is the coordinator's call (Q-REL4: the 4.0 kB figure is a judgement). No file was changed to reduce it.

Server response time (design §8 step 7), `npm run start -- --port 3126` with the five key variables unset, `curl -s -o /dev/null -w '%{time_total}'`, three requests per URL, on the build machine:

| URL | Seconds (3 runs) | Median (baseline median) |
|---|---|---|
| `/` | 0.057941, 0.006129, 0.004849 | 0.0061 (0.0049) |
| `/find` | 0.167253, 0.032824, 0.030327 | 0.0328 (0.0336) |
| `/atelier` | 0.086929, 0.029541, 0.043753 | 0.0438 (0.0302) |
| `/piece/TNZ-1056` | 0.052926, 0.028716, 0.032844 | 0.0328 (0.0335) |
| `/picks?m=<golden 1>` | 0.055905, 0.026388, 0.034665 | 0.0347 (0.0236) |

These are server times on the build machine from `curl`, three runs each, one machine, no controlled load. The differences between runs are of the same size as the spread within a run; no conclusion about a slowdown is drawn. **LCP, TTFB on a real network, and 4G behaviour are NOT measured** (no browser, no deployed URL). The architecture §7 LCP budget (< 2.5 s on 4G) is not claimed. M6 measures it on the deployed URL.

### T4.3 LLM-off pass (REQ-REL-47 to 52)

Server: `env -u GEMINI_API_KEY -u GOOGLE_API_KEY -u GOOGLE_GENERATIVE_AI_API_KEY -u OPENAI_API_KEY -u ANTHROPIC_API_KEY npm run start -- --port 3126` on the production build of T4.2. A `grep -c` of those five names in the shell environment printed 0. Golden-1 `m` was computed with `tsx` (`run(GOLDEN1_TAPS)` → `toModel(answers)` → `encodeModelParam`, URL-encoded), not typed. HTML was stripped of `<script>` blocks before counting (Python regex, as the page is one line).

| Request | Result |
|---|---|
| `/` | 200 |
| `/find` | 200 |
| `/atelier` | 200; 22 `<article` cards |
| `/picks?m=<golden 1>` | 200; first occurrences in order: TBZ-1013, TNZ-1056, TBZ-1017; the footnote "Price as listed on tinytiaraa.com on 21 Nov 2026" occurs twice in the body (the page has two price regions; the count is a fact, not asserted by the spec) |
| `/picks` (no `m`) | 200; `<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=/find"/>` (frozen M2 OQ-1) |
| `/piece/TBZ-1013?m=<golden 1>` | 200; one `<h1`; the fit-check line "A fit check from the atelier — guidance, not a safety certification. When in doubt, check with the brand or the child's parents." present once (after HTML unescape); one "Buy on Tiny Tiaraa" link whose `href` equals the catalog `url` of TBZ-1013 (compared after HTML unescape); one price footnote |
| `/piece/TNZ-1058` | 200; one `<h1`; 0 "Buy on Tiny Tiaraa"; "Out of stock" present |

`npx vitest run tests/journey.golden tests/matching.personas` (run with the five variables unset, no server needed): 2 files, 28 tests passed (`journey.golden` 19, `matching.personas` 9). The journey by taps runs with no network.

REQ-REL-50: no free-text input exists; REQ-CV-44 not applicable. REQ-CV-43 holds: no `app/api/`, no `process.env`, no `fetch(` in the source (asserted by `tests/reliability.static.test.ts`).

**Browser walkthrough: NOT RUN.**

**Gemini layer (REQ-REL-51): UNBUILT.** The optional free-tier Gemini phrasing layer (PRD §4, `app/api/chat/route.ts`, `conversation` spec REQ-CV-43 to REQ-CV-45) is not built in Milestone 5. Reason: no API key exists and none was provided. The scripted-only journey is the shipped and tested default (PRD §4 ship decision, PRD open question 1). Architecture §9 names the optional LLM layer first in the scope-cut order. No code, route, environment variable name, or test for it exists. Whether to obtain a key and build it goes to the Tue 24 Nov checkpoint (Q-REL1, REQ-REL-52).

The server was stopped, and every `/tmp/rel-*` file was removed.

### T4.4 A boundary fires on a real server (REQ-REL-60)

Deviation from design §6.4 step 1: the temporary route could not be `app/__fault/`. In the App Router a folder whose name starts with an underscore is a private folder and is not routed. The first dev request to `/__fault` answered 404 ("We couldn't find that page."). The route was moved to `app/zzfault/page.tsx` (`export default async function Fault({ searchParams }) { await searchParams; throw new Error("fault-injection-secret"); }`). Design §6.4 should name a non-underscore folder. The S1 test asserts there is no `app/__fault`, which still holds; `app/zzfault` was deleted too.

1. Dev server (`next dev --port 3125`), `curl localhost:3125/zzfault`: HTTP 200 (streamed). The HTML has no `<h1`. The thrown text `fault-injection-secret` is not in the HTML markup, but it is in the RSC payload in a `<script>` (`"message":"fault-injection-secret"` with a `stack` that names the repo path); the dev server log shows the same error. The shell contains the loading line "Opening the atelier…". This is a dev-only difference: development ships the real message and stack in the stream; the fallback `h1` was not in the response body, so it was not asserted present by `curl`.
2. Production (`npm run build` with the route present, then `npm run start --port 3126`): the build did not reject the route ("Generating static pages (31/31)", the route table listed `◐ /zzfault`). `curl localhost:3126/zzfault`: HTTP 200 (headers `x-nextjs-prerender: 1`, `x-nextjs-postponed: 1`). The body contains the loading line and `"digest":"2217057328"`; `fault-injection-secret` appears 0 times; "Something went wrong with that page." appears 0 times in the HTML and the body references the `error.tsx` client chunk (`11-2nkkro3ton.js`, which holds that sentence). The server log shows `Error: fault-injection-secret` with a digest. So the secret is masked in production, but the fallback `h1` is not in the `curl` output: the route is a partial prerender whose dynamic part streams after the shell with status 200, and the boundary renders in the browser after hydration. The explanation is inferred from the headers and the payload; it was not tested further (for example without `app/loading.tsx`). **The visible fallback `h1` on a thrown Server Component error is therefore NOT VERIFIED by `curl`; it needs a browser (NOT RUN).** What the real server proved: the error boundary file is wired (its chunk is referenced by the response), the thrown text is not sent in production, and a digest is.
3. `app/zzfault` deleted. A second build was needed: the dev server had left `.next/dev/types/validator.ts` naming the deleted route, and `next build` failed type-checking (`Cannot find module '../../../app/zzfault/page.js'`). That is a stale build artefact, not a repo file: `rm -rf .next/dev` and a new `npm run build` passed (30/30).
4. Unmatched URL on the production server, `curl /this-route-does-not-exist`: HTTP 404; the `h1` is "We couldn't find that page."; `<meta name="robots" content="noindex"/>` present. `/zzfault` now answers 404.
5. `app/zzfault` is gone; no dev or start process remains (checked with `ps` and a `curl` that returned no connection on ports 3125 and 3126); `git status` shows nothing for it.

### Wave 4 checks

| Check | Result |
|---|---|
| `npm test` | 62 files, 1585 tests passed (+1: the `coverage` script assertion); no "Unhandled" line. |
| `npm run typecheck` | clean (exit 0). |
| `npm run lint` | 0 errors, 1 warning (`packages/mcp-catalog/src/index.ts` `AgeBand`, the known one). |
| `npm run validate-catalog` | `CATALOG OK: 22 products, version 1.0.0, 2 warning(s)` (the two width warnings). |
| `npm run coverage` | passes (exit 0); `coverage/` removed afterwards. |
| `npm run build` | passes; 30 static pages. |

## Wave 5: final verification and hand-off (T5.1 to T5.4)

### T5.1 Whole-suite verification (REQ-REL-53, 59)

| Command | Result |
|---|---|
| `npm test` | 62 test files passed (62), 1585 tests passed (1585); 0 lines matching "Unhandled"; duration 101.3 s. Baseline 55 files / 1502 tests; +7 files, +83 tests. The file count equals the Wave 3 count (62): Wave 4 added one test to an existing file, so the "more than 62 files" expectation in the task text was not met and no new file was needed. |
| `npm run typecheck` | clean, exit 0. |
| `npm run lint` | 0 errors, 1 warning (`AgeBand`, `packages/mcp-catalog/src/index.ts:14`), exit 0. |
| `npm run validate-catalog` | `CATALOG OK: 22 products, version 1.0.0, 2 warning(s)`; the two width warnings (TNZ-1058, TNZ-1056). |
| `npm run coverage` | exit 0; lines 99.02%, statements 98.91%, functions 100%, branches 97.42%. |
| `npm run build` | passes; 30/30 static pages; route table as in the baseline. |

In the same `npm test` run: `tests/matching.golden.test.ts` (23 tests), `tests/journey.golden.test.tsx` (19), `tests/matching.personas.test.ts` (9), all green.

### T5.2 Counterexamples (REQ-REL-37)

- M5 property and sweep suites: one finding, C-R2-1 (Wave 3 above), fixed in the test oracle, not the code. No `lib/` defect was found. Waves 4 and 5 found none.
- Earlier counterexamples are in `docs/kiro-evidence-log.md`, not re-run here: M1 at lines 223 (P-CD-2, rounding bound) and 272 (matching I3 and I4, `widenAbove` and `broadenSymbol`); M2 at line 528 (`normalize()` with a leftover `adultIsMom`); M4 at lines 1018 and 1220 (P-PD-4 "name exactly once" generator fix; the digit rule on "18KT gold", spec question SQ-1); the log's own tally is at line 1244.

### T5.3 Independent audit

Not run. The `qa-auditor` agent was not invoked, so the checks in this note were made by the session that built the work and are not independent of the build (as the M4 audit noted). REQ-REL-02, REQ-REL-09, REQ-REL-23 to 25, and REQ-REL-49 are guarded by `tests/reliability.static.test.ts` and `tests/reliability.fallbacks.ui.test.tsx`; no separate reader checked them.

### NOT RUN

Keyboard and screen-reader walkthrough of the fallbacks; forced colours; 320 px and 200% zoom on the fallbacks; phone; reduced motion on the loading line and layout shift from it; the visible fallback `h1` on a thrown error in a real browser; LCP on 4G (and TTFB on a real network); deployed-URL and second-device checks; T4.3 physical calibration of `gift-presentation` (needs a card and a ruler); `/piece/NOPE-0000` production status (frozen); a browser walkthrough of the journey.

### Open questions as they stood

Q-REL1 key and Gemini layer: UNBUILT, goes to the Tue 24 Nov checkpoint. Q-REL2 loading fallback: kept; the REQ-REL-11 checks passed (Wave 1); screen-reader noise is NOT RUN. Q-REL3 coverage per file or whole `lib/`: whole `lib/` used, per-file table recorded, no file under 80%. Q-REL4 size limit (+4.0 kB) and a committed script: the limit is exceeded on every route with the cause above (a coordinator decision); the measurement stays a documented command sequence. Q-REL5 `prebuild` on Vercel: ran locally in `npm run build`; Vercel is untested (M6). Q-REL6 catalog-specific failure message: no. Q-REL7 `global-error` typography: accepted. Q-REL8 digest line: shown. Q-REL9 frozen items (M2 OQ-1, `/piece/NOPE-0000`, Q-PD18, the four matching questions): referenced, unchanged. Q-REL10 multi-symbol sweep: not done.

### Spec updates for the coordinator

Global-error `<title>` in design §5.2 and REQ-REL-05; REQ-REL-28 resume wording (C-R2-1); REQ-REL-16 and REQ-REL-33 footnote on an empty grid; design §6.4 step 1 (no underscore folder name; the `curl` of a production fault route does not show the fallback `h1`); design §5 expectation of "well under 2 kB" for the boundaries (measured +4.4 kB for `error.tsx` and +3.3 kB for the `next/link` chunk that `not-found.tsx` brings in); REQ-REL-45 limit (breached, explained).

### T5.4 Tree

At the end of the session: no `coverage/`, no `app/__fault` or `app/zzfault`, no `/tmp/rel-*` file, no server on ports 3125 or 3126. `git diff --stat -- data public lib` is empty. `git status` lists `package.json` and `vitest.config.ts` (modified) and, untracked, `.kiro/specs/reliability/`, `app/error.tsx`, `app/global-error.tsx`, `app/loading.tsx`, `app/not-found.tsx`, `docs/qa-reports/reliability-m5.md`, `tests/helpers/browse-reference.ts`, `tests/helpers/route-arbitrary.ts`, `tests/money.property.test.ts`, and the five `tests/reliability.*` files. `package-lock.json` is unchanged. `tests/a11y.static.test.ts` is unchanged. Nothing was committed.
