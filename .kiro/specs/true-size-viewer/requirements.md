# True-Size Viewer — Requirements

*Spec for PRD §6 (and PRD §1 step 5). Milestone 3. Implemented in `lib/true-size.ts` (math, calibration format, ruler), `lib/size-spec.ts` (catalog dimensions to drawable items and captions), and the client components `components/TrueSizeViewer.tsx`, `components/CalibrationSlider.tsx`, `components/SizeOutlines.tsx`, `components/SizeRuler.tsx`. Dimensions come from `Product.dims` (`Dims` union) in `lib/catalog.ts` (see `catalog-data`, REQ-CD-17 to REQ-CD-20). The detail page that hosts the viewer (`/piece/[sku]`) belongs to `gift-presentation`.*

Terms: **px-per-mm factor** (`factor`) = CSS pixels that one physical millimetre occupies on this screen. **Uncalibrated factor** = `96 / 25.4` CSS px per mm, the CSS definition of a millimetre, which does not equal a physical millimetre on most screens. **Calibrated** = the user has matched the on-screen card outline to a real card and the factor is stored. **ID-1 card** = ISO/IEC 7810 ID-1, 85.60 × 53.98 mm, the size of a credit or debit card. **Box** = a rectangle outline drawn at a piece's listed height × width. **Ring** = a circle outline drawn at a bracelet's or bangle's size. **Outer edge** = the outside of an outline, including its border.

Scope: no change to `lib/matching.ts`, `lib/matching/*`, `lib/catalog.ts`, `data/catalog.json`, or `data/*.ts`. The viewer reads `Product.dims` and nothing else from the catalog except the name and photo path.

---

## 1. The math

**[REQ-TS-01] Millimetre and pixel conversion**
`lib/true-size.ts` SHALL export `mmToPx(mm, factor)` = `mm × factor` and `pxToMm(px, factor)` = `px ÷ factor`. Both SHALL be pure and SHALL throw a `RangeError` for a non-finite input or a `factor ≤ 0`. Neither SHALL round.

**[REQ-TS-02] Constants**
The module SHALL export `CARD_MM = { long: 85.6, short: 53.98 }` (ID-1), `CSS_PX_PER_MM = 96 / 25.4`, `MIN_FACTOR = 2`, `MAX_FACTOR = 10`, and `STORAGE_KEY = 'hga.trueSize.v1'`. A calibrated factor outside `[MIN_FACTOR, MAX_FACTOR]` SHALL be rejected.

**[REQ-TS-03] Deriving the factor from the card**
`factorFromCardPx(longEdgePx)` SHALL return `longEdgePx ÷ CARD_MM.long`. It SHALL return an error result, not a number, for a non-finite input or a result outside `[MIN_FACTOR, MAX_FACTOR]`. `cardPx(factor)` SHALL return the outline's long and short edges in px (`CARD_MM.long × factor`, `CARD_MM.short × factor`), so the outline keeps the ID-1 proportion.

**[REQ-TS-04] Round trip**
For every finite `mm > 0` and every `factor` in `[MIN_FACTOR, MAX_FACTOR]`, `pxToMm(mmToPx(mm, factor), factor)` SHALL equal `mm` within a relative error of 1e-9. WHEN px is rounded to 0.1 px, the converted-back error SHALL be at most `0.05 ÷ factor` mm, which is at most 0.025 mm at `MIN_FACTOR`.

---

## 2. Calibration

**[REQ-TS-05] Slider calibration**
The viewer SHALL offer a "Calibrate with a card" control. WHEN activated, it SHALL show an outline with the ID-1 proportion and a slider that resizes the outline's long edge from `MIN_FACTOR × 85.6` to `MAX_FACTOR × 85.6` CSS px (171 to 856), in 1 px steps, starting at the uncalibrated size (324 px). The instruction text SHALL say to hold a credit or debit card flat against the screen and drag until the outline matches the card's long edge. A "This matches" button SHALL store the factor from REQ-TS-03.

**[REQ-TS-06] Fast and keyboard-operable**
A user with a card in hand SHALL be able to finish calibration in 3 interactions: open, drag or arrow-key the slider, confirm. The slider SHALL be a native `<input type="range">` with an accessible name ("Card outline width"), operable by arrow keys, Home, and End. Calibration SHALL complete in under 15 seconds for a tester with a card to hand (verified in QA, REQ-TS-30).

