# Catalog Data — Requirements

*Spec for PRD §2. Source of truth: `data/catalog.json` (22 SKUs, extracted 21 Nov 2026).*

---

## 1. Schema fields and validation rules

### EARS acceptance criteria

**[REQ-CD-01] SKU uniqueness and format**
WHEN the catalog is loaded, the system SHALL reject any file where two products share the same `sku` value or where any `sku` does not match the pattern `^[A-Z]{3}-\d{4}$`.
*(Note: sets carry an optional `sku_extra` for the second component; `sku_extra` is not subject to the uniqueness check.)*

**[REQ-CD-02] Required string fields**
WHEN the catalog is loaded, the system SHALL reject any product record missing or having an empty value for `sku`, `name`, `price_inr`, `url`, `image_file`, `materials`, `weight`, `dimensions`, `availability`, or `category`.

**[REQ-CD-03] Price is a positive integer; no MRP**
WHEN any product is loaded, the system SHALL verify `price_inr` is a positive integer. The system SHALL NOT read, display, or derive a discount from `mrp_inr`; the field is null for all 22 SKUs and must remain null.

**[REQ-CD-04] URL pattern**
WHEN the catalog is loaded, the system SHALL verify every `url` matches `https://www.tinytiaraa.com/product/*`.

**[REQ-CD-05] Image file existence**
WHEN the catalog is loaded, the system SHALL verify every `image_file` path exists under `public/catalog/` and that the file is a valid PNG or JPEG.

**[REQ-CD-06] Age groups enum**
WHEN the catalog is loaded, the system SHALL verify every entry in each product's `age_groups` array is one of: `Infants 0-3 years`, `Kids 3-12 years`, `Teens 12-19 years`, `Mom`. An empty `age_groups` array SHALL be rejected.

**[REQ-CD-07] Availability enum**
WHEN the catalog is loaded, the system SHALL verify every product's `availability` is exactly `In Stock` or `Out of Stock`. Any other value SHALL be rejected.

**[REQ-CD-08] Category enum**
WHEN the catalog is loaded, the system SHALL verify every product's `category` is one of: `Pendant`, `Bracelet`, `Earrings`, `Set`, `Tabeez`.

**[REQ-CD-09] Count integrity**
WHEN the catalog is loaded, the system SHALL verify the top-level `count` field equals the actual number of items in the `products` array (expected: 22).

**[REQ-CD-10] Rating display**
WHEN a product's `rating` field is null or absent, the system SHALL NOT display a rating or invent one. The `rating` field is optional (9 of 22 products have no rating).

**[REQ-CD-11] Weight parseable**
WHEN any product is loaded, the system SHALL attempt to parse `weight` into a numeric `weight_g` value. If the parse fails, the system SHALL emit a build warning identifying the SKU and SHALL NOT silently default to zero.

**[REQ-CD-12] Dimensions parseable**
WHEN any product is loaded, the system SHALL attempt to parse `dimensions` into numeric mm fields. If the parse fails for any field, the system SHALL emit a build warning identifying the SKU and the unparsed field, and SHALL NOT silently default to zero.

**[REQ-CD-13] Claims field default**
WHEN a product record does not include a `claims` field, the system SHALL treat it as an empty array `[]`. The system SHALL NOT assert any certification for a product whose `claims` array is empty.

---

## 2. Derived fields

**[REQ-CD-14] Metal derivation**
WHEN deriving `metal`, the system SHALL set it to `gold` if `materials` contains `18KT Gold`, else to `silver` if `materials` contains `925 Silver`. All 22 current SKUs resolve under this rule (14 gold, 8 silver). A product that matches neither SHALL be flagged as a build error.

**[REQ-CD-15] Price band derivation**
WHEN deriving `price_band`, the system SHALL apply:
- `under-2500` for `price_inr < 2500`
- `2500-15000` for `2500 ≤ price_inr ≤ 15000`
- `15000-25000` for `15000 < price_inr ≤ 25000`
- `25000-plus` for `price_inr > 25000`

**[REQ-CD-16] Weight midpoint**
WHEN `weight` is a range string (e.g. `6.50-7.50 gross gms approx`), the system SHALL compute `weight_g` as the arithmetic midpoint of the two bounds, using the first numeric component (gold weight for multi-metal pieces; total gross weight for silver pieces). Single numeric values SHALL be used as-is. Set products (TPN-1206, TPN-1199) sum gold weights of pendant and earring components.

