import { describe, expect, it } from "vitest";
import catalogData from "../data/catalog.json";
import {
  parseCatalog,
  parseDimensions,
  parseRating,
  parseWeight,
  percentile,
  type Dims,
  type PriceBand,
  type Product,
  type RawCatalog,
} from "../lib/catalog";
import {
  PRODUCT_TAGS,
  RELIGIOUS,
  RELIGIOUS_TAGS,
  SYMBOL_CHIP_TAGS,
} from "../data/product-tags";

const parsed = parseCatalog(catalogData as unknown as RawCatalog);
const inStock = parsed.products.filter((p) => p.availability === "In Stock");
const bySku = (sku: string): Product => {
  const p = parsed.products.find((x) => x.sku === sku);
  if (!p) throw new Error(`missing ${sku}`);
  return p;
};
const dimsOf = <K extends Dims["kind"]>(sku: string, kind: K) => {
  const d = bySku(sku).dims;
  expect(d.kind).toBe(kind);
  return d as Extract<Dims, { kind: K }>;
};
const skusWithTag = (tag: string) =>
  parsed.products.filter((p) => p.tags.includes(tag)).map((p) => p.sku).sort();

describe("catalog", () => {
  it("has 22 products, 21 in stock, TNZ-1058 the only Out of Stock", () => {
    expect(parsed.products).toHaveLength(22);
    expect(catalogData.count).toBe(22);
    expect(inStock).toHaveLength(21);
    expect(
      parsed.products.filter((p) => p.availability === "Out of Stock").map((p) => p.sku),
    ).toEqual(["TNZ-1058"]);
  });

  it("carries version and extracted through", () => {
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.extracted).toBe("2026-11-21");
  });

  it("derives metal: 14 gold, 8 silver", () => {
    expect(parsed.products.filter((p) => p.metal === "gold")).toHaveLength(14);
    expect(parsed.products.filter((p) => p.metal === "silver")).toHaveLength(8);
  });

  it("bands in-stock pieces 6/5/5/5", () => {
    const count = (b: PriceBand) => inStock.filter((p) => p.price_band === b).length;
    expect([
      count("under-2500"),
      count("2500-15000"),
      count("15000-25000"),
      count("25000-plus"),
    ]).toEqual([6, 5, 5, 5]);
    expect(bySku("TNZ-1058").price_band).toBe("2500-15000");
  });

  it("has 9 null ratings", () => {
    expect(parsed.products.filter((p) => p.rating === null)).toHaveLength(9);
    expect(parsed.products.filter((p) => p.rating_value === null)).toHaveLength(9);
  });

  it("defaults claims to [] and keeps mrp_inr null", () => {
    for (const p of parsed.products) {
      expect(p.claims).toEqual([]);
      expect(p.mrp_inr).toBeNull();
    }
  });

  it("emits exactly the 2 expected warnings", () => {
    expect(
      parsed.warnings.map((w) => `${w.sku} ${w.field}`).sort(),
    ).toEqual(["TNZ-1056 width", "TNZ-1058 width"]);
  });
});

describe("weight", () => {
  it("pins real weights", () => {
    expect(bySku("TPN-1206").weight_g).toBe(1.06);
    expect(bySku("TPN-1199").weight_g).toBe(1.23);
    expect(bySku("TNZ-1056").weight_g).toBe(6.0);
    expect(bySku("TNZ-1058").weight_g).toBe(7.0);
    expect(bySku("TPN-1147").weight_g).toBe(0.86);
  });
  it("uses the midpoint of a range and ignores the diamond segment", () => {
    expect(parseWeight("6.50-7.50 gross gms approx", "Bracelet").value).toBe(7.0);
    expect(parseWeight("Gold 1.00 gms; Diamond 0.50-0.90 Cts", "Pendant").value).toBe(1.0);
  });
  it("returns null plus a warning instead of 0", () => {
    const r = parseWeight("unknown", "Pendant");
    expect(r.value).toBeNull();
    expect(r.warning).toBeTruthy();
  });
});

