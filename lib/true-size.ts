// True-size math, calibration format and ruler ticks (true-size-viewer design §2).
// Pure: no React, no I/O, no clock. Rounding happens only when text is formatted.

/** ISO/IEC 7810 ID-1 card, the size of a credit or debit card. */
export const CARD_MM = { long: 85.6, short: 53.98 } as const;
/** CSS px that one CSS millimetre occupies (the CSS definition, not a physical mm). */
export const CSS_PX_PER_MM = 96 / 25.4;
export const MIN_FACTOR = 2;
export const MAX_FACTOR = 10;
export const STORAGE_KEY = "hga.trueSize.v1";
export const CARD_PX_MIN = Math.round(CARD_MM.long * MIN_FACTOR); // 171
export const CARD_PX_MAX = Math.round(CARD_MM.long * MAX_FACTOR); // 856
export const CARD_PX_DEFAULT = Math.round(CARD_MM.long * CSS_PX_PER_MM); // 324
/** A stored dpr that differs from the current one by more than this is stale. */
export const DPR_TOLERANCE = 0.02;

function check(value: number, factor: number): void {
  if (!Number.isFinite(value) || !Number.isFinite(factor) || factor <= 0) {
    throw new RangeError("value must be finite and factor must be a finite number above 0");
  }
}

export function mmToPx(mm: number, factor: number): number {
  check(mm, factor);
  return mm * factor;
}

export function pxToMm(px: number, factor: number): number {
  check(px, factor);
  return px / factor;
}

export type FactorResult =
  | { ok: true; factor: number }
  | { ok: false; reason: "non-finite" | "out-of-range" };

const EDGE_SLACK = 0.5 / CARD_MM.long;

export function factorFromCardPx(longEdgePx: number): FactorResult {
  if (!Number.isFinite(longEdgePx)) return { ok: false, reason: "non-finite" };
  const raw = longEdgePx / CARD_MM.long;
  // The slider ends (171 and 856 px) are whole-pixel roundings of 2 × 85.6 = 171.2 and
  // 10 × 85.6 = 856, so up to half a pixel outside the range is accepted and clamped to it.
  if (raw < MIN_FACTOR - EDGE_SLACK || raw > MAX_FACTOR + EDGE_SLACK) {
    return { ok: false, reason: "out-of-range" };
  }
  return { ok: true, factor: Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, raw)) };
}

export function cardPx(factor: number): { long: number; short: number } {
  return { long: mmToPx(CARD_MM.long, factor), short: mmToPx(CARD_MM.short, factor) };
}

/** Upright (portrait) when the long edge does not fit the space available. */
export function cardOrientation(longEdgePx: number, availablePx: number): "landscape" | "portrait" {
  return longEdgePx > availablePx ? "portrait" : "landscape";
}

export interface Calibration {
  v: 1;
  pxPerMm: number;
  dpr: number;
}

export function serializeCalibration(c: Omit<Calibration, "v">): string {
  return JSON.stringify({ v: 1, pxPerMm: c.pxPerMm, dpr: c.dpr });
}

/** Validates on read (REQ-TS-08). Never throws; anything invalid is "not calibrated". */
export function parseCalibration(raw: string | null): Calibration | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const { pxPerMm, dpr } = o;
  if (o.v !== 1) return null;
  if (typeof pxPerMm !== "number" || !Number.isFinite(pxPerMm)) return null;
  if (pxPerMm < MIN_FACTOR || pxPerMm > MAX_FACTOR) return null;
  if (typeof dpr !== "number" || !Number.isFinite(dpr) || dpr <= 0) return null;
  return { v: 1, pxPerMm, dpr };
}

export function isStale(c: Calibration, currentDpr: number): boolean {
  // The 1e-9 absorbs float error: |2 - 2.02| is 0.02000000000000002, not 0.02.
  return !(Math.abs(c.dpr - currentDpr) <= DPR_TOLERANCE + 1e-9);
}

export interface Tick {
  mm: number;
  px: number;
  kind: "mm" | "half" | "cm";
  label?: string;
}

/** `lengthMm + 1` ticks from 0 to `lengthMm`; labels (whole cm) on the cm ticks. */
export function rulerTicks(lengthMm: number, factor: number): Tick[] {
  const ticks: Tick[] = [];
  for (let mm = 0; mm <= lengthMm; mm++) {
    const px = mmToPx(mm, factor);
    if (mm % 10 === 0) ticks.push({ mm, px, kind: "cm", label: String(mm / 10) });
    else if (mm % 5 === 0) ticks.push({ mm, px, kind: "half" });
    else ticks.push({ mm, px, kind: "mm" });
  }
  return ticks;
}

/** 100 mm, or the available width rounded down to whole centimetres; at least 10 mm. */
export function fitRulerMm(availablePx: number, factor: number): number {
  const cm = Math.floor(availablePx / factor / 10) * 10;
  return Math.max(10, Math.min(100, cm));
}

/** Up to 2 decimals, trailing zeros trimmed: 14.4, 26, 4.55, 39.6. */
export function formatMm(mm: number): string {
  return String(Number(mm.toFixed(2)));
}

/** 133.4 mm → "5.25". */
export function formatInches(mm: number): string {
  return (mm / 25.4).toFixed(2);
}
