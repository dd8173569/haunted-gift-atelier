# Reliability size fix (REQ-REL-45) — QA note

Status: manual and browser checks NOT RUN; every number below was taken by the session that wrote it. No browser exists on this machine.

Starting point: HEAD 9c30b8b, clean tree. Cause and per-file shares are in `docs/qa-reports/reliability-m5.md` (T4.2).

## First-load gzip JavaScript, before and after

Same method as M5 (design §8 steps 2 to 5): `entryJSFiles` + every `clientModules[*].chunks` path from each route's `page_client-reference-manifest.js` + `rootMainFiles` + `polyfillFiles`, de-duplicated, `.js` only, `gzipSync` bytes summed, kB = bytes / 1000. The M5 columns are copied from `reliability-m5.md`; the last two columns were measured in this session after a fresh `npm run build`.

| Route | M5 baseline kB | M5 after Wave 1 kB | After this fix kB (files) | Delta vs baseline | Within +4.0 kB |
|---|---|---|---|---|---|
| `/` | 178.5 | 183.3 (+4.8) | 180.3 (10) | +1.8 | pass |
| `/find` | 184.9 | 192.9 (+8.0) | 186.6 (10) | +1.7 | pass |
| `/picks` | 183.5 | 191.6 (+8.1) | 185.3 (10) | +1.8 | pass |
| `/atelier` | 189.6 | 197.7 (+8.1) | 191.4 (10) | +1.8 | pass |
| `/piece/[sku]` | 191.8 | 196.5 (+4.7) | 193.5 (11) | +1.7 | pass |
| `/_not-found` | 175.2 | 183.3 (+8.1) | 177.0 (9) | +1.8 | pass |

REQ-REL-45 is met on every route. The +4.0 kB limit was not changed.

Build: `npm run build` passed; the log opened with `prebuild` (`validate-catalog`) before `next build`. "Generating static pages using 3 workers (30/30)". Route table unchanged (`/` ○, `/_not-found` ○, `/atelier`, `/find`, `/picks`, `/piece/[sku]` and its paths ◐). `du -sk .next/static`: 1168 (M5 after Wave 1: 1172; baseline: 1140).

Remaining gap: about +1.7 to +1.8 kB over the M4 baseline on every route, inside the limit. Chunks read from the build (gzip): the error-boundary chunk, found by grepping for "Something went wrong with that page.", is 1,093 B; the chunk holding `global-error` copy is 876 B. The session did not trace the rest of the +1.8 kB to a specific chunk, so it gives no further breakdown. `app/global-error.tsx` was not changed; the 876 B figure is the chunk found by grepping its copy "The atelier couldn't open" (a second chunk of 4,329 B also matched that string and was not examined).

## What changed

