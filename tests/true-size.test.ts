import { describe, expect, it } from "vitest";
import {
  CARD_MM,
  CARD_PX_DEFAULT,
  CARD_PX_MAX,
  CARD_PX_MIN,
  CSS_PX_PER_MM,
  MAX_FACTOR,
  MIN_FACTOR,
  STORAGE_KEY,
  cardOrientation,
  cardPx,
  factorFromCardPx,
  fitRulerMm,
  formatInches,
  formatMm,
  isStale,
  mmToPx,
  parseCalibration,
  pxToMm,
  rulerTicks,
  serializeCalibration,
} from "../lib/true-size";

describe("constants", () => {
  it("match the spec", () => {
    expect(CARD_MM).toEqual({ long: 85.6, short: 53.98 });
    expect(CSS_PX_PER_MM).toBeCloseTo(3.7795, 4);
    expect([MIN_FACTOR, MAX_FACTOR]).toEqual([2, 10]);
    expect(STORAGE_KEY).toBe("hga.trueSize.v1");
    expect([CARD_PX_MIN, CARD_PX_MAX, CARD_PX_DEFAULT]).toEqual([171, 856, 324]);
  });
});

describe("mmToPx / pxToMm", () => {
  it("multiply and divide without rounding", () => {
    expect(mmToPx(18.6, 5)).toBeCloseTo(93, 10);
    expect(mmToPx(1.9, 5)).toBeCloseTo(9.5, 10);
    expect(mmToPx(1 / 3, 3)).toBeCloseTo(1, 12);
    expect(mmToPx(0.123456789, 2)).toBe(0.123456789 * 2);
    expect(pxToMm(93, 5)).toBeCloseTo(18.6, 10);
  });

  it("throw RangeError on non-finite input or factor <= 0", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(() => mmToPx(bad, 4)).toThrow(RangeError);
      expect(() => pxToMm(bad, 4)).toThrow(RangeError);
      expect(() => mmToPx(4, bad)).toThrow(RangeError);
    }
    for (const f of [0, -1]) {
      expect(() => mmToPx(4, f)).toThrow(RangeError);
      expect(() => pxToMm(4, f)).toThrow(RangeError);
    }
  });
});

