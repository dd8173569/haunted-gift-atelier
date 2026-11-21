# QA report: gift-presentation, Milestone 3 (Wave 4, T4.4)

Role: read-only audit (no application code or test was changed). Scope: `/piece/[sku]` (`app/piece/[sku]/page.tsx`, `not-found.tsx`), `components/GiftWrap.tsx`, `PieceFacts.tsx`, `SafetyVerdict.tsx`, `TrueSizeViewer.tsx`, `lib/gift-message.ts`, `lib/piece-view.ts`, and the "See details" links on `PickCard` and `BrowseCard`.
Audited state: Waves 1 to 3 plus the coordinator's `data-testid` rename (`true-size-viewer` to `size-viewer`).

## How the audit was run

- The audit session called the `catalog` MCP server: `matching_explain` (golden case 1) and `catalog_get` (TNZ-1058). For the other 21 SKUs the ground truth is `data/catalog.json` read directly. `catalog_get` was not called 22 times.
- The 22 detail pages were not fetched from a server (no dev server and no build were run in this session). Instead a temporary script called the real `PiecePage` server component for each SKU with no `m` and passed the result to `renderToStaticMarkup`, so the counts below are over the rendered HTML of the real page, with `<script>` payloads absent. A second temporary script ran `toPieceView` over all 22 products and compared each fact to the catalog. Both scripts were deleted afterwards (`git status` shows no audit file).
- Dev-server numbers for T4.1 (port 3115) were run by the coordinator and are quoted in the evidence log, not re-derived here.

## Automated results (supplied by the coordinator, not re-run)

| Check | Result |
|---|---|
| `npm test` | pass: 953 tests in 45 files |
| `npm run typecheck` | pass |
| `npm run lint` | pass: 0 errors, 1 known warning (`AgeBand` unused in `packages/mcp-catalog/src/index.ts`) |
| `npm run validate-catalog` | OK, 2 expected warnings (TNZ-1058 and TNZ-1056 width) |
| `npm run build` | pass: 30 static pages, `/piece/[sku]` with all 22 paths (Partial Prerender) |

The audit session re-ran only the gift, piece, and model-param test files: 10 files, 143 tests, all passing.

## Checks over all 22 pages

Counts are per page, over the rendered markup. The column "In-stock (21)" and "TNZ-1058" are the only two distinct outcomes; no page differed within its group.

| Check | In-stock (21) | TNZ-1058 | Result |
|---|---|---|---|
| Buy `href` equals catalog `url` byte for byte (HTML-escaped `&` only; includes the percent-encoded URLs of TPN-1459 and TNZ-1056 and the comma URL of TBZ-1013) | exactly 1 per page | 0 | pass |
| Any other `tinytiaraa.com/product/` link | 1 (the buy link) | 0 | pass |
| "Buy on Tiny Tiaraa" | 1 | 0 | pass |
| "Wrap this gift" | 1 | 0 | pass |
| "Out of stock" | 0 | 2 (badge and the "out of stock on the listing" line) | pass |
| Exact fit-check line "A fit check from the atelier — guidance, not a safety certification." | 1 | 1 | pass |
| "No certifications are stated on this product" | 1 | 1 | pass |
| `true size` (case-insensitive, hyphen or space) | exactly 1 | exactly 1 | pass |
| Exact label "Approximate size — calibrate with a card for true size." | 1 (it is the only "true size") | 1 | pass |
| Word-boundary `safe` or `unsafe` | 0 | 0 | pass |
| Discount or MRP wording (`% off`, `save ₹`, `MRP`, `was ₹`, `discount`, `strike`) | 0 | 0 | pass |
| Certification terms (`BIS`, `hypoallergenic`, `nickel-free`, `sensitive skin`, `certified`) | 0 | 0 | pass |
| Price shown with the exact footnote | 1 footnote | 1 footnote | pass |
| Rating: "Rated <catalog string>" when the catalog has one, no "Rated" text when it is null | matches | matches (5.0/5) | pass |
| Product name verbatim (including "sudd set", "studd set") | yes | yes | pass |

