# True-Size Viewer — Design

*Implements REQ-TS-01 to REQ-TS-41 (`requirements.md`). Source: PRD §6, architecture §7, steering `product.md` (brand rules: true size only after calibration). Depends on `catalog-data` (`Product`, `Dims`). Nothing in `lib/matching.ts`, `lib/matching/`, `lib/catalog.ts`, `data/catalog.json`, or `data/*.ts` changes.*

## 1. Overview

```
server: /piece/[sku]  ── buildSizeSpec(product) ──► SizeSpec (plain JSON) ──┐
                                                                            ▼
client: <TrueSizeViewer spec={…}>  'use client'
          ├─ useCalibration()  localStorage via useSyncExternalStore ─► factor (calibrated | CSS_PX_PER_MM)
          ├─ <CalibrationSlider>  resizes the ID-1 outline, "This matches" stores the factor
          ├─ <SizeOutlines>  boxes / ring / height line at mmToPx(mm, factor), reference card
          └─ <SizeRuler>  on-screen ruler + print-only 1:1 sheet
```

The only value that cannot be known on the server is the user's screen scale, so everything that depends on the factor is client-side. Everything that depends on the catalog (which dimensions, which captions, whether a photo fits in the box) is computed on the server in a pure function and passed down as data. The client component never imports the catalog.

### File map

| File | Contents | Pure? |
|---|---|---|
| `lib/true-size.ts` | constants, `mmToPx`, `pxToMm`, `factorFromCardPx`, `cardPx`, `cardOrientation`, `serializeCalibration`, `parseCalibration`, `isStale`, `rulerTicks`, `fitRulerMm`, `formatMm`, `formatInches` | yes |
| `lib/size-spec.ts` | `SizeSpec`, `SizeItem`, `photoFitsBox`, `buildSizeSpec` | yes |
| `components/useCalibration.ts` | the `localStorage` store and hook (a hook file; not a component, so no PascalCase `.tsx`) | client |
| `components/CalibrationSlider.tsx` | the slider and outline | client |
| `components/SizeOutlines.tsx` | boxes, ring, height line, reference card | client (renders from props) |
| `components/SizeRuler.tsx` | screen ruler and print sheet | client (renders from props) |
| `components/TrueSizeViewer.tsx` | composition, labels, mode switching | client |

`structure.md` lists `TrueSizeViewer` and `CalibrationSlider` only; the other three files each hold one concept and are listed in the task that creates them.

## 2. `lib/true-size.ts`

```ts
export const CARD_MM = { long: 85.6, short: 53.98 } as const;      // ISO/IEC 7810 ID-1
export const CSS_PX_PER_MM = 96 / 25.4;                            // 3.7795…, the CSS definition of 1 mm
export const MIN_FACTOR = 2;
export const MAX_FACTOR = 10;
export const STORAGE_KEY = "hga.trueSize.v1";
export const CARD_PX_MIN = Math.round(CARD_MM.long * MIN_FACTOR);   // 171
export const CARD_PX_MAX = Math.round(CARD_MM.long * MAX_FACTOR);   // 856
export const CARD_PX_DEFAULT = Math.round(CARD_MM.long * CSS_PX_PER_MM); // 324

export function mmToPx(mm: number, factor: number): number           // throws RangeError on non-finite or factor <= 0
export function pxToMm(px: number, factor: number): number

export type FactorResult = { ok: true; factor: number } | { ok: false; reason: "non-finite" | "out-of-range" };
export function factorFromCardPx(longEdgePx: number): FactorResult
export function cardPx(factor: number): { long: number; short: number }
export function cardOrientation(longEdgePx: number, availablePx: number): "landscape" | "portrait"

export interface Calibration { v: 1; pxPerMm: number; dpr: number }
export function serializeCalibration(c: Omit<Calibration, "v">): string   // JSON.stringify({v:1,pxPerMm,dpr}) in this key order
export function parseCalibration(raw: string | null): Calibration | null  // never throws; validates REQ-TS-08
export function isStale(c: Calibration, currentDpr: number): boolean      // |c.dpr - currentDpr| > 0.02

export interface Tick { mm: number; px: number; kind: "mm" | "half" | "cm"; label?: string }
export function rulerTicks(lengthMm: number, factor: number): Tick[]
export function fitRulerMm(availablePx: number, factor: number): number   // min(100, floor(availablePx/factor/10)*10), at least 10

export function formatMm(mm: number): string      // up to 2 decimals, trailing zeros trimmed: 14.4, 26, 4.55, 39.6
export function formatInches(mm: number): string  // (mm / 25.4).toFixed(2): 133.4 → "5.25"
```

