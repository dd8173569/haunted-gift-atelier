# Kiro evidence log — Haunted Gift Atelier (Kiroween 2026)

Honest record of what Kiro did vs what was done directly. This log is the raw
material for the Devpost Kiro write-up. Nothing here is embellished: if Kiro
did not do something, it says so.

## How Kiro is driven

Kiro CLI 3.5.0, signed in with Google as muktiyarahmed380@gmail.com
(OAuth portal flow, 21 Nov 2026 ~12:09 IST). An earlier Builder ID session
(device flow, ~12:00 IST the same day) was logged out and replaced at the
builder's request ("login kiro cli with google not with aws id"). Sessions
run non-interactively from the repo root:

```
kiro-cli chat --no-interactive --trust-all-tools "<prompt>"
```

`--no-interactive` selects the v2 engine unless `--trust-all-tools` is passed,
which selects v3. Prompts are stored in `/tmp/kiro-prompts/` on the build VM
(not in the repo). Default mode is used deliberately: spec mode was not tried
non-interactively in Milestone 1 (reliability over novelty; may be revisited
in later milestones).

Subscription / credits (corrected 21 Nov — see Notes): one Kiro
subscription works across IDE, CLI, Web, and Crew — a single credit pool
across surfaces. CLI sessions draw from the SAME monthly balance as the web
app: Pro plan, 411.37/695 credits used as of 12:22 IST 21 Nov (up from
398.16 at 12:02 — the 13.21 rise in 20 minutes while CLI sessions ran
under the Google login proves the CLI draws from the same Pro pool),
usage resets 1 Dec, 500 trial bonus credits untouched. The
`kiro-cli profile` command errors "only available for Pro users" because
it is Identity Center-specific ("idc user") — NOT because the CLI lacks
Pro. Balance watch: ~284 plan credits left + 500 bonus before the 1 Dec
reset (as of the 12:22 snapshot; later sessions draw further).

## Milestone 1 (21–23 Nov 2026)

### 2026-11-21 — Smoke test (Kiro)
- Prompt: create `hello-kiro.md` with one exact line in a scratch dir.
- Result: PASS. File created with the exact line, session exited 0 in ~14 s.
- Verdict: non-interactive Kiro CLI driving works. Scratch dir deleted after.

### 2026-11-21 — Session 1: specs, steering, hooks, agents (Kiro)
- Prompt: `/tmp/kiro-prompts/session1-specs.txt` — read the Phase 4 PRD +
  architecture + catalog.json, then write `.kiro/specs/catalog-data/` and
  `.kiro/specs/matching-core/` (requirements/design/tasks), steering files,
  hooks, agent definitions, MCP settings. Specs before code; no application
  code in this session.
- Status: INTERRUPTED. The session completed 1 of 19 files
  (`.kiro/specs/catalog-data/requirements.md`, 132 lines, EARS criteria
  REQ-CD-01–REQ-CD-26 — verified complete and correct) before it was stopped:
  the builder asked to switch the Kiro CLI login from Builder ID to Google
  sign-in, and the parent agent logged the CLI out mid-session. The session
  was killed cleanly (SIGTERM); no partial files were left. The remaining 18
  files will be written in a re-run session after the new login is confirmed.
  Session 1 counts as 1 Kiro session (interrupted, not failed) — the 132-line
  requirements file is genuine Kiro output under the Builder ID login.
- The price-centrality definition was PINNED DOWN before this session (by the
  human-side analysis, verified by hand against the catalog): +1 when the
  price lies within the interquartile range [P25, P75] of the in-stock prices
  in the recipient's budget band (linear-interpolation percentiles, inclusive
  bounds), computed at build time from `data/catalog.json`; skipped for
  no-limit; after relaxation, still computed against the ORIGINAL budget band.
  This reproduces golden case 1 exactly (under-2500 IQR ₹1,880.25–₹2,267.75:
  TBZ-1017 ₹2,099 gets +1 → 6; TBZ-1013 ₹2,324 and TNZ-1056 ₹1,674 do not →
  both 6). Kiro was asked to document this definition in the matching-core
  spec design.md — the definition itself is a human decision, recorded here
  so the write-up stays honest.

