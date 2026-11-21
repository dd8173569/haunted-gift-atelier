# Catalog Data — Tasks

*Implements `requirements.md` (REQ-CD-01 to REQ-CD-26) per `design.md`. Tasks are small; tasks in the same wave touch different files and can run in parallel. A wave starts only when the previous wave's tasks pass their checks.*

Status key: `[x]` already in the repo from the Milestone 1 import, `[ ]` to do.

## Wave 0 — Import (done; re-verified by T1.3)

- [x] **T0.1 Catalog copy.** `data/catalog.json` is the crawl file plus `version: "1.0.0"` and `claims: []` on every product. `image_file` reduced to the bare filename. *(REQ-CD-13, REQ-CD-22)*
- [x] **T0.2 Images.** 22 photos in `public/catalog/`, named by SKU, unmodified. *(REQ-CD-05)*
- [x] **T0.3 Changelog.** `data/catalog-changelog.md` has the `## v1.0.0 — 2026-11-21` entry. *(REQ-CD-23)*

## Wave 1 — Types, tags, validator (parallel: 3 independent files)

- [ ] **T1.1 Types + pure helpers** in `lib/catalog.ts`: the types from design §2, `percentile()` (type-7 linear interpolation), `priceBand()`, `deriveMetal()`. No I/O. *(REQ-CD-14, REQ-CD-15)*
- [ ] **T1.2 Curated tags** in `data/product-tags.ts`: the exact table from REQ-CD-21 as `PRODUCT_TAGS: Record<string, readonly string[]>` (tag → SKUs), with a header comment "hand-authored; never generated or LLM-edited". *(REQ-CD-21)*
- [ ] **T1.3 Validation script skeleton** in `scripts/validate-catalog.ts`: checks 1–11, 13, 15 from design §4 (file-system and schema checks, magic-byte image check, changelog heading), stderr `FAIL [REQ-CD-xx]` lines, exit codes, `--base` flag parsing. Checks 12 and 14 stay stubs that print `NOTE: not yet wired`. *(REQ-CD-01–09, 22–24)*

Check: `npm run validate-catalog` exits 0 on the current catalog; temporarily breaking one SKU makes it exit 1 with a `FAIL` line (revert the break; do not commit it).

## Wave 2 — Parsers, loader, unit tests (T2.1, T2.2, T2.4 in parallel; T2.3 after T2.1 and T2.2)

- [ ] **T2.1 Weight parser** `parseWeight(raw, category)` per design §3.3, returning `{value, warning?}`. *(REQ-CD-11, REQ-CD-16)*
- [ ] **T2.2 Dimension parser** `parseDimensions(raw, category)` per design §3.4: item, set, string-bracelet (`Math.round(inches * 254) / 10`), bangle; `width: "-"` → `null` + warning. *(REQ-CD-12, REQ-CD-17–20)*
- [ ] **T2.3 Loader** `parseCatalog(raw)`: composes the parsers, derives `metal`, `price_band`, `rating_value`, `tags`, defaults `claims`, computes `band_quartiles`, returns `{products, band_quartiles, warnings}`. Throws on build errors (design §3.1, §3.6, set-dimension failure). Depends on T2.1 and T2.2. *(REQ-CD-09–14)*
- [ ] **T2.4 Unit tests** `tests/catalog.test.ts`: the pinned real-catalog facts from design §5 (22 products, 14/8 metals, 6/5/5/5 bands, weights, 133.4 mm ×5, 39.6 mm ×2, exactly 2 warnings, quartile table, 9 null ratings, TNZ-1058 the only OOS). Written against the design values first; it is expected to fail until T2.1–T2.3 land.

## Wave 3 — Integration (parallel)

- [ ] **T3.1 Wire the validator** to `parseCatalog()` (check 12) and implement check 14 (`--base` git comparison). *(REQ-CD-11, 12, 23)*
- [ ] **T3.2 Property tests** `tests/catalog.property.test.ts`: P-CD-1 to P-CD-12 with fast-check (fixed seed in config, `numRuns ≥ 200`). Any counterexample goes into `docs/kiro-evidence-log.md` with the fix. *(REQ-CD-01–16, 19, 20)*
- [ ] **T3.3 Validator tests** `tests/validate-catalog.test.ts`: run the validator against fixture catalogs written to a temp directory (duplicate SKU, bad URL, `mrp_inr` set, missing image, wrong `count`, missing `version`, non-semver version, changelog heading missing). Each must exit non-zero and print its `FAIL [REQ-CD-xx]` code. A valid fixture exits 0. *(REQ-CD-01–09, 22–24)*

## Wave 4 — Automation (parallel)

- [ ] **T4.1 CI step.** Add `npm run validate-catalog -- --base origin/main` to `.github/workflows/ci.yml` (with `fetch-depth: 0`). *(REQ-CD-23)*
- [ ] **T4.2 Hook check.** Save `data/catalog.json` once unchanged and once with a deliberate bad SKU (then revert); confirm `.kiro/hooks/catalog-validation.json` fires and the failure is visible. Record both firings in `docs/kiro-evidence-log.md`. If the hook does not fire, record that too. *(REQ-CD-24)*
- [ ] **T4.3 MCP tool `catalog_validate`** calls the same `scripts/validate-catalog.ts` logic and returns pass/fail plus the issue list (done in the `packages/mcp-catalog` milestone, listed here for traceability).

## Wave 5 — Consumers (other specs; listed so nothing is orphaned)

- [ ] **T5.1** `/atelier` greys out TNZ-1058 with an "Out of stock" badge and no buy CTA. *(REQ-CD-26; owned by `polish-deploy`)*
- [ ] **T5.2** `matching-core` consumes `Product`, `band_quartiles`; its out-of-stock property test covers REQ-CD-25. *(owned by `matching-core`)*

## Done when

`npm run validate-catalog` prints `CATALOG OK: 22 products, version 1.0.0, 2 warning(s)` and exits 0, `npm test` passes `tests/catalog*.test.ts`, and CI and the save hook both run the validator.
