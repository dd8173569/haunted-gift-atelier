# Catalog Data — Design

*Implements REQ-CD-01 to REQ-CD-26 (`requirements.md`). Source: PRD §2, architecture §7. Source of truth: `data/catalog.json` (v1.0.0, 22 SKUs, extracted 21 Nov 2026).*

## 1. Components

| File | Role |
|---|---|
| `data/catalog.json` | Raw, versioned catalog. Hand-edited only through the workflow in §6. |
| `data/catalog-changelog.md` | One `## v{version} — {date}` heading per version. |
| `data/product-tags.ts` | Hand-curated tag map (REQ-CD-21). Never generated, never LLM-edited. |
| `public/catalog/` | 22 photos named `<SKU>.<png\|jpeg>`. |
| `lib/catalog.ts` | Pure types, `parseCatalog()`, field parsers, derived fields, band quartiles. No I/O. |
| `scripts/validate-catalog.ts` | Node entry point. Reads files, calls `lib/catalog.ts`, adds the file-system and changelog checks. Run by `npm run validate-catalog`, CI, and the save hook. |

`lib/catalog.ts` does no file I/O so the same code runs in Vitest, the Next.js build, the MCP server, and the validation script. The script is the only place that touches `fs`.

## 2. Data model

```ts
type Metal = 'gold' | 'silver';
type PriceBand = 'under-2500' | '2500-15000' | '15000-25000' | '25000-plus';
type Category = 'Pendant' | 'Bracelet' | 'Earrings' | 'Set' | 'Tabeez';
type AgeGroup = 'Infants 0-3 years' | 'Kids 3-12 years' | 'Teens 12-19 years' | 'Mom';

/** As stored in data/catalog.json. Strings are verbatim from the listing. */
interface RawProduct {
  sku: string;                  // ^[A-Z]{3}-\d{4}$, unique (REQ-CD-01)
  sku_extra?: string;           // second component of a Set; not uniqueness-checked
  name: string;                 // displayed verbatim ("sudd set", "studd set" kept)
  price_inr: number;            // positive integer (REQ-CD-03)
  mrp_inr: null;                // always null; never read (REQ-CD-03)
  url: string;                  // https://www.tinytiaraa.com/product/* (REQ-CD-04)
  image_url: string;            // provenance only
  image_file: string;           // bare filename under public/catalog/ (REQ-CD-05)
  materials: string;
  weight: string;
  dimensions: string;
  chain: string | null;
  design_application_no: string | null;
  availability: 'In Stock' | 'Out of Stock';
  category: Category;
  age_groups: AgeGroup[];       // non-empty (REQ-CD-06)
  rating: string | null;        // "4.8/5 (5 reviews)" | "5.0/5" | null
  claims: string[];             // default [] (REQ-CD-13)
}

interface RawCatalog {
  version: string;             // semver (REQ-CD-22)
  extracted: string;           // '2026-11-21'
  count: number;               // === products.length (REQ-CD-09)
  source: string; method: string; notes: string[];
  products: RawProduct[];
}

/** Produced by parseCatalog(); derived fields are never hand-edited. */
interface Product extends RawProduct {
  metal: Metal;                          // REQ-CD-14
  price_band: PriceBand;                 // REQ-CD-15
  weight_g: number | null;               // REQ-CD-16; null + warning on parse failure
  rating_value: number | null;           // 4.8 from "4.8/5 (5 reviews)"; null when rating is null
  dims: Dims;                            // REQ-CD-17..20
  tags: string[];                        // from data/product-tags.ts only (REQ-CD-21)
}

type Dims =
  | { kind: 'item';    height_mm: number | null; width_mm: number | null }          // Pendant, Earrings, Tabeez
  | { kind: 'set';     pendant_height_mm: number; pendant_width_mm: number;
                       earring_height_mm: number; earring_width_mm: number }       // Set
  | { kind: 'string-bracelet'; circumference_mm: number; width_mm: number | null } // height in Inch
  | { kind: 'bangle';  diameter_mm: number; width_mm: number | null };             // height in mm

interface ParseWarning { sku: string; field: string; raw: string; message: string }
interface ParsedCatalog {
  version: string; extracted: string;
  products: Product[];
  band_quartiles: Record<PriceBand, { p25: number; p75: number; n: number }>;
  warnings: ParseWarning[];
}
```

`Dims` is a discriminated union so the true-size viewer and matching cannot read a field that does not exist for a category. A parse failure yields `null` plus a `ParseWarning`, never `0` (REQ-CD-11, REQ-CD-12).

