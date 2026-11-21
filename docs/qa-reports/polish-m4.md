# QA checklist: polish-deploy, Milestone 4 (REQ-PD-44, REQ-PD-45)

Status: **manual checks NOT RUN.** No human, screen reader, physical display, phone, or headless browser was available in the non-interactive builder session. Every manual line below (task T4.3) is "NOT RUN" and stays "NOT RUN" until a person fills it in. This file holds no measured number that the builder did not take.

Scope: the polish pass over `/`, `/find`, `/picks`, `/piece/[sku]`, `/atelier`, and the piece not-found page. Spec: `.kiro/specs/polish-deploy/`. This file is written in waves: the baseline below comes from Wave 0 (T0.2); the automated results, test-setup table, and manual sections come in Wave 4.

## Baseline (before the pass)

Taken at HEAD 5472e92 plus the spec folder, before any Milestone 4 code change (Wave 0, T0.2). It is evidence of the before state, not a gate.

### Axe over the current screens (jsdom)

Tool: `axe-core` 4.14.1 called directly through `tests/helpers/axe.ts` (`runOnly` tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`, `best-practice`; `color-contrast`, `target-size`, `scrollable-region-focusable` off). Each page function was called and the returned element rendered in jsdom, with `next/image` mocked to `<img>`.

| Screen | State rendered | Violations |
|---|---|---|
| Landing `/` | default | 0 |
| `/find` | first question (no `m`) | 0 |
| `/picks` | golden case 1 (3 picks) | 0 |
| `/atelier` | default, 22 cards | 0 |
| `/piece/TNZ-1056` | idle, approximate | 0 |

**Axe found zero violations on the current screens.** That is not the same as "accessible", for two reasons recorded here so nobody reads the zero as a pass:

1. The three rules switched off are exactly where design §2 expects the failures (text contrast, touch-target size, scroll-region focus). Axe cannot see them in jsdom, so the baseline for those comes from the computed contrast table (design §3) and the class counts below.
2. Axe ran on a container, not a full document. Page-level rules were **inapplicable** on all five screens: `landmark-one-main`, `page-has-heading-one`, `region`, `document-title`, `html-has-lang`, `skip-link`, `meta-viewport`. The missing skip link and the missing `id="main-content"` are therefore invisible to axe here. Tests of REQ-PD-39 (role and query assertions) and the static layout checks of REQ-PD-41 cover them.

No axe `incomplete` result on any screen. The rules that applied and passed included `heading-order`, `landmark-unique`, `landmark-banner-is-top-level`, `landmark-no-duplicate-banner`, `link-name`, `button-name`, `image-alt`, `aria-hidden-focus`, `nested-interactive`, `svg-img-alt`, and the `aria-*` validity rules.

### Class counts re-measured with grep (design §2)

`grep -rno` over `app/` and `components/` at the same commit.

| Finding | Design §2 | Measured | Matches |
|---|---|---|---|
| `text-plum/60` | 8 | 8 | yes |
| `text-plum/70` | 4 | 4 | yes |
| `text-plum/50` | 1 | 1 (`components/BrowseCard.tsx`) | yes |
| `text-gold` | 7 | 7 | yes |
| `border-plum/30` | 12 | 12 | yes |
| arbitrary `tracking-[…em]` | "five" (`[0.15em]`, `[0.2em]`, `[0.25em]`) | 6: `[0.15em]` ×1, `[0.2em]` ×4, `[0.25em]` ×1 | **no: 6, not 5** (design counts the three distinct values as five uses; the grep gate of Wave 2 must reach 0 either way) |
| `transition-colors` | 12 | 12 | yes |
| `<header>` copies | 6 | 6 (`app/page.tsx`, `find`, `picks`, `atelier`, `piece/[sku]/page.tsx`, `piece/[sku]/not-found.tsx`) | yes |
| `<main` without `id="main-content"` | every route | 6 `<main`, 0 `id="main-content"` | yes |
| files with a `<button` | 8 button files | 8 files, 15 `<button` tags (ChipGroup 1, RecipientCard 2, Conversation 2, CatalogGrid 1, CalibrationSlider 2, SizeRuler 1, GiftWrap 4, TrueSizeViewer 2) | yes |
| `outline-none` | headings only | 3, all on `tabIndex={-1}` headings (`RecipientCard`, `Conversation` ×2) | yes |
| `tabIndex` | headings only | 4, all `-1` (`RecipientCard`, `Conversation` ×2, `GiftWrap` card heading) | yes |
| `order-*`, `flex-row-reverse`, `flex-col-reverse`, `grid-flow-dense` | 0 | 0 | yes |
| `role="status"` | not counted in §2 | 4 | n/a |
| `aria-describedby` | one (`cal-help`) | 1 | yes |
| `target="_blank"` links | `AtelierButton` external | 1 site (`AtelierButton`) | yes |

### Violations that design §2 does not list

None from axe. One count difference: the arbitrary letter-spacing uses number six, not five. It changes no task: T2.x replace every arbitrary `tracking-[…]` and the Wave 2 gate (`grep -rnE "tracking-\[" app components` prints 0) is unchanged.

### Contrast baseline

Not re-measured here. The coordinator computed these from the tokens (alpha composited over the nine surfaces of design §3): `text-plum/60` 3.47 to 3.69:1, `text-plum/50` 2.71 to 2.82:1, `text-plum/75` 5.15 to 5.66:1, `border-plum/30` 1.74 to 1.79:1, `border-plum/60` 3.47 to 3.69:1, `text-gold` 1.92 to 2.26:1 on the four pastel surfaces. Task T1.1 pins these in `tests/a11y.contrast.test.ts`.

## Automated results

Taken in Wave 4 (T4.1 to T4.3), 21 Nov 2026, on the Wave 3 tree (uncommitted on top of HEAD 5472e92).

| Check | Result |
|---|---|
| `npm test` | 1502 passed in 55 files (953 at the Milestone 3 close-out; 1067 before Wave 3 part 1; 1331 after T3.1/T3.2; 1502 after T3.3) |
| `npm run typecheck` | clean |
| `npm run lint` | 0 errors, 1 existing warning (`AgeBand` unused in `packages/mcp-catalog/src/index.ts`) |
| `npm run validate-catalog` | OK: 22 products, version 1.0.0, 2 existing width warnings (TNZ-1058, TNZ-1056) |
| `npm run build` | passes; 30 static pages; `/` static, `/atelier`, `/find`, `/picks`, `/piece/[sku]` (22 paths) Partial Prerender |
| Axe matrix (T3.1) | 72 states, each its own test, 0 violations on all 72 (page-level rules are inapplicable on a container, see Baseline) |
| Instant warning (T3.4) | reproduced on `/find`, `/picks`, `/atelier`, `/piece/[sku]` (not `/`); decision (a), `export const instant = false` on those four pages; 0 warnings in the dev log afterwards; build table unchanged; `/picks` redirects and golden 1 unchanged |
| `lib/page-meta.ts` coverage | 100% statements, branches, functions, lines (30 tests in the three page-meta files); `coverage/` removed afterwards |
| Dev-server checks (T4.1) | all seven routes answered 200; titles, `lang`, `main-content`, `h1`, skip link first, pinned copy, golden 1 order, 21 buy links on `/atelier`, 0 `text-gold` or `<img` on the landing: see the evidence log. One difference is recorded and explained there (`/piece/NOPE-0000`, see below) |
| Screenshots | not run (no headless browser: `chromium`, `google-chrome`, `chromium-browser`, `chrome`, `firefox` are all absent, and there is no Playwright cache) |

Difference found in T4.1: for `/piece/NOPE-0000` the served dev HTML has the skip link, the `noindex` robots tag and the title "Piece not found | Haunted Gift Atelier", but no `id="main-content"`, no `<h1` and no new-tab hint. The dev server logs "Switched to client rendering because the server rendering errored: NEXT_HTTP_ERROR_FALLBACK;404" and sends the not-found body as a client-rendered template. A production server (`next start`, checked once in T4.5) answers this URL with HTTP 404, not 200, and its served HTML also has no `main-content` or `h1`. The component itself has both (`tests/polish.copy.test.tsx` renders it). Whether a browser shows them after hydration was not checked, because no browser is available. It stays on the manual list below.

## Test setup

Filled in by the person who runs the manual pass. The builder did not fill any cell, because no human or device was available.

| Item | Value |
|---|---|
| Date of the manual pass | NOT RUN |
| Tester | NOT RUN |
| Device and screen (size, pixel density) | NOT RUN |
| Operating system | NOT RUN |
| Browser and version | NOT RUN |
| Screen reader and version | NOT RUN |
| Contrast tool | NOT RUN |
| Browser zoom and text size | NOT RUN |
| Phone model and browser (touch pass) | NOT RUN |
| Build under test (commit, dev or production) | NOT RUN |

## Manual sections

Every result below is **NOT RUN**. No cell holds a measured number. The T4.3 physical calibration of `gift-presentation` (card and ruler, REQ-TS-30: box 18.6 mm, ring about 42.5 mm, calibration under 15 s, 1:1 print sheet) also stays "not run" and is tracked in `docs/qa-reports/true-size-m3.md`. No number in this file is invented.

### Keyboard only, whole journey

| Check | Result | Notes |
|---|---|---|
| Skip link is the first Tab stop on every route and moves focus to the main content | NOT RUN | |
| `/` to `/find`: all six questions, the Religious sub-chips, Back, and Edit on the card, by keyboard only | NOT RUN | |
| Recipient card to `/picks` to `/piece/[sku]`: verdict, viewer, calibration slider, wrap, message, copy, buy link | NOT RUN | |
| `/atelier`: every filter, "Clear filters", the cards | NOT RUN | |
| Focus is visible at every stop; no focus trap | NOT RUN | |
| Calibration slider reaches both ends by keyboard (Q-PD8: arrow keys move 1 px; Page, Home, End are native) | NOT RUN | Q-PD8 stays open; no step buttons were added |

### Screen reader

| Check | Result | Notes |
|---|---|---|
| Reader and browser named in the test setup | NOT RUN | |
| Landmarks and headings list on each route | NOT RUN | |
| A step change speaks the new question | NOT RUN | |
| Chips speak their pressed state | NOT RUN | |
| Repeated "See details" and "Buy" links speak their product (Q-PD4) | NOT RUN | |
| The new-tab hint is spoken on external links | NOT RUN | |
| Wrap status, and focus plus status at the reveal (Q-PD6, possible double speech) | NOT RUN | |
| Calibration status and the slider value text | NOT RUN | |
| Fit-check region name "Good fit" or "Check this" is clear enough (Q-PD5) | NOT RUN | |
| Size drawings are not read twice (Q-PD7) | NOT RUN | |
| Result count on `/atelier` | NOT RUN | |

### Contrast spot-check (real display, contrast tool)

| Check | Result | Notes |
|---|---|---|
| The six token pairs against the computed table (design §3) | NOT RUN | |
| Footnote, eyebrows, pick label | NOT RUN | |
| Out-of-stock card text and its "Out of stock" badge | NOT RUN | |
| Secondary button border, chip border, textarea border | NOT RUN | |
| Size drawings and the reference card outline | NOT RUN | |

### Reduced motion (system setting on)

| Check | Result | Notes |
|---|---|---|
| Landing: motes gone | NOT RUN | |
| Gift wrap: immediate reveal | NOT RUN | |
| Calibration and hover transitions | NOT RUN | |

### Forced colors / high contrast

| Check | Result | Notes |
|---|---|---|
| Focus outline visible | NOT RUN | |
| Borders, buttons, chips visible | NOT RUN | |
| Size drawings and the ruler still visible | NOT RUN | |

### Zoom and reflow

| Check | Result | Notes |
|---|---|---|
| 200% text zoom on each route | NOT RUN | |
| 320 px width: no two-dimensional scroll except the outline row and the ruler | NOT RUN | |

### Touch

| Check | Result | Notes |
|---|---|---|
| Buttons and links easy to hit on a phone | NOT RUN | |
| Chips | NOT RUN | |
| Slider thumb | NOT RUN | |
| Header links | NOT RUN | |

### Premium visual review (REQ-PD-45)

Screenshots not run: no headless browser is installed, so `docs/qa-reports/screenshots-m4/` was not created. Each cell is judged by a person at 360, 768 and 1280 px.

| Screen | One display face and one sans | Type scale | Spacing and radii | Equal card padding | No orphaned styles | Buttons aligned at card bottoms | Photos uncropped on pearl | Prices with a legible footnote | Nothing haunted over content |
|---|---|---|---|---|---|---|---|---|---|
| `/` landing | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| `/find` question | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Recipient card | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| `/picks` | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| `/atelier` | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Piece: pendant (TPN-1149) | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Piece: bracelet (TNZ-1056) | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Piece: earrings (THP-1027) | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Piece: set (TPN-1206) | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Piece: tabeez (TBZ-1013) | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

### Other manual items

| Check | Result | Notes |
|---|---|---|
| `/piece/NOPE-0000` in a browser shows the not-found heading, the main landmark and the skip-link target after hydration (see the difference in Automated results) | NOT RUN | |
| The `/picks` reveal does not feel slow on a real connection (Q-PD10: if it does, option (c)) | NOT RUN | |

### Carried forward

| Item | Result |
|---|---|
| T4.3 physical calibration of `gift-presentation` (REQ-TS-30), `docs/qa-reports/true-size-m3.md` | not run, unchanged |