Notes:
- No rounding inside `mmToPx` or `pxToMm` (REQ-TS-01, REQ-TS-15). Rounding happens only when text is formatted.
- `parseCalibration` accepts a value only when it is a JSON object with exactly `v === 1`, finite `pxPerMm` in `[MIN_FACTOR, MAX_FACTOR]`, and finite `dpr > 0`. Anything else, including a thrown `JSON.parse`, returns `null`.
- The factor range 2 to 10 px/mm covers the real spread of screens (a 96 dpi desktop is 3.78; a typical phone in CSS px is about 5 to 6). It gives a card outline of 171 to 856 CSS px.
- `rulerTicks(lengthMm, factor)` returns `lengthMm + 1` ticks (0 to `lengthMm`). `kind` is `cm` when `mm % 10 === 0`, `half` when `mm % 5 === 0`, else `mm`. `label` is `String(mm / 10)` on `cm` ticks.
- `formatInches(133.4)` gives "5.25" (133.4 ÷ 25.4 = 5.2520). It is derived from the catalog's `circumference_mm`, which `catalog-data` computed from "5.25 Inch" (REQ-CD-19), so the label returns the listing's own number.

## 3. `lib/size-spec.ts`

```ts
export const PHOTO_BOX_MIN_SHORT_MM = 6;
export const PHOTO_BOX_MAX_ASPECT = 2.5;
export function photoFitsBox(heightMm: number, widthMm: number): boolean

export interface SizeCaption { approximate: string; calibrated: string }   // identical for boxes; differ for rings

export type SizeItem =
  | { kind: "box";  id: "piece" | "pendant" | "earring"; heightMm: number; widthMm: number;
      photoInside: boolean; caption: SizeCaption; detail: string }
  | { kind: "line"; id: "piece"; heightMm: number;                       // width not stated
      caption: SizeCaption; detail: string }
  | { kind: "ring"; id: "bracelet" | "bangle"; diameterMm: number;
      caption: SizeCaption; detail: string }
  | { kind: "missing"; id: "piece"; message: string };                    // "Size not stated on the listing."

export interface SizeSpec { sku: string; name: string; imageSrc: string; items: SizeItem[] }
export function buildSizeSpec(product: Product): SizeSpec
```

`buildSizeSpec` dispatches on `product.dims.kind` (the unit in the listing, not the product name, decides bracelet vs bangle, as in `catalog-data`):

| `dims.kind` | Items |
|---|---|
| `item` with both dims | one `box`, `id: "piece"`, `photoInside = photoFitsBox(h, w)` |
| `item`, width null | one `line` |
| `item`, height null | one `missing` |
| `set` | two `box`: `pendant` (`pendant_height_mm × pendant_width_mm`) and `earring`; `photoInside = false` for both |
| `string-bracelet` | one `ring`, `diameterMm = circumference_mm / Math.PI` |
| `bangle` | one `ring`, `diameterMm = diameter_mm` |

Captions (`{h}`, `{d}`, `{in}` use `formatMm`, `formatInches`):