`image_file` in `data/catalog.json` is the bare filename (`TPN-1149.png`). The v1.0.0 import already stripped the source's `images/` prefix (recorded in the changelog). The validator resolves it as `public/catalog/<image_file>`.

## 3. Build-time parsing rules

`parseCatalog(raw)` is pure: it does not mutate its input, does no I/O, and returns the same output for the same input.

### 3.1 Metal (REQ-CD-14)
`materials` includes `18KT Gold` → `gold`; else includes `925 Silver` → `silver`; else a **build error** (not a warning). Expected: 14 gold, 8 silver.

### 3.2 Price band (REQ-CD-15)
`< 2500` → `under-2500`; `≤ 15000` → `2500-15000`; `≤ 25000` → `15000-25000`; else `25000-plus`. Exactly 2500 and 15000 fall in `2500-15000`; exactly 25000 falls in `15000-25000`. The in-stock distribution is 6 / 5 / 5 / 5. TNZ-1058 (₹2,674, out of stock) also sits in `2500-15000`, so that band holds 6 products and 5 in stock.

### 3.3 Weight → `weight_g` (REQ-CD-16)
Strip the diamond segment (`; Diamond …`) first. Diamond carat values are never weights.

| Raw `weight` | Rule | `weight_g` |
|---|---|---|
| `Gold 1.00 gms` | single value | 1.00 |
| `4.05 gms approx` | single value | 4.05 |
| `Silver 2.75 gms approx` | single value | 2.75 |
| `6.50-7.50 gross gms approx` | range → midpoint `(lo+hi)/2` | 7.00 |
| `Silver 1.00-2.00 gms approx` | range → midpoint | 1.50 |
| `Gold - Pendant 0.30 gms, Earrings 0.76 gms; Diamond - …` | Set → sum of the `Pendant` and `Earrings` gold values | 1.06 (TPN-1206) |
| `Gold - Pendant 0.36 gms, Earrings 0.87 gms; Diamond - …` | Set → sum | 1.23 (TPN-1199) |

Algorithm: (1) cut at the first `;`; (2) if the segment contains both `Pendant` and `Earrings`, sum the two `N gms` values; (3) else match `(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)` and take the midpoint; (4) else match the first `\d+(?:\.\d+)?` and use it as is; (5) otherwise return `null` and push a warning. Results are rounded to 2 decimals (`Math.round(x*100)/100`) to remove float noise (1.06, not 1.0600000000000001).

### 3.4 Dimensions (REQ-CD-17 to REQ-CD-20)
Dispatch on `category` and on the unit in the height field.

| Raw `dimensions` | Category | Result |
|---|---|---|
| `Height 14.40 mm, Width 1.90 mm` | Pendant / Earrings / Tabeez | `{kind:'item', height_mm:14.4, width_mm:1.9}` |
| `Pendant Height 11.50 mm Width 4.55 mm; Earrings Height 5.35 mm Width 3.90 mm` | Set | `{kind:'set', pendant_height_mm:11.5, pendant_width_mm:4.55, earring_height_mm:5.35, earring_width_mm:3.9}` |
| `Height 5.25 Inch, Width 2.00 mm` | Bracelet, height in `Inch` | `{kind:'string-bracelet', circumference_mm:133.4, width_mm:2}` |
| `Height 5.25 Inch, Width -` | Bracelet, height in `Inch` | `{kind:'string-bracelet', circumference_mm:133.4, width_mm:null}` + warning for `width` |
| `Height 39.60 mm, Width 1.60 mm` | Bracelet, height in `mm` | `{kind:'bangle', diameter_mm:39.6, width_mm:1.6}` |

**Bracelet circumference.** The 5.25 in value is a string length, not a diameter. The conversion is done in integer tenths of a millimetre so the result does not depend on float rounding:

```ts
circumference_mm = Math.round(inches * 254) / 10   // 5.25 × 254 = 1333.5 → 1334 → 133.4
```

(`5.25 * 25.4` evaluates to `133.35` in decimal but is not safe to round in binary floating point; `5.25` and `254` are both exact, so `1333.5` is exact.) It applies to TNZ-1058, TNZ-1016, TNZ-1010, TNZ-1015, and TNZ-1056, which all produce 133.4 mm.

**Bangle diameter.** A bracelet whose height field is in `mm` is a bangle: `diameter_mm = 39.6` for TOB-1009 and TOB-1008. The unit in the height field, not the product name, decides the kind. The viewer labels these fields with their interpretation (PRD §6): "ring outline at true size — 5.25 in around" vs "bangle outline at true size — 39.6 mm across".