describe("factorFromCardPx / cardPx", () => {
  it("derives the factor from the long edge", () => {
    expect(factorFromCardPx(342.4)).toEqual({ ok: true, factor: 342.4 / 85.6 });
    const r = factorFromCardPx(CARD_PX_DEFAULT);
    expect(r.ok && r.factor).toBeCloseTo(3.785, 3);
  });

  it("accepts the slider's whole range", () => {
    expect(factorFromCardPx(CARD_PX_MIN).ok).toBe(true);
    expect(factorFromCardPx(CARD_PX_MAX).ok).toBe(true);
  });

  it("clamps the slider ends (171, 856 px) into [MIN_FACTOR, MAX_FACTOR]", () => {
    // regression: 171 / 85.6 = 1.9977 used to be rejected as out of range
    expect(factorFromCardPx(CARD_PX_MIN)).toEqual({ ok: true, factor: MIN_FACTOR });
    expect(factorFromCardPx(CARD_PX_MAX)).toEqual({ ok: true, factor: MAX_FACTOR });
    expect(factorFromCardPx(170).ok).toBe(false);
    expect(factorFromCardPx(857).ok).toBe(false);
  });

  it("returns an error result, not a number, for bad input", () => {
    expect(factorFromCardPx(NaN)).toEqual({ ok: false, reason: "non-finite" });
    expect(factorFromCardPx(Infinity)).toEqual({ ok: false, reason: "non-finite" });
    expect(factorFromCardPx(100)).toEqual({ ok: false, reason: "out-of-range" });
    expect(factorFromCardPx(1000)).toEqual({ ok: false, reason: "out-of-range" });
    expect(factorFromCardPx(-5)).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("cardPx keeps the ID-1 proportion", () => {
    const c = cardPx(4);
    expect(c.long).toBeCloseTo(342.4, 10);
    expect(c.short).toBeCloseTo(215.92, 10);
    expect(() => cardPx(0)).toThrow(RangeError);
  });
});

describe("cardOrientation", () => {
  it("is landscape when it fits and portrait when it does not", () => {
    expect(cardOrientation(300, 400)).toBe("landscape");
    expect(cardOrientation(400, 400)).toBe("landscape");
    expect(cardOrientation(401, 400)).toBe("portrait");
  });
});

describe("calibration (de)serialisation", () => {
  it("writes {v, pxPerMm, dpr} in that key order", () => {
    expect(serializeCalibration({ pxPerMm: 4.2, dpr: 2 })).toBe('{"v":1,"pxPerMm":4.2,"dpr":2}');
  });

  it("round-trips a valid value", () => {
    const c = { pxPerMm: 5.5, dpr: 1.5 };
    expect(parseCalibration(serializeCalibration(c))).toEqual({ v: 1, ...c });
  });

  it("treats null, bad JSON, wrong shape, wrong version and bad numbers as not calibrated", () => {
    const bad = [
      null,
      "",
      "{not json",
      "null",
      "[]",
      "5",
      '"x"',
      '{"v":2,"pxPerMm":4,"dpr":1}',
      '{"pxPerMm":4,"dpr":1}',
      '{"v":"1","pxPerMm":4,"dpr":1}',
      '{"v":1,"pxPerMm":1.99,"dpr":1}',
      '{"v":1,"pxPerMm":10.01,"dpr":1}',
      '{"v":1,"pxPerMm":"4","dpr":1}',
      '{"v":1,"pxPerMm":null,"dpr":1}',
      '{"v":1,"pxPerMm":4}',
      '{"v":1,"pxPerMm":4,"dpr":0}',
      '{"v":1,"pxPerMm":4,"dpr":-1}',
      '{"v":1,"pxPerMm":4,"dpr":"1"}',
      '{"v":1,"pxPerMm":4,"dpr":null}',
    ];
    for (const raw of bad) expect(parseCalibration(raw), String(raw)).toBeNull();
  });

  it("accepts the range edges", () => {
    expect(parseCalibration('{"v":1,"pxPerMm":2,"dpr":1}')).not.toBeNull();
    expect(parseCalibration('{"v":1,"pxPerMm":10,"dpr":1}')).not.toBeNull();
  });
});

describe("isStale", () => {
  const c = { v: 1 as const, pxPerMm: 4, dpr: 2 };
  it("is false within 0.02 and true beyond", () => {
    expect(isStale(c, 2)).toBe(false);
    expect(isStale(c, 2.02)).toBe(false);
    expect(isStale(c, 1.98)).toBe(false);
    expect(isStale(c, 2.03)).toBe(true);
    expect(isStale(c, 1)).toBe(true);
  });
  it("is stale for a non-finite current dpr", () => {
    expect(isStale(c, NaN)).toBe(true);
  });
});

describe("rulerTicks", () => {
  it("has lengthMm + 1 ticks with the 1/5/10 rule", () => {
    const t = rulerTicks(20, 4);
    expect(t).toHaveLength(21);
    expect(t[0]).toEqual({ mm: 0, px: 0, kind: "cm", label: "0" });
    expect(t[1]).toEqual({ mm: 1, px: 4, kind: "mm" });
    expect(t[5]).toEqual({ mm: 5, px: 20, kind: "half" });
    expect(t[10]).toEqual({ mm: 10, px: 40, kind: "cm", label: "1" });
    expect(t[20].label).toBe("2");
    expect(t.filter((x) => x.label !== undefined)).toHaveLength(3);
  });
});

describe("fitRulerMm", () => {
  it("is 100 when there is room, otherwise whole centimetres, at least 10", () => {
    expect(fitRulerMm(2000, 4)).toBe(100);
    expect(fitRulerMm(300, 4)).toBe(70);
    expect(fitRulerMm(400, 4)).toBe(100);
    expect(fitRulerMm(10, 4)).toBe(10);
    expect(fitRulerMm(0, 4)).toBe(10);
  });
});

describe("formatMm / formatInches", () => {
  it("trims trailing zeros to at most 2 decimals", () => {
    expect(formatMm(14.4)).toBe("14.4");
    expect(formatMm(26)).toBe("26");
    expect(formatMm(4.55)).toBe("4.55");
    expect(formatMm(39.6)).toBe("39.6");
    expect(formatMm(12.1)).toBe("12.1");
    expect(formatMm(5.350001)).toBe("5.35");
  });
  it("formats inches to 2 decimals", () => {
    expect(formatInches(133.4)).toBe("5.25");
    expect(formatInches(25.4)).toBe("1.00");
  });
});
