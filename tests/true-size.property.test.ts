// Property tests P-TS-1..4 and P-TS-10 (true-size-viewer design §9.2). Seeded.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CARD_MM,
  MAX_FACTOR,
  MIN_FACTOR,
  cardPx,
  factorFromCardPx,
  mmToPx,
  parseCalibration,
  pxToMm,
  rulerTicks,
  serializeCalibration,
} from "../lib/true-size";

const SEED = 20261124;
const assert = <T extends unknown[]>(p: fc.IPropertyWithHooks<T>, numRuns = 300) =>
  fc.assert(p, { seed: SEED, numRuns });

const factor = fc.double({ min: MIN_FACTOR, max: MAX_FACTOR, noNaN: true });
const mm = fc.double({ min: 1e-6, max: 500, noNaN: true });
const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("P-TS-1 round trip", () => {
  it("px → mm returns the mm within 1e-9, and within 0.05/f when px is rounded to 0.1", () => {
    assert(
      fc.property(mm, factor, (m, f) => {
        expect(rel(pxToMm(mmToPx(m, f), f), m)).toBeLessThanOrEqual(1e-9);
        const rounded = Math.round(mmToPx(m, f) * 10) / 10;
        expect(Math.abs(pxToMm(rounded, f) - m)).toBeLessThanOrEqual(0.05 / f + 1e-9);
      }),
      600,
    );
  });
});

describe("P-TS-2 factor round trip", () => {
  it("factorFromCardPx(cardPx(f).long) equals f and the proportion is ID-1", () => {
    assert(
      fc.property(factor, (f) => {
        const c = cardPx(f);
        const r = factorFromCardPx(c.long);
        expect(r.ok).toBe(true);
        if (r.ok) expect(rel(r.factor, f)).toBeLessThanOrEqual(1e-9);
        expect(rel(c.short / c.long, CARD_MM.short / CARD_MM.long)).toBeLessThanOrEqual(1e-12);
      }),
    );
  });

  it("out-of-range or non-finite px is never ok", () => {
    assert(
      fc.property(
        fc.oneof(
          fc.double({ min: -1e6, max: 85.6 * MIN_FACTOR - 0.6, noNaN: true }),
          fc.double({ min: 85.6 * MAX_FACTOR + 0.6, max: 1e6, noNaN: true }),
          fc.constantFrom(NaN, Infinity, -Infinity),
        ),
        (px) => {
          expect(factorFromCardPx(px).ok).toBe(false);
        },
      ),
    );
  });
});

describe("P-TS-3 linearity and monotonicity", () => {
  it("mmToPx is additive and strictly increasing in mm and in factor", () => {
    assert(
      fc.property(mm, mm, factor, (a, b, f) => {
        const sum = mmToPx(a + b, f);
        expect(Math.abs(mmToPx(a, f) + mmToPx(b, f) - sum)).toBeLessThanOrEqual(1e-9 * Math.max(1, sum));
      }),
    );
    assert(
      fc.property(mm, fc.double({ min: 0.001, max: 100, noNaN: true }), factor, (a, d, f) => {
        const bigger = a + d;
        fc.pre(bigger > a);
        expect(mmToPx(bigger, f)).toBeGreaterThan(mmToPx(a, f));
      }),
    );
    assert(
      fc.property(mm, factor, fc.double({ min: 0.001, max: 1, noNaN: true }), (a, f, d) => {
        const bigger = f + d;
        fc.pre(bigger > f);
        expect(mmToPx(a, bigger)).toBeGreaterThan(mmToPx(a, f));
      }),
    );
  });
});

describe("P-TS-4 calibration storage", () => {
  it("parse(serialize(c)) returns c for every valid calibration", () => {
    assert(
      fc.property(factor, fc.double({ min: 0.5, max: 5, noNaN: true }), (pxPerMm, dpr) => {
        expect(parseCalibration(serializeCalibration({ pxPerMm, dpr }))).toEqual({ v: 1, pxPerMm, dpr });
      }),
    );
  });

  it("arbitrary strings and JSON never throw and yield null or an in-range calibration", () => {
    const inputs = fc.oneof(
      fc.string(),
      fc.anything().map((v) => JSON.stringify(v) ?? "undefined"),
      fc.anything().map((v) => JSON.stringify({ v: 1, pxPerMm: v, dpr: v }) ?? ""),
    );
    assert(
      fc.property(inputs, (raw) => {
        const c = parseCalibration(raw);
        if (c !== null) {
          expect(c.v).toBe(1);
          expect(c.pxPerMm).toBeGreaterThanOrEqual(MIN_FACTOR);
          expect(c.pxPerMm).toBeLessThanOrEqual(MAX_FACTOR);
          expect(Number.isFinite(c.dpr) && c.dpr > 0).toBe(true);
        }
      }),
      500,
    );
  });
});

describe("P-TS-10 ruler", () => {
  it("has L+1 ticks at mmToPx(n, f), 5/10 kinds, and labels exactly the whole cm", () => {
    assert(
      fc.property(fc.integer({ min: 1, max: 100 }), factor, (len, f) => {
        const t = rulerTicks(len, f);
        expect(t).toHaveLength(len + 1);
        t.forEach((tick, n) => {
          expect(tick.mm).toBe(n);
          expect(tick.px).toBe(mmToPx(n, f));
          if (n % 10 === 0) expect(tick.kind).toBe("cm");
          else if (n % 5 === 0) expect(tick.kind).toBe("half");
          else expect(tick.kind).toBe("mm");
        });
        const labels = t.filter((x) => x.label !== undefined).map((x) => x.label);
        const cms = Array.from({ length: Math.floor(len / 10) + 1 }, (_, i) => String(i));
        expect(labels).toEqual(cms);
        expect(t.every((x) => (x.label !== undefined) === (x.kind === "cm"))).toBe(true);
      }),
    );
  });
});
