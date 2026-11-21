---
inclusion: fileMatch
fileMatchPattern: "data/**"
---

# Catalog honesty rules

Applies when working on anything under `data/`.

## Refusals

- NEVER add or change a product fact (name, price, material, weight, dimensions, age group, rating, availability, URL, SKU) that is not copied from the Tiny Tiaraa product page. No guessing, no rounding, no "improving" wording.
- NEVER set `mrp_inr` to a number, and never derive a discount.
- NEVER add an entry to a product's `claims[]` unless the claim is stated on that SKU's own product page and you can name the page and the exact wording. Site-wide boilerplate does not count.
- NEVER edit `data/product-tags.ts`, `data/occasion-map.ts`, or `data/safety-rules.md` through an automated or LLM-inferred process. Edit only when a human instruction names the SKU or rule and the reason.
- NEVER change `data/catalog.json` without a version bump and a changelog entry in the same change.
- NEVER leave a validation failure unreported. `npm run validate-catalog` must pass, or the failure is shown to the user.

## Rules

1. Every product fact in the app traces to a field in `data/catalog.json`. Derived fields come from `parseCatalog()` and are not stored in the file.
2. Prices are a snapshot taken on 21 Nov 2026. Every place a price is displayed carries the footnote "Price as listed on tinytiaraa.com on 21 Nov 2026 — check the store for the current price."
3. Change workflow: edit → run `npm run validate-catalog` → add a `## v{version} — {date}` entry to `data/catalog-changelog.md` listing each SKU, field, old value and new value → bump `version`. Price or availability change: minor bump. Schema change: major. Text fix: patch.
4. `extracted` changes only after a new crawl.
5. Names are verbatim, including "sudd set" (TPN-1206) and "studd set" (TPN-1199).
6. Missing data stays missing: `rating: null`, `width: "-"` (TNZ-1058, TNZ-1056), empty `claims[]`. Parsers return `null` plus a warning, never `0`.
7. `image_file` is the bare filename in `public/catalog/`. Photos there are never edited, cropped, recoloured, or replaced by generated images.
8. After any catalog change, re-run the golden cases (`npm test`). A price change can move a band or a quartile and change a pick.
