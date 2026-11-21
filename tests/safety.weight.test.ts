import { describe, expect, it } from "vitest";
import type { AgeGroup } from "../lib/catalog";
import { AGE_LABEL } from "../lib/matching/age";
import type { AgeBand } from "../lib/matching/types";
import {
  MIN_POOL,
  WEIGHT_FLAG_RATIO,
  formatGrams,
  median,
  referenceBand,
  weightContext,
  weightPool,
} from "../lib/safety-weight";
import { catalog, product } from "./helpers/matching-fixtures";

const BANDS: AgeBand[] = ["infants", "kids", "teens", "mom"];

/** Naive reference: float sort + middle, independent of lib/safety-weight.ts. */
function naiveMedian(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function naivePool(band: AgeBand): number[] {
  return catalog.products
    .filter(
      (p) =>
        p.availability === "In Stock" &&
        p.weight_g !== null &&
        p.age_groups.includes(AGE_LABEL[band] as AgeGroup),
    )
    .map((p) => p.weight_g as number);
}
function naiveFlagged(band: AgeBand): string[] {
  const m = naiveMedian(naivePool(band));
  if (naivePool(band).length < 3) return [];
  return catalog.products
    .filter(
      (p) =>
        p.weight_g !== null &&
        p.age_groups.includes(AGE_LABEL[band] as AgeGroup) &&
        Math.round(p.weight_g * 100) > Math.round(1.5 * m * 100),
    )
    .map((p) => p.sku)
    .sort();
}

describe("median", () => {
  it("odd pool: the middle value", () => {
    expect(median([1, 2, 9])).toBe(2);
  });
  it("even pool: the mean of the two middles", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([0.5, 1.51])).toBe(1.005);
  });
  it("throws on an empty list", () => {
    expect(() => median([])).toThrow();
  });
});

describe("weightContext threshold", () => {
  const pool = [1, 1, 2]; // median 1; threshold 1.5
  it("constants", () => {
    expect(WEIGHT_FLAG_RATIO).toBe(1.5);
    expect(MIN_POOL).toBe(3);
  });
  it("exactly 1.5x the median does not flag; +0.01 g does", () => {
    expect(weightContext(1.5, pool, "kids").flag).toBe(false);
    expect(weightContext(1.51, pool, "kids").flag).toBe(true);
  });
  it("reports median, n, and threshold", () => {
    expect(weightContext(1.5, pool, "kids")).toMatchObject({
      band: "kids",
      median_g: 1,
      n: 3,
      threshold_g: 1.5,
      sufficient: true,
    });
  });
  it("exact boundary with an even pool (median 1.51 -> threshold 2.265)", () => {
    const even = [1.5, 1.52]; // pad to 3 below
    expect(weightContext(2.26, [1.5, 1.51, 1.52], "infants").flag).toBe(false);
    expect(weightContext(2.27, [1.5, 1.51, 1.52], "infants").flag).toBe(true);
    expect(median(even)).toBe(1.51);
  });
  it("a pool of 2 never flags, even for a huge weight", () => {
    const c = weightContext(100, [1, 2], "mom");
    expect(c.flag).toBe(false);
    expect(c.sufficient).toBe(false);
    expect(c.n).toBe(2);
  });
  it("an empty pool gives no median and never flags", () => {
    const c = weightContext(5, [], "mom");
    expect(c.flag).toBe(false);
    expect(Number.isNaN(c.median_g)).toBe(true);
  });
});

describe("referenceBand", () => {
  it("returns the recipient band when given", () => {
    expect(referenceBand(product("TPN-1149"), "teens")).toBe("teens");
  });
  it("no band: youngest listed band (infants for infants+kids+teens)", () => {
    expect(product("TPN-1149").age_groups).toHaveLength(3);
    expect(referenceBand(product("TPN-1149"), null)).toBe("infants");
  });
  it("no band: a piece listing only kids, and teens+mom pieces", () => {
    expect(referenceBand(product("TPN-1206"), null)).toBe("kids");
    expect(referenceBand(product("THP-1017"), null)).toBe("kids"); // kids, mom, teens
  });
  it("throws when a product lists no age group", () => {
    expect(() => referenceBand({ ...product("TPN-1149"), age_groups: [] }, null)).toThrow();
  });
  it("a Mom-only product references mom", () => {
    const mom = { ...product("TPN-1149"), age_groups: ["Mom" as AgeGroup] };
    expect(referenceBand(mom, null)).toBe("mom");
  });
});

describe("real pools against catalog v1.0.0", () => {
  const expected: Record<AgeBand, { n: number; median: number | null }> = {
    infants: { n: 18, median: 1.51 },
    kids: { n: 15, median: 1.23 },
    teens: { n: 9, median: 0.86 },
    mom: { n: 2, median: null },
  };
  it.each(BANDS)("%s pool size and median", (band) => {
    const pool = weightPool(catalog, band);
    expect(pool).toEqual([...pool].sort((a, b) => a - b));
    expect(pool).toHaveLength(expected[band].n);
    expect(naivePool(band)).toHaveLength(expected[band].n);
    if (expected[band].median !== null) {
      expect(naiveMedian(naivePool(band))).toBeCloseTo(expected[band].median, 10);
      expect(median(pool)).toBe(expected[band].median);
    }
  });

  it("thresholds: 2.265, 1.845, 1.29", () => {
    const t = (b: AgeBand) => weightContext(1, weightPool(catalog, b), b).threshold_g;
    expect(t("infants")).toBe(2.265);
    expect(t("kids")).toBe(1.845);
    expect(t("teens")).toBe(1.29);
  });

  const flagged: Record<AgeBand, string[]> = {
    infants: ["TNZ-1056", "TPN-1459", "TOB-1009", "TBZ-1013", "TPN-1433", "TBZ-1017", "TOB-1008", "TNZ-1058"],
    kids: ["TPN-1459", "TOB-1009", "TBZ-1013", "TBZ-1017"],
    teens: ["THP-1027", "THP-1017", "THP-1001"],
    mom: [],
  };
  it.each(BANDS)("%s flagged list matches REQ-SV-16 and the naive recomputation", (band) => {
    const pool = weightPool(catalog, band);
    const viaLib = catalog.products
      .filter(
        (p) =>
          p.weight_g !== null &&
          p.age_groups.includes(AGE_LABEL[band] as AgeGroup) &&
          weightContext(p.weight_g, pool, band).flag,
      )
      .map((p) => p.sku)
      .sort();
    expect(viaLib).toEqual([...flagged[band]].sort());
    expect(naiveFlagged(band)).toEqual([...flagged[band]].sort());
  });

  it("TNZ-1056 weighs 6 g (midpoint of 5.50-6.50) and flags for infants", () => {
    const p = product("TNZ-1056");
    expect(p.weight_g).toBe(6);
    expect(weightContext(6, weightPool(catalog, "infants"), "infants").flag).toBe(true);
  });

  it("the out-of-stock TNZ-1058 is outside the pool", () => {
    const p = product("TNZ-1058");
    expect(p.availability).toBe("Out of Stock");
    expect(weightPool(catalog, "infants")).toHaveLength(18);
    expect(naivePool("infants")).toHaveLength(18);
  });
});

describe("formatGrams", () => {
  it("trims trailing zeros", () => {
    expect(formatGrams(6)).toBe("6");
    expect(formatGrams(4.05)).toBe("4.05");
    expect(formatGrams(1.06)).toBe("1.06");
  });
});
