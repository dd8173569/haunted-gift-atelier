# Reliability (Milestone 5) — Design

*Implements REQ-REL-01 to REQ-REL-60 (`requirements.md`). Source: PRD §3 (property invariants), §4 (LLM boundary and fallback), §5, §6; architecture §7 (testing strategy, performance budget), §9 (M5 row, scope-cut order); specs `conversation` (REQ-CV-18 to REQ-CV-25, REQ-CV-43 to REQ-CV-45, OQ-1), `matching-core` §8 (I1 to I7, P-MC-8 to P-MC-15), `polish-deploy` (REQ-PD-14, 16, 23, 28, 47, 48, 52; Q-PD18). Nothing in `lib/`, `data/`, `public/`, `app/globals.css`, or any existing component or page changes.*

## 1. Overview

```
Layer 1  app/ (4 new files)   error.tsx · global-error.tsx · not-found.tsx · loading.tsx      (static, data-free fallbacks)
Layer 2  package.json         prebuild (validate-catalog) · coverage script
Layer 3  vitest.config.ts     coverage block: v8, lib/** only, thresholds from measurement
Layer 4  tests/ (new files)   route totality properties · exhaustive sweeps · money property · static rules · fallback UI
Layer 5  docs/                qa-reports/reliability-m5.md (measurements, UNBUILT record, NOT RUN list) · evidence log (coordinator)
```

The boundaries sit at the top of the segment tree, so one file per boundary kind covers all five routes. No page gets a `try`/`catch`. Layers 1 to 3 are small; the milestone's weight is the tests of layer 4, which pin what the pages already do on every edge state.

### Ownership (REQ-REL-54)