**Unparsed `Width -`.** The two silver nazariya bracelets (TNZ-1058, TNZ-1056) state no width. The parser stores `width_mm: null` and emits one warning per SKU (`field: 'width'`). It never stores `0`. These 2 warnings are expected for v1.0.0 and are pinned by a test (§5, T-warnings). Any other warning, or any change in this set, fails the pinned test so a new unparsed field cannot be missed.

A height or width token that matches neither `\d+(\.\d+)?\s*mm` nor (height only, Bracelet) `\d+(\.\d+)?\s*Inch` is a warning, with the field left `null`. For `kind: 'set'`, any of the four numbers failing to parse makes the whole `dims` fail: `parseCatalog` raises a build error, because the viewer cannot render half a set.

### 3.5 Rating
`rating_value` = number before `/5` (`4.8`, `5.0`), or `null` when `rating` is `null` (REQ-CD-10). Nothing is substituted for a missing rating.

### 3.6 Tags (REQ-CD-21)
`tags` = every tag in `PRODUCT_TAGS` whose SKU list includes `sku`. The map is the table in REQ-CD-21 and nothing else. `parseCatalog` raises a build error if a tag lists a SKU that is not in the catalog. It does not infer tags from names or materials.

### 3.7 Band quartiles (consumed by `matching-core`)
For each of the four bands, `band_quartiles[band]` holds P25 and P75 of the in-stock `price_inr` values, using linear-interpolation percentiles (position `p × (n−1)` on the ascending list, interpolating between neighbours). Pinned expected values:

| Band | n | P25 | P75 |
|---|---|---|---|
| under-2500 | 6 | 1880.25 | 2267.75 |
| 2500-15000 | 5 | 10199 | 14249 |
| 15000-25000 | 5 | 18299 | 24499 |
| 25000-plus | 5 | 25299 | 27949 |

## 4. Validation script (`scripts/validate-catalog.ts`)

Run: `npm run validate-catalog` (`tsx scripts/validate-catalog.ts`).

Checks, in order. Each failure is collected; the script reports all of them, then exits non-zero.

| # | Check | Requirement |
|---|---|---|
| 1 | File reads and JSON parses | REQ-CD-09 |
| 2 | Top-level `version` is semver, `extracted` is `YYYY-MM-DD` | REQ-CD-22 |
| 3 | `count === products.length` | REQ-CD-09 |
| 4 | Required string fields non-empty | REQ-CD-02 |
| 5 | SKU pattern and uniqueness | REQ-CD-01 |
| 6 | `price_inr` positive integer; `mrp_inr` is `null` | REQ-CD-03 |
| 7 | URL pattern | REQ-CD-04 |
| 8 | `age_groups` non-empty, enum | REQ-CD-06 |
| 9 | `availability` enum; `category` enum | REQ-CD-07, REQ-CD-08 |
| 10 | `image_file` exists in `public/catalog/`, magic bytes are PNG (`89 50 4E 47`) or JPEG (`FF D8 FF`) | REQ-CD-05 |
| 11 | `claims` is an array (missing is treated as `[]`) | REQ-CD-13 |
| 12 | Run `parseCatalog()`: metal, weight, dimensions, tags. Build errors fail. Warnings are printed with SKU and field. | REQ-CD-11, 12, 14, 16–21 |
| 13 | Changelog has a heading `## v{version}` matching the file's `version` | REQ-CD-23 |
| 14 | In CI only (`--base <ref>`): if the product content differs from `<ref>:data/catalog.json`, `version` must differ and the changelog must contain the new heading | REQ-CD-23 |
| 15 | Every `public/catalog/` file is referenced by a product (no orphan photos) | REQ-CD-05 |

Output rules (REQ-CD-24: a silent pass on an invalid catalog is a defect):
- Failures are printed to **stderr** as `FAIL [REQ-CD-xx] SKU field: message`, followed by a final line `CATALOG VALIDATION FAILED: N error(s)`. Exit code 1.
- Success prints `CATALOG OK: 22 products, version 1.0.0, W warning(s)`, then each warning. Exit code 0.
- Warnings never change the exit code, but the count is always printed.
- The script never writes to any file.

Check 14 needs git history. When `--base` is absent (local runs, the save hook) the script prints `NOTE: version-bump check skipped (no --base)` so the skip is visible.

## 5. Correctness properties (fast-check, seeded; in `tests/catalog.property.test.ts`)