**[REQ-TS-07] Orientation**
WHEN the outline's long edge in px exceeds the space available, the outline SHALL be shown upright (long edge vertical) instead of lying down. The slider SHALL always control the long edge. `cardOrientation(longEdgePx, availablePx)` SHALL decide this and SHALL be pure.

**[REQ-TS-08] Persistence**
The calibrated factor SHALL be stored in `localStorage` under `STORAGE_KEY` as a versioned JSON value (`{ v: 1, pxPerMm, dpr }`). The value SHALL be validated on read: invalid JSON, a wrong version, a non-finite or out-of-range `pxPerMm`, or a non-finite `dpr` SHALL be treated as not calibrated, without throwing. WHEN `localStorage` is unavailable or throws (private mode, quota), the viewer SHALL keep the calibration in memory for the session and SHALL NOT show an error.

**[REQ-TS-09] Reset**
While calibrated, the viewer SHALL show a "Reset calibration" control. WHEN activated, it SHALL remove the stored value and return the viewer to the uncalibrated mode in the same render.

**[REQ-TS-10] Stale calibration**
WHEN the stored `dpr` differs from the current `window.devicePixelRatio` by more than 0.02 (the browser zoom or the screen changed), the viewer SHALL treat the calibration as stale: it SHALL show the uncalibrated mode and the note "Your browser zoom or screen changed since you calibrated, so sizes are approximate again. Calibrate again to restore them." It SHALL NOT delete the stored value.

---

## 3. Honest labels

**[REQ-TS-11] Uncalibrated label**
Before calibration, the viewer SHALL show every piece at the uncalibrated factor (CSS-mm size) with exactly this label, as one text node, directly above the sizes: "Approximate size — calibrate with a card for true size."

**[REQ-TS-12] "True size" is never unqualified before calibration**
In the uncalibrated mode, the words "true size" and "true-size" (case-insensitive) SHALL appear in the viewer and on the detail page only inside the exact label of REQ-TS-11. No caption, heading, button, aria-label, or note SHALL contain them. The calibrate button text SHALL be "Calibrate with a card".

**[REQ-TS-13] Calibrated label**
After calibration, the viewer SHALL show "Calibrated to your screen" and MAY use "true size" in the captions of REQ-TS-19 and REQ-TS-20. It SHALL also show "Check the size against a real ruler" next to the on-screen ruler.

**[REQ-TS-14] Reference card**
The viewer SHALL draw an ID-1 card outline beside the piece, at the current factor (calibrated or not), labeled "Credit-card size, for reference — 85.60 × 53.98 mm".

---

## 4. Rendering from the real dimensions

**[REQ-TS-15] Dimensions come from `Dims` only**
Every drawn size SHALL come from `Product.dims`. The viewer SHALL NOT invent, round, default, or scale a dimension. A drawn outline's outer edge SHALL equal `mmToPx(dimension_mm, factor)` exactly (no rounding, no CSS `transform: scale`, no `zoom`).

**[REQ-TS-16] Pendant, earrings, tabeez (`kind: 'item'`)**
The viewer SHALL draw one box of `height_mm × width_mm` at the current factor. The caption SHALL name the measured side and its value in millimetres:
- Pendant: "pendant face, {h} mm tall — chain not shown to scale"
- Earrings: "one earring, {h} mm tall"
- Tabeez: "tabeez, {h} mm tall — thread not shown to scale"

A second line SHALL state the listed size ("Listed: {h} mm tall × {w} mm wide.").

**[REQ-TS-17] Photo in the box, only where it can be read**
WHEN the box's shorter side is at least 6 mm and its longer side is at most 2.5 times its shorter side, the catalog photo SHALL fill the box with `object-contain`, unaltered, with no text or overlay on it. OTHERWISE the box SHALL be drawn empty as a size outline, and the photo SHALL appear only in the page's photo area, which is labeled "Photo as listed — shown enlarged, not to scale". Against catalog v1.0.0, exactly 4 pieces get the photo in the box (TPN-1459, TPN-1433, TBZ-1013, TBZ-1017); 9 item pieces (the six gold pendants TPN-1149, TPN-1147, TPN-1145, TPN-1141, TPN-1143, TPN-1144, and the earrings THP-1017, THP-1001, THP-1027) get the empty outline.

