# Safety Verdict — Tasks

*Implements `requirements.md` (REQ-SV-01 to REQ-SV-42) per `design.md`. Tasks in one wave touch different files and can run in parallel. A wave starts only when the previous wave's checks pass. Prerequisites: `catalog-data`, `matching-core`, and `conversation` are done (`parseCatalog`, `AgeBand`, `AGE_LABEL`, `AGE_GROUP_LABEL`, `tests/helpers/dom.ts`). This spec changes none of `lib/matching.ts`, `lib/matching/*`, `lib/catalog.ts`, `data/catalog.json`, or `data/*.ts`; any task that seems to need that is a spec question, not an edit. The detail page that shows the card is built in `gift-presentation`; this spec ends with a tested component and a pure verdict function.*

*Common checks, run at the end of every wave unless the wave says otherwise:* `npm test`, `npm run typecheck`, `npm run lint`. The existing tests stay green throughout. Test files are named `tests/safety*.test.ts(x)` so the `matching-tests` hook runs them.

*Rules edits (T1.1) follow the human instruction in this spec: the 15 rules of design §4.2, exact text. No agent invents or rewords a rule (steering `catalog-rules.md`).*

## Wave 1 — Rules (2 parallel tasks, then 1 test)

- [ ] **T1.1 Rules file** `data/safety-rules.md` per design §4.1 and §4.2: `version: 1.0.0`, the 15 `### SR-…` sections with `check`, `applies`, `severity`, `text`, and a `## Changelog` with the `1.0.0` entry. Text copied exactly from the design table. *(REQ-SV-21, 23)*
- [ ] **T1.2 Rules constant** `lib/safety-rules.ts`: `SAFETY_RULES_VERSION`, `SafetyRule`, `SAFETY_RULES` (the same 15 rows), `RULE_IDS`, `ruleById()` (throws on unknown). No React, no I/O. *(REQ-SV-22)*
- [ ] **T1.3 Sync test** `tests/safety.rules.test.ts` (after T1.1 and T1.2): parse `data/safety-rules.md` with `fs`, compare version, ID set, and each rule's check, applies, severity, text with the constant; ID format and uniqueness; no rule text contains `/\b(un)?safe\b/i` or a certification term (BIS, hallmark, hypoallergenic, nickel-free, certified, tested). *(REQ-SV-22, 03)*

Check: `npx vitest run tests/safety.rules.test.ts`, then common checks.

## Wave 2 — Check helpers (2 parallel tasks, each with its tests)

- [ ] **T2.1 Materials decoder** `lib/safety-materials.ts`: `decodeMaterials(materials): DecodedSegment[]` per design §3.2 (the 6 patterns, first match wins, pass-through for the rest, numbers copied from match groups). Tests `tests/safety.materials.test.ts`: all 22 real `materials` strings (expected displays pinned for TPN-1149 "18KT gold · Diamond 0.06 ct, GH-VS", TPN-1206 "18KT gold · Diamond, GH-VS · pearl", TOB-1008 "925 sterling silver · CZ (cubic zirconia)", TBZ-1013 openable-locket tail passes through unchanged); the join-raw round trip. *(REQ-SV-11, 12; P-SV-9)*
- [ ] **T2.2 Weight context** `lib/safety-weight.ts`: `referenceBand`, `weightPool`, `median`, `weightContext` per design §3.3, in integer hundredths. Tests `tests/safety.weight.test.ts`: median of odd and even pools; flag at 1.5× median is false and at +0.01 g is true; pool of 2 never flags; the real pools (n = 18, 15, 9, 2; medians 1.51, 1.23, 0.86, n/a); the flagged lists of REQ-SV-16 recomputed with a naive median written in the test; no-band reference band for a piece listing infants+kids+teens (infants) and one listing only Mom (mom). *(REQ-SV-13 to 16; P-SV-6)*

Check: `npx vitest run tests/safety.materials.test.ts tests/safety.weight.test.ts`, then common checks.

## Wave 3 — Verdict (1 task, then 2 parallel test tasks)

- [ ] **T3.1 `computeVerdict`** `lib/safety.ts` per design §2 and §3: `FIT_CHECK_LINE`, types, the age, certifications, wear, and not-stated rows, assembly in the fixed order, severity read from `ruleById`, `flagged`, `verdict`. Uses T1.2, T2.1, T2.2. Unit tests `tests/safety.test.ts`: each check and each case of the §3 tables; verdict for TNZ-1056 (infants) = `Check this` with flags `weight` and `wear:SR-WEAR-BRACELET`; TPN-1149 (infants) = `Good fit`; TPN-1149 against `mom` = `Check this` (age row flag); the pinned Good fit lists of design §5.1 for the four bands; the no-band context (age row `note`, weight reference band, two pieces); TNZ-1058 (out of stock) still gets a verdict with the weight flag; an injected rules table in which `SR-NS-NICKEL` is a `flag` makes every verdict `Check this` (proves REQ-SV-20 reads severity from the rule); all 22 certifications rows equal the "No certifications…" sentence; no atelier text matches `/\b(un)?safe\b/i`. *(REQ-SV-01 to 10, 16 to 19, 20)*
- [ ] **T3.2 Property tests** `tests/safety.property.test.ts` (write against the `computeVerdict` signature; run after T3.1): P-SV-1 to P-SV-12 per design §8.1, seeded, `numRuns ≥ 200`, over generated products and over all 22 products × 5 band contexts. A counterexample is logged in the evidence log with its fix; the test is never loosened. *(REQ-SV-33 to 42)*
- [ ] **T3.3 Static purity test** `tests/safety.static.test.ts` (parallel with T3.2): `lib/safety*.ts` import no React, `fs`, `node:*`, `fetch`, LLM client; no `Date`, `Math.random`; `lib/matching.ts` and `lib/matching/*` do not import `lib/safety*` (REQ-SV-06); `components/SafetyVerdict.tsx` imports no `catalog.json` and no `computeVerdict`; no `#hex`, `rgb(`, or `[#` in the component. *(REQ-SV-06, 25, 26, 30; P-SV-11)*

