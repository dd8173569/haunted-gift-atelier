import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import catalogData from "../data/catalog.json";
import {
  parseCatalog,
  parseDimensions,
  parseWeight,
  percentile,
  priceBand,
  type PriceBand,
  type RawCatalog,
} from "../lib/catalog";
import { validateCatalog } from "../scripts/validate-catalog";
import { createFixture, fixtureCatalog, type Fixture } from "./helpers/catalog-fixture";

const SEED = 20261121;
const RUNS = 200;
const opts = { seed: SEED, numRuns: RUNS };
const real = catalogData as unknown as RawCatalog;
const BAND_ORDER: PriceBand[] = ["under-2500", "2500-15000", "15000-25000", "25000-plus"];

// Hundredths as integers keep generated decimals exact.
const hundredths = (min: number, max: number) =>
  fc.integer({ min: min * 100, max: max * 100 }).map((n) => n / 100);
const fmt = (n: number) => n.toFixed(2);
const productIdx = fc.integer({ min: 0, max: real.products.length - 1 });

describe("P-CD-1 price band partition", () => {
  it("is monotonic and exactly one band applies", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200000 }), fc.integer({ min: 0, max: 5000 }), (a, d) => {
        const lo = BAND_ORDER.indexOf(priceBand(a));
        const hi = BAND_ORDER.indexOf(priceBand(a + d));
        expect(lo).toBeGreaterThanOrEqual(0);
        expect(hi).toBeGreaterThanOrEqual(lo);
      }),
      opts,
    );
  });
  it("maps the boundaries", () => {
    expect(priceBand(2499)).toBe("under-2500");
    expect(priceBand(2500)).toBe("2500-15000");
    expect(priceBand(15000)).toBe("2500-15000");
    expect(priceBand(15001)).toBe("15000-25000");
    expect(priceBand(25000)).toBe("15000-25000");
    expect(priceBand(25001)).toBe("25000-plus");
  });
});

describe("P-CD-2 weight midpoint", () => {
  it("range gives the midpoint within [lo, hi]", () => {
    fc.assert(
      fc.property(hundredths(1, 50), hundredths(0, 20), (lo, extra) => {
        const hi = Math.round((lo + extra) * 100) / 100;
        const v = parseWeight(`${fmt(lo)}-${fmt(hi)} gms approx`, "Pendant").value;
        expect(v).not.toBeNull();
        expect(v!).toBeGreaterThanOrEqual(lo - 0.005 - 1e-9);
        expect(v!).toBeLessThanOrEqual(hi + 0.005 + 1e-9);
        expect(Math.abs(v! - (lo + hi) / 2)).toBeLessThanOrEqual(0.005 + 1e-9);
      }),
      opts,
    );
  });
  it("single values round-trip", () => {
    fc.assert(
      fc.property(hundredths(1, 99), (w) => {
        expect(parseWeight(`Gold ${fmt(w)} gms`, "Pendant").value).toBe(w);
      }),
      opts,
    );
  });
});

describe("P-CD-3 set weight is a sum", () => {
  it("sums pendant and earrings; the diamond segment is inert", () => {
    fc.assert(
      fc.property(hundredths(1, 5), hundredths(1, 5), hundredths(0, 3), hundredths(0, 3), (p, e, dp, de) => {
        const head = `Gold - Pendant ${fmt(p)} gms, Earrings ${fmt(e)} gms`;
        const expected = Math.round((p + e) * 100) / 100;
        const plain = parseWeight(head, "Set").value;
        const withDiamond = parseWeight(
          `${head}; Diamond - Pendant ${fmt(dp)} Cts, Earrings ${fmt(de)} Cts`,
          "Set",
        ).value;
        expect(plain).toBe(expected);
        expect(withDiamond).toBe(expected);
      }),
      opts,
    );
  });
});