- `app/error.tsx` (64 lines): removed the `SiteHeader` and `AtelierButton` imports. Still a Client Component with `error: unknown` and `retry`, the digest narrowing, the one `console.error` effect, and `ActionButton` for "Try again". An inline `<header>` holds a plain `<a href="/">` "Tiny Tiaraa" wordmark and a `<nav aria-label="Primary">` with a plain `<a href="/atelier">`, using the classes `SiteHeader` uses. The two main links ("Find a gift", "Browse the atelier") are plain `<a>` with the exact `AtelierButton` secondary classes. Copy, `h1`, `main#main-content`, and control order are unchanged.
- `app/not-found.tsx` (37 lines): same treatment. Still a Server Component with no props. "Browse the atelier" uses the primary classes, "Find a gift" the secondary classes.
- `tests/reliability.fallbacks.ui.test.tsx`: one comment changed ("sized by SiteHeader" now says the links are inline in the fallback's own header). No assertion changed.
- `app/global-error.tsx`, `app/loading.tsx`, every component, `lib/`, `data/`, `public/`, specs: unchanged.

Lint detail: `@next/next/no-html-link-for-pages` only fires for `href="/"` in this repo (it knows one page route). The directive with its reason sits on the wordmark anchor in both files. A directive on the `/atelier` and `/find` anchors was reported by eslint as unused (a new warning), so those anchors carry a plain comment giving the reason instead. No file-level disable. `npm run lint` shows only the known `AgeBand` warning.

## Spec deviation (deliberate)

REQ-REL-01, REQ-REL-06, and REQ-REL-09 require the fallbacks to use the shared `SiteHeader` and `AtelierButton`. `app/error.tsx` and `app/not-found.tsx` now use inline plain markup instead, because the shared components cost +4.4 kB (`SiteHeader` compiled into the error boundary's client chunk) and +3.3 kB (`next/link` pulled in via `AtelierButton`), which is the breach itself. The shared components are unchanged and stay in use on every real screen. The spec files were not edited; REQ-REL-01/06/09/45 and design §5.1/§5.3/§8/Q-REL4 need the coordinator's update. Cost of the deviation: the plain anchors do full-document navigation and the inline classes duplicate the `AtelierButton` and `SiteHeader` class strings, so a change to those styles must be mirrored here.

## Test changes

Only the comment above. `tests/reliability.static.test.ts` and `tests/a11y.static.test.ts` needed no change; the test count did not fall.

## `next start` sanity checks (production build, port 3187, stopped afterwards)

| Check | Result |
|---|---|
| unmatched URL `/nope-zz` | HTTP 404; `h1` "We couldn't find that page." (HTML-escaped); `<meta name="robots" content="noindex"/>` present |
| `/picks?m=<golden 1>` (`m` from `GOLDEN1_TAPS` through `toModel` and `encodeModelParam`) | HTTP 200; first occurrences in order TBZ-1013, TNZ-1056, TBZ-1017; the price footnote "Price as listed on tinytiaraa.com on 21 Nov 2026" appears (2 matches in the body) |

## Check results

| Check | Result |
|---|---|
| `npm test` | 62 files, 1585 tests passed (same as before); no "Unhandled" line in the tail of the output |
| `npm run typecheck` | clean |
| `npm run lint` | 0 errors, 1 warning (`packages/mcp-catalog/src/index.ts` `AgeBand`, the known one) |
| `npm run validate-catalog` | `CATALOG OK: 22 products, version 1.0.0, 2 warning(s)` (the two width warnings) |
| `npm run build` | passed; `prebuild` ran first; 30/30 static pages; route table as above |

Not run: any browser check (keyboard, screen reader, layout of the inline header at 320 px or 200% zoom). The inline header and links reuse the `SiteHeader` and `AtelierButton` class strings, but their rendering was checked only by jsdom tests.

## Coordinator verification (21 Nov 2026, direct work, not the session's numbers)

Re-run independently on the same tree: `npm test` **1585/1585 in 62 files**, 0 lines matching "Unhandled" in the full output (the session had only seen the tail); `npm run typecheck` clean; `npm run lint` 0 errors + the 1 known `AgeBand` warning; `npm run validate-catalog` OK (22 products, 2 width warnings); `npm run build` passes — `prebuild` ran first, 30/30 static pages, route table identical to baseline, `du -sk .next/static` 1168.

Size re-measured independently with a separate script implementing the same design §8 method (manifest parse + `gzipSync`, kB = bytes / 1000): identical figures on every route — `/` 180.3 (10 files), `/find` 186.6 (10), `/picks` 185.3 (10), `/atelier` 191.4 (10), `/piece/[sku]` 193.5 (11), `/_not-found` 177.0 (9). REQ-REL-45 is MET on every route (+1.7 to +1.8 kB vs baseline).

Chunk figures, coordinator-measured (the session's were ~20 B higher on each — a measurement-method difference, immaterial): the error-boundary chunk (`static/chunks/1mokvf37og6_u.js`, found by grepping "Something went wrong with that page.") is **1,072 B gzip** (was 4,438 B before the fix); the global-error chunk (`static/chunks/2a8kbf2c5zqil.js`) is **854 B gzip** — the same figure M5 recorded, so the coordinator's method matches M5's. The two boundary chunks (1,072 + 854 B) account for essentially the whole residual +1.7–1.8 kB: that is the irreducible cost of having the boundaries at all.

Loose ends from the session, closed here: (a) the second 4,329 B chunk holding the global-error copy is `static/chunks/1h8m5wjobt16d.js`, **4,301 B gzip** by the coordinator's measure, referenced only by `.next/server/app/_global-error/page_client-reference-manifest.js` — the global-error route's own manifest, not one of the six measured routes — so it costs the measured routes nothing; (b) the `next/link` chunk (`static/chunks/1elud1o77e445.js`, 3,300 B gzip) is confirmed absent from the `/find`, `/picks`, `/atelier`, and `/_not-found` manifests (0 mentions each) and present only in `/` and `/piece/[sku]` (1 mention each), as in the baseline — the not-found fix worked as intended.

Session note: the session reported it did not read `.kiro/specs/reliability/` or the `error.md`/`not-found.md` docs in full, only the parts of the M5 QA note that fit its read limit plus the code and tests. The coordinator checked the resulting files against the M5-established facts instead: `error.tsx` keeps `"use client"`, the `error: unknown` + `retry` props, no `reset`, the digest narrowing, and the one `console.error` effect; `not-found.tsx` keeps no props and stays a Server Component; `global-error.tsx` and `loading.tsx` are byte-unchanged. No convention was broken by the partial read.
