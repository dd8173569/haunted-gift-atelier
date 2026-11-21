# QA audit: polish-deploy, Milestone 4 (T4.5)

Read-only audit, 21 Nov 2026, on the Wave 3 tree (uncommitted on top of HEAD 5472e92). No code was changed. Two throwaway checks were used and deleted: a temporary test file that rendered all 22 `/piece` pages, and a `next start` on port 3117 (stopped). Product facts come from the catalog MCP server (`catalog_get`, 22 calls; `matching_explain`, 1 call), called through the Kiro MCP client with the config in `.kiro/settings/mcp.json` (`npx tsx packages/mcp-catalog/src/index.ts`). `packages/mcp-catalog` has no README, so that config is the run instruction.

**Verdict: PASS with two recorded observations and one known open question. No blocking defect.**

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Suite re-run | PASS | `npm test` 1502/1502 in 55 files; typecheck clean; lint 0 errors (1 existing warning); `validate-catalog` OK; `npm run build` passes |
| 2 | Pinned strings on all 22 `/piece` pages | PASS | per page: fit-check line once, approximate-size label once; `h1` once. 22 of 22 |
| 3 | "true size" rule on all 22 pages | PASS | `true[- ]size` matches exactly once per page (inside the approximate label), 22 of 22 |
| 4 | Every `₹` has the footnote | PASS, with Q-PD18 | On the 22 pages every `₹` text node sits in a price region that holds the footnote (1 node per page, 0 without). Budget-band and budget-chip text (`/find`, `/atelier` filters, recipient card, the pinned relaxation disclosure) carries `₹` without the footnote. That is the known open question Q-PD18, not a failure |
| 5 | No discount wording | PASS | No `% off`, `save`, `MRP`, `strike`, `was ₹`, `discount` on any of the 22 pages. The landing trust strip says "No discounts invented" (REQ-SV-29); it is the one allowed phrase |
| 6 | No `text-gold` | PASS | `grep -rn "text-gold" app components` prints 0 |
| 7 | No text alpha below the floor | PASS | `text-plum/N` values in use: 75, 80, 85 only; pattern for 50 to 70 prints 0 |
| 8 | No `border-plum/30` | PASS | prints 0. Border alphas in use: `/10` ×1 and `/15` ×7 (decorative, exempt in REQ-PD-26, e.g. card and verdict outlines) and `/60` ×11 (controls and drawings) |
| 9 | No hex in `app/` or `components/` | PASS | The only hex literals are the six token definitions in `app/globals.css` (the one token file). No `rgb(`, `hsl(`, `oklch(`, `[#`, or `bg-[` anywhere. No `tracking-[` |
| 10 | Out-of-stock card: no buy control, photo untouched | PASS | TNZ-1058: 0 buy links, no "Wrap this gift", no store link on `/piece/TNZ-1058` (also 0 in the served HTML in T4.1); `/atelier` has 21 buy links for 22 cards. The photo is the `next/image` of `ProductPhoto` with `object-contain` on `bg-pearl`; no overlay, filter or text. `public/catalog/` has 22 files and `git status` shows none modified |
| 11 | Photo `alt` equals the catalog name | PASS | Compared against the `name` from `catalog_get` for all 22 SKUs: 0 mismatches on the 22 piece pages (4 pages, TPN-1459, TBZ-1017, TPN-1433 and TBZ-1013, render a second `img`, also with the exact name), 0 on the 22 `/atelier` cards, 0 on the 3 golden-1 picks |
| 12 | Titles distinct | PASS | 22 piece titles from `generateMetadata`: 22 distinct, each the catalog name (TNZ-1058 with "(out of stock)"). With the five route titles of T4.1, all 27 differ |
| 13 | Golden 1 through `matching_explain` | PASS | Model niece-nephew, infants, age 0, naming, under-2500, silver, symbols any, category any: TBZ-1013, TNZ-1056, TBZ-1017, scores 6, 6, 6, no relaxations, no disclosures. The dev server served the same order (T4.1) |
| 14 | Logo or watermark | PASS | No `<img` in `app/` or `components/`; the only text matching "logo" or "watermark" is a comment in `ProductPhoto.tsx` forbidding them |
| 15 | No CI file, no `coverage/`, no temp file, no server | PASS | `.github/` absent; `coverage/` removed; nothing on 3116 or 3117; no `/tmp/*-pd.*` files |

## Observations

**O-1 (not blocking, new): `/piece/NOPE-0000` serves no `main-content` and no `h1` in the HTML.** On the dev server the response is 200 and, on a production server (`next start`), 404. In both the title ("Piece not found | Haunted Gift Atelier"), the `noindex` tag and the skip link are in the HTML, but `id="main-content"` and `<h1` are not. The dev log says "Switched to client rendering because the server rendering errored: NEXT_HTTP_ERROR_FALLBACK;404", so the body arrives as a client-rendered template. The component has both elements and its test passes, so a browser most likely shows them after hydration, but no browser was available to confirm it. REQ-PD-53 says every page contains one `main-content` and one `<h1`; a missing-SKU URL is arguably outside "every page", and this was not changed. Two follow-ups for the builder: confirm in a browser (listed in the manual checklist), and decide whether the Q15 note "200 + noindex" should now read "200 in dev, 404 in production".

**O-2 (not blocking): a decorative `opacity-20` on `components/CobwebCorner.tsx`.** It is an `aria-hidden` hero-only stroke, not text, so the text-alpha floor does not apply.

## Known open question

Q-PD18: REQ-PD-15 reads as "every `₹` node has the footnote", but budget bands, budget chips, recipient-card lines and the pinned relaxation disclosure contain `₹` and cannot take the footnote without changing pinned copy. The copy test exempts band shapes and text that says "budget". Left to the builder's decision.

## Not covered

Everything in the manual checklist (`docs/qa-reports/polish-m4.md`) is NOT RUN. Colour contrast, layout, 44 px targets and reflow were checked by computed ratios and class rules in jsdom only, not on a display.