| Item | `calibrated` | `approximate` | `detail` |
|---|---|---|---|
| Pendant box | "pendant face, {h} mm tall — chain not shown to scale" | same | "Listed: {h} mm tall × {w} mm wide." |
| Earrings box | "one earring, {h} mm tall" | same | same form |
| Tabeez box | "tabeez, {h} mm tall — thread not shown to scale" | same | same form |
| Set pendant / earring | pendant and earring forms above | same | same form |
| Height line | the box caption of its category | same | "Listed: {h} mm tall. Width not stated on the listing." |
| Bracelet ring | "ring outline at true size — {in} in around" | "ring outline, approximate size — {in} in around" | "Drawn as a closed circle, Ø ≈ {round(d)} mm. Band width: {w} mm." or "… Band width not stated on the listing." |
| Bangle ring | "bangle outline at true size — {d} mm across" | "bangle outline, approximate size — {d} mm across" | "Band width: {w} mm." or "Band width not stated on the listing." |

The category word ("pendant", "earring", "tabeez") comes from `product.category`; for a `Set` the item `id` decides. `buildSizeSpec` reads `name`, `image_file` (as `/catalog/${image_file}`), `category`, and `dims` only. No caption interpolates a free-form catalog string except the product name in `SizeSpec.name`, which is used as alt text.

### 3.1 Real catalog results (catalog v1.0.0; pinned in tests)

| Group | SKUs | Item |
|---|---|---|
| Photo inside the box | TPN-1459 (26 × 18.6), TPN-1433 (22.8 × 15.5), TBZ-1013 and TBZ-1017 (12.1 × 7.4) | `box`, `photoInside: true` |
| Empty size outline | TPN-1149 (14.4 × 1.9), TPN-1147 (15.8 × 2.1), TPN-1145 (13.7 × 1.3), TPN-1141 (15.8 × 1.7), TPN-1143 (11.5 × 1.7), TPN-1144 (14.3 × 2.2), THP-1017 (11 × 3), THP-1001 (10.5 × 4), THP-1027 (10 × 2) | `box`, `photoInside: false` |
| Sets | TPN-1206 (pendant 11.5 × 4.55, earring 5.35 × 3.9), TPN-1199 (pendant 11.65 × 4.35, earring 5.05 × 4.15) | two `box`, no photo inside |
| String bracelets | TNZ-1058, TNZ-1016, TNZ-1010, TNZ-1015, TNZ-1056 (circumference 133.4 mm, Ø 42.46 mm) | `ring`; band width null for TNZ-1058 and TNZ-1056 |
| Bangles | TOB-1009, TOB-1008 (39.6 mm across, band 1.6 mm) | `ring` |

The photo rule exists because a square photo placed with `object-contain` in a 14.4 × 1.9 mm box would shrink to 1.9 mm and misstate the size. See §7 and open question Q10.

## 4. Calibration store (`components/useCalibration.ts`)

A small external store read with `useSyncExternalStore`, which gives a hydration-safe server snapshot and cross-tab updates without an effect that sets state.

```ts
const EVENT = "hga:calibration";
let memory: string | null = null;                         // fallback when localStorage throws

function read(): string | null {
  try { return window.localStorage.getItem(STORAGE_KEY) ?? memory; } catch { return memory; }
}
function write(raw: string | null) {
  memory = raw;
  try { raw === null ? window.localStorage.removeItem(STORAGE_KEY) : window.localStorage.setItem(STORAGE_KEY, raw); } catch { /* keep memory */ }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb); window.addEventListener(EVENT, cb); window.addEventListener("resize", cb);
  return () => { /* remove the three */ };
}

export function useCalibration(): {
  mode: "approximate" | "calibrated" | "stale";
  factor: number;                 // CSS_PX_PER_MM unless calibrated
  calibrate(longEdgePx: number): boolean;   // false when factorFromCardPx rejects
  reset(): void;
}
```

The hook reads the raw string with `useSyncExternalStore(subscribe, read, () => null)` (server snapshot `null`), parses it with `parseCalibration`, reads `window.devicePixelRatio` through a second `useSyncExternalStore(subscribe, () => window.devicePixelRatio, () => 1)`, and derives the mode: no valid value gives `approximate`; a valid value with `isStale` gives `stale`; otherwise `calibrated`. Only `calibrated` uses the stored factor. The raw string is a primitive, so the snapshot is stable and React does not loop. The server render and the first client render both use the server snapshot, so they match (REQ-TS-28); the stored calibration applies on the next render.

