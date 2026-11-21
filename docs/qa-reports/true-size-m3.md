# QA checklist: true-size-viewer, Milestone 3 (T4.1, REQ-TS-30)

Status: **manual measurements NOT yet taken. T4.3 (gift-presentation Wave 4) was NOT RUN: no human with a card and a ruler was available in the non-interactive session (Session 10 retry, 2026-11-21).** The viewer has no route of its own, so the physical checks run on `/piece/[sku]` after the detail page exists (the `gift-presentation` final wave). Every measured-value field below is blank on purpose. Do not fill a number that was not measured with a physical ruler.

Scope: `lib/true-size.ts`, `lib/size-spec.ts`, `components/TrueSizeViewer.tsx`, `CalibrationSlider.tsx`, `SizeOutlines.tsx`, `SizeRuler.tsx`, `useCalibration.ts`.
Written by the builder session (Session 9) from design §10, not by the read-only `qa-auditor` agent. The checklist is the deliverable; a human or the auditor fills it in later.

## Automated results (Waves 1 to 3)

| Check | Result |
|---|---|
| `npm test` | pass: 36 files, 815 tests (645 in 30 files before this milestone, plus 166 in 6 new files, plus 4 cases that `tests/safety.copy.test.ts` now generates for the 4 new `.tsx` components; its expectations are unchanged) |
| `npm run typecheck` | pass |
| `npm run lint` | pass: 0 errors, 1 warning (`AgeBand` unused in `packages/mcp-catalog/src/index.ts`, outside this milestone) |
| Coverage, `lib/true-size.ts` + `lib/size-spec.ts` | 100% lines, branches, functions. `coverage/` removed afterwards. |
| Property tests P-TS-1 to P-TS-10 | pass (seed 20261124, 300 runs each; round trip and storage parsing 500 to 600). No property counterexample. |
| P-TS-11 (component, 22 products, three modes) | pass: approximate and stale modes contain "true size" exactly once, inside the exact label; calibrated mode has no such label |
| Static guard | pass: lib files pure; components import no catalog, no network, no ad-hoc colour, no transform or zoom, no raw `<img>`, no effect hooks |

jsdom has no layout, so the automated tests assert the `style` and SVG attribute sizes equal `mmToPx(mm, factor)`. They cannot show that a drawing measures the right length on glass. That is what this checklist is for.

## Test setup (fill in)

| Item | Phone | Desktop |
|---|---|---|
| Device and model | | |
| Screen size and resolution | | |
| Browser and version | | |
| Browser zoom at start (must be 100%) | | |
| Card used (ISO/IEC 7810 ID-1, 85.60 × 53.98 mm) | | |
| Ruler used (mm markings) | | |
| Date, tester | | |

## Checklist

Run each block on one phone and one desktop screen. Tick a box only when the step was done and the value written.

### A. Before calibration

