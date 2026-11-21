# True-Size Viewer — Tasks

*Implements `requirements.md` (REQ-TS-01 to REQ-TS-41) per `design.md`. Tasks in one wave touch different files and can run in parallel. A wave starts only when the previous wave's checks pass. Prerequisites: `catalog-data` and `conversation` are done (`parseCatalog`, `Dims`, `tests/helpers/dom.ts`, jsdom and Testing Library installed). This spec changes none of `lib/matching.ts`, `lib/matching/*`, `lib/catalog.ts`, `data/catalog.json`, or `data/*.ts`; any task that seems to need that is a spec question, not an edit. This spec ends with tested pure logic and tested client components; the dev-server and physical-ruler checks run on the detail page in `gift-presentation` (its final wave), because the viewer has no route of its own.*

*Before writing any component, re-read `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` (`fill`, `sizes`) and the `'use client'` guide under `01-app/` (AGENTS.md: this Next.js version has breaking changes). The viewer is a client island: props in, no server-only imports.*

*Common checks, run at the end of every wave unless the wave says otherwise:* `npm test`, `npm run typecheck`, `npm run lint`. The existing tests stay green throughout.

## Wave 1 — Pure logic (2 parallel tasks, then 2 parallel test tasks)

- [ ] **T1.1 Math and calibration format** `lib/true-size.ts` per design §2: constants, `mmToPx`, `pxToMm` (throw `RangeError`, no rounding), `factorFromCardPx`, `cardPx`, `cardOrientation`, `serializeCalibration`, `parseCalibration`, `isStale`, `rulerTicks`, `fitRulerMm`, `formatMm`, `formatInches`. No React, no I/O, no clock. Unit tests `tests/true-size.test.ts` as listed in design §9. *(REQ-TS-01 to 04, 07, 08, 10, 23)*
- [ ] **T1.2 Size spec** `lib/size-spec.ts` per design §3: `photoFitsBox`, `SizeSpec`, `SizeItem`, `buildSizeSpec` with the caption tables. Imports `formatMm`/`formatInches` from `lib/true-size.ts` (write against the signatures; wire in when T1.1 lands). Unit tests `tests/size-spec.test.ts`: every `Dims` kind; all 22 real products against the design §3.1 table (4 photo-inside SKUs, 9 empty outlines, 2 sets, 5 string bracelets, 2 bangles; TNZ-1058 and TNZ-1056 band width not stated); captions byte-for-byte for TPN-1149 ("pendant face, 14.4 mm tall — chain not shown to scale"), TPN-1459, TNZ-1056 (calibrated "ring outline at true size — 5.25 in around"; approximate "ring outline, approximate size — 5.25 in around"), TOB-1009 ("bangle outline at true size — 39.6 mm across"), TPN-1206 pendant and earring; null-height and null-width `item` fixtures give `missing` and `line`. *(REQ-TS-15 to 22)*
- [ ] **T1.3 Property tests, math** `tests/true-size.property.test.ts`: P-TS-1 to P-TS-4 and P-TS-10, seeded, `numRuns ≥ 200` (P-TS-1 ≥ 500). *(REQ-TS-32 to 35, 41)*
- [ ] **T1.4 Property tests, spec** `tests/size-spec.property.test.ts` (after T1.2): P-TS-5 to P-TS-9, seeded, `numRuns ≥ 200`, over the 22 real products and generated `Dims`. A counterexample is logged in the evidence log with its fix; the test is never loosened. *(REQ-TS-36 to 40)*

Check: `npx vitest run tests/true-size tests/size-spec`, then common checks, and coverage of `lib/true-size.ts` and `lib/size-spec.ts` ≥ 80% (`npx vitest run --coverage --coverage.include='lib/{true-size,size-spec}.ts'`, then confirm no `coverage/` directory is left behind).

## Wave 2 — Client pieces (4 parallel tasks)

- [ ] **T2.1 Calibration store** `components/useCalibration.ts` per design §4: module-level `memory` fallback, `read`/`write`, `subscribe` (storage, custom event, resize), `useCalibration()` with two `useSyncExternalStore` reads (stored string with server snapshot `null`; `devicePixelRatio` with server snapshot `1`), mode `approximate | calibrated | stale`, `calibrate()`, `reset()`. `'use client'`. No `setState` inside an effect (lint). *(REQ-TS-08 to 10, 28)*
- [ ] **T2.2 Slider** `components/CalibrationSlider.tsx` per design §5.2: instruction (`id="cal-help"`), ID-1 outline (`box-border`, `border-plum/60`, `bg-champagne/40`), landscape/portrait by `cardOrientation`, native range 171–856 step 1 with `aria-label="Card outline width"` and `aria-describedby`, "This matches" and "Cancel". Tokens only. *(REQ-TS-05 to 07, 29)*
- [ ] **T2.3 Outlines** `components/SizeOutlines.tsx` per design §5.3: boxes with optional `next/image` (`fill`, `object-contain`, `sizes` = box px), height line, ring SVG (stroke inset), missing message, reference card with its label, captions and detail lines below (never over a photo), `role="img"` and `aria-label` on SVGs. Style sizes are exactly `mmToPx(mm, factor)`. *(REQ-TS-14 to 22, 26, 29)*
- [ ] **T2.4 Ruler and print sheet** `components/SizeRuler.tsx` per design §5.4: on-screen ruler from `rulerTicks`, label per mode, `aria-hidden` ticks; print-only SVG sheet in `mm` units (`hidden print:block`), the instruction line, and the "Print a 1:1 paper ruler" button calling `window.print()`. *(REQ-TS-23, 24)*