describe("P-CD-4 inch conversion", () => {
  it("is within 0.05 of inches x 25.4 and a multiple of 0.1", () => {
    fc.assert(
      fc.property(hundredths(1, 12), (inches) => {
        const d = parseDimensions(`Height ${fmt(inches)} Inch, Width 2.00 mm`, "Bracelet").dims;
        expect(d.kind).toBe("string-bracelet");
        if (d.kind !== "string-bracelet") return;
        expect(Math.abs(d.circumference_mm - inches * 25.4)).toBeLessThanOrEqual(0.05 + 1e-9);
        expect(Math.abs(d.circumference_mm * 10 - Math.round(d.circumference_mm * 10))).toBeLessThan(1e-6);
      }),
      opts,
    );
  });
  it("5.25 gives exactly 133.4", () => {
    const d = parseDimensions("Height 5.25 Inch, Width 2.00 mm", "Bracelet").dims;
    expect(d).toEqual({ kind: "string-bracelet", circumference_mm: 133.4, width_mm: 2 });
  });
});

describe("P-CD-5 unit decides bracelet kind", () => {
  it("Inch is a string bracelet, mm is a bangle with the same diameter", () => {
    fc.assert(
      fc.property(hundredths(1, 99), (n) => {
        const inch = parseDimensions(`Height ${fmt(n)} Inch, Width 1.00 mm`, "Bracelet").dims;
        const mm = parseDimensions(`Height ${fmt(n)} mm, Width 1.00 mm`, "Bracelet").dims;
        expect(inch.kind).toBe("string-bracelet");
        expect(mm.kind).toBe("bangle");
        if (mm.kind === "bangle") expect(mm.diameter_mm).toBe(n);
      }),
      opts,
    );
  });
});

describe("P-CD-6 no silent zero", () => {
  const junk = fc.stringMatching(/^[a-zA-Z ]{0,12}$/);
  it("an unparseable weight is null with exactly one warning", () => {
    fc.assert(
      fc.property(junk, (s) => {
        const r = parseWeight(s, "Pendant");
        expect(r.value).toBeNull();
        expect(r.warning).toBeTruthy();
      }),
      opts,
    );
  });
  it("an unparseable height is null with exactly one warning, never 0", () => {
    fc.assert(
      fc.property(junk, (s) => {
        const r = parseDimensions(`Height ${s}, Width 2.00 mm`, "Pendant");
        expect(r.dims).toEqual({ kind: "item", height_mm: null, width_mm: 2 });
        expect(r.warnings).toHaveLength(1);
        expect(r.warnings[0].field).toBe("height");
      }),
      opts,
    );
  });
  it("Width '-' is null with exactly one width warning", () => {
    const r = parseDimensions("Height 5.25 Inch, Width -", "Bracelet");
    expect(r.warnings.map((w) => w.field)).toEqual(["width"]);
    expect(r.dims).toMatchObject({ width_mm: null });
  });
  it("a zero weight is not accepted as a weight", () => {
    expect(parseWeight("Gold 0.00 gms", "Pendant").value).toBeNull();
  });
});

describe("P-CD-7 SKU uniqueness and count", () => {
  it("duplicating any SKU makes parseCatalog throw", () => {
    fc.assert(
      fc.property(productIdx, productIdx, (i, j) => {
        fc.pre(i !== j);
        const c = structuredClone(real);
        c.products[j].sku = c.products[i].sku;
        expect(() => parseCatalog(c)).toThrow(/duplicate sku/);
      }),
      opts,
    );
  });
});