`calibrate()` calls `factorFromCardPx`, then `write(serializeCalibration({ pxPerMm, dpr: window.devicePixelRatio }))`. `reset()` calls `write(null)`. The module-level `memory` fallback means a private-mode browser keeps its calibration until the page closes (REQ-TS-08).

Before writing the hook, the builder reads the `useSyncExternalStore` entry in the React docs bundled in `node_modules` if present, and otherwise the React 19 reference, and runs `npm run lint`: the React compiler lint rules in `eslint-config-next` reject `setState` inside an effect, which is why this design avoids that pattern.

## 5. The components

### 5.1 `TrueSizeViewer` (client)

Props: `{ spec: SizeSpec }`. State: `useCalibration()` for the mode and factor, `calibrating: boolean`, and the slider value (inside `CalibrationSlider`).

Layout, top to bottom, inside one `<section aria-labelledby="size-title">` (`data-testid="true-size-viewer"`):

1. `<h2 id="size-title">Size on your screen</h2>`. The heading never contains "true size" (REQ-TS-12).
2. The status line:
   - `approximate`: exactly "Approximate size — calibrate with a card for true size." as one text node, then a "Calibrate with a card" button.
   - `stale`: the stale note of REQ-TS-10, the approximate label, and the calibrate button.
   - `calibrated`: "Calibrated to your screen", a "Check the size against a real ruler" line (next to the ruler), and "Reset calibration".
3. When `calibrating`: `<CalibrationSlider>`; confirming calls `calibrate(px)` and closes it.
4. `<SizeOutlines spec factor calibrated>`.
5. `<SizeRuler factor calibrated items>` (screen ruler, print button, print sheet).

All of 2 to 5 carry `print:hidden` except the print sheet. The mode, not the factor, decides which caption string is used: `calibrated ? caption.calibrated : caption.approximate`. A `stale` mode counts as not calibrated.

### 5.2 `CalibrationSlider` (client)

Props: `{ onConfirm(longEdgePx: number): void; onCancel(): void }`. It keeps `longEdgePx` in `useState(CARD_PX_DEFAULT)` and renders:

- the instruction (id `cal-help`): "Hold a credit or debit card flat against the screen. Drag the slider until the outline matches the card's long edge.";
- the outline, a `div` with `box-sizing: border-box`, `border border-plum/60`, `bg-champagne/40`, `width = longEdgePx`, `height = longEdgePx × 53.98 / 85.6` (landscape) or the swapped sizes (portrait, from `cardOrientation(longEdgePx, availablePx)`), where `availablePx` is the parent's `clientWidth` read in a `ref` callback on mount and on `resize`;
- `<input type="range" min={171} max={856} step={1} aria-label="Card outline width" aria-describedby="cal-help">`;
- buttons "This matches" (primary) and "Cancel" (secondary).

The outline's outer edge is the thing the user matches to the card, so its border is inside the box (`border-box`). Matching the card's outer edge to the outline's outer edge is stated in the instruction ("long edge"). Interactions to calibrate: tap "Calibrate with a card", move the slider, tap "This matches": 3 (REQ-TS-06).

### 5.3 `SizeOutlines` (client)

Props: `{ spec, factor, calibrated }`. For each item (REQ-TS-15 to REQ-TS-22):

| Item | Rendering |
|---|---|
| `box` | `<div style={{ width: mmToPx(w, factor), height: mmToPx(h, factor) }} className="relative box-border border border-plum/60 bg-pearl">`; when `photoInside`, a child `<Image fill sizes={px} alt={spec.name} className="object-contain">` of `spec.imageSrc`. Caption below in a `<p>`; detail line in `<p className="text-xs text-plum/70">`. |
| `line` | An SVG vertical rule of `mmToPx(h)` height with end caps, `role="img"`. |
| `ring` | `<svg width={d} height={d} role="img" aria-label={caption}>` with `<circle cx cy r={d/2 - 0.75} className="fill-none stroke-plum" strokeWidth={1.5}>`. The stroke is inset by half its width so the outer edge equals `d`. Stroke width is constant, never scaled to the band width. |
| `missing` | The message text, no drawing. |