Tests (jsdom, each file starts `// @vitest-environment jsdom` and imports `tests/helpers/dom.ts`):
- `tests/true-size.ui.test.tsx` (parts for T2.x): `CalibrationSlider` renders a range input with min 171, max 856, step 1, name "Card outline width"; changing it to 400 changes the outline's `style.width` to `400px` and its height to `400 × 53.98 / 85.6`; "This matches" calls `onConfirm(400)`; keyboard arrow keys (via `fireEvent.keyDown`/`change`) move it; portrait when the container is narrower (stub `clientWidth`). `useCalibration` through a tiny test component: no stored value gives `approximate`; a stored valid value gives `calibrated` and the factor; a corrupt value gives `approximate`; a stored `dpr` of 2 with jsdom's 1 gives `stale`; `reset()` removes the key; a `localStorage.setItem` that throws still calibrates in memory.
- `SizeOutlines`: for `buildSizeSpec` of TPN-1459 at factor 5: the box `style` is `width: 93px; height: 130px` (18.6 × 5, 26 × 5), contains an `<img>` with class `object-contain`, no sibling or child element other than that image; for TPN-1149: the box is empty (no `<img>`), width `9.5px`, height `72px`; TNZ-1056 ring `svg` width within 0.01 of 212.32 px (42.4635 × 5) and the caption variants by `calibrated`; TPN-1206: two boxes.

Check: `npx vitest run tests/true-size.ui.test.tsx`, then common checks.

## Wave 3 — The viewer (1 task, then 1 test task)

- [ ] **T3.1 Viewer** `components/TrueSizeViewer.tsx` per design §5.1: `'use client'`, props `{ spec }`, heading "Size on your screen", the three status variants, the exact approximate label as one text node, "Calibrate with a card", "Calibrated to your screen", "Reset calibration", the stale note, `CalibrationSlider` toggle, `SizeOutlines`, `SizeRuler`, `print:hidden` on screen elements. The only occurrence of "true size" in the approximate and stale modes is inside the exact label. *(REQ-TS-05 to 14, 28, 29)*
- [ ] **T3.2 Viewer tests and static guard** (after T3.1): extend `tests/true-size.ui.test.tsx`: approximate mode shows the exact label once and a `getAllByText(/true[- ]size/i)` of length 1; the button reads "Calibrate with a card"; calibrating (open, set 324 → 360, confirm) switches to "Calibrated to your screen", removes the approximate label, shows "Reset calibration" and "Check the size against a real ruler", and rewrites outline sizes by the new factor (360 / 85.6); reset returns to the approximate label and the stored key is gone; stale shows the note and the approximate label; P-TS-11 over all 22 products (approximate mode: text matches `/true[- ]size/i` once, inside the exact label). Add `tests/true-size.static.test.ts` per design §9. *(REQ-TS-11 to 13, 27, 31; P-TS-11)*

Check: `npx vitest run tests/true-size tests/size-spec`, then common checks. Counts of tests per file recorded in the evidence log.

## Wave 4 — Hand-off (2 parallel tasks)

- [ ] **T4.1 QA checklist** `docs/qa-reports/true-size-m3.md` (written by the read-only `qa-auditor` agent; fixes happen in a separate pass): the manual steps of design §10 as an empty checklist with the target ranges (box 17.7 to 19.5 mm; ring Ø 40.4 to 44.6 mm), plus the automated results (test counts, coverage). The numbers are filled after the detail page exists (`gift-presentation` final wave). *(REQ-TS-30)*
- [ ] **T4.2 Evidence log** in `docs/kiro-evidence-log.md`: a session entry (files with line counts, test counts, any property counterexample with its fix) and the open questions Q10 to Q14 of design §11 for the Tue 24 Nov checkpoint. Update `.kiro/steering/structure.md` to list `lib/size-spec.ts`, `components/SizeOutlines.tsx`, `components/SizeRuler.tsx`, `components/useCalibration.ts` only if the builder approves. *(REQ-TS-31)*

Check: common checks; `git status` shows only the files named in this spec; no dev server, temp file, or `coverage/` directory remains.

## Done when

`npm test` passes every true-size and size-spec test with the existing tests unchanged; P-TS-1 to P-TS-11 hold; the 22 real products produce the §3.1 table; the viewer shows the exact approximate label and no other "true size" text before calibration; calibration is 3 interactions; typecheck and lint are clean; and the physical checks of REQ-TS-30 are on the `gift-presentation` final-wave list with their target ranges.
