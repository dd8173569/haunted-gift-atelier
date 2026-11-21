// Pure catalog types and parsers (design.md §2–§3). No I/O, no catalog.json import.
import { PRODUCT_TAGS } from "../data/product-tags";

export type Metal = "gold" | "silver";
export type PriceBand =
  | "under-2500"
  | "2500-15000"
  | "15000-25000"
  | "25000-plus";
export type Category = "Pendant" | "Bracelet" | "Earrings" | "Set" | "Tabeez";
export type AgeGroup =
  | "Infants 0-3 years"
  | "Kids 3-12 years"
  | "Teens 12-19 years"
  | "Mom";

/** As stored in data/catalog.json. Strings are verbatim from the listing. */
export interface RawProduct {
  sku: string;
  sku_extra?: string;
  name: string;
  price_inr: number;
  mrp_inr: null;
  url: string;
  image_url: string;
  image_file: string;
  materials: string;
  weight: string;
  dimensions: string;
  chain: string | null;
  design_application_no: string | null;
  availability: "In Stock" | "Out of Stock";
  category: Category;
  age_groups: AgeGroup[];
  rating: string | null;
  claims: string[];
}

export interface RawCatalog {
  version: string;
  extracted: string;
  count: number;
  source: string;
  method: string;
  notes: string[];
  products: RawProduct[];
}

export type Dims =
  | { kind: "item"; height_mm: number | null; width_mm: number | null }
  | {
      kind: "set";
      pendant_height_mm: number;
      pendant_width_mm: number;
      earring_height_mm: number;
      earring_width_mm: number;
    }
  | { kind: "string-bracelet"; circumference_mm: number; width_mm: number | null }
  | { kind: "bangle"; diameter_mm: number; width_mm: number | null };

/** Produced by parseCatalog(); derived fields are never hand-edited. */
export interface Product extends RawProduct {
  metal: Metal;
  price_band: PriceBand;
  weight_g: number | null;
  rating_value: number | null;
  dims: Dims;
  tags: string[];
}

export interface ParseWarning {
  sku: string;
  field: string;
  raw: string;
  message: string;
}

export interface ParsedCatalog {
  version: string;
  extracted: string;
  products: Product[];
  /** P25/P75 of in-stock prices per band. n === 0 means the band is empty (p25, p75 are NaN). */
  band_quartiles: Record<PriceBand, { p25: number; p75: number; n: number }>;
  warnings: ParseWarning[];
}

/** A build error: the catalog must not be served. `req` is the requirement the validator reports. */
export class CatalogBuildError extends Error {
  constructor(
    public readonly req: string,
    public readonly sku: string,
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "CatalogBuildError";
  }
}

/** Band midpoints in rupees, consumed by matching-core for ranking. */
export const BAND_MIDPOINTS: Record<PriceBand, number> = {
  "under-2500": 2000,
  "2500-15000": 8750,
  "15000-25000": 20000,
  "25000-plus": 30000,
};

const BANDS = Object.keys(BAND_MIDPOINTS) as PriceBand[];
const NUM = "(\\d+(?:\\.\\d+)?)";
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Type-7 (linear interpolation) percentile of an ascending list; p in [0, 1]. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new Error("percentile of empty list");
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}

export function priceBand(price: number): PriceBand {
  if (price < 2500) return "under-2500";
  if (price <= 15000) return "2500-15000";
  if (price <= 25000) return "15000-25000";
  return "25000-plus";
}

export function deriveMetal(materials: string): Metal {
  if (materials.includes("18KT Gold")) return "gold";
  if (materials.includes("925 Silver")) return "silver";
  throw new CatalogBuildError(
    "REQ-CD-14",
    "",
    "materials",
    `cannot derive metal from materials "${materials}"`,
  );
}

export function parseWeight(
  raw: string,
  category: string,
): { value: number | null; warning?: string } {
  const fail = () => ({
    value: null,
    warning: `cannot parse ${category} weight from "${raw}"`,
  });
  const text = raw.split(";")[0];
  if (text.includes("Pendant") && text.includes("Earrings")) {
    const gms = [...text.matchAll(new RegExp(`${NUM}\\s*gms`, "gi"))].map((m) =>
      Number(m[1]),
    );
    if (gms.length < 2 || gms[0] <= 0 || gms[1] <= 0) return fail();
    return { value: round2(gms[0] + gms[1]) };
  }
  const range = new RegExp(`${NUM}\\s*-\\s*${NUM}`).exec(text);
  if (range) {
    const value = round2((Number(range[1]) + Number(range[2])) / 2);
    return value > 0 ? { value } : fail();
  }
  const single = new RegExp(NUM).exec(text);
  if (single) {
    const value = round2(Number(single[1]));
    return value > 0 ? { value } : fail();
  }
  return fail();
}

export interface DimWarning {
  field: string;
  raw: string;
  message: string;
}

/**
 * Parses `dimensions` by category and height unit. A Set that does not parse
 * in full throws (build error). A Bracelet whose height cannot be read yields
 * `{kind:'item', height_mm:null}` plus a warning, because neither bracelet
 * kind can be decided without the unit.
 */