The reference card is a `box`-like `div` of `cardPx(factor)` (landscape; upright when it would overflow), `border-plum/40`, with the label "Credit-card size, for reference — 85.60 × 53.98 mm" below. Outlines sit in a flex row with `flex-wrap` and `overflow-x-auto`, so a 10 px/mm calibration does not break the page. Colours: `border-plum/60`, `stroke-plum`, `bg-pearl`, `bg-champagne/40` only.

No element is positioned over a photo. `next/image` in a box uses `fill` with `sizes` set to the box's px width, which keeps Next.js from loading a larger variant than the box needs. The photo file is the same `/catalog/<image_file>` as the page photo.

### 5.4 `SizeRuler` (client)

- Screen ruler: an SVG of width `mmToPx(lengthMm, factor)`, `lengthMm = fitRulerMm(availablePx, factor)`, ticks from `rulerTicks`, drawn as `<line>`s with `className="stroke-plum"` (long ticks 12 px, half 8 px, mm 5 px) and `<text className="fill-plum">` labels at cm ticks, unit "cm". Label: "Approximate ruler" when not calibrated; "Check the size against a real ruler" when calibrated. The whole ruler is `aria-hidden`; the label is real text.
- Print sheet: a `div` with `className="hidden print:block"` containing one SVG with `viewBox` in millimetres and `width`/`height` set in `mm` units (`width="100mm"`), so print uses physical millimetres regardless of screen scale: the 100 mm ruler, the ID-1 outline (85.6 × 53.98), and each item's outline at its listed size (box rect, ring circle, height line), laid out left to right and wrapped by row, plus the instruction text. The button "Print a 1:1 paper ruler" calls `window.print()`.
- Everything else on the page is hidden in print through `print:hidden` on the page's other sections (task in `gift-presentation`) and on the viewer's own screen elements. No custom print CSS file is needed; Tailwind's `print:` variant is the print stylesheet.

## 6. Composition with the server page

`app/piece/[sku]/page.tsx` (a server component, built in `gift-presentation`) does:

```tsx
const spec = buildSizeSpec(product);                 // pure, serialisable
…
<TrueSizeViewer spec={spec} />                       // client island; only props cross the boundary
```

Props crossing the boundary are plain data (strings, numbers, booleans, arrays). The viewer's markup, in the uncalibrated mode, is part of the server-rendered HTML, which is what the dev-server check reads ("Approximate size — calibrate with a card for true size." appears with no stored calibration). The client island is small: `TrueSizeViewer` plus three children, no catalog, no matching.

## 7. Design decisions

| Decision | Alternatives | Why |
|---|---|---|
| Draw outlines from `Dims`, put the photo inside only when it can be read (REQ-TS-17) | Always put the photo in the H×W box (the PRD sentence) | A catalog photo is a square with the piece at an unknown fraction of the frame. In a 14.4 × 1.9 mm box, `object-contain` shrinks the whole photo to 1.9 mm: the picture would understate the piece to a sliver and be unreadable. Nine of 13 single-piece pendants and earrings have an aspect over 2.5 or a short side under 6 mm. The rule keeps the PRD's "photo in a true-size box" exactly where it works (4 pieces) and shows the box alone elsewhere, with the photo at page size labeled "not to scale". |
| Caption names height; second line gives listed width | Caption names both as if they were face dimensions | The listing gives "Height" and "Width" only. For the gold pendants width is 1.3 to 2.2 mm, which cannot be a face width, so it is likely a thickness. The card does not say which. |
| Factor derived from the card's long edge | Short edge, or both | One slider, one number. The long edge is more precise (more pixels). |
| Store `{v, pxPerMm, dpr}` and treat a changed `dpr` as stale | Store the factor only | Browser zoom changes CSS px per physical mm; a stale factor would silently break "true size". The check is cheap and the failure is stated, not hidden. |
| `useSyncExternalStore` over `useEffect` + `useState` | Effect that reads storage | Matches hydration (server snapshot `null`), syncs tabs, and passes the React lint rules. |
| Ring drawn as a closed circle | Draw the string as a line of 133.4 mm | A bracelet is worn as a loop; the PRD asks for a ring of Ø ≈ 42 mm. The detail line says "Drawn as a closed circle". |
| Print sheet via `print:` utilities and `mm` | A separate print page | No new route; physical `mm` is exact in print. |