**[REQ-CD-17] Pendant/earring/tabeez dimensions**
WHEN parsing `dimensions` for a Pendant, Earrings, or Tabeez product, the system SHALL extract `height_mm` and `width_mm` as floating-point millimetres from the `Height X mm, Width Y mm` pattern.

**[REQ-CD-18] Set dimensions**
WHEN parsing `dimensions` for a Set product, the system SHALL extract `pendant_height_mm`, `pendant_width_mm`, `earring_height_mm`, and `earring_width_mm` from the two-component pattern (e.g. `Pendant Height 11.50 mm Width 4.55 mm; Earrings Height 5.35 mm Width 3.90 mm`).

**[REQ-CD-19] Bracelet circumference**
WHEN parsing `dimensions` for a Bracelet product whose height field is in inches (pattern `X.XX Inch`), the system SHALL compute `circumference_mm = value_in_inches × 25.4`. The 5.25-inch bracelet value used across TNZ-1058, TNZ-1016, TNZ-1010, TNZ-1015, TNZ-1056 produces `circumference_mm = 133.4 mm`.

**[REQ-CD-20] Bangle diameter**
WHEN parsing `dimensions` for a Bracelet product whose height field is in millimetres (pattern `39.60 mm`; products TOB-1009, TOB-1008), the system SHALL store `diameter_mm = 39.6 mm`. These are bangles distinguished from string-bracelets by their mm-unit height field.

**[REQ-CD-21] Tags — human-curated, never LLM-inferred**
WHEN a product is tagged, the system SHALL apply only the tags defined in `data/product-tags.ts`, which is hand-authored per the following curated map and SHALL NOT be modified by any automated process or LLM:

| Tag | SKUs |
|-----|------|
| `symbol:om` | TPN-1149 |
| `symbol:sikh` | TPN-1147 |
| `symbol:cross` | TPN-1145 |
| `symbol:ganesha` | TPN-1141 |
| `symbol:trishul` | TPN-1143 |
| `symbol:jain` | TPN-1144 |
| `symbol:swastik` | TBZ-1017 |
| `symbol:third-eye` | TBZ-1013 |
| `symbol:zodiac` | TPN-1459, TPN-1433 |
| `symbol:evil-eye` | TNZ-1056, TNZ-1058 |
| `material:black-beads` | TNZ-1016, TNZ-1010, TNZ-1015 |
| `material:pearl` | TPN-1206, TPN-1199 |
| `material:cz` | TOB-1008 |

---

## 3. Versioning

**[REQ-CD-22] Version and extraction fields**
WHEN `data/catalog.json` is used, the file SHALL carry a top-level `version` field (semver, starting at `1.0.0`) and an `extracted` field (`2026-11-21`). These fields must be present; their absence SHALL be a validation error.

**[REQ-CD-23] Changelog discipline**
WHEN any field in `data/catalog.json` is changed, the system SHALL require a corresponding entry in `data/catalog-changelog.md` and a version bump before the change is merged. A price or availability change is a minor version bump; structural schema changes are major.

**[REQ-CD-24] No silent edits**
WHEN a save to `data/catalog.json` is detected, the catalog-validation hook SHALL run automatically and SHALL surface any validation failure as a visible error. A silent pass on an invalid catalog is a defect.

---

## 4. Availability invariant

**[REQ-CD-25] Out-of-stock items never returned by matching**
WHEN the matching function is called with any recipient model, it SHALL NEVER return a product whose `availability` is `Out of Stock`. This is both a hard filter in `lib/matching.ts` and a property-test invariant verified by fast-check over random recipient models. Currently one product is out of stock: TNZ-1058 (Red Square Evil Eye Nazariya).

**[REQ-CD-26] Out-of-stock display in browse**
WHEN the browse grid (`/atelier`) renders TNZ-1058, it SHALL display the product greyed out with an "Out of stock" badge and SHALL NOT show a buy CTA.

---

## 5. Known data gaps (never papered over)

| Gap | Required handling |
|-----|-------------------|
| No MRP or discount data (`mrp_inr` is null for all 22 SKUs) | NEVER display a discount, strike-through price, or "save ₹X" message anywhere in the UI |
| Only one photo per SKU (gallery extras not accessible) | Detail page shows the single catalog photo large; no AI-generated alternate views |
| `claims[]` is empty for all 22 SKUs until verified per SKU | Assert no certification for any product; display "No certifications are stated on this product's page" |
| Mixed dimension formats (some in inches, some in mm) | Parse at build time; label each parsed field with its interpretation; ambiguous cases emit a build warning |
| TNZ-1058 out of stock as of extraction | Excluded from all matching results; visible greyed-out in browse only |