- [ ] A1. Open `/piece/TPN-1459`. The viewer shows exactly "Approximate size — calibrate with a card for true size." and a button "Calibrate with a card".
- [ ] A2. The words "true size" appear nowhere else in the viewer or on the page (use the browser's find: exactly 1 match). The ruler is labelled "Approximate ruler".
- [ ] A3. The reference card is labelled "Credit-card size, for reference — 85.60 × 53.98 mm". Note how far off a real card looks against it (this is expected before calibration): ______

### B. Calibration time (REQ-TS-06, target: under 15 seconds)

- [ ] B1. With a card in hand, time from tapping "Calibrate with a card" to tapping "This matches". Phone: ______ s. Desktop: ______ s.
- [ ] B2. Interactions used (target 3: open, drag or arrow-key, confirm): phone ______, desktop ______.
- [ ] B3. The slider works with arrow keys, Home and End on desktop. Result: ______
- [ ] B4. On a narrow phone the outline stands upright when the long edge does not fit. Result: ______

### C. Box width after calibration (REQ-TS-25)

Target: the TPN-1459 box is 18.6 mm wide. Pass range ±5%: **17.7 to 19.5 mm**.

- [ ] C1. After calibrating, "Calibrated to your screen" shows and the approximate label is gone.
- [ ] C2. Measure the TPN-1459 box width (outer edge to outer edge) with a physical ruler. Phone: ______ mm. Desktop: ______ mm. In range 17.7 to 19.5?  Phone ☐ yes ☐ no. Desktop ☐ yes ☐ no.
- [ ] C3. Measure the box height (target 26 mm; ±5% is 24.7 to 27.3 mm). Phone: ______ mm. Desktop: ______ mm.
- [ ] C4. The photo sits inside the box, uncropped, with no text or overlay on it.

### D. Ring after calibration (REQ-TS-25)

Target: the TNZ-1056 ring is Ø about 42.5 mm (133.4 mm around ÷ π = 42.46). Pass range ±5%: **Ø 40.4 to 44.6 mm**.

- [ ] D1. Open `/piece/TNZ-1056`. After calibration the caption reads "ring outline at true size — 5.25 in around".
- [ ] D2. Measure the ring's outer diameter. Phone: ______ mm. Desktop: ______ mm. In range 40.4 to 44.6?  Phone ☐ yes ☐ no. Desktop ☐ yes ☐ no.
- [ ] D3. The detail line says the band width is not stated on the listing (TNZ-1056 and TNZ-1058 have none).
- [ ] D4. Open `/piece/TOB-1009`. The bangle outline is 39.6 mm across; measured: Phone ______ mm. Desktop ______ mm (±5% is 37.6 to 41.6 mm).

### E. Reference card and on-screen ruler

- [ ] E1. After calibration, hold a real card against the reference-card outline. The outer edges match to within 1 mm on the long edge: ______
- [ ] E2. The on-screen ruler's 10 cm mark (or the last whole centimetre shown) against a physical ruler. Phone: ______ mm. Desktop: ______ mm.
- [ ] E3. The ruler reads "Check the size against a real ruler".

### F. Print sheet (REQ-TS-24)

- [ ] F1. Tap "Print a 1:1 paper ruler". Print preview shows only the sheet: 100 mm ruler, ID-1 card outline, the piece outlines, and the line "Print at 100% scale — turn off 'Fit to page' — then check the ruler against a real one." The rest of the page is hidden.
- [ ] F2. Print at 100% with "Fit to page" off. Measure the printed 100 mm ruler against a physical ruler. Printed: ______ mm (target 100 ±1 mm).
- [ ] F3. Lay a real card on the printed card outline. Result: ______
- [ ] F4. Print works without calibration (do this once with storage cleared).

### G. Stale, reset, storage

- [ ] G1. After calibrating, change browser zoom (Ctrl and +, or pinch). The viewer shows "Your browser zoom or screen changed since you calibrated, so sizes are approximate again. Calibrate again to restore them." and the approximate label. Result: ______
- [ ] G2. Return the zoom to 100%. The calibration applies again (the stored value was kept). Result: ______
- [ ] G3. "Reset calibration" returns the approximate label in the same view. Result: ______
- [ ] G4. Private or incognito window: calibrate, no error shown, calibration holds until the tab closes. Result: ______
- [ ] G5. Reload after calibrating. The first paint is approximate, then the calibration applies with no hydration warning in the console. Result: ______

### H. Honest-label spot checks (one pendant with a thin box)

- [ ] H1. Open `/piece/TPN-1149` (14.4 × 1.9 mm). The size outline is an empty thin box with no photo in it, and the caption reads "pendant face, 14.4 mm tall — chain not shown to scale".
- [ ] H2. The page's own photo area is labelled "Photo as listed — shown enlarged, not to scale" (this label belongs to the detail page, `gift-presentation`).
- [ ] H3. No chain or thread is drawn on any piece.

## Result

| Block | Phone | Desktop |
|---|---|---|
| B calibration under 15 s | | |
| C box within 17.7 to 19.5 mm | | |
| D ring within Ø 40.4 to 44.6 mm | | |
| F printed ruler within ±1 mm | | |

Overall: not yet run.
