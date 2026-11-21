# Catalog changelog

Every change to `data/catalog.json` is recorded here with a version bump.
No silent edits: a price or availability change is a version bump.

## v1.0.0 — 2026-11-21

Initial import from the read-only browser crawl of tinytiaraa.com
(21 Nov 2026, 22 products). Source: `hidden_files/catalog/catalog.json`
in the project workspace.

Transforms applied on import (documented, not silent):
- Added `version: "1.0.0"` (`extracted: "2026-11-21"` was already present).
- Added `claims: []` to every product (PRD §2: site-verified certification
  claims only; empty until verified per SKU — see PRD §5 claims discipline).
- Reduced `image_file` to the bare filename (e.g. `images/TPN-1149.png` →
  `TPN-1149.png`): the photos live directly in `public/catalog/` in this
  repo. `image_url` keeps the original admin.tinytiaraa.com URL for
  provenance.

Data facts (from the source, unchanged):
- 22 products: 8 pendants, 7 bracelets, 3 earrings, 2 sets, 2 tabeez.
- Prices ₹1,674–₹61,599. No MRP or discount listed on any product page
  (`mrp_inr` is null for all 22) — the app never shows discounts.
- TNZ-1058 (Red Square Evil Eye Nazariya) is Out of Stock; excluded from
  matching, visible greyed-out in browse only.
- Main image only per product (gallery extras were not exposed by the site).