## 8. Failure behaviour

| Situation | Behaviour |
|---|---|
| `localStorage` unavailable or throws | In-memory calibration for the session; no error shown. |
| Stored value corrupt or out of range | Treated as not calibrated; the stored value is left alone until the next successful calibration overwrites it. |
| Browser zoom or screen changed | `stale` mode: approximate again, with the note; stored value kept (it is valid again if the zoom returns). |
| A product with a null dimension | `line` or `missing` item; never a drawing of 0. |
| Container narrower than the outline | Portrait outline (REQ-TS-07); outlines row scrolls horizontally. |
| JavaScript disabled | The server-rendered approximate mode shows, with the label; calibration and print need JS. |

## 9. Testing

| File | Env | Covers |
|---|---|---|
| `tests/true-size.test.ts` | node | constants, `mmToPx`/`pxToMm` (+ `RangeError`), `factorFromCardPx` (ok, non-finite, out of range), `cardPx`, `cardOrientation`, serialise/parse (valid, corrupt, wrong version, out of range), `isStale`, `rulerTicks`, `fitRulerMm`, `formatMm`, `formatInches` (133.4 → "5.25", 39.6 → "39.6") |
| `tests/true-size.property.test.ts` | node | T1 to T10 (seed fixed, `numRuns ≥ 200`; the round trip ≥ 500) |
| `tests/size-spec.test.ts` | node | every `Dims` kind; the 22 real products (the table in §3.1); null-width bracelets; null-dimension items from a fixture; captions byte-for-byte for TPN-1149, TPN-1459, TNZ-1056, TOB-1009, TPN-1206 |
| `tests/true-size.ui.test.tsx` | jsdom (`// @vitest-environment jsdom`, `tests/helpers/dom.ts`) | viewer in both modes, slider, reset, stale, labels, the wording rule |
| `tests/true-size.static.test.ts` | node | `lib/true-size.ts` and `lib/size-spec.ts` import no React, `fs`, `fetch`, LLM; no `Date`, `Math.random`; components import no `catalog.json` or `catalog-store`; no `#hex`, `rgb(`, `[#`; no `transform: scale`/`zoom` on outlines; no `<img` of a logo |

### 9.1 Component test notes