describe("dimensions", () => {
  it("parses items in mm", () => {
    expect(dimsOf("TPN-1149", "item")).toEqual({ kind: "item", height_mm: 14.4, width_mm: 1.9 });
  });
  it("converts string-bracelet inches to 133.4 mm for all five", () => {
    for (const sku of ["TNZ-1058", "TNZ-1016", "TNZ-1010", "TNZ-1015", "TNZ-1056"]) {
      expect(dimsOf(sku, "string-bracelet").circumference_mm).toBe(133.4);
    }
  });
  it("stores null width for 'Width -'", () => {
    expect(dimsOf("TNZ-1056", "string-bracelet").width_mm).toBeNull();
    expect(dimsOf("TNZ-1058", "string-bracelet").width_mm).toBeNull();
    expect(dimsOf("TNZ-1016", "string-bracelet").width_mm).toBe(2);
  });
  it("stores bangle diameter 39.6", () => {
    expect(dimsOf("TOB-1009", "bangle").diameter_mm).toBe(39.6);
    expect(dimsOf("TOB-1008", "bangle").diameter_mm).toBe(39.6);
  });
  it("parses set components", () => {
    expect(dimsOf("TPN-1206", "set")).toEqual({
      kind: "set",
      pendant_height_mm: 11.5,
      pendant_width_mm: 4.55,
      earring_height_mm: 5.35,
      earring_width_mm: 3.9,
    });
  });
  it("warns with null on an unparseable item and throws on a bad set", () => {
    const r = parseDimensions("n/a", "Pendant");
    expect(r.dims).toEqual({ kind: "item", height_mm: null, width_mm: null });
    expect(r.warnings.map((w) => w.field)).toEqual(["width", "height"]);
    expect(() => parseDimensions("Pendant Height 1 mm", "Set")).toThrow();
  });
});

describe("tags", () => {
  const religious: Record<string, string> = {
    "symbol:om": "TPN-1149",
    "symbol:sikh": "TPN-1147",
    "symbol:cross": "TPN-1145",
    "symbol:ganesha": "TPN-1141",
    "symbol:trishul": "TPN-1143",
    "symbol:jain": "TPN-1144",
    "symbol:swastik": "TBZ-1017",
    "symbol:third-eye": "TBZ-1013",
  };
  it("maps the 8 religious symbol tags to the exact SKUs", () => {
    expect([...RELIGIOUS_TAGS].sort()).toEqual(Object.keys(religious).sort());
    expect([...RELIGIOUS].sort()).toEqual(Object.keys(religious).sort());
    for (const [tag, sku] of Object.entries(religious)) {
      expect(skusWithTag(tag)).toEqual([sku]);
      expect(PRODUCT_TAGS[tag]).toEqual([sku]);
    }
  });
  it("has the curated non-religious tags", () => {
    expect(skusWithTag("symbol:zodiac")).toEqual(["TPN-1433", "TPN-1459"]);
    expect(skusWithTag("symbol:evil-eye")).toEqual(["TNZ-1056", "TNZ-1058"]);
    expect(skusWithTag("material:black-beads")).toEqual(["TNZ-1010", "TNZ-1015", "TNZ-1016"]);
    expect(skusWithTag("material:pearl")).toEqual(["TPN-1199", "TPN-1206"]);
    expect(skusWithTag("material:cz")).toEqual(["TOB-1008"]);
  });
  it("attaches tags to products", () => {
    expect(bySku("TPN-1149").tags).toEqual(["symbol:om"]);
    expect(bySku("THP-1027").tags).toEqual([]);
  });
  it("maps symbol chips to tags", () => {
    expect(SYMBOL_CHIP_TAGS.tabeez).toEqual(["symbol:swastik", "symbol:third-eye"]);
    expect(SYMBOL_CHIP_TAGS.om).toEqual(["symbol:om"]);
  });
  it("throws when a tag lists a SKU that is not in the catalog", () => {
    expect(() =>
      parseCatalog(catalogData as unknown as RawCatalog, { "symbol:om": ["ZZZ-9999"] }),
    ).toThrow(/not in the catalog/);
  });
});

describe("rating", () => {
  it("parses ratings", () => {
    expect(parseRating("4.8/5 (5 reviews)")).toBe(4.8);
    expect(parseRating("5.0/5")).toBe(5);
    expect(parseRating(null)).toBeNull();
    expect(bySku("TPN-1147").rating_value).toBe(4.8);
    expect(bySku("TPN-1459").rating_value).toBeNull();
  });
});

describe("band quartiles", () => {
  it("matches the pinned table", () => {
    const q = parsed.band_quartiles;
    expect(q["under-2500"]).toEqual({ p25: 1880.25, p75: 2267.75, n: 6 });
    expect(q["2500-15000"]).toEqual({ p25: 10199, p75: 14249, n: 5 });
    expect(q["15000-25000"]).toEqual({ p25: 18299, p75: 24499, n: 5 });
    expect(q["25000-plus"]).toEqual({ p25: 25299, p75: 27949, n: 5 });
  });
  it("interpolates percentiles linearly (type 7)", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([5], 0.25)).toBe(5);
  });
});