describe("validator properties (fixture catalog)", { timeout: 120_000 }, () => {
  let fx: Fixture;
  beforeAll(() => {
    fx = createFixture();
  });
  afterAll(() => fx.cleanup());

  const check = (mutate: (c: ReturnType<typeof fixtureCatalog>) => void) => {
    const c = fixtureCatalog();
    mutate(c);
    fx.write(c);
    return validateCatalog({ root: fx.root });
  };

  it("the unmodified fixture is valid", () => {
    expect(check(() => {}).errors).toEqual([]);
  });

  it("P-CD-7 deleting a product without lowering count fails", () => {
    fc.assert(
      fc.property(productIdx, (i) => {
        const r = check((c) => {
          c.products.splice(i, 1);
        });
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => e.startsWith("[REQ-CD-09]"))).toBe(true);
      }),
      opts,
    );
  });

  it("P-CD-8 an arbitrary string outside an enum fails validation", () => {
    const outside = (allowed: string[]) =>
      fc.string({ maxLength: 20 }).filter((s) => !allowed.includes(s));
    const cases: [string, string, string[]][] = [
      ["availability", "REQ-CD-07", ["In Stock", "Out of Stock"]],
      ["category", "REQ-CD-08", ["Pendant", "Bracelet", "Earrings", "Set", "Tabeez"]],
      ["age_groups", "REQ-CD-06", ["Infants 0-3 years", "Kids 3-12 years", "Teens 12-19 years", "Mom"]],
    ];
    for (const [field, req, allowed] of cases) {
      fc.assert(
        fc.property(productIdx, outside(allowed), (i, s) => {
          const r = check((c) => {
            if (field === "age_groups") (c.products[i].age_groups as string[])[0] = s;
            else c.products[i][field] = s;
          });
          expect(r.ok).toBe(false);
          expect(r.errors.some((e) => e.startsWith(`[${req}]`))).toBe(true);
        }),
        opts,
      );
    }
  });

  it("P-CD-10 setting mrp_inr to a number fails validation", () => {
    fc.assert(
      fc.property(productIdx, fc.integer({ min: 0, max: 100000 }), (i, n) => {
        const r = check((c) => {
          c.products[i].mrp_inr = n;
        });
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => e.startsWith("[REQ-CD-03]"))).toBe(true);
      }),
      opts,
    );
  });
});

describe("P-CD-9 purity", () => {
  it("parseCatalog is deterministic and does not mutate its input", () => {
    fc.assert(
      fc.property(fc.array(productIdx, { maxLength: 8 }), (drop) => {
        const x = structuredClone(real);
        x.products = x.products.filter((_, i) => !drop.includes(i));
        x.count = x.products.length;
        const before = structuredClone(x);
        const tags = { "material:cz": [] as string[] };
        expect(parseCatalog(x, tags)).toEqual(parseCatalog(x, tags));
        expect(x).toEqual(before);
      }),
      opts,
    );
  });
});

describe("P-CD-10 MRP never surfaces", () => {
  it("no parsed field depends on mrp_inr", () => {
    fc.assert(
      fc.property(productIdx, fc.integer({ min: 1, max: 1000000 }), (i, n) => {
        const x = structuredClone(real) as unknown as { products: Record<string, unknown>[] };
        x.products[i].mrp_inr = n;
        expect(parseCatalog(x as unknown as RawCatalog)).toEqual(parseCatalog(real));
      }),
      opts,
    );
  });
});

describe("P-CD-11 quartile ordering", () => {
  it("min <= P25 <= median <= P75 <= max with type-7 values", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 100000 }), { minLength: 1, maxLength: 30 }), (prices) => {
        const s = [...prices].sort((a, b) => a - b);
        const p25 = percentile(s, 0.25);
        const med = percentile(s, 0.5);
        const p75 = percentile(s, 0.75);
        expect(s[0]).toBeLessThanOrEqual(p25);
        expect(p25).toBeLessThanOrEqual(med);
        expect(med).toBeLessThanOrEqual(p75);
        expect(p75).toBeLessThanOrEqual(s[s.length - 1]);
        const h = (s.length - 1) * 0.25;
        const expected = s[Math.floor(h)] + (s[Math.ceil(h)] - s[Math.floor(h)]) * (h - Math.floor(h));
        expect(p25).toBeCloseTo(expected, 9);
      }),
      opts,
    );
  });
});

describe("P-CD-12 claims default", () => {
  it("a product with claims missing parses to []", () => {
    fc.assert(
      fc.property(productIdx, (i) => {
        const x = structuredClone(real) as unknown as { products: Record<string, unknown>[] };
        delete x.products[i].claims;
        expect(parseCatalog(x as unknown as RawCatalog).products[i].claims).toEqual([]);
      }),
      opts,
    );
  });
});