## Facts against the catalog (`toPieceView` for all 22)

For every product: `url`, `price_inr`, `rating` and availability flag equal the catalog; Materials, Weight and Dimensions values are the catalog strings verbatim; the Chain row exists exactly when `chain` is non-null; no `mrp_inr`, `claims`, or `design_application_no` value appears in the facts (Q21: not shown). Mismatches found: none. Availability is shown as "In stock" / "Out of stock" (the documented map of the catalog's "In Stock" / "Out of Stock"). TNZ-1058 shows Dimensions "Height 5.25 Inch, Width -" verbatim, which states the missing width as the listing does.

## Other refusal checks

| Rule | Evidence | Result |
|---|---|---|
| No ad-hoc colour in components or routes | `grep -rnE '#[0-9a-fA-F]{3,8}\b\|rgb\(\|\[#' components app` over `.ts` and `.tsx` is empty; hex values exist only in `app/globals.css` (token file) | pass |
| No `app/api/` directory | `ls app/api` fails | pass |
| TNZ-1058 has no buy control and no wrap | table above; page source takes the `view.inStock` branch to a "Browse the atelier" button | pass |
| Photo untouched | page uses `ProductPhoto` with only the "Photo as listed — shown enlarged, not to scale." caption below it, not over it | pass |
| No matching on the detail page | `app/piece/[sku]/page.tsx` imports no `lib/matching` (matching stays in `/picks`) | pass |

## Golden case 1 through MCP `matching_explain`

Model: niece-nephew, infants, age 0, naming, under-2500, silver, symbols any, category any.

| Pick | Score | Reasons | Disclosures |
|---|---|---|---|
| TBZ-1013 | 6 | age, budget, occasion, metal | none |
| TNZ-1056 | 6 | age, budget, occasion, metal | none |
| TBZ-1017 | 6 | age, budget, occasion, metal | none |

Order and scores match golden case 1; no shortfall note, no trace. The `/picks` page serves them in the same order with three "See details" links (coordinator's T4.1).

## Findings

No blocker, major, or minor defect was found on `/piece/[sku]`. Items below are notes and open questions. None was fixed.

| ID | Severity | Item | Evidence |
|---|---|---|---|
| N-1 | note (resolved) | The T4.1 `true size` count was 2 on first run because `TrueSizeViewer.tsx` carried `data-testid="true-size-viewer"`. The coordinator renamed it to `size-viewer`. The audit's own count is 1 on all 22 pages. The attribute was never visible text. | table above |
| N-2 | open (Q15) | `/piece/NOPE-0000` returns 200 with the not-found UI and `noindex`, not 404. Accepted fallback of Q15 (root `Suspense`; same cause as M2 OQ-1). | coordinator's T4.1 |
| N-3 | open (M4/M6) | Next.js dev-only "instant" validation warning on `/find` and `/picks`: `searchParams` awaited outside `<Suspense>` may prevent instant navigation (suggests a Suspense placeholder or `export const instant = false`). Dev-only, does not affect the build. Not touched. | dev log, coordinator |
| N-4 | note | TNZ-1058 shows "Rated 5.0/5" next to an Out of stock badge. Correct per catalog; recorded because the page shows a rating for a piece that cannot be bought. | catalog_get TNZ-1058 |

## Not done

- T4.3 physical checks (card and ruler, phone and desktop): NOT RUN. No human is available in a non-interactive session. No measurement was fabricated; the lines stay blank in `docs/qa-reports/true-size-m3.md`.
- No fetch of the 22 pages from a running server (see "How the audit was run").
- The 22 MCP `catalog_get` calls were replaced by one call plus direct reads of `data/catalog.json`.

## Verdict

Pass for the gift-presentation milestone, with N-2 and N-3 for the builder's decision.