jsdom has no layout, so the tests assert the `style` width and height of each outline equal `mmToPx(mm, factor)` (REQ-TS-25's code guarantee), not rendered pixels. Storage is `window.localStorage` provided by jsdom; each test clears it. `window.devicePixelRatio` is 1 in jsdom; the stale case sets it with `Object.defineProperty`. `next/image` is mocked with `vi.mock` to a plain `<img>` that passes `src`, `alt`, and `className`, so the test can check `object-contain` and the absence of overlay siblings.

### 9.2 Correctness properties (fast-check, seeded)

| ID | Property | Requirement |
|---|---|---|
| P-TS-1 (T1) | For finite `mm ∈ (0, 500]` and `factor ∈ [2, 10]`, `pxToMm(mmToPx(mm, f), f)` is within relative 1e-9 of `mm`; with px rounded to 0.1, the error is ≤ `0.05 / f`. | REQ-TS-04, 32 |
| P-TS-2 (T2) | For `f ∈ [2, 10]`, `factorFromCardPx(cardPx(f).long)` equals `f` (relative 1e-9) and `cardPx(f).short / cardPx(f).long` equals `53.98 / 85.6` (1e-12). Out-of-range or non-finite px never returns `ok`. | REQ-TS-03, 33 |
| P-TS-3 (T3) | `mmToPx` is additive and strictly increasing in both arguments over the ranges. | REQ-TS-34 |
| P-TS-4 (T4) | `parseCalibration(serializeCalibration(c))` equals `{ v: 1, ...c }` for valid `c`; for any generated string or `JSON.stringify(fc.anything())`, `parseCalibration` returns `null` or a calibration within range, and never throws. | REQ-TS-08, 35 |
| P-TS-5 (T5) | For all 22 real products and generated `Dims` of each kind: no `approximate` caption or `detail` matches `/true[- ]size/i`. | REQ-TS-11, 12, 36 |
| P-TS-6 (T6) | For every product and `factor ∈ [2, 10]`, each item's outer px size equals `mmToPx(listed mm, factor)` (the test computes it from the raw `Dims`, not from `size-spec`); ring: `Math.PI × diameterMm` equals `circumference_mm` (1e-9). | REQ-TS-15, 37 |
| P-TS-7 (T7) | Each box caption contains `${formatMm(height)} mm tall`; each bracelet calibrated caption contains `${formatInches(circumference)} in around`; each bangle caption contains `${formatMm(diameter)} mm across`. | REQ-TS-16, 19, 20, 38 |
| P-TS-8 (T8) | `photoFitsBox(h, w)` ⇔ `min ≥ 6 ∧ max/min ≤ 2.5` for generated `h, w > 0`; over the real catalog the 4 SKUs of REQ-TS-17 and no other get `photoInside`; no `set` item has it. | REQ-TS-17, 18, 39 |
| P-TS-9 (T9) | `buildSizeSpec` never yields an item of size 0, NaN, or an item for a chain or thread; for generated `item` dims with null height or width the result is `missing` or `line`. | REQ-TS-21, 22, 40 |
| P-TS-10 (T10) | `rulerTicks(L, f)` has `L + 1` ticks at `mmToPx(n, f)`; kinds follow the 5 and 10 rule; labels are exactly the whole centimetres. | REQ-TS-23, 41 |
| P-TS-11 | Component, both modes, 22 products: in the uncalibrated mode the viewer's text matches `/true[- ]size/i` exactly once, inside the exact REQ-TS-11 label (`getByText` of the full label); in the calibrated mode the label is gone and "Calibrated to your screen" is present. | REQ-TS-11, 12, 13 |

A counterexample from any property is logged in `docs/kiro-evidence-log.md` with its fix.

## 10. Manual QA (REQ-TS-30)

Not automatable (needs a physical card and ruler). The qa-auditor agent writes the checklist into `docs/qa-reports/true-size-m3.md`; a human fills the numbers. Steps: open `/piece/TPN-1459`; time from tapping "Calibrate with a card" to "This matches" with a real card; measure the box width (target 18.6 mm ± 5%, so 17.7 to 19.5 mm); open `/piece/TNZ-1056` and measure the ring (Ø about 42.5 mm ± 5%); print the sheet at 100% and compare the printed 100 mm ruler with a real ruler; repeat on a phone and a desktop screen; change browser zoom and see the stale note.

## 11. Open questions (not resolved by this spec; builder's call)

| ID | Question | Spec's working assumption |
|---|---|---|
| Q10 | The PRD puts the photo in a box at true H×W for every pendant, earring, and tabeez. For 9 of 13 such pieces the box is too thin for a square photo. | Photo in the box only when `min ≥ 6 mm` and `aspect ≤ 2.5` (4 pieces); otherwise an empty size outline, with the photo at page size labeled "not to scale". |
| Q11 | The listing's "Width" for gold pendants is 1.3 to 2.2 mm. The listing does not say whether it is face width or thickness. | The caption names height only; the detail line says "Listed: … wide" and makes no claim about which side. |
| Q12 | Browser zoom invalidates a stored factor. | Store `dpr`, treat a change of more than 0.02 as stale, show the note, keep the value. |
| Q13 | The landing page and PRD use "true-size" as a feature name. | The REQ-TS-12 rule covers the viewer and the detail page; the landing line is reworded in `safety-verdict` T4.2 so it does not claim "true-size" before calibration. |
| Q14 | A bracelet is drawn as a closed circle of the listed circumference. | Yes, stated in the detail line. |