Check: `npx vitest run tests/safety`, common checks, and coverage of the `lib/safety*.ts` files ≥ 80% (`npx vitest run --coverage --coverage.include='lib/safety*.ts'`, then confirm no `coverage/` directory is left behind).

## Wave 4 — Card, copy, evidence (4 parallel tasks)

- [ ] **T4.1 Card component** `components/SafetyVerdict.tsx` per design §6: server-renderable, props `{ verdict }`, `<section role="region" aria-labelledby>`, `<dl>` rows, "Worth a look" on flags, "General guidance" blocks with rule IDs, "Source: …" lines, the exact fit-check line last, `bg-sage/60` / `bg-champagne`, tokens only, `data-row-id` / `data-severity` / `data-sources` attributes. No icon, no image. Tests `tests/safety.ui.test.tsx` (jsdom, per-file docblock, `tests/helpers/dom.ts`): the card for TNZ-1056 / infants shows "Check this", both flagged rows with "Worth a look", the bracelet guidance with "SR-WEAR-BRACELET", the weight sentence with "6 g" and "1.51 g", "No certifications are stated on this product's page.", the three not-stated sentences, and the exact fit-check line; the card for TPN-1149 / infants shows "Good fit"; a no-band card shows "No recipient selected — age fit shown against all listed age groups"; no element text matches `/\b(un)?safe\b/i`; every row has a "Source:" line. *(REQ-SV-02, 07, 24 to 28)*
- [ ] **T4.2 Landing copy** per design §9: edit `app/page.tsx` (hero paragraph, step-3 body), `app/layout.tsx` (metadata `description`), `README.md` line 4; leave "Safety notes are fit checks, not certifications." unchanged. Add `tests/safety.copy.test.ts`: static scan of `app/**/*.tsx`, `components/**/*.tsx`, `lib/safety*.ts`, and `README.md` for `/\b(un)?safe\b/i` and `/prove it|proves it/i` (the only allowed match is none), and an assertion that the trust-strip sentence is still present. *(REQ-SV-29)*
- [ ] **T4.3 Evidence log** in `docs/kiro-evidence-log.md`: a session entry for this spec (files written, test counts, any counterexample), and the resolution of M2 OQ-2: "decided by the PRD §5 framing; landing copy aligned to 'fit check'; files and lines changed". Also record open questions Q1 to Q9 of design §10 for the Tue 24 Nov checkpoint. *(REQ-SV-29)*
- [ ] **T4.4 Hook matcher** (small, optional, `.kiro/hooks/matching-tests.json`): widen `matcher` from `lib/(matching(/[^/]+)?|safety)\.ts` to `lib/(matching(/[^/]+)?|safety(-[a-z]+)?)\.ts` so saves to `lib/safety-materials.ts`, `lib/safety-weight.ts`, and `lib/safety-rules.ts` also fire the safety tests. Record the change in the evidence log. Skip if the builder prefers not to touch hooks.

Check: common checks; `npm run lint` clean on the new files; dev-server check of the landing copy (kill the server afterwards, remove the log):
```
npm run dev -- --port 3113 > /tmp/dev-sv.log 2>&1 &   # note the PID, wait until "Ready"
curl -s http://localhost:3113/ | grep -c -i "or if it's safe\|prove it\|proves it"            # 0
curl -s http://localhost:3113/ | grep -c "plain-language fit check"                           # ≥ 1
curl -s http://localhost:3113/ | grep -c "Safety notes are fit checks, not certifications."   # 1
kill <PID>; rm /tmp/dev-sv.log
```
(`&rsquo;` in the page source renders as an apostrophe; grep for the words without the apostrophe if the first pattern misses.)

## Done when

`npm test` passes every safety test with the existing tests unchanged; the property tests V1 to V10 hold over the generated inputs and the 22 × 5 real cases; the pinned flag cases (TNZ-1056 for infants among them) and Good fit lists match; the card renders exactly the fit-check line and never the words "safe" or "unsafe"; the landing copy matches the fit-check framing; typecheck and lint are clean; no dev server, temp log, or `coverage/` directory remains; and open questions Q1 to Q9 of design §10 are in the evidence log for the builder.