**[REQ-TS-18] Sets (`kind: 'set'`)**
The viewer SHALL draw two boxes side by side, the pendant (`pendant_height_mm × pendant_width_mm`) and one earring (`earring_height_mm × earring_width_mm`), each at the same factor. Their captions follow REQ-TS-16. The set photo shows both components, so it SHALL NOT be placed inside either box.

**[REQ-TS-19] Bracelets (`kind: 'string-bracelet'`)**
The viewer SHALL draw a ring outline whose circumference equals `circumference_mm` (diameter `circumference_mm ÷ π`, 42.5 mm for 133.4 mm). Calibrated caption: "ring outline at true size — {inches} in around", with `{inches}` = `circumference_mm ÷ 25.4` to 2 decimals (5.25). Uncalibrated caption: "ring outline, approximate size — {inches} in around". A second line SHALL read "Drawn as a closed circle, Ø ≈ {rounded diameter} mm. Band width: {w} mm." WHEN `width_mm` is null, it SHALL read "Band width not stated on the listing." (the two silver nazariya bracelets, TNZ-1058 and TNZ-1056).

**[REQ-TS-20] Bangles (`kind: 'bangle'`)**
The viewer SHALL draw a ring outline of `diameter_mm` across. Calibrated caption: "bangle outline at true size — {d} mm across". Uncalibrated caption: "bangle outline, approximate size — {d} mm across". A second line SHALL give the band width or "Band width not stated on the listing."

**[REQ-TS-21] Chains and threads are never drawn to scale**
The viewer SHALL NOT draw a chain, thread, or any part that `Dims` does not contain. Pendant, set, and tabeez captions SHALL say so (REQ-TS-16).

**[REQ-TS-22] Missing dimensions**
WHEN `height_mm` of an `item` is null, the viewer SHALL show "Size not stated on the listing." and no drawing for that piece. WHEN only `width_mm` is null, it SHALL draw a height line of `height_mm` (a vertical rule with end caps, no box), the caption of REQ-TS-16, and "Width not stated on the listing." The viewer SHALL NOT draw 0.

---

## 5. Ruler and print fallback

**[REQ-TS-23] On-screen ruler**
The viewer SHALL show a horizontal ruler with a tick for every millimetre, a longer tick every 5 mm, a longest tick and a number every 10 mm (cm), at the current factor, as long as 100 mm or the available width rounded down to whole centimetres, whichever is shorter. In the uncalibrated mode it SHALL be labeled "Approximate ruler". Tick positions SHALL equal `mmToPx(n, factor)`.

**[REQ-TS-24] Print sheet**
The viewer SHALL offer "Print a 1:1 paper ruler". Printing SHALL produce a sheet, built with print-variant utilities and physical `mm` units, containing a 100 mm ruler, the ID-1 card outline, and the piece's outlines at their listed millimetre sizes, plus the instruction "Print at 100% scale — turn off 'Fit to page' — then check the ruler against a real one." The rest of the viewer and the page SHALL be hidden in print. The sheet SHALL work without calibration, because printed `mm` is physical.

---

## 6. Accuracy and integrity

**[REQ-TS-25] Accuracy**
After calibration with a real ID-1 card, the rendered outline of a piece SHALL measure within ±5% of its listed size against a physical ruler. Because the component tests run without layout, the code SHALL guarantee `style` sizes equal `mmToPx(mm, factor)` (REQ-TS-15), and QA SHALL verify the physical result (REQ-TS-30).

**[REQ-TS-26] Photos exactly as downloaded**
A photo in a box SHALL use `object-contain`, SHALL NOT be cropped, recoloured, filtered, upscaled, or regenerated, and SHALL have no text, badge, border radius that clips content, or overlay on it. Captions sit below the box, never over it. No new image, logo, or watermark SHALL be added.

**[REQ-TS-27] Tokens, no network**
All colours SHALL be tokens from `app/globals.css`. The viewer SHALL make no network request; its only storage is the one `localStorage` key.

---

## 7. Composition and tests