| ID | Property | Requirement |
|---|---|---|
| P-CD-1 | **Price band partition.** For any positive integer price, exactly one band applies; the band is monotonic non-decreasing in price; the boundaries 2499/2500, 15000/15001, 25000/25001 map as specified. | REQ-CD-15 |
| P-CD-2 | **Weight range midpoint.** For any generated `lo ≤ hi` (2 decimals), parsing `"{lo}-{hi} gms approx"` gives a value in `[lo, hi]` equal to `(lo+hi)/2` within 0.005. Single values round-trip unchanged. | REQ-CD-16 |
| P-CD-3 | **Set weight is a sum.** For any generated pendant and earring weights, the parsed Set weight equals their sum (2 decimals), and the diamond segment never changes the result. | REQ-CD-16 |
| P-CD-4 | **Inch conversion.** For any inches in `[1, 12]` (2 decimals), `circumference_mm` is within 0.05 of `inches × 25.4` and is a multiple of 0.1. `5.25 → 133.4` exactly. | REQ-CD-19 |
| P-CD-5 | **Unit decides bracelet kind.** `Height N Inch` always yields `string-bracelet`; `Height N mm` always yields `bangle` with `diameter_mm === N`. | REQ-CD-19, 20 |
| P-CD-6 | **No silent zero.** For any string that is not parseable as a weight or dimension, the parsed numeric field is `null` and one warning is produced. No parser ever returns `0` for a failed parse. | REQ-CD-11, 12 |
| P-CD-7 | **SKU uniqueness.** Duplicating any one SKU in a valid catalog makes `parseCatalog` fail; deleting a product without lowering `count` fails. | REQ-CD-01, 09 |
| P-CD-8 | **Enum closure.** Replacing `availability`, `category`, or any `age_groups` entry with an arbitrary string outside the enum always fails validation. | REQ-CD-06, 07, 08 |
| P-CD-9 | **Purity.** `parseCatalog(x)` deep-equals `parseCatalog(x)`, and `x` is deep-equal to its pre-call clone. | design §3 |
| P-CD-10 | **MRP never surfaces.** For any catalog, no field on a parsed `Product` is derived from `mrp_inr`; setting `mrp_inr` to a number fails validation. | REQ-CD-03 |
| P-CD-11 | **Quartile ordering.** For any non-empty list of positive prices, `min ≤ P25 ≤ median ≤ P75 ≤ max`, and P25/P75 equal the type-7 linear-interpolation values. | design §3.7 |
| P-CD-12 | **Claims default.** A product with `claims` missing parses to `claims: []`. | REQ-CD-13 |

Example-based tests (Vitest) pin the real catalog: 22 products, 14 gold / 8 silver, 6/5/5/5 in-stock by band, TNZ-1058 the only `Out of Stock`, 9 null ratings, `weight_g` of TPN-1206 = 1.06 and TPN-1199 = 1.23, TNZ-1056 weight 6.0 (midpoint of 5.50–6.50), TNZ-1058 weight 7.0, circumference 133.4 for the five string bracelets, diameter 39.6 for TOB-1009 and TOB-1008, exactly 2 warnings (`TNZ-1058 width`, `TNZ-1056 width`), and the quartile table in §3.7.

## 6. Versioning workflow (REQ-CD-22 to REQ-CD-24)

1. Edit `data/catalog.json` for one reason (for example a price change).
2. Bump `version`: price or availability change → minor; structural schema change → major; typo fix in a text field → patch.
3. Add a `## v{new} — {date}` section to `data/catalog-changelog.md` listing every changed SKU and field with old → new values.
4. Save the file. The `catalog-validation` hook runs `npm run validate-catalog` and surfaces failures.
5. CI runs `npm run validate-catalog -- --base origin/main`, which enforces step 2 and step 3 mechanically.
6. If a price or availability changed, check that the matching golden cases and `PriceFootnote` still hold (`npm test`).

`extracted` changes only when a new crawl is performed. Prices stay labelled with the 21 Nov 2026 snapshot until then. Edits made by an agent follow the same steps. An agent never edits `data/product-tags.ts` or `claims[]` without an explicit instruction naming the SKU and the source of the claim.

## 7. Failure behaviour

| Situation | Behaviour |
|---|---|
| Invalid catalog at `next build` | `parseCatalog` throws; the build fails. The app never serves an unvalidated catalog. |
| Unparseable weight/dimension | Warning with SKU + field; value is `null`; UI hides the derived value instead of showing 0. |
| Missing image | Validation fails (check 10); the UI never substitutes a placeholder photo for a catalog SKU. |
| Out-of-stock product | Kept in `products`; matching excludes it (REQ-CD-25); `/atelier` greys it out (REQ-CD-26). |