### 2026-11-21 — Login switch: Builder ID → Google (parent agent)
- The builder asked to switch the Kiro CLI login from AWS Builder ID to
  Google sign-in. The parent agent performed the logout/re-login. All
  `kiro-cli` work paused until the new login was confirmed via `whoami`.
- Outcome: re-login completed ~12:09 IST via the Google OAuth portal
  (the direct browser-redirect flow can't open a browser on the headless
  VM, so the sign-in URL was captured via a stub browser command and the
  builder completed it in his own browser; the localhost callback was
  relayed to the waiting CLI). `whoami` now shows "Logged in with
  Google", muktiyarahmed380@gmail.com. Session 1b runs under this login.

### 2026-11-21 — Repo skeleton (DIRECT, not Kiro)
- `git init`, MIT `LICENSE`, `.gitignore` (explicitly does NOT ignore `.kiro/`),
  `README.md` stub, `data/catalog.json` v1.0.0 (transformed from the extracted
  catalog: added `version`, `claims: []` per product, `image_file` reduced to
  the bare filename — see `data/catalog-changelog.md`), 22 exact photos copied
  to `public/catalog/`. All mechanical file operations, done directly.
- Next.js scaffold via `create-next-app` (vendor boilerplate: Next 16.4.6,
  React 19.3.0, Tailwind 4.3.3) into a temp dir, merged into the repo — also
  direct, not Kiro. One merge slip, fixed immediately: `package.json` was
  not copied in the first merge pass (the temp dir was deleted first); it
  was reconstructed from the known scaffold contents + the intact
  `package-lock.json`, renamed to `haunted-gift-atelier`, with test /
  typecheck / validate-catalog scripts added. Recorded here so no one
  mistakes scaffold boilerplate for Kiro-authored code.
- Design tokens (`app/globals.css`, Tailwind v4 `@theme`: pearl/blush/
  champagne/sage/gold/plum), landing shell (`app/page.tsx`, `app/layout.tsx`
  with Cormorant Garamond + Inter via `next/font`), component shell
  (`PriceFootnote`, `ProductPhoto`, `AtelierButton`), `/find` + `/atelier`
  route shells (honest "opens in Milestone 2/3" notes so no landing link
  404s), Vitest config, and GitHub Actions CI (lint + typecheck + test +
  catalog validation) — all DIRECT, not Kiro. Small deterministic files taken
  straight from architecture §7; Kiro sessions are reserved for the spec and
  implementation work where the write-up scores on genuine usage.
- Dev server verified 21 Nov: `npm run dev` serves `/` (HTTP 200, contains
  "Haunted Gift Atelier", "Tiny Tiaraa", "Find a gift"), `/find` (HTTP 200),
  `/atelier` (HTTP 200). `tsc --noEmit` and `eslint` both pass. One fix
  during verification: the scaffold's `LayoutProps<"/">` type needs Next.js
  generated types (`.next/types`), which don't exist before a first build —
  the root layout now uses plain `{ children: ReactNode }` so `tsc` passes
  on a clean checkout.
- Checkpoint commit `2035e64` (46 files) — scaffold + catalog + tokens +
  landing + the one Kiro-written spec file. Not pushed yet: the GitHub repo
  is created and pushed once Milestone 1 is complete (specs + matching core
  + tests green).

### 2026-11-21 — Session 1b: specs re-run (Kiro) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session1b-specs-rerun.txt`: verify the
  existing `catalog-data/requirements.md`, then write the remaining 18 files
  (catalog-data design + tasks, matching-core requirements/design/tasks,
  4 steering files, 2 hooks, 3 agents, MCP settings).
