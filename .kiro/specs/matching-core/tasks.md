# Matching Core — Tasks

*Implements `requirements.md` (REQ-MC-01 to REQ-MC-42) per `design.md`. Tasks in one wave touch different files and can run in parallel. A wave starts only when the previous wave's checks pass. Prerequisite: `catalog-data` Wave 2 (`parseCatalog`, `band_quartiles`, `tags`) is done.*

## Wave 1 — Types and curated maps (3 parallel tasks)

- [ ] **T1.1 Types** in `lib/matching/types.ts`: `RecipientModel`, `Constraints`, `ScoreBreakdown`, `Pick`, `Reason`, `MatchResult`, `LadderTrace`, `Relaxation` exactly as in design §1. *(REQ-MC-01)*
- [ ] **T1.2 Symbol and tag maps** in `data/product-tags.ts`: add `RELIGIOUS` (the 8 tags) and `SYMBOL_CHIP_TAGS` (om, ganesha, cross, sikh, trishul, jain, tabeez → tags) next to the `PRODUCT_TAGS` table from catalog-data T1.2. Hand-authored; header comment says so. *(REQ-MC-11, REQ-MC-13)*
- [ ] **T1.3 Occasion map** in `data/occasion-map.ts`: `OCCASION_MAP` with the rules table from design §4. Hand-authored. *(REQ-MC-16)*

Check: `npm run typecheck` passes.

## Wave 2 — Pure building blocks (4 parallel tasks, one file each)

- [ ] **T2.1 Age mapping** `ageYearsToBand()` and `AGE_LABEL` in `lib/matching/age.ts`: half-open `[0,3)`, `[3,12)`, `[12,19)`; adult → `'adult'`; invalid → throws. *(REQ-MC-02, REQ-MC-03)*
- [ ] **T2.2 Hard filters** `initialConstraints()` and `eligible()` in `lib/matching/filters.ts` per design §2: stock, age, budget, category, metal, symbol table. *(REQ-MC-07 to REQ-MC-13)*
- [ ] **T2.3 Scoring** `scoreProduct()` and `centrality()` in `lib/matching/scoring.ts` per design §4–5, reading `band_quartiles` from the parsed catalog (inclusive bounds, skipped for `no-limit`, original band after relaxation). *(REQ-MC-14 to REQ-MC-17)*
- [ ] **T2.4 Templates** in `lib/matching/templates.ts`: label maps, Indian-grouping price formatter, disclosure templates (n=0 variant), reason templates, pick-marker sentence, shortfall note. *(REQ-MC-24, REQ-MC-26, REQ-MC-28)*

Check: each file has its own unit test file (`tests/matching.age.test.ts`, `…filters…`, `…scoring…`, `…templates…`) written with it. Boundary cases to include: ages 2.999 / 3 / 11.999 / 12 / 18.999 / 19; prices 2499 / 2500 / 15000 / 15001 / 25000 / 25001; centrality on the exact P25 and P75 values; `none-religious` excludes all 8 religious SKUs.

## Wave 3 — Ranking, diversity, ladder, explain (3 parallel tasks, then 1)

- [ ] **T3.1 Ranking** `compare()` and `rank()` in `lib/matching/rank.ts`: score, rating (null last), distance to the original band's midpoint, SKU. *(REQ-MC-18)*
- [ ] **T3.2 Diversity** `applyDiversity()` in `lib/matching/rank.ts` (same file as T3.1; do after T3.1 or in the same change): swap rule from design §6. *(REQ-MC-20)*
- [ ] **T3.3 Ladder** `relax()` in `lib/matching/relax.ts`: the 5 steps in order (below, above, symbol, metal, category), re-check after each, no-op skipping, trace, disclosure strings. *(REQ-MC-21 to REQ-MC-25)*
- [ ] **T3.4 Explain** `explain()` in `lib/matching/explain.ts`: reason selection, ordering, `source` field. Depends on T2.4. *(REQ-MC-27 to REQ-MC-30)*
- [ ] **T3.5 Entry point** `match()` in `lib/matching.ts`: wires filter → ladder → score → rank → diversity → explain, shortfall note, browse flag, markers. Depends on T3.1–T3.4. *(REQ-MC-19, REQ-MC-26, REQ-MC-31)*

Check: `npm run typecheck` and `npm run lint` pass; `match()` has no import of `fs`, `Date`, `Math.random`, `fetch`, or any LLM client (a grep-based test asserts this).

## Wave 4 — Golden and property tests (3 parallel tasks)

- [ ] **T4.1 Golden unit tests** `tests/matching.golden.test.ts`: REQ-MC-33 (TBZ-1013, TNZ-1056, TBZ-1017, all score 6, rating order 5.0 > 4.7 > 3.9), REQ-MC-34 (exactly 2 picks for Mom: THP-1001 score 7, THP-1017 score 6, shortfall note, browse link, no disclosure), REQ-MC-35 (TPN-1141 score 9, TPN-1147 and TPN-1143 score 7, both disclosures, markers). Also pin the four quartile ranges and the 6/5/5/5 band depth. *(REQ-MC-06, REQ-MC-33 to REQ-MC-35)*
- [ ] **T4.2 Property tests** `tests/matching.property.test.ts`: I1–I7 and P-MC-8 to P-MC-15 from design §8, fixed seed, `numRuns ≥ 500`. *(REQ-MC-36 to REQ-MC-42)*
- [ ] **T4.3 Persona tests** `tests/matching.personas.test.ts`: the 8 scripted personas from PRD §4 as models → expected behaviour (persona 3: TNZ-1058 never appears; persona 8: no religious piece even after relaxation). Expected values are computed by running the real catalog once and reviewing each result by hand before pinning; any surprising result is raised as a spec question, not pinned silently.

## Wave 5 — Integration (parallel)

- [ ] **T5.1 Hook check.** Save `lib/matching.ts` and confirm `.kiro/hooks/matching-tests.json` fires and reports a deliberately failing golden test (then revert). Record in `docs/kiro-evidence-log.md`. *(architecture §7 hooks)*
- [ ] **T5.2 MCP tool** `matching_explain` calls `match()` and returns picks, scores, reasons, disclosures, trace (done with `packages/mcp-catalog`). Used by `qa-auditor` for golden-case checks.
- [ ] **T5.3 Coverage.** `lib/matching*` and `lib/catalog.ts` at ≥ 80% line coverage; list uncovered branches in the evidence log.

## Done when

`npm test` passes all matching tests, golden cases 1 to 3 reproduce exactly, I1–I7 hold over ≥ 500 generated models, and `matching-tests` fires on save.