export function parseDimensions(
  raw: string,
  category: string,
): { dims: Dims; warnings: DimWarning[] } {
  if (category === "Set") {
    const m = new RegExp(
      `Pendant\\s+Height\\s+${NUM}\\s*mm\\s+Width\\s+${NUM}\\s*mm\\s*;\\s*Earrings\\s+Height\\s+${NUM}\\s*mm\\s+Width\\s+${NUM}\\s*mm`,
      "i",
    ).exec(raw);
    if (!m) {
      throw new CatalogBuildError(
        "REQ-CD-18",
        "",
        "dimensions",
        `cannot parse all four set dimensions from "${raw}"`,
      );
    }
    return {
      dims: {
        kind: "set",
        pendant_height_mm: Number(m[1]),
        pendant_width_mm: Number(m[2]),
        earring_height_mm: Number(m[3]),
        earring_width_mm: Number(m[4]),
      },
      warnings: [],
    };
  }

  const warnings: DimWarning[] = [];
  const h = new RegExp(`Height\\s+${NUM}\\s*(mm|Inch)\\b`, "i").exec(raw);
  const w = new RegExp(`Width\\s+${NUM}\\s*mm`, "i").exec(raw);
  const width_mm = w ? Number(w[1]) : null;
  if (!w) {
    warnings.push({
      field: "width",
      raw,
      message: /Width\s*-/i.test(raw)
        ? "width not stated on the listing"
        : `cannot parse width from "${raw}"`,
    });
  }

  if (!h) {
    warnings.push({
      field: "height",
      raw,
      message: `cannot parse height from "${raw}"`,
    });
    return { dims: { kind: "item", height_mm: null, width_mm }, warnings };
  }
  const value = Number(h[1]);
  const inch = h[2].toLowerCase() === "inch";
  if (category === "Bracelet") {
    return {
      dims: inch
        ? {
            kind: "string-bracelet",
            circumference_mm: Math.round(value * 254) / 10,
            width_mm,
          }
        : { kind: "bangle", diameter_mm: value, width_mm },
      warnings,
    };
  }
  if (inch) {
    warnings.push({
      field: "height",
      raw,
      message: `height in Inch is only understood for bracelets: "${raw}"`,
    });
    return { dims: { kind: "item", height_mm: null, width_mm }, warnings };
  }
  return { dims: { kind: "item", height_mm: value, width_mm }, warnings };
}

export function parseRating(rating: string | null): number | null {
  if (rating === null) return null;
  const m = new RegExp(`^${NUM}\\s*/\\s*5`).exec(rating);
  return m ? Number(m[1]) : null;
}

/**
 * The one entry point. Pure: does not mutate `raw`, does no I/O.
 * Throws CatalogBuildError on build errors (duplicate SKU, unknown metal,
 * unparseable set dimensions, a tag that lists an unknown SKU).
 * `tagTable` defaults to the curated PRODUCT_TAGS; tests may inject another.
 */
export function parseCatalog(
  raw: RawCatalog,
  tagTable: Record<string, readonly string[]> = PRODUCT_TAGS,
): ParsedCatalog {
  const skus = new Set<string>();
  for (const p of raw.products) {
    if (skus.has(p.sku)) {
      throw new CatalogBuildError("REQ-CD-01", p.sku, "sku", "duplicate sku");
    }
    skus.add(p.sku);
  }
  for (const [tag, list] of Object.entries(tagTable)) {
    for (const sku of list) {
      if (!skus.has(sku)) {
        throw new CatalogBuildError(
          "REQ-CD-21",
          sku,
          "tags",
          `tag "${tag}" lists a SKU that is not in the catalog`,
        );
      }
    }
  }

  const warnings: ParseWarning[] = [];
  const products: Product[] = raw.products.map((p) => {
    const withSku = <T>(field: string, f: () => T): T => {
      try {
        return f();
      } catch (e) {
        if (e instanceof CatalogBuildError) {
          throw new CatalogBuildError(e.req, p.sku, field, e.message);
        }
        throw e;
      }
    };
    const metal = withSku("materials", () => deriveMetal(p.materials));
    const w = parseWeight(p.weight, p.category);
    if (w.warning) {
      warnings.push({ sku: p.sku, field: "weight", raw: p.weight, message: w.warning });
    }
    const d = withSku("dimensions", () => parseDimensions(p.dimensions, p.category));
    for (const dw of d.warnings) warnings.push({ sku: p.sku, ...dw });
    return {
      ...p,
      age_groups: [...p.age_groups],
      mrp_inr: null,
      claims: [...(p.claims ?? [])],
      metal,
      price_band: priceBand(p.price_inr),
      weight_g: w.value,
      rating_value: parseRating(p.rating ?? null),
      dims: d.dims,
      tags: Object.entries(tagTable)
        .filter(([, list]) => list.includes(p.sku))
        .map(([tag]) => tag),
    };
  });

  const band_quartiles = {} as ParsedCatalog["band_quartiles"];
  for (const band of BANDS) {
    const prices = products
      .filter((p) => p.price_band === band && p.availability === "In Stock")
      .map((p) => p.price_inr)
      .sort((a, b) => a - b);
    band_quartiles[band] =
      prices.length === 0
        ? { p25: NaN, p75: NaN, n: 0 }
        : {
            p25: percentile(prices, 0.25),
            p75: percentile(prices, 0.75),
            n: prices.length,
          };
  }

  return {
    version: raw.version,
    extracted: raw.extracted,
    products,
    band_quartiles,
    warnings,
  };
}