**[REQ-TS-28] Client component on a server page**
`TrueSizeViewer` SHALL be a client component (`'use client'`) because it reads `localStorage` and holds slider state. The server page SHALL build a serialisable `SizeSpec` with `buildSizeSpec(product)` and pass it as a prop; the client SHALL NOT import `data/catalog.json` or `lib/catalog-store.ts`. The server render and the first client render SHALL both be the uncalibrated mode, so hydration matches; the stored calibration SHALL apply after hydration.

**[REQ-TS-29] Accessibility**
The outlines SHALL have text equivalents (the captions are real text next to them, and each SVG has `role="img"` and an `aria-label` with the caption). The ruler SHALL be `aria-hidden` with its meaning carried by the "Approximate ruler" or "Check the size against a real ruler" text. The calibration control SHALL be reachable by keyboard and its instruction text SHALL be associated with the slider (`aria-describedby`).

**[REQ-TS-30] QA verification (manual, recorded)**
QA SHALL record in `docs/qa-reports/` the following, on one phone and one desktop screen: calibration time with a real card (under 15 seconds); after calibration, the measured width of the TPN-1459 box (18.6 mm) and the TNZ-1056 ring (Ø about 42 mm) against a physical ruler, each within ±5%; the printed sheet's ruler against a physical ruler.

**[REQ-TS-31] Tests**
Unit tests SHALL cover the math, factor derivation, calibration (de)serialisation, the ruler ticks, orientation, and the size spec for every catalog `Dims` kind. Property tests SHALL cover §8. Component tests SHALL cover the slider, the labels in both modes, and the reset. `lib/true-size.ts` and `lib/size-spec.ts` SHALL reach ≥ 80% line coverage. `lib/true-size.ts` and `lib/size-spec.ts` SHALL be pure: no React, no I/O, no clock, no randomness, no network, no LLM.

---

## 8. Property-test invariants

**[REQ-TS-32] T1 Round trip.** REQ-TS-04.
**[REQ-TS-33] T2 Factor round trip.** For every `factor` in range, `factorFromCardPx(cardPx(factor).long)` equals `factor` within 1e-9 relative; the outline's short ÷ long equals `53.98 ÷ 85.6` within 1e-12.
**[REQ-TS-34] T3 Linearity and monotonicity.** `mmToPx` is linear (`mmToPx(a + b) = mmToPx(a) + mmToPx(b)` within 1e-9) and strictly increasing in both `mm` and `factor`.
**[REQ-TS-35] T4 Calibration storage round trip.** `parseCalibration(serializeCalibration(c))` returns `c` for every valid calibration; every arbitrary string (generated with `fc.string()` and `fc.anything()` JSON) either parses to a valid calibration or returns `null`, and never throws.
**[REQ-TS-36] T5 No unqualified "true size" before calibration.** For every catalog product (all 22) and for generated `Dims` of every kind, every string `buildSizeSpec` produces for the uncalibrated mode (the `approximate` captions and detail lines) matches no `/true[- ]size/i`.
**[REQ-TS-37] T6 Drawn size equals listed size.** For every product and any `factor` in range, every item's outer edge in px equals `mmToPx(listed mm, factor)` exactly (ring: diameter `circumference_mm ÷ π`, so `π × diameter` equals `circumference_mm` within 1e-9).
**[REQ-TS-38] T7 Captions name the measured side.** For every box item, the caption contains `"{formatMm(height_mm)} mm tall"`; for every ring, the caption contains the formatted inches (bracelet) or millimetres (bangle) of the catalog value.
**[REQ-TS-39] T8 Photo placement rule.** `photoFitsBox(h, w)` is true exactly when `min(h, w) ≥ 6` and `max ÷ min ≤ 2.5`; over the real catalog exactly the 4 SKUs of REQ-TS-17 get the photo in the box, and no `set` item ever does.
**[REQ-TS-40] T9 Nothing invented.** The size spec has no item for a chain or thread, and no item whose size is 0 or NaN; an `item` with a null dimension yields the missing-data variants of REQ-TS-22.
**[REQ-TS-41] T10 Ruler.** For any `factor` and `lengthMm`, the ticks number `lengthMm + 1`, positions equal `mmToPx(mm, factor)`, every 5th is at least `half`, every 10th is `cm`, and labels are exactly the whole centimetres.
