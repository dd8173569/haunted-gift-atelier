// Property tests P-TS-5..9 (true-size-viewer design §9.2). Seeded.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Category, Dims, Product } from "../lib/catalog";
import { buildSizeSpec, photoFitsBox, type SizeItem } from "../lib/size-spec";
import { MAX_FACTOR, MIN_FACTOR, formatInches, formatMm, mmToPx } from "../lib/true-size";
import { catalog, product } from "./helpers/matching-fixtures";

const SEED = 20261124;
const assert = <T extends unknown[]>(p: fc.IPropertyWithHooks<T>, numRuns = 300) =>
  fc.assert(p, { seed: SEED, numRuns });

const TRUE_SIZE = /true[- ]size/i;
const factor = fc.double({ min: MIN_FACTOR, max: MAX_FACTOR, noNaN: true });
const pos = fc.double({ min: 0.01, max: 300, noNaN: true });
const maybe = fc.option(pos, { nil: null });
const CATEGORIES: Category[] = ["Pendant", "Bracelet", "Earrings", "Set", "Tabeez"];

const dimsArb: fc.Arbitrary<Dims> = fc.oneof(
  fc.record({ kind: fc.constant("item" as const), height_mm: maybe, width_mm: maybe }),
  fc.record({
    kind: fc.constant("set" as const),
    pendant_height_mm: pos,
    pendant_width_mm: pos,
    earring_height_mm: pos,
    earring_width_mm: pos,
  }),
  fc.record({ kind: fc.constant("string-bracelet" as const), circumference_mm: pos, width_mm: maybe }),
  fc.record({ kind: fc.constant("bangle" as const), diameter_mm: pos, width_mm: maybe }),
);
const productArb: fc.Arbitrary<Product> = fc.record({
  category: fc.constantFrom(...CATEGORIES),
  dims: dimsArb,
}).map(({ category, dims }) => ({ ...product("TPN-1149"), category, dims }));

const strings = (it: SizeItem): string[] =>
  it.kind === "missing" ? [it.message] : [it.caption.approximate, it.caption.calibrated, it.detail];
const approximateStrings = (it: SizeItem): string[] =>
  it.kind === "missing" ? [it.message] : [it.caption.approximate, it.detail];

describe("P-TS-5 no unqualified 'true size' before calibration", () => {
  it("holds for all 22 real products", () => {
    for (const p of catalog.products) {
      for (const it of buildSizeSpec(p).items) {
        for (const s of approximateStrings(it)) expect(s, `${p.sku}: ${s}`).not.toMatch(TRUE_SIZE);
      }
    }
  });
  it("holds for generated Dims of every kind", () => {
    assert(
      fc.property(productArb, (p) => {
        for (const it of buildSizeSpec(p).items) {
          for (const s of approximateStrings(it)) expect(s).not.toMatch(TRUE_SIZE);
        }
      }),
    );
  });
});

describe("P-TS-6 drawn size equals listed size", () => {
  it("every real product, any factor: px equals mmToPx of the raw Dims value", () => {
    assert(
      fc.property(factor, (f) => {
        for (const p of catalog.products) {
          const d = p.dims;
          const items = buildSizeSpec(p).items;
          if (d.kind === "item") {
            const it = items[0];
            if (it.kind === "box") {
              expect(mmToPx(it.heightMm, f)).toBe(mmToPx(d.height_mm as number, f));
              expect(mmToPx(it.widthMm, f)).toBe(mmToPx(d.width_mm as number, f));
            }
          } else if (d.kind === "set") {
            const [a, b] = items;
            expect(a.kind === "box" && mmToPx(a.heightMm, f)).toBe(mmToPx(d.pendant_height_mm, f));
            expect(a.kind === "box" && mmToPx(a.widthMm, f)).toBe(mmToPx(d.pendant_width_mm, f));
            expect(b.kind === "box" && mmToPx(b.heightMm, f)).toBe(mmToPx(d.earring_height_mm, f));
            expect(b.kind === "box" && mmToPx(b.widthMm, f)).toBe(mmToPx(d.earring_width_mm, f));
          } else if (d.kind === "string-bracelet") {
            const it = items[0];
            expect(it.kind).toBe("ring");
            if (it.kind === "ring") {
              expect(Math.abs(Math.PI * it.diameterMm - d.circumference_mm)).toBeLessThanOrEqual(1e-9);
              expect(mmToPx(it.diameterMm, f)).toBe(mmToPx(d.circumference_mm / Math.PI, f));
            }
          } else {
            const it = items[0];
            expect(it.kind === "ring" && mmToPx(it.diameterMm, f)).toBe(mmToPx(d.diameter_mm, f));
          }
        }
      }),
    );
  });
  it("generated Dims: the spec carries the listed numbers unchanged", () => {
    assert(
      fc.property(productArb, (p) => {
        const d = p.dims;
        const items = buildSizeSpec(p).items;
        if (d.kind === "item" && d.height_mm !== null && d.width_mm !== null) {
          expect(items[0]).toMatchObject({ kind: "box", heightMm: d.height_mm, widthMm: d.width_mm });
        } else if (d.kind === "bangle") {
          expect(items[0]).toMatchObject({ kind: "ring", diameterMm: d.diameter_mm });
        } else if (d.kind === "string-bracelet") {
          const it = items[0];
          expect(it.kind === "ring" && Math.abs(Math.PI * it.diameterMm - d.circumference_mm)).toBeLessThanOrEqual(1e-9);
        }
      }),
    );
  });
});