| Owner | Writes |
|---|---|
| `design-polish` agent | `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `app/loading.tsx` |
| Builder session or `gift-curator` | `package.json`, `vitest.config.ts`, `tests/**` (including `tests/helpers/route-arbitrary.ts`), `docs/**` |
| `qa-auditor` agent | `docs/qa-reports/` only, read-only on code |

### File map

| File | Contents | Client? |
|---|---|---|
| `app/error.tsx` | segment boundary (§5.1) | yes (required) |
| `app/global-error.tsx` | root boundary, own `<html>` (§5.2) | yes (required) |
| `app/not-found.tsx` | root 404 (§5.3) | no |
| `app/loading.tsx` | text-only loading fallback (§5.4) | no |
| `tests/helpers/route-arbitrary.ts` | `arbParam`, `arbSearchParams`, `arbSku`, `arbFilterParams` (§6.2) | n/a |
| `tests/reliability.routes.property.test.ts` | R1 to R5 (§10) | node, `renderToStaticMarkup` |
| `tests/reliability.matching.sweep.test.ts` | E1 (§4.2) | node |
| `tests/reliability.browse.sweep.test.tsx` | B1 (§4.3) | node (`renderToStaticMarkup`) |
| `tests/money.property.test.ts` | M1 | node |
| `tests/reliability.static.test.ts` | S1 (§6.3) | node |
| `tests/reliability.fallbacks.ui.test.tsx` | F1 (§6.1) | jsdom per file |
| `tests/reliability.catalog-failure.test.ts` | REQ-REL-20 (`vi.doMock`) | node |
| `docs/qa-reports/reliability-m5.md` | measurements and records (§9) | n/a |

## 2. What the code review found

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| 1 | The only boundary is `app/piece/[sku]/not-found.tsx`. There is no `error.tsx`, `global-error.tsx`, `loading.tsx`, or root `not-found.tsx`. | `find app -name '*.tsx'`; the built `.next/server/app` holds Next.js's default `_global-error` and `_not-found` | A thrown error or an unmatched URL shows Next.js's unbranded default page, with no way back into the journey. REQ-REL-01, 05, 06. |
| 2 | Two places throw on purpose and rely on a boundary that does not exist: `toPickViews` throws when a pick is missing from the catalog, out of stock, duplicated, or more than 3 (`lib/picks-view.ts`); `parseCatalog` throws `CatalogBuildError` when `lib/catalog-store.ts` is first imported. | `lib/picks-view.ts`, `lib/catalog-store.ts`; conversation design §5 ("trip the Next.js error boundary") | The design said the error boundary would show; it does not exist. REQ-REL-01, 20. |
| 3 | `app/layout.tsx` wraps `children` in `<Suspense fallback={null}>`, so while `/find`, `/picks`, `/atelier`, or `/piece/[sku]` stream their body (all four set `instant = false`), the shell is blank under the skip link. | `app/layout.tsx`; M4 evidence T3.4 | REQ-REL-10, with the REQ-PD-48 limits. |
| 4 | `/picks` calls `redirect()` at the top level, outside any `try`. `/piece/[sku]` calls `notFound()` the same way. No other `redirect`, `notFound`, `try`, or `catch` exists in `app/`. `components/` has two `catch` blocks that set fallbacks (`useCalibration.ts`, `GiftWrap.tsx`) and one `async` function (`copyMessage`). No `fetch`, `process.env`, or `app/api/` exists anywhere. | `grep` over `app components lib scripts data` at HEAD `dd2e064` | The rules REQ-REL-23 to REQ-REL-25 and REQ-REL-49 are true today; the work is to pin them so they stay true. |
| 5 | Route functions are callable as plain async functions in the node environment (`tests/piece.route.test.tsx`, `tests/helpers/pages.tsx`) and a thrown `redirect()` or `notFound()` carries a readable `digest`. `tests/picks.ui.test.tsx` already pins two digests for two fixed `m` values. | those files | R1 to R4 can run in the node environment with `renderToStaticMarkup`, with no browser. |
| 6 | `vitest.config.ts` has no `coverage` block and `package.json` has no `coverage` script, though `@vitest/coverage-v8` is installed. `/coverage` is in `.gitignore`. | files | REQ-REL-38 to REQ-REL-42. |
| 7 | The Next.js 16 Turbopack build prints a route table but, in this repo's M4 record, no per-route size column. | evidence log T3.4 and T4.2 record the table and "30 static pages" only | The size baseline does not exist; REQ-REL-43 creates it. |

## 3. Existing coverage and the candidates dropped

The brief names five candidate suites. Each was checked against the 10 existing property files and the UI tests. A suite is kept only where an invariant is missing.

| Candidate | Already pinned by | Verdict |
|---|---|---|
| Browse and filter invariants over all filter combinations | `conversation.property` P-CV-11 (`filterItems` is an ordered sub-list equal to the AND of the four predicates; adding a filter never grows it; 22 items, 21 in stock first) and P-CV-12 (`parseBrowseFilters` never throws; round trip). `atelier.ui` "single-filter combination: OOS card has no buy link". | **Keep the gap only:** the rendered grid over all 450 combinations (B1), and the route function over arbitrary params (R3). The pure filter logic stays as is. |
| Picks-view invariants | `conversation.property` P-CV-9 (`toPickViews` mirrors `match()` and the catalog; ≤ 3; In Stock) and P-CV-13 (twice gives equal output). | **Drop** as a standalone suite. E1 extends it to the whole model space as part of the sweep. |
| `parseModelParam` over arbitrary strings | `conversation.property` P-CV-4 (never throws on `fc.anything()`, 600 runs; `ok` implies a valid model `match()` accepts; every mutation rejected) and `model-param.test`. | **Drop.** R1 to R4 test the route functions that consume it, which no test does for arbitrary input. |
| Price and footnote invariants over all 22 SKUs | `picks.ui` (every in-stock product through `PickCard`), `atelier.ui` P-CV-10 (grid), `piece.route.test` (all 22 pieces), `polish.copy.test` (22 SKUs × screens), `gift-presentation.static`. | **Drop.** Keep one new fact only: `formatInr` itself has example tests but no property (M1). |
| Conversation transition invariants not already covered | `conversation.property` P-CV-1 to P-CV-8, P-CV-13: valid model on every path, back never changes answers, normalisation, step gating and purity, round trip, religious opt-in, age chips, resume. The `arbFlow` generator already includes `back`, `edit`, `restart`. | **Drop.** No gap found. |
| Matching invariants over the whole model space | `matching.property` I1 to I7 and P-MC-8 to P-MC-15, 500 runs, sampled. | **Keep the gap only:** the 0-, 1-, and 2-pick states are rare in a random sample. E1 enumerates the finite space so every short or empty state is hit (REQ-REL-14). It repeats I1, I5, I4 on purpose, over the whole space; it adds the shortfall and render checks that no sample reaches reliably. |
| Browser-API failure (storage, clipboard) | `true-size.ui` ("localStorage.setItem that throws", "throws on read", "still calibrates when setItem throws"), `gift-wrap.ui` ("clipboard is missing"), `true-size.property` P-TS-4. | **Drop.** REQ-REL-22 verifies they still run. |

New suites: R1 to R5 (`reliability.routes.property`), E1 (`reliability.matching.sweep`), B1 (`reliability.browse.sweep`), M1 (`money.property`), S1 (`reliability.static`), F1 (`reliability.fallbacks.ui`), and `reliability.catalog-failure`. Existing tests are not edited, so none of their pins moves (REQ-REL-53). The new generators live in a new helper file, not in the existing `conversation.property.test.ts`, for the same reason.

## 4. Edge-state design

### 4.1 Route functions as the unit

Each page default export is an `async` function of `{ params?, searchParams }`. A test calls it, and either catches the thrown framework signal or renders the returned element with `renderToStaticMarkup` (as `piece.route.test.tsx` does, with `next/image` mocked to `<img>`). This exercises the real parse, match, view, and render path for each edge input, without a server.

| Signal | How a test recognises it |
|---|---|
| `redirect()` | thrown object whose `digest` matches `/^NEXT_REDIRECT;(replace\|push);([^;]*);/`, target in the third group (`tests/picks.ui.test.tsx` uses the same pattern) |
| `notFound()` | `digest === 'NEXT_HTTP_ERROR_FALLBACK;404'` (`tests/piece.route.test.tsx`) |
| anything else | a failure of the property, reported with the generated input |

`renderToStaticMarkup` does not run effects or client-only code, which is right: the properties are about the server render. Client behaviour (chips, Back, Edit, filters) is pinned by the existing jsdom suites.

### 4.2 The finite model space (E1)

`match()` reads `ageBand`, `occasion`, `budgetBand`, `metal`, `symbols`, `symbolList`, and `category`. It does not read `relationship` (REQ-MC, "Relationship does NOT score") and reads `ageYears` only through the band. The sweep fixes `relationship` to `'mom'` for the Mom band and `'other'` otherwise, omits `ageYears`, and enumerates the rest.

| Axis | Values | Count |
|---|---|---|
| `ageBand` | infants, kids, teens, mom | 4 |
| `occasion` | the 8 values of `OCCASIONS` (includes `other`, which the UI never offers but the type allows) | 8 |
| `budgetBand` | 4 bands + `no-limit` | 5 |
| `metal` | gold, silver, any | 3 |
| `category` | pendant, bracelet, earrings, set, tabeez, any | 6 |
| symbol choice | `any`, `zodiac`, `evil-eye`, `none-religious` (4); `religious` with no list (1); `religious` with each single symbol key (7) | 12 |

Total 4 × 8 × 5 × 3 × 6 × 12 = **34,560 models**. Multi-symbol lists are not enumerated (the 2^7 lists would multiply the space by 128); the sampled `matching.property` suite covers them. Each model is checked with the invariants of REQ-REL-32. The implementation SHALL measure the run time first. WHEN the sweep takes longer than 60 s on the build machine, it SHALL reduce `occasion` to the four values that differ in scoring (`naming`, `festival`, `rakhi`, `just-because`) and record the new count; it SHALL NOT sample at random.

The test collects `(pick count → number of models)` and the distinct shortfall notes, and writes both into the QA note by `console.info` (read from the run, not typed by hand). For rendering, it groups models by `(pick count, shortfallNote, joined disclosures, ageBand)`, renders `/picks` for one model per group (capped at 300 groups), and asserts the REQ-REL-14 markup. Whether any model returns 0 picks is a result, not an assumption: the matching ladder drops metal, then category, and the Mom band lists 2 in-stock pieces, so the likely minimum is 1 or 2; the test asserts what it finds and says so in the QA note.

### 4.3 The filter space (B1)

| Axis | Values | Count |
|---|---|---|
| age | all, infants, kids, teens, mom | 5 |
| category | all + 5 | 6 |
| metal | all, gold, silver | 3 |
| budget | all + 4 bands | 5 |

5 × 6 × 3 × 5 = **450 combinations**. For each, `CatalogGrid` renders to static markup with `initialFilters` set, and the test counts cards by their `data-sku`-style marker (whatever attribute `BrowseCard` already carries; the implementation reads `components/BrowseCard.tsx` and uses the existing attribute, adding none). The reference selection is written in the test from raw `data/catalog.json` fields (`age_groups`, `category`, materials via the catalog's own `metal`, `price_inr` against the four band edges 2500, 15000, 25000 written as literals), not through `lib/browse.ts`, so the two implementations check each other.

### 4.4 Unknown and malformed SKUs (R4)

`arbSku` draws from: the 22 real SKUs; each real SKU lower-cased, padded with a space, truncated, suffixed with a character, and percent-encoded; the empty string; `fc.string()`; and a long string. The oracle is `catalog.products.some(p => p.sku === sku)`. The oracle uses strict equality, as the page does, so "tnz-1056" and "TNZ-1056 " are unknown (REQ-GP-02 already pins four of these by example).

### 4.5 Failed catalog (REQ-REL-19, REQ-REL-20)

| Moment | What happens | Where it is handled |
|---|---|---|
| Authoring | `data/catalog.json` is edited and saved | `.kiro/hooks/catalog-validation.json` runs `validate-catalog` on save (exists) |
| Build | `npm run build` | New `prebuild` runs `npm run validate-catalog`. A failure exits 1 with `FAIL [REQ-CD-xx] SKU field: message` before Next.js starts. If validation passes, `lib/catalog-store.ts` parses at build and cannot fail differently. |
| Runtime | The built app imports a JSON bundled into the server output, so it is the build's JSON. A parse failure at import would need a corrupted artefact. | `app/error.tsx` / `app/global-error.tsx`, which import no catalog module |

Why a `prebuild` rather than relying on `parseCatalog`: `parseCatalog` throws `CatalogBuildError` with a good message, but inside a Next.js build the message arrives wrapped in a prerender stack. The validator prints a flat, numbered report and also checks things `parseCatalog` does not (image files exist and are valid PNG or JPEG; `count` equals the array length; version bump rules with `--base`). `npm run validate-catalog` takes under a second. Whether a lifecycle script is acceptable on Vercel is open question Q-REL5.

## 5. Error-handling architecture

```
app/layout.tsx  (SkipLink, <Suspense fallback={null}>)           ← failures here → global-error.tsx
 └─ app/error.tsx           boundary for everything below it     ← NOT wrapping the layout above
     └─ app/loading.tsx     Suspense fallback around page        ← wraps page + not-found, not error
         └─ app/not-found.tsx   (root 404; notFound() and unmatched URLs)
         └─ page.tsx   (/, /find, /picks, /atelier, /piece/[sku] + its own not-found.tsx)
```

This order follows `error.md` ("`error.js` wraps `loading.js`, `not-found.js`, `page.js`, and nested `layout.js`; it does not wrap the `layout.js` above it") and `loading.md` ("`loading.js` wraps `not-found.js`, `page.js`, and nested `layout.js` in a `<Suspense>` boundary; it does not wrap `error.js`"). `app/piece/[sku]/not-found.tsx` is the nearest not-found for an unknown SKU and stays the pinned page; the root `app/not-found.tsx` catches everything else.

### 5.1 `app/error.tsx`

```tsx
'use client'
import { useEffect } from 'react'
import ActionButton from '../components/ActionButton'
// No SiteHeader, no AtelierButton: both pull client JavaScript into every route (size fix, 21 Nov 2026).
// The header is inline plain markup and the links are plain <a> with the shared components' classes.

export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && typeof error.digest === 'string' && error.digest !== '' ? error.digest : undefined
  useEffect(() => { console.error('[atelier] route error', digest ?? 'no digest') }, [digest])
  return (…)   // §5.5 table
}
```

- The header is a minimal inline `<header>`: a plain-text "Tiny Tiaraa" wordmark as a plain `<a href="/">` (same classes `SiteHeader` uses) plus a `<nav aria-label="Primary">` with a plain `<a href="/atelier">`. The two links in `main` are plain `<a>` elements carrying the exact `AtelierButton` secondary classes. `SiteHeader` and `AtelierButton` were used here until the REQ-REL-45 size fix (21 Nov 2026): the shared header compiled into the boundary's client chunk (+4.4 kB) and `AtelierButton` pulled in the `next/link` chunk. The inline class strings duplicate the shared components' classes and must be mirrored if those change. The plain anchors use `// eslint-disable-next-line @next/next/no-html-link-for-pages` with a reason where the rule fires (in this repo only `href="/"` is flagged; the `/atelier` and `/find` anchors carry a plain comment, since a directive there is reported unused).

- `error` is typed `unknown` and narrowed, per the Next.js 16.4.6 docs ("a value thrown in a Client Component is passed as-is and may not be an `Error`"). Reading `digest` on an `Error` needs a local type (`Error & { digest?: string }`); the implementation adds that type in the file, not a global declaration.
- The effect depends on `digest` only, so the line prints once per distinct error and never prints `message` or `stack`. In development the dev overlay already shows the full error; in production the server log holds the original under the same digest, which is how the reference line helps.
- `retry()` re-fetches and re-renders the segment (`error.md`, `retry`). `reset()` would clear the error state without re-fetching and is not used (REQ-REL-01). A retry of a deterministic failure fails again and shows the same fallback; the two links beside it are the way out.

### 5.2 `app/global-error.tsx`

```tsx
'use client'
import './globals.css'
import ActionButton from '../components/ActionButton'

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <head><title>The atelier couldn&apos;t open</title></head>
      <body className="min-h-full flex flex-col bg-pearl text-plum font-sans">
        <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-12 outline-none sm:px-10">
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">The atelier couldn&apos;t open.</h1>
          <p>Please reload the page. If it keeps happening, come back in a little while.</p>
          <div className="flex max-w-xs flex-col gap-3">
            <ActionButton variant="primary" onClick={() => retry()}>Reload</ActionButton>
            <a href="/" className="…secondary link classes…">Back to the start</a>
          </div>
        </main>
      </body>
    </html>
  )
}
```

Facts relied on (`error.md`, "Global Error"): it replaces the root layout and must define `<html>` and `<body>`; it does not get the app's global styles, so it imports `./globals.css` itself; `metadata` is not supported in it. Consequences:

- The file also carries `<head><title>The atelier couldn't open</title></head>`: axe flags `document-title` (serious) without a title, and `global-error` cannot export `metadata`, so the React `<title>` element is the fix the docs point to (M5 Wave 1 finding; REQ-REL-05 updated). The title is fixed text, holds no wordmark, and adds no import.
- The font variables (`--font-cormorant`, `--font-inter`) are defined by `next/font` in `app/layout.tsx`, which is not rendered. `font-display` and `font-sans` fall back to the generic families named in the `@theme` block. Importing `next/font` a second time would duplicate the font files, so this file does not. The heading therefore appears in the fallback serif, and the "Tiny Tiaraa" wordmark is not shown (REQ-REL-05). Open question Q-REL7.
- `<a href="/">` is a plain anchor on purpose: a full-document navigation discards all client state, which is what a root failure needs. `@next/next/no-html-link-for-pages` flags it; the implementation adds a single `// eslint-disable-next-line @next/next/no-html-link-for-pages` with this reason beside it. If `tests/a11y.static.test.ts` rejects a raw `<a>` or `<button>`, the test's allow-list gains the file by name with the reason, which is the only edit to an existing test the milestone permits (REQ-REL-53). `ActionButton` is used for "Reload", so the "every button comes from ActionButton" rule holds.
- No `SkipLink` and no `SiteHeader`: the page has one `h1`, two controls, and nothing to skip.
- Both props are named in the type; `error` is unused, and the file does not read it (a root failure shows no detail, REQ-REL-04).

### 5.3 `app/not-found.tsx`

Same structure as `app/piece/[sku]/not-found.tsx` (a Server Component, inline minimal header, `main`, `h1`, two links), with the heading "We couldn't find that page." and the same two links in the same order ("Browse the atelier" primary, "Find a gift" secondary). The header is the same inline minimal header as `error.tsx` (plain-text wordmark link to `/`, nav link to `/atelier`), and the two links are plain `<a>` elements carrying the exact `AtelierButton` classes — `SiteHeader` and `AtelierButton` were used here until the REQ-REL-45 size fix (21 Nov 2026), because `AtelierButton` pulls the `next/link` chunk (+3.3 kB) into the first-load set of routes that otherwise never load it. Next.js adds `<meta name="robots" content="noindex">` itself (`not-found.md`). The status is 404 when the check runs before streaming and 200 after (`loading.md`, "Status codes"); this is the same class of behaviour as frozen item (4), so the QA note records what `curl` shows for an unmatched URL and does not assert a status the framework does not guarantee (REQ-REL-60).

### 5.4 `app/loading.tsx`

```tsx
export default function Loading() {
  return <p role="status" aria-busy="true" className="mx-auto w-full max-w-6xl px-6 py-8 text-plum/75 sm:px-10">Opening the atelier…</p>
}
```

It sits inside the root layout, so the skip link is present; it needs no `main` of its own because the page that replaces it supplies `main#main-content` (REQ-PD-05). The text is the only content: no card, price, photo, or pinned string (REQ-PD-48). It has no animation. Risks, each tied to a check:

| Risk | Check |
|---|---|
| A fallback around `/picks` changes the shell the redirect streams from, and breaks the 200 + meta-refresh of frozen item (3) | REQ-REL-11: curl `/picks` with no `m`; golden-1 `m` order; route table symbols; static page count |
| The status line is announced on every navigation | Open question Q-REL2. The streamed body replaces the line within the 60 to 220 ms M4 measured, so the announcement is brief. |
| The fallback shifts the layout | Not measurable here (no browser); recorded NOT RUN |

### 5.5 Fallback content (the only new copy this milestone)

| File | `h1` | Body | Controls |
|---|---|---|---|
| `app/error.tsx` | "Something went wrong with that page." | "You can try again, start a new search, or browse the atelier." Then, only with a digest: "Reference: {digest}". | "Try again" (button, primary) · "Find a gift" (link `/find`, secondary) · "Browse the atelier" (link `/atelier`, secondary) |
| `app/global-error.tsx` | "The atelier couldn't open." | "Please reload the page. If it keeps happening, come back in a little while." | "Reload" (button, primary) · "Back to the start" (`<a href="/">`, secondary) |
| `app/not-found.tsx` | "We couldn't find that page." | none | "Browse the atelier" (primary) · "Find a gift" (secondary) |
| `app/loading.tsx` | none (status line) | "Opening the atelier…" | none |

The strings are plain and fixed. They carry no price, rating, product fact, or safety word, and none of the forbidden words of REQ-REL-09. They are not pinned by an earlier spec; once built, they are pinned by F1. "We couldn't find that piece." stays the piece page's heading.

### 5.6 What is shown, what is logged

| Item | Shown to the user | Logged |
|---|---|---|
| Fixed fallback copy | yes | no |
| `error.digest` | "Reference: {digest}" when present | `console.error('[atelier] route error', digest)` once, in the browser console |
| `error.message`, `error.stack` | never | never from the client. Server-side, Next.js writes the original error with the same digest to the server log (a platform log, not new code). |
| The request URL, the `m` value, the recipient model | never | never. The model holds no personal data (REQ-CV-18), but the fallback has no reason to echo a URL. |
| Anything to a remote service | no | no (`tech.md`: no runtime external API) |

### 5.7 Framework signals and the rest of the stack

- `redirect()` and `notFound()` are thrown objects with a digest that Next.js routes itself; they never reach `error.tsx`. The boundary files do not look at the digest's prefix, and no page has a `try` (REQ-REL-07, REQ-REL-23). S1 pins this.
- A production Server Component error reaches `error.tsx` with a generic message and a digest; a development one carries the real message. The fallback ignores the message in both, so the two builds render the same markup (F1 asserts it).
- The `toPickViews` throws (missing SKU, out of stock, duplicate, more than 3) and the `CatalogBuildError` throw (REQ-REL-20) both end in `error.tsx`. Neither is reachable from user input; E1 proves the first set unreachable over the whole model space, and REQ-REL-19 makes the second unreachable after a passing build.

### 5.8 Next.js facts this design relied on (read from `node_modules/next/dist/docs/`, version 16.4.6)

| Fact | Source | Used in |
|---|---|---|
| `error.js` props are `error` and `retry` (`retry` stable since v16.3.0; `unstable_retry` was v16.2.0); `reset` exists but `retry` is preferred. `error` may be any thrown value. | `01-app/03-api-reference/03-file-conventions/error.md` | §5.1 |
| `error.js` wraps `loading.js`, `not-found.js`, `page.js`, and nested layouts, not the layout above it in the same segment. | same | §5 diagram |
| `global-error.js` replaces the root layout, must define `<html>` and `<body>`, does not receive global styles, and cannot export `metadata`. | same, "Global Error" | §5.2 |
| `loading.js` wraps `not-found.js`, `page.js`, nested layouts in a `<Suspense>`; not `error.js`. Streaming responses start with 200; a request-time `notFound()` after the shell is sent keeps 200. | `loading.md` | §5.4, REQ-REL-11, REQ-REL-60 |
| `app/not-found.tsx` renders for `notFound()` and carries `noindex`; 404 before streaming, 200 after. `global-not-found.js` is experimental and not used. | `not-found.md` | §5.3 |

The implementer re-reads these three files before writing (REQ-REL-56); the table is what the spec relied on, not a replacement for the read.

## 6. Test design

### 6.1 Fallback UI tests (F1, jsdom)

`tests/reliability.fallbacks.ui.test.tsx` starts with `// @vitest-environment jsdom` and imports `tests/helpers/dom.ts`. It renders each file's default export directly. For `error.tsx` it passes `retry = vi.fn()` and these thrown values: `new Error('secret detail')` with and without `digest`, `'a string'`, `null`, `{ message: 'x' }`. It asserts the structure and copy of §5.5; `retry` called once per click and not on mount; the digest line only for a non-empty string digest; `queryByText(/secret detail/)` is null; `console.error` spied once with the prefix and the digest. `global-error.tsx` is rendered with `render(<GlobalError … />, { container: document })` or by `renderToStaticMarkup` (an `<html>` root cannot mount inside a `div`); the test uses `renderToStaticMarkup` for its structure and a jsdom parse of that string for axe. Axe runs through `tests/helpers/axe.ts` (`runAxe`, REQ-PD-38 tags). Class assertions reuse `tests/helpers/targets.ts` for the 44 px rule.

### 6.2 Generators (`tests/helpers/route-arbitrary.ts`)

```ts
export const arbParam: fc.Arbitrary<string | string[] | undefined>   // same mix as conversation.property: valid, mutated, truncated, repeated, fc.anything() JSON, fc.string() up to MAX_PARAM_LENGTH+20, undefined
export const arbSearchParams: fc.Arbitrary<Record<string, string | string[] | undefined>>
   // keys: 'm' (arbParam), 'notice' (fc.oneof(constant('incomplete'), fc.string(), undefined)), plus 0..3 arbitrary extra keys with string or string[] values
export const arbFilterParams: fc.Arbitrary<Record<string, string | string[] | undefined>>
   // keys age, category, metal, budget: each valid value, an invalid string, a string[], or undefined
export const arbSku: fc.Arbitrary<string>                           // §4.4
```

`arbParam` is rebuilt here from `arbModel` (`tests/helpers/model-arbitrary.ts`) and `encodeModelParam`, with the same mutation kinds. It is a deliberate near-copy of the generator inside `conversation.property.test.ts`, because that file is not edited (REQ-REL-53); a comment in the helper names the source. Defaults: `seed: 20261201`, `numRuns: 300` (R1: 400, because valid models run `match()` and render), `fc.assert` through a local `assert` wrapper as the other suites do. `testTimeout` is raised in the files that render in a loop (R1 to R5, B1, E1).

### 6.3 Static rules (S1)

`tests/reliability.static.test.ts` reuses `tests/helpers/source-scan.ts` (`sourceFiles()` = every `.ts`/`.tsx` under `components/` and `app/`, comments stripped) and a small local reader for `lib/`, `data/`, `scripts/`. Rules, each an `it`:

| Rule | Method |
|---|---|
| The four boundary files exist; `error.tsx` and `global-error.tsx` start with `'use client'`; `error.tsx` has a default export taking `retry`; `global-error.tsx` contains `<html lang="en">` and `<body`; `app/loading.tsx` has `role="status"` and `aria-busy="true"`. | string match on the comment-stripped source |
| Fallbacks import no catalog module (REQ-REL-02): the four files' import specifiers match none of `catalog`, `catalog-store`, `data/`, `matching`, `picks-view`, `piece-view`, `model-param`; they contain no `searchParams`, `params`, `localStorage`, `₹`, `<img`, `<Image`. | regex over import lines and body |
| No framework signal inside a `try`, `catch`, or `.then(` callback (REQ-REL-23). | a brace-matching pass: find each `try {`, `catch (…) {` / `catch {`, `.then(` and its matching close; assert none of `redirect(`, `permanentRedirect(`, `notFound(`, `forbidden(`, `unauthorized(` falls inside; assert the two real call sites exist and are outside. |
| No empty `catch` in `app/` or `components/`; the `catch` blocks in `lib/` equal an allow-list (REQ-REL-25). | regex `catch\s*(\([^)]*\))?\s*\{\s*\}` over `app/`, `components/`; a list of `lib/` `catch` sites by file with a reason for each |
| Every `.then(` and every `async` function in `components/` and `app/` is on a reviewed list or is a page's default export (REQ-REL-24). | regex; the list is `GiftWrap.tsx copyMessage (try/catch)` plus the page functions |
| No LLM code, key, or network call (REQ-REL-49): no `app/api/`; no listed LLM specifier; no `process.env`; no `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` in `app/`, `components/`, `lib/`, `data/`, `scripts/`; `packages/mcp-catalog` is excluded because it is a Node tool, not the app. | `fs.existsSync`, regex |
| `vitest.config.ts` does not set `dangerouslyIgnoreUnhandledErrors`; `package.json` has the `coverage` and `prebuild` scripts and `npm test` has no `--coverage`. | read and `JSON.parse` |

`tests/conversation.static.test.ts` and `tests/gift-presentation.static.test.ts` already scan some of these for specific files; S1 is the repo-wide version and does not edit them.

### 6.4 Catalog failure test and the real-server fault check

`tests/reliability.catalog-failure.test.ts` (node): `vi.resetModules()`, `vi.doMock('../data/catalog.json', …)` returning a deep copy of the real catalog with `products[1].sku = products[0].sku` (a duplicate, the P-CD-7 fault), then `await import('../lib/catalog-store')` and `expect(...).rejects`/`toThrow` with a `CatalogBuildError` whose `sku` field names the duplicated SKU (its message is only "duplicate sku"; the validator's report prints the SKU — M5 Wave 2 finding). A second `it` imports the four fallback modules in the same module registry (the mock still active) and renders them: all four render, proving they do not depend on the catalog. `vi.doUnmock` and `vi.resetModules()` in `afterEach`.

The real-server fault check (REQ-REL-60) is a manual-by-command procedure, because no jsdom test can prove Next.js wires the file:

1. Create `app/zzfault/page.tsx` (temporary): `export default async function Fault({ searchParams }) { await searchParams; throw new Error('fault-injection-secret') }`. The `await` makes it request-time, so the prerender does not fail. (Do NOT use `app/__fault/`: a folder whose name starts with `_` is a private folder in the App Router and is not routed — M5 Wave 4 finding, the first attempt at `/__fault` answered 404.)
2. `npm run dev -- --port 3125 > /tmp/rel-dev.log 2>&1 &`, record the pid. `curl -s localhost:3125/zzfault` and assert the HTML contains "Something went wrong with that page." and does not contain `fault-injection-secret`. (In development, Next.js may render the dev overlay or the message in the HTML; record exactly what appears. A dev-only difference is a finding, not a failure of the production behaviour.)
3. Stop the dev server. `npm run build` then `npm run start -- --port 3126` with the fault route still present; repeat the `curl`. If the build rejects the route, record that and the message. (M5 finding: the fallback `h1` is NOT in the production `curl` output — the route is a partial prerender whose dynamic part streams after the shell, and the boundary renders in the browser after hydration. The visible `h1` on a thrown Server Component error needs a browser check, NOT RUN in M5. What `curl` proves: the boundary file is wired (its chunk is referenced), the thrown text is masked in production, and a digest is issued.)
4. Delete `app/zzfault`, stop the server, remove `/tmp/rel-*`, run `git status`.
5. `curl -s -o /dev/null -w '%{http_code}'` and `curl -s` on `/this-route-does-not-exist` against the production server: record the status and whether "We couldn't find that page." appears.

The fault route is the one place this milestone writes an application file that is not kept. It is created and deleted in the same task, and S1 runs after the deletion (it asserts no `app/__fault`; the session used `app/zzfault`, which is deleted too).

## 7. Coverage measurement

### 7.1 Configuration

```ts
// vitest.config.ts (added block)
test: {
  include: [...], environment: 'node',
  coverage: {
    provider: 'v8',
    include: ['lib/**/*.ts'],
    exclude: ['lib/**/*.d.ts'],
    reporter: ['text-summary', 'json-summary'],
    reportsDirectory: 'coverage',
    thresholds: { lines: N, statements: N, functions: N, branches: N },   // N from the measurement, §7.2
  },
}
```

The exact option names (`thresholds`, `include`, `reporter`) are checked against the installed `@vitest/coverage-v8` 5.1.x types and docs before writing; a renamed option is recorded as a spec correction, not guessed. The `npm run coverage` script is `vitest run --coverage`.

### 7.2 What is included, what is not, and why

| Path | In the gate? | Reason |
|---|---|---|
| `lib/**/*.ts` | yes | `tech.md`: target ≥ 80% on `lib/`; this is the pure logic the properties and golden cases protect. Includes `lib/matching/*` and `lib/catalog-store.ts` (four lines, always imported). |
| `components/**`, `app/**` | no (measured once, reported) | They are exercised through jsdom and `renderToStaticMarkup`; line coverage of JSX is a weak signal, and the a11y, copy, and class suites assert behaviour directly. One informational run with `--coverage.include='components/**' --coverage.include='app/**'` goes in the QA note. |
| `scripts/validate-catalog.ts` | no | Run as a CLI in CI and by hook; its tests (`tests/validate-catalog.test.ts`, property tests on a fixture) drive its exported function, but `main()` and `process.exit` are not unit-testable usefully. |
| `packages/mcp-catalog/**` | no | A separate Node workspace with its own tool role. |
| `data/**` | no | Hand-curated data and maps, not logic. |
| `tests/**`, `*.d.ts`, `node_modules`, `.next`, `coverage` | no | Not product code (Vitest's default exclusions already cover tests, `node_modules`, and `.d.ts`). |

### 7.3 Procedure

1. After Wave 3 (so the new suites count), run `npm run coverage` once with no thresholds set. Read the whole-`lib/` percentages from `text-summary` and the per-file figures from `coverage/coverage-summary.json`.
2. Write them to the QA note as "measured in M5". Compute `N = floor(measured) − 1` for each of the four metrics, never below 80, never above measured (REQ-REL-40).
3. Add the `thresholds` block and run `npm run coverage` again: it passes.
4. Run once with `--coverage.thresholds.lines=101` to show the gate fails (REQ-REL-41). Do not commit that.
5. Record the per-file table, flag any file under 80% lines with a reason, and `rm -rf coverage` (the directory the script created; the session's own artefact).

A single file under 80% does not fail the gate (whole-`lib/`, Q-REL3); the QA note lists each such file so the choice is visible.

## 8. Performance measurement

The Next.js 16 Turbopack build in this repo does not print per-route first-load sizes (finding 7). The measurement therefore reads the build output on disk. It is a one-off command sequence kept in the QA note, not a committed script (YAGNI; Q-REL4).

1. `npm run build 2>&1 | tee /tmp/rel-build-<label>.log`, where `<label>` is `baseline` or `after`. Keep the route table lines (those starting `┌ ├ └` or containing `○`, `◐`, `ƒ`, `●`) and the line "Generating static pages (N/N)".
2. For each route pattern, load `.next/server/app/<route>/page_client-reference-manifest.js`: `/` is `.next/server/app/page_client-reference-manifest.js`; `/find`, `/picks`, `/atelier` are `<route>/page_…`; `/piece/[sku]` is `piece/[sku]/page_…`; the 404 is `_not-found/page_…`. Parse the object assigned to `globalThis.__RSC_MANIFEST["<route>/page"]`.
3. Collect the file set: every value in `entryJSFiles`, plus every path in each `clientModules[*].chunks` entry with the leading `/_next/` removed, plus `rootMainFiles` and `polyfillFiles` from `.next/build-manifest.json`. Remove duplicates.
4. For each file, `gzipSync(readFileSync('.next/' + file)).length`. Sum per route. Report kB with one decimal (`bytes / 1000`, state the divisor).
5. Record, per route: symbol, file count, gzip kB. Also record the total static page count and `du -sk .next/static`. Record wall-clock build time as information only.
6. Repeat after Wave 3; compare (REQ-REL-45). The baseline is taken first, at `dd2e064`, before any code change (task T0.1). If `app/loading.tsx` or `error.tsx` adds more than 4.0 kB gzip to any route, find the cause (a boundary importing a heavy module is the likely one) before changing the threshold.
7. With `npm run start` on a free port, `curl -s -o /dev/null -w '%{time_total} %{http_code}\n'` on `/`, `/find`, `/atelier`, `/piece/TNZ-1056`, and the golden-1 `/picks?m=…`, three times each; record the median. State that this is server time on the build machine, not LCP (REQ-REL-46).

M5 outcome (measured, REQ-REL-45): NOT met — every route grew +4.7 to +8.1 kB gzip over the dd2e064 baseline (`/` +4.8, `/find` +8.0, `/picks` +8.1, `/atelier` +8.1, `/piece/[sku]` +4.7, `/_not-found` +8.1). Cause, measured by removing one file at a time and rebuilding: `error.tsx` +4.4 kB on every route (a Client Component, so it pulls `SiteHeader`/`ActionButton`/`AtelierButton` into client JavaScript — its chunk is 4,438 B gzip); `not-found.tsx` +3.3 kB on `/find`, `/picks`, `/atelier`, `/_not-found` (the `next/link` chunk, 3,300 B gzip); `global-error.tsx` +0.3 kB; `loading.tsx` nothing measurable. The design's "well under 2 kB" estimate (Q-REL4) did not account for the boundary pulling the shared header and `next/link` into client code. The limit was NOT raised. Accepted as a known gap for the Tue 24 Nov checkpoint: cutting the cost means rewriting the fallbacks with plain markup instead of the shared components.

Size-fix outcome (21 Nov 2026, session 20, builder's call): MET on every route, limit not raised. After rewriting `error.tsx` and `not-found.tsx` with an inline minimal header and plain `<a>` links: `/` 180.3 (+1.8), `/find` 186.6 (+1.7), `/picks` 185.3 (+1.8), `/atelier` 191.4 (+1.8), `/piece/[sku]` 193.5 (+1.7), `/_not-found` 177.0 (+1.8), same method as above, independently re-measured by the coordinator with identical figures. The residual +1.7–1.8 kB is the two boundary chunks themselves (error 1,072 B gzip, global-error 854 B gzip, coordinator-measured). The `next/link` chunk (3,300 B gzip) is confirmed absent from the `/find`, `/picks`, `/atelier`, and `/_not-found` manifests (present only in `/` and `/piece/[sku]`, as in the baseline). A second chunk holding the global-error copy (4,301 B gzip) is referenced only by the `_global-error` route's own manifest, not by any measured route, so it costs the measured routes nothing. Full record: `docs/qa-reports/reliability-size-fix.md`.

The `.next` directory is a gitignored build artefact; the session leaves whatever the final `npm run build` produced, as in earlier milestones, and records no path under it as a deliverable. The `/tmp/rel-*` logs are deleted before the session ends (REQ-REL-58); the figures that matter are copied into the QA note.

## 9. The QA note and the LLM-off record

`docs/qa-reports/reliability-m5.md` is written during the implementation (Wave 4) with these sections: status line ("manual and browser checks NOT RUN; every number below was taken by the session that wrote it"); baseline and after measurements (§8); coverage figures (§7.3); sweep results (counts by pick count, from E1); the fault-injection result (§6.4); the LLM-off checks (REQ-REL-48, with each `curl` and its result); the Gemini layer record (REQ-REL-51); counterexamples (REQ-REL-37); a "NOT RUN" list (keyboard and screen-reader walkthrough of the fallbacks, forced colours, mobile, reduced motion on the loading line, LCP on 4G, deployed-URL checks, second device, T4.3 physical calibration, `/piece/NOPE-0000` production status); and the open questions as they stood. The coordinator writes the evidence-log entry from it (REQ-REL-57).

### LLM-off pass, as commands

```
env -u GEMINI_API_KEY -u GOOGLE_API_KEY -u GOOGLE_GENERATIVE_AI_API_KEY -u OPENAI_API_KEY -u ANTHROPIC_API_KEY \
  npm run start -- --port 3126 > /tmp/rel-start.log 2>&1 &   echo $! > /tmp/rel-start.pid
curl -s -o /dev/null -w '%{http_code}\n' localhost:3126/ localhost:3126/find localhost:3126/atelier
# /picks?m=<golden 1> : the three SKUs in order, then the footnote
# /picks              : 200 and a meta-refresh to /find (frozen item 3)
# /piece/TBZ-1013?m=<golden 1> : 200, one <h1, the fit-check line, one buy link equal to the catalog url
# /piece/TNZ-1058     : 200, no "Buy on Tiny Tiaraa"
kill "$(cat /tmp/rel-start.pid)"; rm -f /tmp/rel-start.*
```

Golden-1 `m` comes from `encodeModelParam` of the model that `tests/helpers/conversation-taps.ts` `GOLDEN1_TAPS` produces, computed in a one-line `tsx` call, not typed by hand. HTML is stripped of `<script>` blocks before counting (the page is one line; M4 used `grep -o | wc -l`).

## 10. Correctness properties

Seeded 20261201, `numRuns ≥ 300` (R1: 400). "Whole space" means enumerated, no seed.

| ID | Property | Requirement |
|---|---|---|
| P-REL-R1 | For any `arbSearchParams`, `PicksPage` either throws a redirect with digest target `/find` iff `parseModelParam(m)` is `missing`, or `/find?notice=incomplete` iff `invalid`; or, for `ok`, renders one `h1`, ≤ 3 `article` cards whose SKUs equal `match()` picks in order. Nothing else is ever thrown. | REQ-REL-13, 27 |
| P-REL-R2 | For any `arbSearchParams`, `FindPage` resolves and renders one `h1`; the incomplete notice is present iff `m` is invalid or `notice === 'incomplete'`; a valid `m` renders the recipient card. | REQ-REL-15, 28 |
| P-REL-R3 | For any `arbFilterParams`, `AtelierPage` resolves, renders one `h1`, and a card count equal to the independent reference count for `parseBrowseFilters`. | REQ-REL-16, 29 |
| P-REL-R4 | For any `arbSku` and `arbSearchParams`, `PiecePage` resolves iff the SKU is one of the 22, else throws exactly the 404 signal; a resolved page has one `h1` equal to the product name and one price footnote. | REQ-REL-17, 30 |
| P-REL-R5 | For any `arbParam`, `/piece/TNZ-1058` has no buy link, no `GiftWrap`, and the out-of-stock sentence; every in-stock SKU with any valid `m` has exactly one buy link equal to its catalog `url`. | REQ-REL-18, 31 |
| P-REL-E1 | Over the whole model space (34,560 models, §4.2): `match()` never throws; ≤ 3 picks; no duplicates; all In Stock; `toPickViews` mirrors it; fewer than 3 picks ⇒ `shortfallNote` and `showBrowseLink`; `none-religious` ⇒ no religious piece; one rendered `/picks` per shortfall class shows the picks, the note, both links, and no filler. | REQ-REL-14, 32 |
| P-REL-B1 | Over all 450 filter combinations: the rendered cards equal the independent reference selection in order, out-of-stock last; the empty-state sentence iff empty; one footnote iff any price shown; the out-of-stock card has no buy control. | REQ-REL-16, 33 |
| P-REL-M1 | `formatInr(n)` for integers in `[0, 10^9]` and the 22 prices: Indian grouping pattern, round trip to the integer, no `.`/`NaN`/`Infinity`, deterministic, digit count monotone, negative gives `-` plus the absolute value's digits. | REQ-REL-34 |
| P-REL-S1 | The static rules of §6.3 hold over the source tree. | REQ-REL-23 to 25, 35, 49 |
| P-REL-F1 | The four fallbacks render with the §5.5 copy, never show `error.message` or `stack` for any thrown value, call `retry` only on "Try again" or "Reload", log once with the prefix and digest, pass axe, and contain no forbidden word, `₹`, or image. | REQ-REL-01 to 10, 36 |
| P-REL-C1 | A corrupted catalog makes `lib/catalog-store.ts` throw `CatalogBuildError` naming the fault, while the four fallbacks still render. | REQ-REL-20 |

A counterexample from any property goes in `docs/kiro-evidence-log.md` with its fix (REQ-REL-37).

## 11. Open questions (not resolved by this spec; builder's call at the Tue 24 Nov checkpoint)

| ID | Question | Spec's working assumption |
|---|---|---|
| Q-REL1 | Does the project obtain a Google AI Studio key and build the optional Gemini phrasing layer at all? No key exists and none was provided. Architecture §9 names the layer first in the scope-cut order; the PRD ship decision is scripted-only. | **No.** The layer is recorded UNBUILT (REQ-REL-51). The scripted-only journey is the shipped and tested default. The builder decides at the Tue 24 Nov go/no-go; if yes, it becomes its own spec, gated on the key and on the REQ-CV-43 to 45 contract, and not part of this milestone. |
| Q-REL2 | Is a loading fallback wanted at all, given the M4 decision (a) (`instant = false`, no Suspense fallback because the body arrives in under 220 ms)? And is a status line acceptable, or does it add screen-reader noise? Skeleton cards are excluded by REQ-PD-48 and the design lock (REQ-PD-52). | Add one text-only `app/loading.tsx` (REQ-REL-10) so the shell is never blank. It is removed if any REQ-REL-11 check fails. No skeletons. If the builder prefers silence, the fallback can become an empty `<div aria-busy="true">`, a one-line edit. |
| Q-REL3 | Coverage bar: per file or whole `lib/`? | Whole `lib/` thresholds at floor(measured) − 1, minimum 80 (REQ-REL-40). The QA note lists any file below 80% lines. A per-file gate (`perFile: true`) would fail on a single small file and push toward tests that exist only to move a number. If the builder wants it, set it after seeing the per-file table. |
| Q-REL4 | The size regression threshold (+4.0 kB gzip per route) is a judgement. Should the measurement be a committed script? | 4.0 kB is about the size of two small client components; the two boundary files are expected to add well under 2 kB. The measurement stays a documented command sequence, not a committed script (YAGNI). A larger tool belongs to M6 if deployment needs it. **M5 outcome: the estimate was wrong — measured `error.tsx` +4.4 kB and the `next/link` chunk via `not-found.tsx` +3.3 kB; REQ-REL-45 not met on any route (+4.7 to +8.1 kB); the limit was not raised; accepted as a known gap for the checkpoint (see §8). Size-fix outcome (21 Nov 2026, session 20): the fallbacks were rewritten with inline plain markup; REQ-REL-45 is now MET on every route (+1.7 to +1.8 kB), limit still not raised; the residual is the two boundary chunks themselves.** |
| Q-REL5 | Is a `prebuild` lifecycle script acceptable on Vercel (it runs `npm run validate-catalog` with `tsx`, a devDependency)? | Yes. Vercel installs devDependencies and runs `npm run build`, which triggers `prebuild`. The M6 deploy confirms it; if it does not run there, the validator still runs on save (hook) and in the local build. |
| Q-REL6 | Should a failed catalog show a catalog-specific message ("the catalog could not be loaded")? | No. The fallback cannot know the cause (it has only a digest) and must not import the catalog (REQ-REL-02). The generic fallback plus the build-time gate is the design. A catalog-specific message would need a separate error class and a boundary that inspects it, which the production error masking prevents. |
| Q-REL7 | `global-error.tsx` cannot use the `next/font` variables, so its heading falls back to a generic serif and the wordmark is omitted. | Accept. The file is for a failure of the layout itself, which is not expected to occur; matching the typography exactly would duplicate font loading for a page almost nobody sees. |
| Q-REL8 | Does the fallback show the digest? | Yes, as a "Reference" line, because it is the only link between a user report and the server log, and it holds no information about the request. If the builder prefers a quieter page, delete one line and one assertion. |
| Q-REL9 | `/picks` without `m` answers 200 with a meta-refresh (M2 OQ-1, accepted; M6 owns it). `/piece/NOPE-0000` answers 200 in dev and 404 in production. Q-PD18 (`₹` in budget text). The four matching questions (Q-M1 to Q-M4). | **Frozen.** Referenced here, pinned as they are, not resolved. |
| Q-REL10 | Should E1 enumerate multi-symbol `symbolList` combinations (128 subsets of the 7 symbols)? | No. It multiplies the space by 128 for the religious branch only; `matching.property` and `conversation.property` sample lists, and E1 covers each single symbol. Revisit if a counterexample ever involves a list. |