- Started after the Google login was confirmed via `whoami` ("Logged in
  with Google"). Exit 0 in ~7.5 min. Wrote 14 of the 18 files:
  catalog-data design.md (221 lines) + tasks.md (47), matching-core
  requirements.md (202) + design.md (278) + tasks.md (46), steering
  product.md (44) / tech.md (40) / structure.md (38) / catalog-rules.md
  (28), hooks catalog-validation.json (17) + matching-tests.json (17),
  agents gift-curator.md (41) / qa-auditor.md (41) / design-polish.md
  (40). `catalog-data/requirements.md` verified intact at 132 lines and
  untouched. Kiro recomputed golden cases 1–3 by hand with the locked
  IQR definition and confirmed they reproduce; the four band IQRs are
  pinned in matching-core design.md §5.
- NOT written: `.kiro/settings/mcp.json`. A permission rule (kiro-scope)
  blocked the write, and Kiro did not work around it with a shell write
  (one Write File failed, then one Run Command failed). Kiro's stated
  intended content: single `catalog` server, stdio, `command: "node"`,
  `args: ["packages/mcp-catalog/dist/index.js"]`, `autoApprove` on the
  four tools, `_comment` noting the server is scaffolded in M1. The
  empty `.kiro/settings/` directory was created directly (mechanical
  unblock only; no content authored). The mcp.json content decision
  (node+dist vs tsx-from-source) belongs to session 3, which builds the
  server; the file itself will be created directly if the kiro-scope
  rule blocks Kiro again, and recorded as direct work.
- Kiro's own caveats, recorded verbatim in spirit: the hook schema came
  from the Kiro docs (v1 JSON, PostFileSave, regex matcher, command
  action); the agent-file front matter was written from CONVENTION, not
  docs (the fetched docs covered hooks only) — check against the Kiro
  version before relying on it. Additions beyond the PRD: relaxed-budget
  / broadened-symbol / no-limit reason templates, a shortfall-note
  wording, a `SYMBOL_CHIP_TAGS` map, disclosing only ladder steps that
  added products, and a `docs/qa-reports/` folder. One Fetch URL failed
  mid-session (harmless). The matching-core design splits the
  implementation into `lib/matching.ts` (entry point) +
  `lib/matching/` pipeline stages (age/filters/scoring/rank/relax/
  explain/templates/types) — a refinement of the architecture's single
  `lib/matching.ts` sketch; the entry point and purity contract are
  unchanged. Kiro ran no tests and no validation in this session
  (specs only, as instructed).

### 2026-11-21 — Session 2a: catalog foundation (Kiro) — COMPLETED (then realigned)
- Prompt at `/tmp/kiro-prompts/session2a-catalog-foundation.txt`: implement
  `data/product-tags.ts`, `data/occasion-map.ts`, `lib/catalog.ts`,
  `scripts/validate-catalog.ts`, `tests/catalog.test.ts`. Exit 0 in
  ~1.5 min. All five files created (42 / 65 / 254 / 125 / 150 lines);
  `npm run validate-catalog`, `npm test` (21 tests), `npm run typecheck`,
  and `npm run lint` all passed.
- Divergence, found on review: the prompt was written BEFORE
  catalog-data design.md and tasks.md existed, and Kiro read only the
  first part of design.md (one tool output was truncated — it batched
  several long files into one shell cat). So the implementation followed
  the prompt, not the spec: `getCatalog()`/`getInStock()` with a static
  JSON import instead of pure `parseCatalog(raw)`; flat dimension
  fields instead of the `Dims` discriminated union; camelCase derived
  fields instead of the spec's snake_case; 0 parse warnings instead of
  the 2 the design pins (TNZ-1058 / TNZ-1056 width "-"); no property
  tests; a validator missing checks 13–15 (changelog, --base, orphan
  photos) and the spec's output format. The pinned VALUES were all
  correct (IQRs, weights, circumferences, tag map, occasion rules).
  Lesson recorded: prompts must be written AFTER the spec they
  implement, and Kiro must read spec files one at a time with the Read
  File tool. The code was NOT committed in this form — session 2a-fix
  realigned it to the spec (below), so the committed history contains
  only the aligned version. Both sessions are counted honestly here.

### 2026-11-21 — Session 2a-fix: align catalog foundation to spec (Kiro) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session2a-fix-align-to-spec.txt`: refactor
  the 2a output to catalog-data design.md + tasks.md waves T1.1–T4.1
  exactly. Exit 0 in ~5 min. All four checks green (verified
  independently by the parent afterwards): `npm run validate-catalog`
  prints `CATALOG OK: 22 products, version 1.0.0, 2 warning(s)` with
  exactly the 2 expected warnings (TNZ-1058 width, TNZ-1056 width);
  `npm test` 54 tests in 3 files, all passing; `npm run typecheck`
  and `npm run lint` clean. Files: lib/catalog.ts rewritten (350
  lines, `parseCatalog` / `ParsedCatalog` / `Dims` union /
  `band_quartiles`), data/product-tags.ts (51, `PRODUCT_TAGS` as the
  tag → SKU table plus `RELIGIOUS` set and `SYMBOL_CHIP_TAGS`),
  data/occasion-map.ts (65, `OCCASION_MAP` exported as the rule
  table), scripts/validate-catalog.ts rewritten (249, checks 1–15
  with the spec's stderr `FAIL [REQ-CD-xx]` format), tests/
  catalog.test.ts rewritten (203), tests/catalog.property.test.ts
  new (304, P-CD-1–P-CD-12, seed 20261121, 200 runs each), tests/
  validate-catalog.test.ts new (61) + tests/helpers/
  catalog-fixture.ts (51), .github/workflows/ci.yml (23, now
  fetch-depth 0 + `npm run validate-catalog -- --base origin/main`).
  `data/catalog.json` shows no git diff; no catalog fact changed.
- Disclosed departures from the spec (Kiro's own list, accepted):
  `parseCatalog(raw, tagTable = PRODUCT_TAGS)` takes an optional
  second argument (fixtures need it); a bracelet with an unreadable
  height returns `{kind:'item', height_mm:null}` + warning (the
  design is silent on that case; no real SKU hits it); an empty
  price band gets `{p25: NaN, p75: NaN, n: 0}` (no fake 0); a
  `CatalogBuildError` class carries the requirement number for the
  validator's FAIL codes; check 12 is skipped when checks 1–9 or 11
  already failed (avoids cascading errors); check 14 compares the
  whole file except `version` (so an `extracted` change also needs a
  bump — stricter than the design's "product content", defensible);
  the image check reads only the first 8 bytes (magic bytes need at
  most 4; cut the property suite from ~24s to ~5s); fixtures use
  the real 22 products with `image_file` renamed to `<SKU>.png`
  (hard links of real PNGs — the tag table needs all 22 SKUs).
- Property-test counterexample (counted below): P-CD-2 found
  `[1, 14.97]` — the midpoint 8.485 rounds to 8.49, which is
  0.005000000000000782 from the true midpoint, a hair over the
  test's 0.005 bound. The 2-decimal rounding is REQUIRED by design
  §3.3, so the implementation was not changed; Kiro added a `1e-9`
  float epsilon to the test's comparisons and kept the 0.005 bound.
  This is a floating-point representation artifact at the exact
  rounding boundary, not a logic bug. No other counterexamples.
- T4.2 hook outcome: the hook could NOT be observed from the CLI —
  it fires from the IDE on save. Kiro saved `data/catalog.json`
  unchanged, then with TPN-1149 changed to `bad`, and ran the
  hook's command by hand: it printed `FAIL [REQ-CD-01] bad sku:
  does not match ^[A-Z]{3}-\d{4}$` and `CATALOG VALIDATION FAILED:
  1 error(s)`. The file was restored byte-for-byte identical. So
  the hook's COMMAND works and fails visibly; only the automatic
  firing on save is unverified and needs an IDE check.
- Check 14 manual verification: changing TPN-1149's price
  (18299 → 18300) without a version bump made `npm run
  validate-catalog -- --base HEAD` fail with `FAIL [REQ-CD-23]
  catalog version: content changed since HEAD but version is still
  1.0.0`; after revert, the same command passed.

### 2026-11-21 — Session 2b: matching core (Kiro) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session2b-matching-core.txt`: implement
  matching-core tasks.md waves 1–5 (T5.2 is session 3's scope). Exit
  0 in ~8 min. All four checks green (verified independently by the
  parent afterwards): `npm run validate-catalog`, `npm test` (11
  files, 225 tests, all passing), `npm run typecheck`, `npm run
  lint`. Files: lib/matching.ts (101 lines, the `match()` entry
  point) + lib/matching/ types.ts (103), age.ts (21), filters.ts
  (89), scoring.ts (47), templates.ts (197), rank.ts (46),
  relax.ts (98), explain.ts (93); tests matching.age (34),
  matching.filters (87), matching.scoring (104), matching.templates
  (130), matching.test (262, incl. the grep-based purity test),
  matching.golden (162), matching.property (304), matching.personas
  (109), helpers/matching-fixtures.ts (61). package.json +
  package-lock.json modified ONLY to add `@vitest/coverage-v8`
  ^5.1.1 as a devDependency (allowed for T5.3); npm also dropped
  the file's missing trailing newline. `RELIGIOUS`,
  `SYMBOL_CHIP_TAGS`, and `OCCASION_MAP` were already exported
  correctly, so nothing was added to `data/`. lib/catalog.ts was
  not modified.
- Golden cases: all three reproduce EXACTLY — SKU order, scores,
  breakdowns, markers, disclosures, shortfall note, and the
  TPN-1141 marker sentence. Quartiles and the 6/5/5/5 band depth
  pinned too (23 golden tests).
- Property runs: I1–I7 and P-MC-8–P-MC-15, each 600 runs (above
  the ≥ 500 requirement), seed 20261121; I5 uses an independent
  reference filter in the test.
- Property-test counterexample (counted below — the session's one
  real find): the first run broke BOTH I3 and I4. Model: infants /
  naming / under-2500 / gold / set / religious `['om']`. The
  ladder's `widenAbove` and `broadenSymbol` steps added nothing on
  their own; only the later `dropCategory` step brought in
  products, and only that step was disclosed — but the picks
  carried `budget-above` and `symbol-broadened` markers with no
  matching disclosure. Root cause: a step can add nothing to the
  eligible set at its turn (a later constraint still blocks
  everything) yet still be NECESSARY for the final picks. Fix
  (Kiro, in the implementation): `finalDisclosures()` in
  relax.ts, called from `match()` — a step that added nothing is
  now disclosed when a final pick carries its marker. The golden
  cases are unchanged by the fix. Regression test added in
  tests/matching.personas.test.ts ("discloses an earlier no-op
  step when a final pick relies on it"). The design §3 rule
  "disclose only steps that added products" needs this refinement
  recorded — a spec-update session follows (below).
- Coverage (T5.3, v8 over lib/): lib/matching.ts 100% lines,
  lib/matching/* 100% lines, lib/catalog.ts 92.7% lines — above
  the ≥ 80% requirement. Uncovered branches in matching:
  explain.ts lines 60–67, templates.ts lines 98, 130, 157
  (fallback labels). Uncovered catalog.ts lines: 246–251,
  298–301, 307. No coverage threshold or script was added (to
  avoid touching config); the coverage run left no `coverage/`
  directory behind.
- T5.1 hook outcome: the IDE firing could not be observed from
  the CLI (same as T4.2). The hook command was run as written
  outside the IDE: it passes when green, and the missing
  `tests/safety` does NOT break it (vitest filters by pattern
  and ran 8 matching files). With a deliberately broken golden
  test (TBZ-1013 score changed to 99) it failed with exit 1 and
  printed "MATCHING/SAFETY TESTS FAILED…"; the change was
  reverted and the revert confirmed. A real save-triggered
  firing in the IDE remains the open item.
- Persona surprises — FOUR SPEC QUESTIONS for the parent/builder
  (pinned as current behaviour; the code follows the rules as
  written, the questions are about the rules themselves):
  1. Persona 2: the PRD says gold pendants "Om/Sikh/Trishul" in
     the ₹15–25k band, but Trishul (TPN-1143, ₹14,399) sits
     below that band. Picks are TPN-1147, TPN-1149, and the
     TPN-1206 set (scores 6, 6, 4). Should the PRD wording
     change?
  2. Persona 3: the third pick is TBZ-1013, a Third Eye tabeez
     scoring 1 — allowed because `symbols = any` counts as
     explicit opt-in under REQ-MC-11. The PRD expects
     "nazariya/bangles". Should "any" avoid religious pieces
     unless they are requested?
  3. Persona 6: picks are TPN-1199, TPN-1206 (`budget-below`),
     and TOB-1009 (`category-dropped`). Only 2 sets exist, so
     a bangle fills the third slot with disclosure. This
     matches the ladder, but the PRD says only "sets".
  4. Persona 8: with no occasion, metal, or budget signals,
     only rating separates the pieces. Picks are TPN-1199,
     TPN-1206, and THP-1001, all scoring 1. THP-1001 is a
     ₹26,649 diamond hoop listed for kids in the catalog.
     Correct per the rules but looks thin.
  These four are NOT resolved in Milestone 1 — they need the
  builder's call before any behaviour or PRD change.

### 2026-11-21 — Session 2b-spec-update: record the disclosure refinement (Kiro) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session2b-spec-update.txt`: document
  the `finalDisclosures()` refinement in matching-core design.md §3
  and REQ-MC-24 — docs only. Exit 0 in ~1 min. design.md §3 now
  describes the two-pass rule (pass (a) during the ladder, pass
  (b) `finalDisclosures()` after ranking, disclosures in ladder
  order) with the counterexample as rationale and the note that
  golden case 3 is unchanged; REQ-MC-24 now SHALLs disclosure for
  each step that added a product AND each step whose marker
  appears on a final pick even if it added nothing when it ran,
  and SHALL NOT disclose a step that affected neither. The
  parent verified the spec text against the implementation
  (`relax.ts` rebuilds the final list from the disclosed set
  plus the used-steps set — no duplication). `npm test` (225)
  and typecheck stayed green; no code or test file changed.

### 2026-11-21 — Session 3: MCP server (Kiro) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session3-mcp-server.txt`: scaffold
  `packages/mcp-catalog` with the four tools over the real
  catalog, stdio transport, run from source via tsx. Exit 0 in
  ~3 min. `npm run typecheck`, `npm run lint`, and `npm test`
  (225) all pass (verified independently by the parent
  afterwards). Files: packages/mcp-catalog/src/index.ts (171
  lines), package.json (13, `@modelcontextprotocol/sdk` pinned
  EXACT at 1.32.2 — no other dependency added; zod 4.6.7 is the
  SDK's required peer, resolved into the existing tree),
  tsconfig.json (13); root package.json gained `workspaces:
  ["packages/*"]`; package-lock.json updated by the install.
  The server loads the repo-root catalog once at startup via
  `parseCatalog`, passes it to `match()` for `matching_explain`,
  and calls the imported `validateCatalog()` for
  `catalog_validate`. `catalog_search` reuses the real filter
  logic (`just-because` as the neutral occasion; no ageBand →
  all bands; no availability → In Stock only; Out of Stock
  reuses the filter with availability neutralised; category
  case-insensitive).
- Deviations (Kiro's own list, accepted): repo-root imports are
  `../../../lib/...` (the prompt said `../../`, wrong for files
  under `src/`); the SDK README points to `docs/server.md`,
  which is not shipped, so the API (`registerTool`,
  `StdioServerTransport`) was taken from the installed `.d.ts`
  files; the server tsconfig uses `module: esnext` +
  `moduleResolution: bundler` instead of NodeNext because under
  NodeNext `scripts/validate-catalog.ts` fails TS1470
  (`import.meta` in a file under the CommonJS root package) —
  the root tsconfig and `lib/` were not touched; the first
  `npm install -w` only linked the workspace, a second run
  added the SDK.
- Smoke test (Kiro, transcript at
  `/tmp/kiro-prompts/session3-mcp-smoke.log`, run from `/tmp`
  to prove cwd-independence): startup prints `mcp-catalog
  ready: catalog v1.0.0, 22 products` on stderr; `tools/list`
  names all four tools; `catalog_get` TNZ-1056 returns the Blue
  Evil Eye bracelet; `catalog_search` infants/under-2500/silver
  returns the 6 in-stock pieces (the golden-case-1 eligible
  set); `catalog_validate` returns ok true, 0 errors, 2
  warnings; `matching_explain` golden case 1 returns TBZ-1013
  (6), TNZ-1056 (6), TBZ-1017 (6) with an empty ladder trace;
  `catalog_get` NOPE-0000 returns isError "SKU not found:
  NOPE-0000"; `catalog_search` availability Out of Stock
  returns only TNZ-1058. The parent re-ran an independent
  smoke test (initialize + tools/list + matching_explain GC1 +
  catalog_validate, from `/tmp`) and confirmed the same
  results. No Kiro MCP client session has called the server
  yet — the smoke tests used piped JSON-RPC directly, so the
  counts table still shows 0 MCP server calls (see below).
- `.kiro/settings/mcp.json` — created DIRECTLY by the parent
  (not Kiro): kiro-scope blocks Kiro from writing that path
  (proven in session 1b, and session 3 was instructed not to
  try). The content is exactly the JSON session 3 printed in
  its summary: `npx tsx packages/mcp-catalog/src/index.ts`
  with the absolute repo-root cwd, `autoApprove` on the four
  tools, and the tsx `_comment`. The run command was verified
  working from `/tmp` with absolute paths; the `cwd` field
  itself has not been exercised through an MCP client yet.

## Counts (running totals)

| Metric | Count |
|---|---|
| Kiro sessions (non-interactive CLI) | 8 (smoke test + session 1 + 1b + 2a + 2a-fix + 2b + 2b-spec-update + session 3) |
| Kiro sessions completed successfully | 7 (smoke test, 1b, 2a, 2a-fix, 2b, 2b-spec-update, session 3; session 1 interrupted) |
| MCP server calls | 0 via a Kiro MCP client (server scaffolded in M1 by session 3 and smoke-tested via piped JSON-RPC — initialize, tools/list, and all four tools verified; first live client calls in M2) |
| Hook firings observed | 0 (hooks defined in M1; CLI firing unverified — T4.2 and T5.1 attempts could not observe firing from the CLI; both hooks' commands were verified to fail visibly by hand) |
| Property-test counterexamples found | 2 (P-CD-2 [1, 14.97]: float epsilon, implementation unchanged per design §3.3; I3/I4 ladder-disclosure gap: fixed with finalDisclosures(), spec update follows) |

## Notes

- CORRECTION (21 Nov): an earlier draft of this log said the CLI runs on
  the free tier — that was WRONG and has been removed. Verified from Kiro's
  own pricing page (via multiple sources): one subscription works across
  IDE, CLI, Web, and Crew — "one pool across surfaces". The CLI draws from
  the SAME monthly credit balance as the web app (Pro, 398.16/695 used,
  resets 1 Dec, 500 trial bonus untouched). The `kiro-cli profile` error
  ("only available for Pro users") is because that command is Identity
  Center-specific, not because the CLI lacks Pro. Balance watch: ~297 plan
  credits left + 500 bonus before the 1 Dec reset. If a credit limit is
  hit, it will be recorded here and flagged to the builder — no workarounds.
- Hooks are defined as Kiro hooks v1 JSON. Whether they fire in the CLI (vs
  the IDE) is UNVERIFIED in M1; the write-up will say so if they never fire.
- Kiro cannot write `.kiro/settings/mcp.json` itself: the kiro-scope
  permission rule blocks it (observed in session 1b). That file will be
  created directly when session 3 defines the server's run command, and
  recorded as direct work — it is wiring, not Kiro-authored content.
- STANDING BUILD PRINCIPLE (builder's direct instruction, 21 Nov ~12:25
  IST): "build the best, don't worry about credits." Do NOT economize
  on Kiro sessions to save credits — run the full spec-driven flow
  properly (specs, design, tasks, steering, hooks, agents, MCP),
  thorough golden + property + persona tests, and fix issues properly
  rather than cutting corners. Quality first. Balance is fine anyway
  (~284 plan credits left + 500 bonus untouched at the 12:22 snapshot,
  reset 1 Dec).