describe("P-TS-7 captions name the measured side", () => {
  const check = (p: Product) => {
    const d = p.dims;
    for (const it of buildSizeSpec(p).items) {
      if (it.kind === "box" || it.kind === "line") {
        expect(it.caption.calibrated).toContain(`${formatMm(it.heightMm)} mm tall`);
        expect(it.caption.approximate).toContain(`${formatMm(it.heightMm)} mm tall`);
      } else if (it.kind === "ring" && d.kind === "string-bracelet") {
        expect(it.caption.calibrated).toContain(`${formatInches(d.circumference_mm)} in around`);
        expect(it.caption.approximate).toContain(`${formatInches(d.circumference_mm)} in around`);
      } else if (it.kind === "ring" && d.kind === "bangle") {
        expect(it.caption.calibrated).toContain(`${formatMm(d.diameter_mm)} mm across`);
        expect(it.caption.approximate).toContain(`${formatMm(d.diameter_mm)} mm across`);
      }
    }
  };
  it("holds for all 22 real products", () => catalog.products.forEach(check));
  it("holds for generated Dims", () => assert(fc.property(productArb, check)));
});

describe("P-TS-8 photo placement", () => {
  it("photoFitsBox ⇔ min ≥ 6 ∧ max/min ≤ 2.5", () => {
    assert(
      fc.property(fc.double({ min: 0.01, max: 100, noNaN: true }), fc.double({ min: 0.01, max: 100, noNaN: true }), (h, w) => {
        const min = Math.min(h, w);
        const max = Math.max(h, w);
        expect(photoFitsBox(h, w)).toBe(min >= 6 && max / min <= 2.5);
      }),
      500,
    );
  });
  it("over the real catalog exactly the 4 SKUs, and never a set", () => {
    const inside = catalog.products
      .filter((p) => buildSizeSpec(p).items.some((i) => i.kind === "box" && i.photoInside))
      .map((p) => p.sku)
      .sort();
    expect(inside).toEqual(["TBZ-1013", "TBZ-1017", "TPN-1433", "TPN-1459"]);
  });
  it("no generated set item ever has the photo inside", () => {
    assert(
      fc.property(productArb, (p) => {
        fc.pre(p.dims.kind === "set");
        for (const it of buildSizeSpec(p).items) expect(it.kind === "box" && it.photoInside).toBeFalsy();
      }),
    );
  });
});

describe("P-TS-9 nothing invented", () => {
  const sane = (it: SizeItem) => {
    const sizes =
      it.kind === "box" ? [it.heightMm, it.widthMm] : it.kind === "line" ? [it.heightMm] : it.kind === "ring" ? [it.diameterMm] : [];
    for (const n of sizes) expect(Number.isFinite(n) && n > 0).toBe(true);
    for (const s of strings(it)) expect(s).not.toMatch(/\b(chain|thread)\b.*\b(outline|drawn at)\b/i);
  };
  it("real products: only box/line/ring/missing items, none of size 0 or NaN", () => {
    for (const p of catalog.products) buildSizeSpec(p).items.forEach(sane);
  });
  it("generated Dims: sizes are positive and finite; null dimensions give missing or line", () => {
    assert(
      fc.property(productArb, (p) => {
        const items = buildSizeSpec(p).items;
        items.forEach(sane);
        if (p.dims.kind === "item") {
          expect(items).toHaveLength(1);
          const { height_mm: h, width_mm: w } = p.dims;
          if (h === null) expect(items[0].kind).toBe("missing");
          else if (w === null) expect(items[0].kind).toBe("line");
          else expect(items[0].kind).toBe("box");
        }
      }),
    );
  });
});
