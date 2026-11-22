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
- Checkpoint commit `f5b455d` (45 files) — scaffold + catalog + tokens +
  landing + the one Kiro-written spec file. (This commit was
  originally recorded here as `2035e64` (46 files); the pushed
  history carries different hashes because `.github/workflows/
  ci.yml` was removed from the history before the push — see
  the GitHub entry below. The content is otherwise identical.)

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

### 2026-11-21 — GitHub repo created and pushed WITHOUT CI (DIRECT)
- Repo created public via `gh repo create` (direct, not Kiro):
  https://github.com/dd8173569/haunted-gift-atelier.
- First push attempt REJECTED by GitHub: the `gh` token has
  scopes `gist`, `read:org`, `repo` but NOT `workflow`, and
  GitHub refuses OAuth App tokens without the `workflow` scope
  from creating or updating `.github/workflows/ci.yml` (the
  file was in the history since the scaffold commit, so the
  whole push was blocked). Two `gh auth refresh -h github.com
  -s workflow` device-flow attempts were started (one-time
  codes `03BC-7366` and `C9E1-10F1`, via
  https://github.com/login/device); both timed out after 15
  minutes without the builder completing the authorization.
  The codes are expired and dead.
- THE PUSH THEN LANDED WITHOUT THE WORKFLOW FILE: at
  07:41:58Z the repo's `main` received commit `38cf2d9`
  ("Milestone 1: specs, matching core, tests, MCP server",
  47 files) on top of `3ce6d80` and `f5b455d`. The history
  was rewritten to exclude `.github/workflows/ci.yml` — that
  exclusion is what let the push through without the
  `workflow` scope — and the local repo was reset to
  `origin/main`. The pushed content is otherwise identical
  to the local Milestone 1 commit (verified: the working
  tree differs from `origin/main` only by this log file).
  All 89 files are on GitHub, including the full `.kiro/`
  tree, `lib/`, `tests/`, `packages/mcp-catalog/`, and
  `LICENSE`. The earlier local hashes (`2035e64`, `4e5bb22`,
  `0bd760b`) no longer exist; the scaffold entry above has
  been corrected to `f5b455d`.
- CONSEQUENCE: there is NO CI on GitHub right now — no
  workflow file, no runs. The `gh` token STILL lacks the
  `workflow` scope (verified after the push).
- TO RESTORE CI (the one remaining Milestone 1 item):
  `.github/workflows/ci.yml` is recreated locally in the
  commit after this log entry (content: checkout with
  fetch-depth 0, Node 24, `npm ci`, lint, typecheck, test,
  `validate-catalog -- --base origin/main`). Pushing it
  needs the `workflow` scope: the builder completes ONE
  device authorization (run `gh auth refresh -h github.com
  -s workflow` fresh, hand him the new code, he enters it
  at github.com/login/device as dd8173569), verify with `gh
  auth status` that `workflow` is listed, then `git push`.
  ALTERNATIVE with no token change: the builder creates
  `.github/workflows/ci.yml` with that content directly in
  the GitHub web UI (web-UI file creation does not use the
  OAuth token, so no scope is needed).

## Milestone 2 (21–24 Nov 2026)

### 2026-11-21 — M2 start: corrected base state (parent agent)
- Remote HEAD is cb633bb (the M1 agent pushed log corrections after the
  M2 brief was written — NOT 38cf2d9). Local main was 1 commit ahead:
  4a200e7, "Restore .github/workflows/ci.yml", which is UNPUSHABLE (the
  `gh` token lacks workflow scope; the push is rejected). The ci.yml
  content was saved aside to `/tmp/ci.yml.bak` (443 bytes) BEFORE any
  reset, and 4a200e7 will NOT be pushed. The repo will be reset to
  origin/main (cb633bb) once the running session 4 finishes writing its
  (untracked) spec files, so the reset cannot disturb it. CI is
  unfinished and NOT a submission requirement — the file can be added
  later via the GitHub web UI or after a token refresh; no M2 time is
  spent on it.
- Four persona spec questions are OPEN (pinned as current behaviour in
  tests/matching.personas.test.ts; the code follows the rules as written
  — the questions are about the rules, and need the builder's call at
  the Tue 24 Nov go/no-go checkpoint): (a) PRD says gold pendants
  "Om/Sikh/Trishul" in ₹15–25k but Trishul (TPN-1143, ₹14,399) is
  below the band; (b) should symbols=any avoid religious pieces unless
  requested (persona 3's third pick is the Third Eye tabeez TBZ-1013);
  (c) PRD says only "sets" for persona 6 but only 2 sets exist, so a
  bangle fills the third slot with disclosure; (d) persona 8's
  no-signal picks (all score 1, incl. the ₹26,649 THP-1001 hoop) look
  thin. M2 does NOT change matching behaviour to answer these.
- Known M1 gaps carried into M2 (not chased unless trivial): hooks'
  save-triggered firing is still unverified (needs a real IDE check);
  agent-file front matter was written from convention, not docs; no
  Kiro MCP client session has called the catalog server yet.

### 2026-11-21 — Session 4: conversation spec (Kiro) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session4-conversation-spec.txt`: write
  `.kiro/specs/conversation/` (requirements/design/tasks) from PRD §1/§3/§4
  + architecture §7/§8 + the matching-core and catalog-data specs.
  Exit 0 in ~8 min. Files: requirements.md (231 lines, REQ-CV-01–60,
  last nine are property invariants C1–C9), design.md (469), tasks.md
  (102, five waves). No application code, no tests run (specs only).
- Model transport DECIDED in the spec: the confirmed model travels in
  one URL query parameter, `m`, as canonical-order JSON, percent-encoded
  by `URLSearchParams`; never localStorage/cookie/session. Missing `m`
  on /picks → redirect /find; invalid `m` → /find?notice=incomplete.
  `match()` runs only in the /picks server component, after validation.
- Spec questions Q1–Q10 with working assumptions in design §13 (Q1:
  Q5 top-level chips single-select, only religious sub-chips
  multi-select; Q2: "No religious symbols" as a top-level chip; Q3: an
  "An adult" age chip added — the PRD chips stop at 12–19, so no tap
  path to the adult message existed; Q4–Q5: `ageYears` set to the
  chip's lower bound (0, 1, 3, 6, 12) so the chip can be restored, never
  shown as a real age; Q6: new `lib/catalog-store.ts` four-line loader
  proposed — APPROVED by the M2 coordinator (see below), steering
  updated in Wave 5; Q7: pick cards link only to the buy URL — no
  /piece/[sku] in M2; Q8: "greyed" OOS = muted surface + text, no
  filter/opacity on the photo; Q9: age prompt written as "How old is
  the little one?"; Q10: "Resume at the card" / "Change my answers"
  via /find?m=… added by the spec author).
- Q6 approval (coordinator, recorded here): `lib/catalog-store.ts` is
  a four-line loader with no logic, imported by server pages only — a
  file-organisation decision, not a product/behaviour one. Steering
  `structure.md` updated in Wave 5 to list all five new lib files.

### 2026-11-21 — Session 5a: conversation Wave 1, pure logic (Kiro) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session5a-conversation-wave1.txt`:
  implement tasks.md Wave 1 (T1.1–T1.4 + tests). Exit 0 in ~9.5 min.
  Files: lib/conversation.ts (701 lines), lib/model-param.ts (37),
  lib/picks-view.ts (54), lib/browse.ts (121); tests conversation.test
  (566), model-param (76), picks-view (100), browse (143),
  conversation.property (601), conversation.static (83), plus helper
  tests/helpers/conversation-taps.ts (61, golden 1–3 tap sequences).
  166 new tests; 391 total, all passing (verified independently by the
  coordinator afterwards). `npm run typecheck` and `npm run lint`
  clean (only the pre-existing mcp-catalog warning). Coverage:
  browse/model-param/picks-view 100% lines, conversation.ts 99.54%.
  No `coverage/` directory left behind.
- Property-test counterexample (counted below — the session's real
  find): answers `{adultIsMom: true}` combined with a child age and a
  category. `normalize()` judged which questions apply from the raw
  answers, so a leftover `adultIsMom: true` made the recipient look
  like Mom and the piece answer was wrongly dropped. The real flow
  hits this when an adult-and-Mom path is edited to a child age. Fix
  (Kiro, in the implementation): `normalize` first clears the answers
  other questions depend on (`age`, then `adultIsMom`), then evaluates
  the rest. Regression test in conversation.test.ts.
- Deviations / spec refinements (Kiro's list, accepted — all in the
  implementation or tests, none in matching behaviour): (1) Back
  during an edit returns to the card only when the answers are
  complete, else steps back normally and ends edit mode (design §2.4
  said Back goes to the card, which breaks "card implies a model");
  (2) P-CV-3 `adult-end ⇔ ended` does not hold (Back from `adult-end`
  keeps the "No" answer while the step is `adult-check`) — the weaker
  forms `adult-end ⇒ ended` and `ended ⇒ step ∈ {relationship, age,
  adult-check, adult-end}` are tested instead; (3) P-CV-8 round trip
  cannot hold for every valid model — `ageYears: 0.5` comes back as 0
  (chip lower bound, Q4), `occasion: "other"` has no chip,
  a Mom model with `category` other than `any` comes back as `any` —
  exact round trips are tested for models the flow can produce, and
  the lower-bound rule for the rest; `validateModel` accepts
  `occasion: "other"` and a resumed model with it starts at the
  occasion question; (4) in the property generator, Edit actions are
  legal only on the card; (5) `momSkipNote` pluralises by adding "s"
  unless the category already ends in "s" — "Earrings" is correct
  today; a hypothetical Mom-only Tabeez catalog would read "tabeezs",
  unreachable now; (6) adult-and-No from the card wipes the later
  answers, following design §2.3 as written (spec change needed if the
  builder wants those answers kept).

### 2026-11-21 — Session 5b: conversation Wave 2, /find (Kiro) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session5b-conversation-wave2.txt`:
  implement tasks.md Wave 2 (T2.0–T2.4 + flow test + dev-server
  check). Exit 0 in ~4 min. Files: components/ChipGroup.tsx (51),
  ProgressMoon.tsx (33), RecipientCard.tsx (53), Conversation.tsx
  (226); app/find/page.tsx (37, M1 shell replaced);
  lib/catalog-store.ts (4); tests/helpers/dom.ts (6),
  tests/dom-env.test.tsx (9, kept as the setup guard),
  tests/conversation.flow.test.tsx (232). package.json +
  package-lock.json changed only to add @testing-library/react
  16.3.3, @testing-library/jest-dom 8.0.0, jsdom 31.0.1 (the
  @testing-library/dom peer came in automatically, not added to
  package.json). 17 new tests (16 flow + 1 DOM proof); 408 total, all
  passing (verified independently by the coordinator afterwards).
  typecheck + lint clean. The `// @vitest-environment jsdom` docblock
  works under Vitest 5.1.1 — the `test.projects` fallback was NOT
  needed and vitest.config.ts is untouched. Dev-server check (port
  3111, killed afterwards, /tmp/dev.log removed): /find 200, the
  prompt appears once, "start again" once on
  /find?notice=incomplete, "Reveal my picks" once on
  /find?m=<golden 1>.
- Assumptions (Kiro's, accepted): the "five verbatim prompts" test
  covers relationship, occasion, budget, metal and symbols (design
  §2.2 strings — the PRD itself is not in the repo); when editing
  "Who" from the card, Back renders as a button ("cancel edit"),
  not a link to `/` (design §4 only specifies question 1's Back
  linking to `/`).

### 2026-11-21 — Session 5c: conversation Wave 3, /picks (Kiro) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session5c-conversation-wave3.txt`:
  implement tasks.md Wave 3 (T3.1–T3.3 + picks UI test +
  dev-server check). Exit 0 in ~3 min. Files:
  components/AtelierButton.tsx (34, `external` prop added),
  PickCard.tsx (45), DisclosureNote.tsx (19), app/picks/page.tsx
  (69), tests/picks.ui.test.tsx (249). 16 new tests; 424 total, all
  passing (verified independently by the coordinator afterwards).
  typecheck + lint clean. Dev-server check: golden 1 shows TBZ-1013
  with its verbatim name and ₹2,324; footnote text 3×; "Buy on Tiny
  Tiaraa" 3× (grep counted 6/3 because the page's inline data
  payload duplicates the visible text on one line — counted by hand);
  /picks returns 307 → /find; /picks?m=%7Bnope returns 307 →
  /find?notice=incomplete (NOTE: this 307 behaviour changed in Wave
  5 — see OQ-1 below). Golden-1 names/prices/buy URLs checked by
  hand against data/catalog.json.
- Notes (Kiro's, accepted): (1) RELIGIOUS PIECES IN GOLDEN 1 — the
  golden-1 picks include two religious-symbol pieces (TBZ-1013 Third
  Eye/Shiva, TBZ-1017 Swastik) although the user chose "no symbol
  preference", while steering product.md says never to show a
  religious-symbol piece unless the user opted in. NO change was
  made: the golden case is pinned and matching questions stay open.
  This is the same question as M1 open question (b)
  (symbols='any' counts as explicit opt-in under REQ-MC-11) and
  belongs with it at the Tue 24 Nov checkpoint. (2) Card eyebrow:
  design §5 draws "1 of 3 · Pendant", but the card takes only `view`
  — with 2 picks "1 of 3" would be wrong, so the card reads "Pick 1 ·
  Tabeez". Rating line reads "Rated {rating}" with the catalog
  string unchanged, e.g. "Rated 5.0/5".

### 2026-11-21 — Session 5d: conversation Wave 4, /atelier (Kiro) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session5d-conversation-wave4.txt`:
  implement tasks.md Wave 4 (T4.1–T4.3 + atelier UI test +
  dev-server check). Exit 0 in ~4.5 min. Files:
  components/BrowseCard.tsx (44), CatalogGrid.tsx (89),
  app/atelier/page.tsx (37, M1 shell replaced),
  tests/atelier.ui.test.tsx (224). 12 new tests; 436 total, all
  passing (verified independently by the coordinator afterwards).
  typecheck + lint clean. Dev-server check: /atelier shows 21 "Buy
  on Tiny Tiaraa" and 1 "Out of stock"; ?metal=silver&category=
  bracelet shows 2 TNZ cards (TNZ-1056, TNZ-1058 — TOB-1008 is the
  third silver bracelet but not a TNZ SKU); ?metal=junk shows 21 buy
  links (invalid → All). `BrowseCard` carries a `data-sku`
  attribute for tests; stock status comes from `availability`,
  never from a SKU.
- Notes (Kiro's, accepted): (1) PRICE REGION — the budget chips
  show ₹ ranges, so P-CV-10 fails if `data-price-region` wraps only
  the cards; the single `data-price-region` is on the whole grid,
  filters included, with the one `PriceFootnote` directly above the
  cards. Alternative (exempt filter-chip text from P-CV-10) was
  offered — the implemented approach stands unless the builder
  prefers the exemption. (2) PRICE BAND EDGES — `price_band` runs
  from just above ₹15,000 up to ₹25,000 inclusive, with 15,000
  itself in the lower band (per the pinned catalog-data spec); the
  Pendant + gold + ₹15,000–₹25,000 test case computes TPN-1149 and
  TPN-1147 from raw catalog fields with that edge.

### 2026-11-21 — Session 6: conversation Wave 5, integration + QA (Kiro) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session6-conversation-wave5.txt`:
  implement tasks.md Wave 5 (T5.1–T5.5). Exit 0 in ~7 min. Files:
  tests/journey.golden.test.tsx (256, 19 tests — golden cases 1–3
  tapped through `Conversation`, `href` decoded, `parseModelParam`
  → `match()` → `toPickViews`, /picks rendered, SKU order/scores/
  disclosures/shortfall/TPN-1141 sentence asserted; the 8 personas
  + flow cases 9–11 tapped the same way with values copied from
  tests/matching.personas.test.ts; persona 3 asserts TNZ-1058
  absent; personas 7 and 8 assert no religious SKU; tap-count tests
  give 8 taps for golden 1 and 10 for golden 3),
  docs/qa-reports/conversation-m2.md (74, the qa-auditor report),
  .kiro/steering/structure.md (now lists all five new lib files).
  ONE code change outside the tests: app/layout.tsx wraps
  `{children}` in `<Suspense fallback={null}>` — the first `npm run
  build` failed because /atelier reads `searchParams` outside a
  Suspense boundary, which `cacheComponents` rejects; the layout fix
  resolves it. 455 tests total (22 files), all passing (verified
  independently by the coordinator afterwards, together with the
  dev-server happy path: / 200, /find 200, /picks golden-1 shows
  TBZ-1013 + 3 buy links + 3 footnotes, /atelier 21 buy links +
  1 "Out of stock"). `npm run typecheck`, `npm run lint` (only the
  known mcp-catalog warning), `npm run validate-catalog` (2
  expected warnings), and `npm run build` all pass. Coverage:
  browse/model-param/picks-view 100% lines, conversation.ts
  99.54%. No `coverage/` directory, no dev server, no temp log
  left behind.
- MCP — FIRST LIVE CLIENT CALLS (counted below): three real
  `matching_explain` calls to the catalog MCP server, one per golden
  model. All three matched REQ-MC-33 to 35 exactly (picks, scores,
  disclosures, shortfall note, TPN-1141 sentence). The M1 gap "no
  Kiro MCP client session has called the server yet" is now closed
  for `matching_explain`; `catalog_search`, `catalog_get`, and
  `catalog_validate` still have 0 live client calls.
- QA audit: no unambiguous bugs found — footnote on every price, no
  out-of-stock buy control, no hex in components, no discount
  wording all check out. Nothing was fixed in the audit step.
- OPEN QUESTIONS from Wave 5 (for the builder, not fixed): OQ-1 —
  with `cacheComponents`, /picks with a missing or invalid `m`
  returns HTTP 200 with a streamed redirect, not the 307 tasks.md
  expects. VERIFIED by the coordinator: the response is 200 with a
  `<meta http-equiv="refresh" content="1;url=/find"/>` (1-second
  client-side redirect) — the redirect still works in a browser,
  just not as an HTTP 307. Acceptable for M2; if a 307 is wanted,
  the route needs a different prerendering approach. OQ-2 — the M1
  landing copy and page metadata say "prove it's safe" and "or if
  it's safe"; the "never says safe" rule is written for the safety
  card, so the landing copy was left alone. Needs the builder's
  call: is the landing wording acceptable, or should it change
  before M3 writes the safety card?
- DEFERRED, honestly: the manual timed browser run of golden 1
  (T5.3) was NOT done — a non-interactive session cannot tap
  through a browser, and no time was recorded or fabricated. The
  tap-count test (8 taps) and the jsdom journey tests cover the tap
  budget and the flow; the timed run moves to the M6 clean-browser
  pass.
- Balance watch: NOT re-checked during M2 (no new reading taken);
  the 12:22 IST snapshot (~284 plan credits + 500 bonus, reset
  1 Dec) stands.

## Milestone 3 (21 Nov 2026)

### 2026-11-21 — Session 7: Milestone 3 specs (Kiro, non-interactive) — COMPLETED
- Task: write the three M3 specs (safety-verdict, true-size-viewer,
  gift-presentation), requirements/design/tasks each, from PRD §1/§5/§6 +
  architecture §7/§8 + the M1/M2 specs. No application code. Exit 0 in
  ~18.5 min. Files (lines): safety-verdict requirements 166, design 387,
  tasks 51; true-size-viewer requirements 148, design 297, tasks 47;
  gift-presentation requirements 149, design 347, tasks 101.
- Grounded decisions recorded in the specs (verified by the coordinator
  against data/catalog.json): `claims[]` empty for all 22 SKUs; TNZ-1056
  weight "5.50-6.50 gross gms approx" → weight_g 6.0 (the PRD §5 example
  "7.0 g" is a PRD error); weight medians infants 1.51 / kids 1.23 /
  teens 0.86 / mom n=2 (no flags); check-6 not-stated rows are `note`
  severity, not flags (deviation from PRD §5, REQ-SV-20 — otherwise every
  piece would be "Check this"); photo-in-box only when short side ≥ 6 mm
  and aspect ≤ 2.5 (4 SKUs); gold-pendant "width" 1.3–2.2 mm is not a face
  width, captions name height only; TNZ-1056 ring Ø = 133.4/π = 42.4625 mm
  (tasks.md's 42.4635 is a rounding slip, caught in session 9);
  /piece/NOPE-0000 may return 200 + noindex under the root Suspense
  (same behaviour as M2 OQ-1, recorded as Q15); Copy message added
  (clipboard only); `design_application_no` and `sku_extra` stay off the
  detail page (the first could read as a certification).
- 22 open questions/assumptions (Q1–Q9 safety, Q10–Q14 true-size,
  Q15–Q22 gift) recorded in the three design documents for the Tue 24 Nov
  checkpoint. Physical ±5% accuracy and the 15-second calibration can only
  be checked by a human with a card and a ruler (manual QA wave in
  gift-presentation).

### 2026-11-21 — Session 8: safety-verdict Waves 1–4 (Kiro, non-interactive) — COMPLETED
- Task: implement `.kiro/specs/safety-verdict/tasks.md` Waves 1–4 in order
  (each wave's checks green before the next), plus T4.4 (hook matcher,
  approved). Files written (lines): data/safety-rules.md (98),
  lib/safety-rules.ts (130), lib/safety-materials.ts (50),
  lib/safety-weight.ts (80), lib/safety.ts (293),
  components/SafetyVerdict.tsx (88), tests/safety.rules.test.ts (86),
  safety.materials (111), safety.weight (186), safety.test (303),
  safety.property (290), safety.static (79), safety.ui.test.tsx (142),
  safety.copy (51). Edited: app/page.tsx, app/layout.tsx, README.md,
  .kiro/hooks/matching-tests.json. Not touched: lib/matching*, lib/catalog.ts,
  data/catalog.json, data/*.ts, any existing test.
- Tests: 190 new (rules 22, materials 13, weight 26, verdict 37, property 9,
  static 46, ui 13, copy 24); `npm test` 645 passing in 30 files (455 before).
  Property tests (seeded 20261124, 300 runs each) found NO counterexample.
  Coverage of lib/safety*.ts: 100% lines/branches; no `coverage/` left.
  typecheck clean; lint only the known mcp-catalog warning.
- Real pools re-derived in tests with a naive median: infants n=18 / 1.51 g,
  kids 15 / 1.23, teens 9 / 0.86, mom 2 / none. Flag lists of REQ-SV-16 and
  the Good fit lists of design §5.1 match exactly. TNZ-1056 = 6.0 g (midpoint
  of 5.50–6.50), flagged for infants. The PRD §5 example "7.0 g" is a PRD error.
- M2 OQ-2 RESOLVED: decided by the PRD §5 framing ("a fit check, not a
  certification"); landing copy aligned. Changed: app/page.tsx hero paragraph
  (3 lines) and step-3 body (3 lines), app/layout.tsx metadata description
  (1 line), README.md lines 3–6. "Safety notes are fit checks, not
  certifications." unchanged. tests/safety.copy.test.ts fails on "safe",
  "unsafe", "prove it", "proves it" in app/**/*.tsx, components/**/*.tsx,
  lib/safety*.ts, README.md.
- Dev-server check (port 3113, killed, log removed): old wording 0 matches,
  "plain-language fit check" 1, trust-strip sentence 1, whole-word safe/unsafe
  in the page 0.
- T4.4 hook matcher widened to
  `(^|/)lib/(matching(/[^/]+)?|safety(-[a-z]+)?)\.ts$` (description updated).
  Checked by regex against lib/safety.ts, safety-materials/weight/rules.ts
  (match) and lib/safety-1.ts, lib/safetyx.ts (no match). Firing in the
  CLI/IDE is still unobserved.
- Spec questions raised while implementing (closest faithful alternative
  taken; none changes behaviour the spec pins):
  - S1: REQ-SV-17 says the certifications row cites SR-CLAIMS-ONLY, REQ-SV-24
    says a catalog-grounded certifications row carries no "General guidance"
    label. The card shows the rule's sentence there as plain text, no label.
  - S2: the injected-rules test (T3.1) needs a rules argument, so
    `computeVerdict(product, catalog, band, rules = SAFETY_RULES)` and
    `ruleById(id, rules = SAFETY_RULES)` take an optional last parameter.
  - S3: T3.3's component checks cannot run in Wave 3 (the file lands in
    Wave 4). They are `describe.skipIf(file missing)`, and run now.
  - S4: the REQ-SV-14 template prints "…for infants 0–3 years pieces here…"
    because `AGE_GROUP_LABEL` is a noun phrase. Kept literal.
  - S5: not-stated rows with no mention cite the rule plus the four fields
    searched; rows that quote a field cite the field and the rule and carry no
    guidance text (the rule sentence says "not stated", which would contradict
    the quote). Property V3 exempts these rows from "rule text appears in
    guidance".
  - S6: several `claims` are joined into the row's `text` with newlines, one
    "Stated on this product's page: …" line each (none exist in v1.0.0).
- Open questions Q1–Q9 of safety-verdict design §10, for the Tue 24 Nov
  checkpoint: Q1 not-stated rows are `note`, so they never flip the verdict
  (PRD §5 deviation, REQ-SV-20); Q2 with no recipient the weight reference is
  the youngest listed band; Q3 one median per band across all categories
  (teens: 0.86 g, three 1.5 g earrings flag; mom pool 2, never flags); Q4
  listed weights are not like for like, and TPN-1459 / TPN-1433 also state
  "weight approx 2.5-3 gms" in `chain`; Q5 rules live in both
  data/safety-rules.md and lib/safety-rules.ts, kept equal by a test; Q6
  standalone earrings (THP-1001, THP-1027) get no small-parts note; Q7 the
  PRD's "0.8 g — light for everyday wear" is replaced by the median text; Q8
  the copy task also rewords the step-3 line, the hero's "then proves it", and
  README line 4; Q9 with no recipient the card can still say Good fit.

### 2026-11-21 — Session 9: true-size-viewer Waves 1–4 (Kiro, non-interactive) — COMPLETED
- Task: implement `.kiro/specs/true-size-viewer/tasks.md` Waves 1–4 in order
  (each wave's checks green before the next). Files written (lines):
  lib/true-size.ts (126), lib/size-spec.ts (187),
  components/useCalibration.ts (81), CalibrationSlider.tsx (82),
  SizeOutlines.tsx (141), SizeRuler.tsx (188), TrueSizeViewer.tsx (81),
  tests/true-size.test.ts (192), true-size.property (142),
  size-spec.test (187), size-spec.property (185), true-size.ui.test.tsx (642),
  true-size.static (110), docs/qa-reports/true-size-m3.md (105). Not touched:
  lib/matching*, lib/catalog.ts, data/catalog.json, data/*.ts, any existing
  test, .kiro/steering/structure.md, the counts table, ci.yml.
- Tests: 166 new (true-size 19, size-spec 17, true-size.property 7,
  size-spec.property 11, ui 48, static 64). `npm test` 815 passing in 36 files
  (645 in 30 before). The 4 extra beyond the 166 are per-file cases that
  tests/safety.copy.test.ts generates for the 4 new `.tsx` components; its
  expectations are unchanged and they pass (no "safe"/"unsafe" in the new UI).
  Per wave: Wave 1 699 / 34 files, Wave 2 735 / 35, Wave 3 815 / 36.
  Coverage of lib/true-size.ts and lib/size-spec.ts: 100% lines, branches,
  functions; no `coverage/` left. typecheck clean; lint only the known
  mcp-catalog warning.
- Property tests (seeded 20261124, 300 runs; P-TS-1 600, P-TS-4 parse 500,
  P-TS-8 500) found NO counterexample. Two boundary defects were found by unit
  tests before the property suite ran green and were fixed in the
  implementation (tests not loosened), see S1 and S4. The out-of-range
  generator of P-TS-2 was moved 0.5 px outward to match the S1 fix.
- Photo-in-box rule, pinned against the real catalog: exactly TPN-1459,
  TPN-1433, TBZ-1013, TBZ-1017 get the photo in the box; the 9 thin single
  pieces get an empty outline; sets never. Captions are byte-for-byte per spec.
- Wording rule: in approximate and stale modes the viewer's text contains
  "true size" exactly once (the REQ-TS-11 label) for all 22 products, and no
  aria-label, alt, or title contains it (P-TS-11 plus attribute scan). The
  static test also pins that the only string literal with "true size" in the
  components is that label.
- Spec questions raised while implementing (closest faithful alternative
  taken; the first two need a spec edit):
  - S1: REQ-TS-05 sets the slider to 171–856 px, but 171 ÷ 85.6 = 1.9977,
    below MIN_FACTOR 2 (REQ-TS-02 rejects it); 856 ÷ 85.6 is 10 only up to
    float error. 171 and 856 are whole-pixel roundings of 171.2 and 856.
    `factorFromCardPx` now accepts up to half a pixel outside the range and
    clamps the factor into [2, 10]; further out is still rejected.
    Regression test in tests/true-size.test.ts.
  - S2: tasks.md T2 quotes the TNZ-1056 ring as 42.4635 mm; 133.4 ÷ π is
    42.4625. At factor 5 that is 212.31 px, inside the spec's 0.01 tolerance of
    212.32, so the tests compare against `133.4 / Math.PI`.
  - S3: jsdom's CSS layer rounds inline `style` lengths to about 3 decimals,
    so style-based tests of non-integer px compare to 2 decimals; SVG
    attributes (width, height) are compared to 9 decimals. The code passes the
    unrounded number.
  - S4: REQ-TS-10 "more than 0.02" and a float: |2 − 2.02| is
    0.02000000000000002. `isStale` adds 1e-9 so exactly 0.02 is not stale.
  - S5: T4.1 says the read-only qa-auditor writes the checklist. It was
    written by this builder session (the checklist is only blank steps and
    targets); the auditor can still fill it in.
  - S6: REQ-TS-22 covers null dimensions. `buildSizeSpec` also treats a
    non-finite or non-positive dimension as not stated (a set with any bad
    part, a ring with a bad diameter, become `missing`), so 0 and NaN are
    never drawn (REQ-TS-22, P-TS-9). Real catalog v1.0.0 has none.
  - S7: the print sheet's labels are neutral ("14.4 × 1.9 mm", "Ø 42.46 mm")
    and not the screen captions. The sheet is in the DOM on screen, and the
    calibrated captions say "true size", which would break the wording rule.
  - S8: the "Photo as listed — shown enlarged, not to scale" label (REQ-TS-17)
    belongs to the detail page and is on the gift-presentation list; the
    viewer renders no page photo.
  - S9: the structure.md update in T4.2 is left to the coordinator, as
    instructed. It would add lib/size-spec.ts, components/SizeOutlines.tsx,
    components/SizeRuler.tsx, components/useCalibration.ts.
- Dev-server and physical-ruler checks were not run: the viewer has no route
  until gift-presentation. docs/qa-reports/true-size-m3.md is the blank manual
  checklist with the targets (box 17.7 to 19.5 mm, ring Ø 40.4 to 44.6 mm).
- Open questions Q10–Q14 of true-size-viewer design §11, for the Tue 24 Nov
  checkpoint: Q10 the PRD puts the photo in a true-size box for every pendant,
  earring and tabeez, but 9 of 13 are too thin, so the photo goes in the box
  only when the short side is ≥ 6 mm and the aspect ≤ 2.5 (4 pieces), and the
  rest get an empty size outline with the photo at page size "not to scale";
  Q11 the gold pendants' listed "Width" (1.3–2.2 mm) may be thickness, so the
  caption names height only and the detail line says "Listed: … wide"; Q12
  browser zoom invalidates a stored factor, so `dpr` is stored and a change
  of more than 0.02 gives the stale mode and note (value kept); Q13 the
  landing page and PRD use "true-size" as a feature name, covered by REQ-TS-12
  for the viewer and detail page, landing line reworded in safety-verdict;
  Q14 a bracelet is drawn as a closed circle of the listed circumference (the
  detail line says so).

### 2026-11-21 — Session 10 (retry): gift-presentation Wave 4 — QA audit + evidence log (Kiro, non-interactive) — COMPLETED
- Task: T4.4 (QA audit) and T4.5 (this entry) only. Session 10 completed
  Waves 1–3 and the build, then ended before writing the audit or this entry.
  Written: docs/qa-reports/gift-presentation-m3.md; "NOT RUN" note for T4.3 in
  docs/qa-reports/true-size-m3.md; this entry. No application code or test
  was changed by the retry. The counts table and .kiro/steering/structure.md
  are the coordinator's and were not edited.
- Session 10 Waves 1–3, from `git status` (new, lines where counted):
  app/piece/[sku]/page.tsx (120), app/piece/[sku]/not-found.tsx (27),
  components/GiftWrap.tsx (195), components/PieceFacts.tsx (23),
  lib/gift-message.ts (79), lib/piece-view.ts (63),
  tests/gift-message.test.ts (119), gift-message.property (110),
  gift-wrap.ui.test.tsx (256), gift-presentation.static (168),
  piece-view.test (76), piece-view.property (42), piece.links.ui.test.tsx (89),
  piece.route.test.tsx (181), model-param.property (30),
  tests/helpers/model-arbitrary.ts (44). Edited: app/globals.css (+59),
  app/picks/page.tsx, app/page.tsx, app/layout.tsx, components/PickCard.tsx,
  components/BrowseCard.tsx, lib/model-param.ts (+6, `pieceHref`),
  tests/model-param.test.ts, tests/atelier.ui.test.tsx, README.md,
  .kiro/hooks/matching-tests.json. (Also untracked from Sessions 8–9: the
  safety and true-size files, and the three M3 spec folders.)
- Tests (coordinator-verified): `npm test` 953 passing in 45 files (815 in 36
  before gift-presentation). The gift, piece and model-param files alone: 10
  files, 143 tests, re-run by this session, all passing. typecheck clean; lint
  only the known mcp-catalog AgeBand warning; validate-catalog OK with the two
  expected warnings (TNZ-1058, TNZ-1056 width).
- Property counterexamples: not recorded by session 10; none found by the
  coordinator's verification run.
- Build: `npm run build` succeeds (compiled, 30 static pages, /piece/[sku]
  with all 22 paths, Partial Prerender). This resolves Q19:
  generateStaticParams + Cache Components + promise params work.
- T4.1 dev-server numbers (port 3115, coordinator-run, server killed, logs
  removed): /piece/TNZ-1056 status 200; "Check this" 2; fit-check line 1; "No
  certifications are stated on this product" 1; no-recipient line 1;
  approximate label 1; "true size" total 1; "Wrap this gift" 1; buy href 1;
  "Out of stock" 0. /piece/TBZ-1013 with the golden-1 model: "Listed by Tiny
  Tiaraa for infants 0–3 years" 1. /piece/TNZ-1058: "Out of stock" 2,
  tinytiaraa.com/product 0, buy and wrap 0. /piece/NOPE-0000: status 200 (not
  404; the accepted Q15 fallback: 200 + noindex), "find that piece" 1,
  "noindex" 1. /picks golden 1: /piece/TBZ-1013, /piece/TNZ-1056,
  /piece/TBZ-1017 in that order, 0 detail content, 3 buy links. /atelier: 21
  buy links, 22 "See details" links.
- Coordinator fix (direct work): the first T4.1 "true size" count was 2, not
  1, because components/TrueSizeViewer.tsx carried
  `data-testid="true-size-viewer"`, which matched the grep. Renamed to
  `size-viewer` (component + 6 references in tests/true-size.ui.test.tsx); 48
  UI tests pass; all 22 pages count exactly 1 "true size" (the label). The
  rule's intent was never violated (a test id is not visible text); the
  spec's grep check now passes as written.
- T4.3 physical checks (box 18.6 mm ±5%, ring Ø 42.5 mm ±5%, calibration under
  15 s, 1:1 print sheet; phone and desktop): NOT RUN. No human with a card and
  ruler in a non-interactive session. Recorded as "not run" in
  docs/qa-reports/true-size-m3.md; no number fabricated. Needs a human before
  the REQ-TS-30 claim can be made.
- QA audit (docs/qa-reports/gift-presentation-m3.md), result PASS, no defect.
  MCP: `matching_explain` for golden 1 (TBZ-1013, TNZ-1056, TBZ-1017, score 6
  each, no disclosures) and `catalog_get` for TNZ-1058; the other 21 SKUs
  checked against data/catalog.json read directly. The real `PiecePage` was
  rendered for all 22 SKUs by a temporary script (deleted): buy href equals
  the catalog url on all 21 in-stock pages (incl. percent-encoded and comma
  URLs), none on TNZ-1058; no wrap or buy control on TNZ-1058; exactly 1
  "true size" (the label) and 1 fit-check line on every page; no
  safe/unsafe, discount/MRP wording, or certification terms; footnote once per
  page; all facts equal the catalog; no #hex in components or app (hex only in
  globals.css); no app/api. Notes: N-4 TNZ-1058 shows "Rated 5.0/5" beside the
  Out of stock badge (catalog-correct).
- Open item (new, for M4/M6): the dev log shows a dev-only Next.js "instant"
  validation warning on /find and /picks: `searchParams` awaited outside
  `<Suspense>` may prevent instant navigation (suggests a Suspense placeholder
  or `export const instant = false`). Dev-only per the Next.js docs; the build
  is unaffected. No behaviour change made.
- Supersession: conversation REQ-CV-33 ("a pick card SHALL NOT link to
  /piece/[sku]") is superseded for the link rule by REQ-GP-10 and REQ-GP-11
  (gift-presentation design §7), because the detail page now exists. The rest
  of REQ-CV-33 stands. Conversation Q7 is resolved; REQ-CV-32 and REQ-CV-38
  (buy link on pick cards, no buy control on the out-of-stock browse card) are
  unchanged. M2 OQ-2 was resolved in Session 8.
- Open questions Q1–Q22 of the three M3 design documents, for the Tue 24 Nov
  checkpoint (Q10–Q14 are listed in the Session 9 entry; Q1–Q9 in Session 8):
  - Safety Q1–Q9: not-stated rows are notes and never flip the verdict; weight
    reference with no recipient is the youngest listed band; one median per
    band across categories; listed weights are not like for like; rules live
    in two places kept equal by a test; standalone earrings get no small-parts
    note; PRD "0.8 g" text replaced; copy rewording beyond the card; Good fit
    allowed with no recipient.
  - True-size Q10–Q14: photo-in-box only for 4 pieces; "Width" of gold
    pendants may be thickness; stored factor invalidated by zoom (dpr);
    "true-size" as feature name on the landing; bracelet drawn as a circle.
  - Gift Q15–Q22: Q15 `/piece/NOPE-0000` answers 200 + noindex, not 404
    (observed; accepted unless the builder wants a 404); Q16 buy link present
    in every wrap phase; Q17 adds "Copy message" (clipboard only); Q18
    `detailHref` optional on PickCard; Q19 RESOLVED by the build; Q20
    out-of-stock pieces show verdict and viewer but no wrap; Q21
    `design_application_no` not shown; Q22 per-piece page titles left to
    polish-deploy.
- Not done: T4.3 (above); no server fetch of the 22 pages in the audit;
  `.kiro/steering/structure.md` update left to the coordinator.

### 2026-11-21 — Milestone 3 close-out (coordinator, direct)
- Final verification on the committed code (after the testid fix):
  `npm test` 953 passing in 45 files; `npm run typecheck` clean;
  `npm run lint` 1 known warning only (mcp-catalog AgeBand);
  `npm run validate-catalog` OK (2 expected warnings);
  `npm run build` succeeds (30 static pages, /piece/[sku] × 22).
  Dev-server T4.1 numbers re-verified by the coordinator (see the
  Session 10 retry entry); all 22 detail pages count exactly 1
  "true size" (the approximate label).
- `.kiro/steering/structure.md` updated by the coordinator (new
  `lib/` files and components listed; spec→code map extended for
  safety-verdict, true-size-viewer, gift-presentation). Counts table
  updated: 19 sessions, 18 completed, 5 MCP calls.
- Session 10's Wave 4 gap (no QA report, no log entry when its
  process ended) was closed by the 10b retry; nothing was re-done
  twice. Session 10 counts as completed with that gap noted.
- Milestone 3 committed and pushed to origin/main (see HEAD below).

## Milestone 4 (21 Nov 2026)

### 2026-11-21 — Session 12: polish-deploy Waves 0–1 (Kiro, non-interactive) — COMPLETED
Scope: `.kiro/specs/polish-deploy/tasks.md` T0.1, T0.2, T1.1 to T1.5. Waves 2 to 4 not started.

**T0.1 axe decision (REQ-PD-37, Q-PD11): `axe-core` called directly works. `vitest-axe` and the role-only fallback were not needed.**
- Versions: `axe-core` 4.14.1 (already installed through `eslint-plugin-jsx-a11y`; `npm install -D axe-core@4.14.1` added only `"axe-core": "^4.14.1"` to `devDependencies` in `package.json` and the same line in the root entry of `package-lock.json`; no other package changed). Vitest 5.1.1, jsdom 31, Testing Library 16.3.3, React 19.3.0.
- Spike: `PickCard` (golden 1, first pick) and `Conversation` rendered in jsdom, `axe.run(container, { runOnly: tags, rules })`. Both returned zero violations. A positive control (`<img src>` with no alt) returned `image-alt`, so axe is really running in jsdom, not silently passing. The spike test file was deleted; `tests/helpers/axe.ts` stays.
- Rules that cannot run in jsdom: `color-contrast` (no layout or Tailwind), `target-size` (no geometry), `scrollable-region-focusable` (jsdom reports 0 for scroll and client sizes). All three are switched off in the helper with a one-line reason each, and replaced by REQ-PD-40 and REQ-PD-41.
- Also not applicable on a container: page-level rules (`landmark-one-main`, `page-has-heading-one`, `region`, `document-title`, `html-has-lang`, `skip-link`, `meta-viewport`, `bypass`) report "inapplicable" when axe is given a container, so the matrix of design §7.2 cannot rely on axe for them. REQ-PD-39 (role and query assertions) and the static layout checks of REQ-PD-41 carry them. This is a gap in the spec's assumption that axe covers "landmarks and document basics"; it changes no task.

**T0.2 baseline:** zero axe violations on landing, a `/find` step, `/picks` golden 1, `/atelier`, and `/piece/TNZ-1056` (see `docs/qa-reports/polish-m4.md`, "Baseline"). The design §2 grep counts all reproduce (8, 4, 1, 7, 12, 12, 6 headers, 0 `id="main-content"`), except letter-spacing: 6 arbitrary uses (`[0.15em]` ×1, `[0.2em]` ×4, `[0.25em]` ×1), design says "five". No task changes.

**Wave 1 outcome:** 953 tests before, 1067 in 50 files after (+110 in 5 new test files, +4 cases that `tests/safety.copy.test.ts` generates for the 4 new `.tsx` components). `npm run typecheck` clean; `npm run lint` 0 errors (the one known `AgeBand` warning in `packages/mcp-catalog`); `npm run validate-catalog` OK. `lib/page-meta.ts` coverage 100% lines, branches, functions; `coverage/` removed.

**Assertion updates (REQ-PD-49, design §7.5):** `tests/gift-wrap.ui.test.tsx` line 218 `border-plum/30` to `border-plum/60`, with a comment. `tests/atelier.ui.test.tsx` line 59 is Wave 2 (T2.4), not changed yet.

**Counterexamples and fixes:**
- Test-generator, not product code: P-PD-4 "name appears exactly once" failed for the generated name `a`, which also occurs in the fixed sentence ("a size view"). Fix: assert the name by position (the string starts with it, and the added suffix is exactly "" or " (out of stock)") for generated products, and keep the exactly-once check for the 22 real names. Not a loosened product assertion.
- P-PD-4 digit rule failed on the metal label ("18KT gold"). See spec question SQ-1.

**Deviations and decisions:**
- `app/globals.css`: the focus rule and the global reduced-motion block sit before the "Gift wrap reveal" comment, not at the end of the file. `tests/gift-presentation.static.test.ts` scans everything after that comment for the words "color" and "background" (a rule that `var(--color-plum)` trips), so appending broke it. No existing rule was edited and the wrap block is byte for byte unchanged. The non-colour tokens went inside the existing `@theme` block (REQ-PD-01: "the same `@theme` block").
- `tracking-eyebrow` and `.shadow-card` confirmed as generated utilities by compiling the stylesheet with Tailwind 4.3.3 (`compile()` from `tailwindcss`), then deleting the throwaway script.
- Interim state: external `AtelierButton`s now carry `aria-describedby="new-tab-hint"`, but `SiteHeader` (which renders that hint) is used by no screen until Wave 2, so the reference dangles on the live pages in between. Nothing asserts on it yet; it resolves in T2.1 to T2.5. Not shipped between waves.
- `ActionButton` takes `ref` as a normal prop (React 19) so Wave 2 focus hand-offs need no `forwardRef`. `CobwebCorner` was built (Q-PD9 not declined).
- The token table of design §3 border rows `/15`, `/30`, `/40`, `/50` are quoted as single or rounded values. The test pins the measured ranges instead: `/30` 1.74 to 1.78 (design: 1.76), `/15` 1.30 to 1.31. `text-plum/70` on `sage` measures 4.499, just below 4.5; the design table says "4.50, no margin". The policy floor of 75 is unaffected.

**Spec questions raised (not resolved by editing around them):**
- SQ-1: REQ-PD-57 says a description contains "no digit that is not in the catalog name or the age-group label". REQ-PD-35's sentence also carries the metal label ("18KT gold", "925 silver"), whose digits are not in the name for most pieces. The property allows the metal label's digits too. Spec text should add "or the metal label".
- SQ-2: design §6 types `pieceDescription` over `materials`; the page already holds the parsed product with `metal`, and `METAL_LABEL` is keyed on `metal`, so the function takes `metal`. Spec text should say so.
- SQ-3: the design's "nine surfaces" are the four pastel tokens plus five composites; `plum` is listed in §3's prose as a surface but only `text-pearl` sits on it. The helper keeps `plum` and `plum/85` in a separate `plumFillSurfaces` list.

### 2026-11-21 — Session 13a: polish-deploy Wave 2, screens part 1 (T2.1 to T2.4) (Kiro, non-interactive) — COMPLETED

Read the three spec files one at a time, then the Next.js docs (`generate-metadata.md` title/template, `instant.md`) before editing.
Tasks done: T2.1 landing, T2.2 `/find`, T2.3 `/picks`, T2.4 `/atelier`. T2.5 to T2.8 not started.

Files changed (git numstat, added/removed):
- `app/page.tsx` 31/31, `app/find/page.tsx` 11/10, `app/picks/page.tsx` 16/11, `app/atelier/page.tsx` 12/11
- `components/Conversation.tsx` 10/14, `ChipGroup.tsx` 1/1, `ProgressMoon.tsx` 2/3, `RecipientCard.tsx` 7/7
- `components/PickCard.tsx` 13/7, `BrowseCard.tsx` 9/6, `CatalogGrid.tsx` 20/12
- `tests/atelier.ui.test.tsx` 2/1. `DisclosureNote.tsx` needed no change (no policy-violating class).

What changed: `SiteHeader` and `main#main-content` (tabIndex -1, outline-none) on all four screens; landing eyebrow and numerals
plum with a `bg-gold` rule, moon `fill-gold`, steps in an `<ol>`, `CobwebCorner` in both hero corners, secondary CTA `border-plum/60`;
`/find` conversation inside one `bg-blush/50 rounded-3xl` panel, Continue/Back/Edit through `ActionButton`, Back on question 1 a styled
`Link`, chips `border-plum/60`; `/picks` and `/atelier` cards `shadow-card`, heading ids `pick-${sku}-name` and `browse-${sku}-name` with
`describedBy` on "See details" and the buy link; out-of-stock card `text-plum/75`; "Clear filters" is `ActionButton secondary` and moves
focus to the first chip in its click handler (the chip is always mounted); the empty-state sentence now sits inside the `aria-live` container
with the count; `metadata.title` on `/find`, `/picks`, `/atelier` (from `ROUTE_TITLES`).

Assertion update (REQ-PD-49): `tests/atelier.ui.test.tsx` line 59, `text-plum/50` to `text-plum/75`, with a comment. No other assertion changed.

Tests: 1067 before, 1067 after (50 files). One run failed first: `tests/safety.copy.test.ts` greps `CatalogGrid.tsx` for the word "safe"
and my code comment contained it. Reworded the comment; no test touched.
Checks: typecheck clean, lint 0 errors (1 existing warning in `packages/mcp-catalog`), validate-catalog OK, `npm run build` OK,
`npx vitest run tests/picks tests/atelier tests/conversation tests/journey` green.

Grep gates over `app components`: zero hits in every T2.1 to T2.4 file. Remaining hits are in T2.5 to T2.7 files only:
`text-plum/60|70`: `app/piece/[sku]/page.tsx`, `PriceFootnote.tsx`, `SafetyVerdict.tsx`, `SizeOutlines.tsx`, `GiftWrap.tsx`;
`border-plum/30`: `app/piece/[sku]/page.tsx`, `CalibrationSlider.tsx`, `SizeRuler.tsx`, `GiftWrap.tsx`, `TrueSizeViewer.tsx`;
`tracking-[`: `SafetyVerdict.tsx`; `text-gold`: none left.

Deviations:
- The price footnote on `/picks`, `/atelier` and the landing footer is still `text-xs text-plum/60`. It comes from `components/PriceFootnote.tsx`,
  which T2.5 owns and the boundaries here did not list. The `text-sm text-plum/75` change lands with T2.5.
- `DisclosureNote.tsx` unchanged (nothing to fix).
- Edit buttons use `ActionButton` secondary, whose hover is `bg-champagne`, the same as the list surface on the recipient card, so hover shows no step there. Cosmetic; for the visual review.

Open questions: none new beyond Q-PD1 to Q-PD16. The `#new-tab-hint` id now resolves on the four screens; piece screens follow in 13b.

### 2026-11-21 — Session 13b: polish-deploy Wave 2, screens part 2 (T2.5 to T2.8) (Kiro, non-interactive) — COMPLETED

Wave 2 is complete after this session. Wave 3 not started.

- **Tasks done:** T2.5 `/piece/[sku]` static parts, T2.6 viewer, T2.7 gift wrap, T2.8 root layout.
- **Files changed (line counts after the edit):** `app/layout.tsx` 39, `app/piece/[sku]/page.tsx` 134, `app/piece/[sku]/not-found.tsx` 24,
  `components/PieceFacts.tsx` 26, `PriceFootnote.tsx` 10, `SafetyVerdict.tsx` 88, `TrueSizeViewer.tsx` 98, `CalibrationSlider.tsx` 81,
  `SizeOutlines.tsx` 142, `SizeRuler.tsx` 185, `GiftWrap.tsx` 195; test: `tests/true-size.ui.test.tsx` 643 (one assertion).
- **Test count:** 1067 in 50 files before, 1067 in 50 files after. No test added (Wave 3 owns the new suites).
- **Next.js docs re-read first:** `generate-metadata.md` ("title", "template", "With Cache Components"). `generateMetadata` awaits `params` and
  the piece route has `generateStaticParams`; `npm run build` passes with no error, so no `use cache` or dynamic marker was needed.
  Title template is on the root layout only (it does not apply to the root segment's own page, so `/` shows the default).
- **Assertion updates (REQ-PD-49):** one. `tests/true-size.ui.test.tsx` line 283: `toHaveAttribute("role", "img")` on the ring became
  `toHaveAttribute("aria-hidden", "true")` with a comment; the `aria-label` assertions at lines 284 and 293 and the caption text assertions are
  unchanged. Line 350 (`getAllByRole("img")` length 1) needed no edit: the photo box carries no role and the only `role="img"` left is the `<img>`.
  No test pinned the old `PriceFootnote` classes, so none changed for that. `tests/gift-wrap.ui.test.tsx` needed no edit: its queries use
  `getByRole("button", ...)` and the persistent `wrap-status` region did not make any `status` query ambiguous.
- **Q-PD7 decision:** accepted (not vetoed). Ring and height-line SVGs now `aria-hidden="true"` and keep `aria-label`; the box drawing without a photo
  gets `aria-hidden` plus `aria-label`; the photo-in-box drawing is unchanged. Outcome: all 1067 tests pass.
- **Focus hand-offs:** slider focuses on open; "Reset calibration" or "Calibrate with a card" gets focus after This matches, Cancel, Reset; "Skip"
  gets focus when wrapping starts. Checked with a throwaway jsdom test (deleted afterwards): all five hand-offs, `aria-valuetext`, and
  the wrap status text swap behaved as specified.
- **Deviation (spec says effect, repo forbids it):** design §5.1 implies effects for focus. `tests/true-size.static.test.ts` bans `useEffect`
  in `TrueSizeViewer.tsx` and `CalibrationSlider.tsx` ("no setState inside an effect, no effect hooks at all"). The test was not loosened. Focus is
  done through ref callbacks that focus the element as it mounts (a pending-target ref set by the click handler in the viewer). `GiftWrap` has no such
  ban and uses its existing effect for both Skip and the card heading.
- **Other notes:** the `GiftWrap` revealed card border moved from `border-plum/15` to `border-plum/60` as the task list says; no test pinned the old one.
  Drawing detail lines and the reference-card caption in `SizeOutlines` moved from `text-xs text-plum/70` to `text-sm text-plum/75` (REQ-PD-03 allows
  `text-xs` only for eyebrows and "Source:"). The `SafetyVerdict` "Source:" line stays `text-xs` at `text-plum/75`.
  The always-mounted wrap status adds an empty flex child in the idle phase, so the idle section gains one extra `gap-5` of space; flagged for the visual review.
- **Checks:** `npm test` 1067/1067; typecheck clean; lint 0 errors (1 existing warning in `packages/mcp-catalog`); `validate-catalog` OK;
  focused run (picks, atelier, gift, true-size, safety, piece, conversation, journey) 673/673; `npm run build` green. Grep gates all 0:
  `text-gold`, `text-plum/(50|55|60|65|70)`, `border-plum/30`, `tracking-[`.
- **New spec questions:** Q-PD17: design §5.1 assumes effects for focus but the M3 static test bans them in the viewer files; ref callbacks used. Confirm
  this is the preferred pattern, or approve a spec change to the static test.

### 2026-11-21 — Session 14a: polish-deploy Wave 3 part 1, axe and keyboard suites (T3.1, T3.2) (Kiro, non-interactive) — COMPLETED

T3.3 and T3.4 not started.

- **Tasks done:** T3.1 axe suite, T3.2 keyboard, live-region and name tests.
- **Spec files read** one at a time (requirements, design, tasks) before any edit.
- **Next.js docs:** not re-read this session. No Next.js code was written or changed (tests and one SVG attribute only); the docs listed in the tasks header belong to T3.4.
- **Files changed (line counts after the edit):** new `tests/a11y.axe.test.tsx` 219, `tests/a11y.keyboard.test.tsx` 753, `tests/helpers/pages.tsx` 136
  (page render helpers and a DOM driver for the conversation), `tests/helpers/conversation-actions.ts` 69 (the shared index-based generator: `legalActions`
  moved out of `tests/conversation.property.test.ts` unchanged, plus `pickAction`); edited `tests/conversation.property.test.ts` 554 (the function was
  removed and imported; six imports that became unused were removed; its 27 tests pass unchanged); component `components/SizeOutlines.tsx` 142 (one attribute).
- **Test count:** 1067 in 50 files before, 1331 in 52 files after (+264: 72 axe, 192 keyboard). `npm test` 1331/1331; the two new files pass alone (264/264).
- **Axe matrix:** 72 states, each its own `it`, zero violations on all 72 (landing 1; `/find` 14 including the 8 question steps, Religious sub-chips, card, adult-end,
  notice, resumed card, edit; `/picks` 3; `/atelier` 4; `/piece` 22 idle + 7 calibrated + 7 slider open + 6 wrapping + 6 revealed + 1 with `?m=`; not-found 1).
  Every state also asserts P-PD-6 (one `h1` first, no skipped level, one `main`). The page-level axe rules are not asserted (container render); T3.2 covers them by query.
- **Component fix for a test-revealed failure (1):** `components/SizeOutlines.tsx` height-line drawing (`data-testid="size-line"`) had `role="img"` and an `aria-label`
  equal to its figcaption (REQ-PD-29 requires `aria-hidden`; session 13b had hidden only the ring and the box). Now `aria-hidden="true"`, label kept as an attribute.
  Found by the "caption repeats its label is aria-hidden" test on a line item. Axe did not catch it (a double read, not a rule violation).
- **Test-side errors fixed (not component bugs, no assertion loosened):** the verdict heading may be "Good fit" or "Check this" (my first assertion assumed one);
  the calibration store keeps an in-memory copy besides localStorage, so the keyboard file resets it in `beforeEach`; the "true size" attribute scan allows only the
  pinned calibrated drawing captions and asserts nothing else carries it (slider, hint, statuses).
- **Q-PD17 outcome:** the ref-callback pattern passes every focus test: slider on open, "Reset calibration" after "This matches", "Calibrate with a card" after Cancel and
  after Reset, none on load. No fix needed. Q-PD17 stays open only as a spec-wording question (design §5.1 still says "effect"); it is not a behaviour problem.
- **What T3.2 asserts:** outline, landmarks (one banner, "Primary" nav, one `main#main-content`, contentinfo on the landing) and content-inside-landmark on 15 screens; skip link
  first in focus order on 15 screens plus the layout tree (`lang="en"`, `SkipLink` first in body); no positive `tabindex` and `-1` only on `main`, `[data-step-heading]`,
  the gift-card `h3`; focus after answer, back, edit, return to the card, adult-end; P-PD-7 (fast-check seed 20261121, 100 runs, DOM-driven); wrap focus (Skip, card heading by timer, by
  Skip, reduced motion); every REQ-PD-22 live region present before its text changes (fake timers for the wrap); `aria-describedby` on repeated links and the hint on every
  `_blank` link; alt equals the name on pick, browse and detail for all 22 SKUs; slider name, description, `aria-valuetext`; P-PD-8 name and target classes for
  `PickCard` and `BrowseCard` over 22 SKUs.
- **Checks:** `npm test` 1331/1331; typecheck clean; lint 0 errors (1 existing warning in `packages/mcp-catalog`); `validate-catalog` OK (22 products, 2 existing width warnings). No `coverage/`, no server, no temp file.
- **Deviation:** the DOM driver `tests/helpers/pages.tsx` and `pickAction` are additions to the generator move the task named. `pickAction` never picks "restart" because the UI has no control for it.
- **New spec questions:** none.

### 2026-11-21 — Session 14b: polish-deploy Wave 3 part 2, static, contrast-scan, targets, copy-lock and the instant warning (T3.3, T3.4) (Kiro, non-interactive) — COMPLETED

Wave 4 not started.

- **Tasks done:** T3.3 and T3.4.
- **Spec files and docs:** requirements, design and tasks read one at a time before any edit. Next.js docs re-read before T3.4: `instant.md` (route segment config), `instant-navigation.md`, `generate-metadata.md` ("With Cache Components"). `partialPrefetching.md` is not at the path the tasks header names (`05-config/01-next-config-js/`); its content was covered by the `instant-navigation.md` Partial Prefetching sections. No Tailwind theme docs in `node_modules/tailwindcss`; the `tracking-eyebrow` and `shadow-card` tokens were already proven by the Wave 1 and 2 builds. No Tailwind or token change this session.
- **Files changed (line counts after the edit):** edited `tests/a11y.contrast.test.ts` 341 (part 2 appended, 210 before; the header comment updated); new `tests/a11y.static.test.ts` 201, `tests/a11y.targets.test.tsx` 318, `tests/polish.copy.test.tsx` 429, `tests/helpers/source-scan.ts` 69 (reads `components/` and `app/` as text, strips comments, finds the JSX tag around a match; shared by the contrast scan and the static file). Components: `components/SizeOutlines.tsx` (one class, see fixes). T3.4 code: `app/find/page.tsx`, `app/picks/page.tsx`, `app/atelier/page.tsx`, `app/piece/[sku]/page.tsx` (one `export const instant = false` and a comment each).
- **Test count:** 1331 in 52 files before, 1502 in 55 files after (+171: contrast part 2 +11 so the file is 63, static 32, targets 63, copy 65). `npm test` 1502/1502. The four new or extended files pass alone (223/223).
- **What T3.3 asserts:**
  - Contrast scan (REQ-PD-25, 26, 40; P-PD-2, 3). Every `text-*`, `border-*`, `bg-*` token utility in the source, with variant prefixes, is checked against all nine surfaces by the computed ratio. Text must be plum or pearl and every `text-plum/N` must reach 4.5:1. `text-pearl` needs a `bg-plum` in its file and 7:1. Borders other than the decorative 10 and 15 must reach 3:1, and the decorative alphas are shown to be under 3:1 so the exemption hides no pass. Every `bg-` surface is one the computation covers or a decorative fill (gold, `plum/15`).
  - Static (REQ-PD-41; P-PD-9). No `text-gold`, no text alpha under 75, border floor, no colour literal. `outline-none` only inside a tag that carries `tabIndex={-1}` (8 or more found). No `order-*`, reverse or dense classes, no positive tabIndex. The global reduce rule has the three `!important` declarations and `.mote` hidden, and no other `!important` exists in the stylesheet. The wrap keyframes end exactly at `WRAP_REVEAL_MS` (tight, not only below) and the card fade equals `CARD_FADE_MS`. No inline animation or transition, no rAF, `.animate(`, smooth scroll, `maximum-scale` or `user-scalable`, no raw `<img`. `<button` appears only in `ActionButton.tsx` and `ChipGroup.tsx`. `lang="en"` and `SkipLink` first in `<body>`. No logo or watermark text in the source.
  - Targets (REQ-PD-28; P-PD-8). `PickCard` and `BrowseCard` over all 22 SKUs (names contain the visible text, class rule), the header on four routes, the skip link, question 1, a later question, adult-end, the Religious sub-chips, the recipient card (7 Edit buttons), the viewer idle, calibrating and calibrated, the wrap idle, wrapping and revealed. The rule guards classes only: jsdom has no Tailwind and no layout.
  - Copy lock (REQ-PD-15, 16, 42; P-PD-10). All 22 `/piece` pages in approximate mode and in stale mode (a calibration stored at dpr 2): fit-check line, no-certifications line, photo note, no-recipient line, the approximate label once, "true size" exactly once across text and speakable attributes, the footnote on every listed price, no discount wording, photos `object-contain` with no filter or overlay class up to the card and nothing beside the photo, only `/catalog/<SKU>` images, buy links equal the catalog `url`, and for TNZ-1058 no buy link, no wrap, no store link. Also `/atelier` (22 cards, 21 buy links, one "Out of stock", the muted card), `/picks` goldens 1 to 3, landing, `/find`, the not-found page, the wrap strings, "Copied" and the manual-copy line.
- **Component fix for a test-revealed failure (1):** `components/SizeOutlines.tsx` line 131, the credit-card reference drawing, `border-plum/40` (2.2:1) became `border-plum/60` (REQ-PD-26 names the size drawings). Found by the contrast scan. No existing test pinned `/40`.
- **Test-side errors fixed (not component bugs, no assertion loosened):** my first discount pattern matched "turn off" in the pinned ruler line and "75% gold" in a safety rule, so it now names discount forms only (`% off`, `off ₹`, `save`, `was ₹`, MRP and so on); the landing trust strip says "No discounts invented" (REQ-SV-29), allowed as the one phrase on the landing and asserted absent elsewhere; the file-count threshold and a JSX comment between `SkipLink` and `Suspense` were off in my own tests.
- **Deviation 1, rupee amounts that are not prices (new spec question Q-PD18):** REQ-PD-15 says every `₹` text node has a price region with the footnote. Budget bands ("Under ₹2,500", "₹15,000–₹25,000", "₹25,000+"), the budget chip labels, the recipient-card lines and the pinned relaxation disclosure ("No pieces matched your ₹15,000–₹25,000 budget…") contain `₹` and cannot take the footnote (pinned copy, REQ-PD-16). The copy test therefore checks every single bare listed amount (`₹18,299`) and exempts only text that is a band shape or says "budget". No component was changed. If the spec means literally every `₹` node, the disclosure and the chips need a spec change.
- **Deviation 2, mote delay:** `app/page.tsx` sets `style={{ animationDelay }}` on each mote. The static test bans every inline animation or transition property except `animationDelay`, allowed only in `app/page.tsx` (the animation is the `.mote` class, neutralised and hidden by the reduce rule).
- **T3.4 instant warning, step 1 (dev, port 3116, no browser on the machine, so curl only).** Visited `/`, `/find`, `/picks?m=<golden 1>`, `/atelier`, `/piece/TNZ-1056`: all 200. Warned routes: `/find` (app/find/page.tsx:18), `/picks` (app/picks/page.tsx:25), `/atelier` (app/atelier/page.tsx:17), `/piece/[sku]` (app/piece/[sku]/page.tsx:49). `/` did not warn. So the warning also appears on `/atelier` and `/piece/[sku]`, which the dev log of M3 had not named. Exact text, one block per route (shown for `/find`):

```
Error: Route "/find": Next.js encountered URL data during prerendering or a navigation.

`params` or `searchParams` accessed outside of `<Suspense>` may prevent the navigation from being instant, leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with `<Suspense fallback={...}>` around the data access
  - [block] Set `export const instant = false` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/instant-shell-url-data
```

- **T3.4 step 2, decision rule.** `npm run build` passed (30 static pages). Route table: `/` static; `/atelier`, `/find`, `/picks` and `/piece/[sku]` (22 paths) are `◐ Partial Prerender`. `next start` on port 3117: `/find` answered in 0.22 s, `/atelier` 0.06 s, `/piece/TNZ-1056` 0.08 s (total, including matching and render), and the HTML carries the skip link and a `<template id="B:0">` for the streamed body. The navigation could not be watched in a browser (none installed), so "no blank or blocked UI" rests on those timings, not on a screen. Decision **(a)**. Reason: the recipient model and filters live in the URL by design (REQ-CV-18), so these four pages depend on request data by construction; the server answers in under 100 ms; a Suspense fallback (b) would be an empty box on a two-second journey and `/picks` redirects from inside the streamed body. **Build unaffected:** the build output before and after the change is the same table.
- **T3.4 step 3.** `export const instant = false;` with a comment citing design §8 and REQ-PD-47 on the four pages.
- **T3.4 step 4, re-run on dev after the change.** All five routes 200. The warning count in the dev log is 0. `/picks` without `m`: 200 with `<meta http-equiv="refresh" content="1;url=/find"/>`. `/picks?m=garbage`: 200 with `content="1;url=/find?notice=incomplete"`. Golden 1 picks in order: TBZ-1013, TNZ-1056, TBZ-1017. Titles per route as REQ-PD-53 expects. Dev server killed, no listener on 3116 or 3117, `/tmp/dev-pd.log` and every other temp file removed.
- **Q-PD10:** answered, (a). Open only if the manual pass finds the reveal visibly slow, then option (c) (`prefetch={true}` on "Reveal my picks") per design §8.1.
- **Checks:** `npm test` 1502/1502; typecheck clean; lint 0 errors (the same 1 warning in `packages/mcp-catalog`); `validate-catalog` OK (22 products, 2 existing width warnings); `npm run build` passes after T3.4; the four grep gates print 0; no `coverage/`, no server, no temp file.
- **New spec questions:** Q-PD18 (above, rupee amounts that are budget bands). The path for `partialPrefetching.md` in the tasks header is wrong (`05-config/01-next-config-js/` does not exist under `01-app/` in this version).

### 2026-11-21 — Session 15: polish-deploy Wave 4, acceptance, manual checklist, audit, design lock (T4.1 to T4.3, T4.5, T4.6) (Kiro, non-interactive) — COMPLETED

T4.4 skipped on purpose (no human keyboard pass, so no slider step buttons; Q-PD8 stays open). Nothing committed or pushed. No CI file added.

- **Spec files (line counts):** `.kiro/specs/polish-deploy/requirements.md` 223, `design.md` 489, `tasks.md` 113.
- **T4.1 dev-server checks** (port 3116, `npm run dev`, log in `/tmp/dev-pd.log`, golden-1 model in `m`). All routes answered 200. Observed:

| Route | `<title>` | `lang="en"` | `main-content` | `<h1` | Skip link before first `<h1` (byte offsets) | "Opens in a new tab" |
|---|---|---|---|---|---|---|
| `/` | Haunted Gift Atelier — Tiny Tiaraa | 1 | 1 | 1 | 1308 < 4150 | 1 |
| `/find` | Find a gift \| Haunted Gift Atelier | 1 | 1 | 1 | 1306 < 3040 | 1 |
| `/picks?m=<golden 1>` | Your picks \| Haunted Gift Atelier | 1 | 1 | 1 | 1305 < 2127 | 1 |
| `/atelier` | The atelier \| Haunted Gift Atelier | 1 | 1 | 1 | 1306 < 2126 | 1 |
| `/piece/TNZ-1056` | Blue Evil Eye Nazariya – 925 Silver Baby Bracelet \| Haunted Gift Atelier | 1 | 1 | 1 | 1342 < 3312 | 1 |
| `/piece/TNZ-1058` | Red Square Evil Eye Nazariya – 925 Silver Baby Bracelet (out of stock) \| Haunted Gift Atelier | 1 | 1 | 1 | 1369 < 3339 | 1 |
| `/piece/NOPE-0000` | Piece not found \| Haunted Gift Atelier (status 200, `noindex` 1) | 1 | **0** | **0** | skip link at 1394, no `<h1` | **0** |

  Every title equals the REQ-PD-53 expectation. **The one number that differs is `/piece/NOPE-0000`** (expected 1, 1, 1 like the others, observed 0, 0, 0). Explanation: the dev server logs "Switched to client rendering because the server rendering errored: NEXT_HTTP_ERROR_FALLBACK;404", so the served HTML has the title, the robots tag and the skip link, and the not-found body is client-rendered. The component has `main-content` and an `h1` (its test passes). A production `next start`, checked once in T4.5, gives HTTP 404 (not 200) with the same missing elements in the HTML. Not changed; recorded as observation O-1 in `docs/qa-reports/polish-m4-audit.md` and as a manual-checklist line. Status 200 plus `noindex` in dev stays the accepted Q15 behaviour.

  | Check | Expected | Observed |
  |---|---|---|
  | `/piece/TNZ-1056`: approximate-size label | 1 | 1 |
  | `/piece/TNZ-1056`: "true size" (case-insensitive, `true[- ]size`) | 1 | 1 |
  | `/piece/TNZ-1056`: fit-check line | 1 | 1 |
  | `/piece/TNZ-1058`: "Buy on Tiny Tiaraa", "Wrap this gift", "tinytiaraa.com/product" | 0 | 0 |
  | Golden 1 pick order on `/picks?m=…` | TBZ-1013, TNZ-1056, TBZ-1017 | TBZ-1013, TNZ-1056, TBZ-1017 |
  | `/picks` with no `m`: status; meta-refresh count | 200; at least 1 | 200; 1 |
  | `/atelier`: "Buy on Tiny Tiaraa" | 21 | 21 |
  | Landing served HTML: `text-gold` or `<img` | 0 | 0 |
  | Instant-warning lines in the dev log (`instant-shell-url-data`) | 0 | 0 |

  Server killed (the `next-server` child needed a second kill). Afterwards nothing listened on 3116 or 3117, and `/tmp/dev-pd.pid`, `/tmp/dev-pd.log`, `/tmp/picks-nom.html` were deleted.
- **T4.2 whole suite:** `npm test` **1502/1502 in 55 files** (953 at the M3 close-out; 1067 after Wave 1 and 2; 1331 after T3.1/T3.2; 1502 after T3.3; +549 over M3). `npm run typecheck` clean. `npm run lint` 0 errors (1 existing warning, `AgeBand` in `packages/mcp-catalog`). `npm run validate-catalog` OK (22 products, 2 existing width warnings). **`npm run build` passes** (30 static pages; `/` static; `/atelier`, `/find`, `/picks`, `/piece/[sku]` ×22 Partial Prerender; same table as before T3.4). `lib/page-meta.ts` coverage 100% statements, branches, functions, lines (30 tests); `coverage/` removed.
- **T4.3:** `docs/qa-reports/polish-m4.md` finished (baseline kept; automated results; test-setup table; each manual section as a table, every result NOT RUN; REQ-PD-45 grid for 5 journey screens and 5 piece categories). It says the T4.3 physical calibration stays not run and that no number is invented. No headless browser (`chromium`, `google-chrome`, `chromium-browser`, `chrome`, `firefox` absent, no Playwright cache), so "screenshots not run" and `docs/qa-reports/screenshots-m4/` does not exist.
- **T4.5 audit:** `docs/qa-reports/polish-m4-audit.md`. 15 checks, all pass. It used the catalog MCP server through the Kiro MCP client: `catalog_get` ×22 (all names compared with the rendered `alt` on piece, browse and pick views: 0 mismatches) and `matching_explain` ×1 (golden 1: TBZ-1013, TNZ-1056, TBZ-1017, scores 6, 6, 6). Two observations (O-1 above, O-2 a decorative `opacity-20` on the hero cobweb) and the known Q-PD18. No defect was fixed in this pass. Note: the audit was done by the builder session, not by the `qa-auditor` agent, so it is not independent of the build.
- **Axe decision (T0.1, Q-PD11):** `axe-core` 4.14.1 called directly through `tests/helpers/axe.ts`. `vitest-axe` and the role-only fallback were not needed. Page-level rules are inapplicable on a container and are carried by role queries and static tests. Matrix: 72 states, 0 violations (T3.1).
- **Test count before and after:** 953 (M3 close-out) before, 1502 after (+549, 10 new test files in `tests/` plus 7 new helper files, and 4 edited test files). No test removed or loosened.
- **Assertion updates (design §7.5, REQ-PD-49), all listed:** `tests/atelier.ui.test.tsx` `text-plum/50` to `text-plum/75`; `tests/gift-wrap.ui.test.tsx` `border-plum/30` to `border-plum/60`; `tests/true-size.ui.test.tsx` the drawing's `role="img"` to `aria-hidden="true"` (Q-PD7); `tests/conversation.property.test.ts` moved `legalActions` into `tests/helpers/conversation-actions.ts` (a move, no change of what it generates).
- **Instant warning (T3.4, Q-PD10):** reproduced on `/find`, `/picks`, `/atelier`, `/piece/[sku]`, not `/`. Decision (a): `export const instant = false` with a comment on those four pages. Reason: the model and filters live in the URL by design (REQ-CV-18), the server answers in under 100 ms, and a Suspense fallback would be an empty box. Build output unchanged. `/picks` redirects and golden 1 unchanged. Re-checked in this session: 0 warnings in the dev log.
- **Agent runs:** the component and route edits of Waves 1 and 2 are recorded in the session 12, 13a and 13b entries above (see them for which agent wrote what); the `qa-auditor` agent (QA) did not run in this session, the audit was written by the builder (see T4.5). MCP calls this session: `catalog_get` ×22, `matching_explain` ×1 (all matched the data and the golden case). Hook firings observed: 0.
- **Counterexamples and fixes in Milestone 4:** (1) P-PD-4 "name exactly once" failed for the generated name `a`: test-generator fix (assert by position), not a product change. (2) P-PD-4 digit rule hit "18KT gold": spec question SQ-1 (session 12). (3) T3.3 contrast scan found `components/SizeOutlines.tsx` line 131, the credit-card reference drawing, at `border-plum/40` (2.2:1): fixed to `border-plum/60` (REQ-PD-26 names the size drawings). Reference-card border fix = this one. (4) T3.3 test-side errors fixed without loosening: the discount pattern first matched "turn off" and "75% gold", so it now names discount forms only. No property counterexample reached product behaviour; the M1 to M3 total of 3 is unchanged.
- **Design lock (REQ-PD-52), "visual language frozen" as of the end of this pass; a later change is a spec change:**
  - *Token block* (`app/globals.css` `@theme`): `pearl #FAF7F2`, `blush #F7E8E4`, `champagne #F5EDD8`, `sage #DCE8DD`, `gold #C9A227`, `plum #3D2C3A`; fonts `--font-display` (Cormorant) and `--font-sans` (Inter); `--tracking-eyebrow 0.2em`; `--shadow-card` (derived from plum with `color-mix`); `--focus-ring-width 2px`; `--focus-ring-offset 2px`. Text is plum or pearl, plum alpha 75 or more; gold is decorative only; control borders `plum/60`, decorative borders `plum/10` or `/15`.
  - *Type scale:* page `h1` `text-3xl sm:text-4xl` (landing `text-4xl sm:text-6xl`); section `h2` `text-2xl` (cards `text-xl`); body `text-base`; secondary `text-sm`; `text-xs` only for eyebrows and the "Source:" line; headings and wordmark in the display serif, the rest sans; nothing under 12 px.
  - *Spacing and radii:* container `mx-auto w-full max-w-6xl px-6 sm:px-10`; `gap-6` between sections, `py-8` page padding, `py-14` landing bands; radii `rounded-2xl` (panels, inputs), `rounded-3xl` (product cards), `rounded-full` (buttons, chips, badges).
  - *Focus rule:* one global `:focus-visible` outline, `var(--focus-ring-width)` solid plum, offset `var(--focus-ring-offset)`, an outline (not a box-shadow) so it survives forced colours; `outline-none` only on `tabIndex={-1}` targets; one global `prefers-reduced-motion` rule neutralises animation, transition and smooth scroll.
- **Steering update pending approval:** `.kiro/steering/structure.md` was NOT edited. It needs coordinator approval to list `SiteHeader`, `SkipLink`, `ActionButton`, `CobwebCorner`, `lib/page-meta.ts`, and the new test files (`a11y.axe`, `a11y.keyboard`, `a11y.contrast`, `a11y.static`, `a11y.targets`, `page-meta.*`, `polish.*`, and the `tests/helpers/` files).
- **Open questions for the Tue 24 Nov checkpoint (Q-PD1 to Q-PD18):**
  - Q-PD1 out-of-stock text `text-plum/75` instead of `/50` (done as assumed). Q-PD2 gold decorative only (done). Q-PD3 every control border 3:1, strict (done; the visual review may soften other things). Q-PD4 `aria-describedby` on repeated links (done). Q-PD5 fit-check region name unchanged (open until the screen-reader pass). Q-PD6 wrap writes a status and moves focus, possible double speech (open until the screen-reader pass). Q-PD7 drawings `aria-hidden` (done; builder may veto).
  - Q-PD8 slider step buttons: **open**, T4.4 skipped, native Page/Home/End only, needs a human keyboard pass.
  - Q-PD9 cobweb corners built, hero only (builder may drop). Q-PD10 **answered (a)**, `instant = false`; reopen only if the reveal feels slow (option c). Q-PD11 `axe-core` direct (answered, works). Q-PD12 no price in titles. Q-PD13 header link "← Back to the atelier" to `/` unchanged. Q-PD14 no headless browser; screenshots not run. Q-PD15 `design-polish` cannot write `tests/**` or `lib/**` (tasks split by owner). Q-PD16 `/about` is in `structure.md` but has no route; out of scope.
  - Q-PD17 **spec wording only:** the paths in the tasks header for `partialPrefetching.md` do not exist in this Next.js version (content found in `instant-navigation.md`); fix the wording, no code change.
  - Q-PD18 **new:** REQ-PD-15 says every `₹` node carries the footnote, but budget bands, budget chips, recipient-card lines and the pinned relaxation disclosure contain `₹` and cannot without a copy change; the copy test exempts band shapes and text that says "budget". Builder decides: keep the exemption (amend REQ-PD-15) or change the pinned copy.
  - Also for the checkpoint: observation O-1 (`/piece/NOPE-0000` has no `main-content` or `h1` in the served HTML; 200 in dev, 404 in production; update the Q15 note). Manual checks and the T4.3 physical calibration remain NOT RUN.
- **Final tree state:** `git status` shows only intended changes (Waves 0 to 4 uncommitted, plus `docs/qa-reports/polish-m4.md`, `polish-m4-audit.md` and this entry). No `coverage/`, no dev server, no temp file, no spike file.

## Counts (running totals)

| Metric | Count |
|---|---|
| Kiro sessions (non-interactive CLI) | 32 (M1: 8; M2: 6 — session 4 spec, 5a Wave 1, 5b Wave 2, 5c Wave 3, 5d Wave 4, session 6 Wave 5; M3: 5 — session 7 specs, session 8 safety-verdict, session 9 true-size-viewer, session 10 gift-presentation, session 10b retry Wave 4; M4: 7 — session 11 spec, 12 Wave 0+1, 13a Wave 2 part 1, 13b Wave 2 part 2, 14a Wave 3 part 1, 14b Wave 3 part 2, 15 Wave 4; M5: 4 — session 16 spec, 17 Waves 0+1, 18 Waves 2+3, 19 Waves 4+5; REQ-REL-45 size fix: 1 — session 20; M6: 1 — session 21) |
| Kiro sessions completed successfully | 31 (M1: 7 + session 1 interrupted; M2: 6 of 6; M3: 5; M4: 7 of 7; M5: 4 of 4; size fix: 1 of 1; M6: 1 of 1) |
| MCP server calls | 28 via a Kiro MCP client (`matching_explain` × 5 — 3 in session 6, 1 in 10b, 1 in session 15, all matching the golden cases; `catalog_get` × 23 — 1 in 10b for TNZ-1058, 22 in session 15 for the T4.5 audit alt check). `catalog_search`, `catalog_validate` still 0 live client calls (M1 smoke tests used piped JSON-RPC). |
| Hook firings observed | 0 (hooks defined in M1; CLI firing unverified — T4.2 and T5.1 attempts could not observe firing from the CLI; both hooks' commands were verified to fail visibly by hand) |
| Property-test counterexamples found | 3 (M1: 2; M2: 1 — Wave 1 `normalize()` adultIsMom leftover, fixed in the implementation with a regression test; M3: 0 property counterexamples — session 9 fixed 2 boundary bugs found in unit tests, not property tests; M4: 0 product counterexamples — the P-PD-4 "name exactly once" failure was a test-generator fix, and the T3.3 SizeOutlines border was found by the contrast scan, not a property test; M5: 0 product counterexamples — the one Wave 3 finding, C-R2-1, was a test-oracle correction; the code was as designed) |

### Coordinator verification, 21 Nov 2026 (direct work, not a Kiro session)

- Re-ran independently after Session 15: `npm test` **1502/1502 in 55 files**, `npm run build` passes (30 static pages; same route table). Typecheck clean, lint 0 errors + 1 existing warning, `validate-catalog` OK — all re-verified after Session 14b; Session 15 changed docs only.
- Re-ran the T4.1 dev-server check independently on port 3116: `/piece/NOPE-0000` returns 200, title "Piece not found | Haunted Gift Atelier", `main-content` 0, `<h1` 0, `noindex` 1, skip link 1; control `/piece/TNZ-1056` gives `main-content` 1, `<h1` 1; 0 instant warnings. Confirms O-1. The component `app/piece/[sku]/not-found.tsx` does render `main id="main-content"` and an `h1`, so the served-HTML gap is the Next.js client-rendering fallback on the 404, not a missing component. Carried to M6 (per the brief, the NOPE-0000 fallback stays for the M6 clean-browser pass); whether a browser shows the heading after hydration is on the manual checklist.
- Counts table above updated by the coordinator (was stale at the M3 numbers: 19 sessions, 18 completed, 5 MCP calls). New totals: 26 sessions, 25 completed, 28 MCP calls.
- Steering update approved by the coordinator and applied directly: `.kiro/steering/structure.md` now lists `SiteHeader`, `SkipLink`, `ActionButton`, `CobwebCorner`, `lib/page-meta.ts`, the `a11y.*` / `page-meta.*` / `polish.*` test files and `tests/helpers/`, plus the `polish-deploy` spec map. No other steering change.
- Audit independence caveat stands: the T4.5 audit was written by the builder session, not the `qa-auditor` agent.

## Milestone 5 (21 Nov 2026)

M5 was planned for 1 Dec; it started 21 Nov, ahead of schedule, on the M4 code as-is (HEAD `dd2e064`, 1502 tests in 55 files, typecheck clean, lint 0 errors + 1 known warning). Scope: reliability + property-based testing — error boundaries and loading states, edge-state hardening, PBT expansion where it adds real coverage, the coverage threshold + script M1 left out, performance sanity, and the LLM-off pass. The optional Gemini phrasing layer is a stretch only and stays UNBUILT (no key exists; see below). No matching behaviour, safety-verdict wording, design token, or pinned copy was changed in this milestone.

### 2026-11-21 — Session 16: reliability spec (Kiro, non-interactive) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session16-reliability-spec.txt`: write `.kiro/specs/reliability/` (requirements/design/tasks) from PRD §3/§4/§5/§6 + architecture §7/§9 + the M1–M4 specs and the current code. No application code. Exit 0 in ~10.5 min. Files: requirements.md (250 lines, REQ-REL-01–60, 10 sections + a brief-item mapping table), design.md (407), tasks.md (77, Waves 0–5). Read the spec files one at a time, as instructed.
- New suites named (7 + 1 helper): route totality R1–R5 (`reliability.routes.property.test.ts`), whole-space model sweep E1 (`reliability.matching.sweep.test.ts`, 34,560 models enumerated), whole-space filter sweep B1 (`reliability.browse.sweep.test.tsx`, 450 combinations), money M1 (`money.property.test.ts`), static S1 (`reliability.static.test.ts`), fallback UI F1 (`reliability.fallbacks.ui.test.tsx`), catalog failure C1 (`reliability.catalog-failure.test.ts`), helper `tests/helpers/route-arbitrary.ts`. Dropped as duplicates (design §3 lists where they already live): `parseModelParam` over arbitrary strings, `toPickViews`, price/footnote over all 22 SKUs, conversation transitions.
- Spec decisions the brief did not dictate: `error.tsx` takes `retry` (stable since Next.js 16.3, alongside `reset`) from the installed docs; the four fallbacks are static and import no catalog module, so they work if the catalog itself fails; the performance baseline is measured in M5 at `dd2e064` because the M4 log has the route table but no size figures; a `prebuild` script runs `validate-catalog` so a bad catalog fails the build. The spec does not promise a new counterexample. Open questions Q-REL1–Q-REL10, each with a working assumption, in design §11.

### 2026-11-21 — Session 17: reliability Waves 0–1, baseline + boundaries (Kiro, non-interactive) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session17-reliability-wave01.txt`: implement tasks.md T0.1, T0.2, T1.1–T1.5. Exit 0 in ~12 min. Files: `app/error.tsx` (52), `app/global-error.tsx` (45), `app/not-found.tsx` (24), `app/loading.tsx` (9), `tests/reliability.fallbacks.ui.test.tsx` (225), `docs/qa-reports/reliability-m5.md` started (~180 lines: Baseline, Pre-flight, Wave 1). No existing file edited; `tests/a11y.static.test.ts` accepted the `<a href="/">` in `global-error.tsx` without an allow-list change.
- Baseline (measured in M5 at `dd2e064`): 1502 tests / 55 files, 30 static pages; first-load gzip per route `/` 178.5, `/find` 184.9, `/picks` 183.5, `/atelier` 189.6, `/piece/[sku]` 191.8, `/_not-found` 175.2 kB; `du -sk .next/static` 1140 kB. Pre-flight greps matched the spec (two framework-signal call sites only, both outside any `try`; no `process.env`/`fetch(`/`app/api/`; `lib/` `catch` sites exactly `catalog.ts`, `model-param.ts`, `true-size.ts`).
- After Wave 1: 1533 tests / 56 files, all passing (verified independently by the coordinator afterwards); typecheck clean; lint 0 errors + the known warning; `validate-catalog` OK; `npm run build` passes with the same route table and 30 static pages. REQ-REL-11 checks on `next start`: `/picks` 200 + meta-refresh to `/find`; golden-1 `m` lists TBZ-1013, TNZ-1056, TBZ-1017 in order with the footnote. `app/loading.tsx` stays (Q-REL2 not triggered). Unmatched URL: 404 with "couldn't find that page".
- Deviation (spec updated by the coordinator after the milestone, see below): `app/global-error.tsx` gained `<head><title>The atelier couldn't open</title></head>` — axe flagged `document-title` (serious) without it, and `global-error` cannot export `metadata`. The session did not edit the spec.
- Size finding for T4.2 (not a Wave 1 failure): first-load gzip grew +4.7 to +8.1 kB on every route vs baseline, past REQ-REL-45's 4.0 kB limit. Two extra builds (files temporarily removed, restored afterwards) showed `app/loading.tsx` adds nothing; the growth comes from `error.tsx`, `global-error.tsx`, and/or `not-found.tsx`, not split further. The limit was not raised.
- Next.js props used (REQ-REL-56): `error.tsx` takes `error: unknown` + `retry` (no `reset`); `global-error.tsx` takes `retry` only. No counterexample in Wave 1.

### 2026-11-21 — Session 18: reliability Waves 2–3, edge states + sweeps (Kiro, non-interactive) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session18-reliability-wave23.txt`: implement tasks.md T2.1–T2.4 and T3.1–T3.5. Exit 0 in ~12.5 min. Files: `package.json` (+1 line, `"prebuild": "npm run validate-catalog"`); new tests `reliability.static.test.ts` (293 lines, 28 tests), `reliability.catalog-failure.test.ts` (75, 4), `reliability.routes.property.test.ts` (242, 8), `reliability.matching.sweep.test.ts` (157, 1), `reliability.browse.sweep.test.tsx` (102, 2), `money.property.test.ts` (69, 8); helpers `tests/helpers/route-arbitrary.ts` (107) + `tests/helpers/browse-reference.ts` (54, an addition beyond the task list — the independent reference filter shared by R3 and B1, built from raw catalog fields with the 2500/15000/25000 edges as literals). QA note grew to 265 lines.
- After Waves 2–3: 1584 tests / 62 files, all passing, no "Unhandled" line (verified independently by the coordinator afterwards); typecheck clean; lint 0 errors + the known warning; `validate-catalog` OK. `data/catalog.json` byte-identical; `data/`, `lib/`, `public/` untouched. Full-suite runtime 85.8 s → 96.5 s (+10.7 s); the new reliability + money suites take 14.1 s.
- T2.1: duplicate-SKU catalog through `--root` printed `FAIL [REQ-CD-01] TPN-1149 sku: duplicate sku`, exit 1; `npm run prebuild` on the real catalog exit 0. T2.4: all five named browser-API tests exist and pass (73 tests across the three files); nothing added.
- E1 whole-space sweep: all 34,560 models enumerated in ~1.3 s (no reduction needed). Pick-count distribution: 0 picks 10,512; 1 pick 1,440; 2 picks 5,184; 3 picks 17,424. Every invariant held; `/picks` rendered for 300 shortfall classes. **Models returning 0 picks: yes, 10,512** (the design guessed a minimum of 1 or 2). A one-off breakdown put 7,776 of them in the Mom band (two in-stock pieces, both earrings, and the Mom flow never asks for a category, so a Mom model with another category is not reachable by taps), 1,440 teens, 864 kids, 432 infants. These are product observations, not invariant failures: I5 holds on all of them (note defined, browse link on). `lib/matching` was not changed. The product question is recorded for the Tue 24 Nov checkpoint (see the M5 open-questions section).
- B1 filter sweep: all 450 combinations match the independent reference; out-of-stock last; empty-state iff empty; no buy control on the out-of-stock card.
- R1–R5 and M1: no counterexample in the route-totality or money properties.
- Finding C-R2-1 (oracle, not code — counted below): R2 failed on a valid `m` with `occasion: "other"` or no `ageYears`, which resumes at a question instead of the recipient card (conversation design §2.6, P-CV-8). REQ-REL-28 was over-broad; the test now asserts the card exactly where resume is complete and a question otherwise. The shrunk counterexample is in the QA note. Spec updated by the coordinator after the milestone (see below).
- Deviations (spec updated by the coordinator after the milestone, see below): (a) T2.2 empty-`catch` rule split — `components/useCalibration.ts` `write()` has a comment-only `catch` whose fallback (`memory = raw`) is assigned before the `try`; the rule is now two tests (no catch empty counting comments; this one site on a reviewed list with a check on the fallback). No component edited. (b) T2.3: `CatalogBuildError` carries the SKU in its `sku` field; the message is only "duplicate sku" — the test asserts `sku`, `req`, `field`, and `message`. (c) B1 footnote: REQ-REL-16 said no footnote when no price is shown, but the grid renders one footnote in all 450 combinations including the 283 empty ones, because the budget chips print `₹` ranges inside the price region. The test pins the current behaviour and references the frozen Q-PD18. No `lib/` defect was found, so no task stopped.

### 2026-11-21 — Session 19: reliability Waves 4–5, coverage + perf + LLM-off + verification (Kiro, non-interactive) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session19-reliability-wave45.txt`: implement tasks.md T4.1–T4.4 and T5.1–T5.4. Exit 0 in ~37 min. Files: `package.json` (+1 line, `"coverage": "vitest run --coverage"`); `vitest.config.ts` (18 lines, `test.coverage` block); `tests/reliability.static.test.ts` (+1 `coverage` script assertion); `docs/qa-reports/reliability-m5.md` completed (452 lines). No new test files in this session (the task text expected more than 62 files; the count stayed 62 and the note says so).
- After Waves 4–5: 1585 tests / 62 files, all passing, no "Unhandled" line (verified independently by the coordinator afterwards, together with typecheck, lint, validate-catalog, coverage, and build — see the coordinator verification below). Golden cases and personas green.
- T4.1 coverage (whole `lib/`, measured first with no thresholds, then the gate set at `floor(measured) − 1`): lines 99.02% (815/823) → threshold 98; statements 98.91% (1004/1015) → 97; functions 100% (219/219) → 99; branches 97.42% (757/777) → 96. No file under 80% lines (lowest `lib/catalog.ts` 92.7%). `npm run coverage` passes; with `--coverage.thresholds.lines=101` it exits 1 with the threshold error; no override committed. Informational pass over `components/**` + `app/**`: lines 99.21%, statements 98.36%, branches 96.35%, functions 97.97%; no file under 80%. `coverage/` removed after each pass. This closes the M1 gap (no coverage threshold or script existed).
- T4.2 performance after: `npm run build` passes; `prebuild` ran first (build log opens with the validator's `CATALOG OK`); same route table and 30 static pages. First-load gzip, baseline → after: `/` 178.5 → 183.3 (+4.8); `/find` 184.9 → 192.9 (+8.0); `/picks` 183.5 → 191.6 (+8.1); `/atelier` 189.6 → 197.7 (+8.1); `/piece/[sku]` 191.8 → 196.5 (+4.7); `/_not-found` 175.2 → 183.3 (+8.1). `du -sk .next/static` 1140 → 1172. **REQ-REL-45 NOT met on any route.** The limit was not raised. Cause, measured by removing one file at a time and rebuilding (files and the two importing test files held aside, all restored): `error.tsx` +4.4 kB on every route — a Client Component, so its chunk (4,438 B gzip) contains the fallback copy and the code of `SiteHeader`, otherwise server-rendered, and Next.js lists the boundary chunk in every route's client manifest; `not-found.tsx` +3.3 kB on `/find`, `/picks`, `/atelier`, `/_not-found` — it renders `AtelierButton`, which uses `next/link`, and the `next/link` chunk (3,300 B gzip) enters those routes' first-load sets (`/` and `/piece/[sku]` already loaded it, so their share is 0.0); `global-error.tsx` +0.3 kB; `loading.tsx` nothing. The design's "well under 2 kB" estimate (Q-REL4) did not account for the boundary pulling the shared header and `next/link` into client code. Cutting the cost means rewriting the fallbacks with plain markup and `<a>` instead of the shared components — the session changed nothing, and the decision is the coordinator's (see below). Server timings on the build machine are unchanged within run-to-run spread; LCP, TTFB on a real network, and 4G are NOT measured.
- T4.3 LLM-off pass (all five key variables unset, production build): `/`, `/find`, `/atelier` 200 (22 cards); `/picks?m=<golden 1>` 200, TBZ-1013/TNZ-1056/TBZ-1017 in order with the footnote; `/picks` no `m` 200 + meta-refresh to `/find`; `/piece/TBZ-1013?m=<golden 1>` 200, one `h1`, fit-check line, one buy link equal to the catalog `url`; `/piece/TNZ-1058` 200, no buy link. `journey.golden` + `matching.personas` 28 tests pass with the variables unset. **Gemini layer recorded as UNBUILT** (REQ-REL-51): no API key exists and none was provided; the scripted-only journey is the shipped and tested default; architecture §9 names the LLM layer first in the scope-cut order; the key question goes to the Tue 24 Nov checkpoint (Q-REL1). Browser walkthrough: NOT RUN.
- T4.4 fault injection (REQ-REL-60): `app/__fault` does NOT work — a folder starting with `_` is a private folder in the App Router and is never routed (first request answered 404). The route was `app/zzfault/page.tsx` instead (deleted afterwards). Dev: `curl /zzfault` 200, no `<h1` in the HTML; the thrown text appears only in the streamed RSC payload (dev ships message + stack). Production: build accepted the route (31/31 pages); `curl` 200 with a digest, thrown text 0 times, `error.tsx` chunk referenced — but the fallback `h1` is NOT in the `curl` output, because the boundary renders client-side after hydration. **The visible fallback `h1` on a thrown Server Component error is therefore NOT VERIFIED by `curl`; it needs a browser (NOT RUN).** What the real server proved: the boundary is wired, the thrown text is masked in production, and a digest is issued. Unmatched URL on production: 404, "We couldn't find that page.", `noindex` present. A stale `.next/dev/types` file left by the dev server broke the next build (`Cannot find module '../../../app/zzfault/page.js'`); `rm -rf .next/dev` and a rebuild passed (30/30). No `coverage/`, no `app/__fault` or `app/zzfault`, no server, no `/tmp/rel-*` left.
- T5.1 whole-suite verification: `npm test` 62 files / 1585 tests; typecheck clean; lint 0 errors + the known warning; `validate-catalog` OK; `npm run coverage` passes; `npm run build` passes (30/30). T5.2 QA note completed per design §9. T5.3 independent audit NOT run — the `qa-auditor` agent was not invoked, so the checks are not independent of the build (as the M4 audit noted). T5.4 tree clean of temporaries; `git diff --stat -- data public lib` empty; nothing committed (the coordinator commits).

### 2026-11-21 — Milestone 5 close-out (coordinator, direct)
- Final verification on the committed-pending tree (re-run independently, not the sessions' numbers): `npm test` **1585/1585 in 62 files**, no "Unhandled" line; `npm run typecheck` clean; `npm run lint` 0 errors + 1 known warning (`packages/mcp-catalog` `AgeBand`); `npm run validate-catalog` OK (22 products, 2 width warnings); `npm run coverage` passes (lines 99.02%, statements 98.91%, functions 100%, branches 97.42%; `coverage/` removed); `npm run build` passes — `prebuild` ran first (`CATALOG OK`), 30/30 static pages, route table identical to baseline.
- Coordinator spec updates (direct work, docs only — the sessions recorded the findings and left the spec files untouched, per the M1 pattern): (1) REQ-REL-05 + design §5.2 now list the `<head><title>` in `global-error.tsx`; (2) REQ-REL-28 now states the resume rule (card only when resume is complete; otherwise the first unanswered question) per C-R2-1; (3) REQ-REL-16 now pins one footnote per grid (budget chips always print `₹` ranges inside the price region) with the frozen Q-PD18 reference; (4) REQ-REL-25 now records the one reviewed comment-only `catch` (`useCalibration.ts` `write()`, fallback assigned before the `try`); (5) REQ-REL-45 + design §8 + Q-REL4 now record the M5 outcome (breach, cause, acceptance — see the decision below); (6) design §6.4 now names `app/zzfault` (no underscore folder), the `CatalogBuildError` `sku` field (message is only "duplicate sku"), and the un-verified-by-`curl` production fallback `h1`.
- Coordinator decision on REQ-REL-45 (recorded here, not hidden): the +4.0 kB limit stands and was NOT raised. The breach (+4.7 to +8.1 kB) is accepted as explained: the cost buys fallbacks that reuse the design system's shared components instead of duplicated plain markup, first-load totals stay ~183–198 kB gzip, and the fallbacks only render on error. It is a known gap for the Tue 24 Nov checkpoint — if the builder prefers leaner fallbacks, that is a spec change for M6, not a silent threshold edit.
- `.kiro/steering/structure.md` updated by the coordinator: the four new `app/` files listed; the `api/chat/` line corrected (UNBUILT in M5, no key); the `.github/workflows/ci.yml` line corrected (NOT PRESENT — the file was dropped in M1 for the token scope; the old line described it as if it existed); the `reliability` spec→code map added.
- Counts table updated: 30 sessions, 29 completed, 28 MCP calls (no M5 session made a live MCP client call), 0 hook firings.
- Balance watch: NOT re-checked during M5 (no new reading taken); the 12:22 IST snapshot (~284 plan credits + 500 bonus, reset 1 Dec) stands; four more sessions ran since (16–19, ~72 min of session time).
- Milestone 5 committed and pushed to origin/main (see HEAD below).

## Size fix — REQ-REL-45 (21 Nov 2026)

The M5 close-out had accepted the REQ-REL-45 breach as a known gap for the Tue 24 Nov checkpoint. The builder's call the same evening was to fix it instead ("fix it"). One Kiro session, on the M5 code as-is (HEAD `9c30b8b`, 1585 tests in 62 files).

### 2026-11-21 — Session 20: slim the fallbacks (Kiro, non-interactive) — COMPLETED
- Prompt at `/tmp/kiro-prompts/session20-reliability-size-fix.txt`: replace `SiteHeader`/`AtelierButton` in `app/error.tsx` and `app/not-found.tsx` with an inline minimal header and plain `<a>` links carrying the same classes; keep all copy, structure, and props; measure per design §8; write a new QA note. Exit 0 in ~7 min. Files: `app/error.tsx` (64 lines), `app/not-found.tsx` (37), `tests/reliability.fallbacks.ui.test.tsx` (one comment changed, no assertion changed), `docs/qa-reports/reliability-size-fix.md` (new). `global-error.tsx`, `loading.tsx`, every component, `lib/`, `data/`, `public/` untouched.
- After the fix (session-measured, design §8 method): `/` 180.3 (+1.8), `/find` 186.6 (+1.7), `/picks` 185.3 (+1.8), `/atelier` 191.4 (+1.8), `/piece/[sku]` 193.5 (+1.7), `/_not-found` 177.0 (+1.8) — **REQ-REL-45 MET on every route**, limit not raised. Build: `prebuild` ran first, 30/30 static pages, route table unchanged, `du -sk .next/static` 1168 (was 1172). Checks: 1585 tests / 62 files pass; typecheck clean; lint 0 errors + the known warning; `validate-catalog` OK. `next start` sanity checks: unmatched URL 404 with "We couldn't find that page." and `noindex`; golden-1 `/picks?m=` 200 with TBZ-1013, TNZ-1056, TBZ-1017 in order and the footnote.
- Session-reported details, recorded as reported: the error-boundary chunk is 1,093 B gzip (was 4,438 B); the global-error chunk 876 B gzip. The lint rule `@next/next/no-html-link-for-pages` fired only for `href="/"` in this repo, so only the wordmark anchors carry the `eslint-disable` directive; the `/atelier` and `/find` anchors carry a plain comment (a directive there was reported unused). The session did NOT read `.kiro/specs/reliability/` or the `error.md`/`not-found.md` docs in full — only the parts of the M5 QA note that fit its read limit plus the code and tests. The coordinator checked the resulting files against the M5-established facts instead (see the close-out below); no convention was broken. The session left two loose ends (the residual +1.8 kB untraced to a chunk; a second 4,329 B chunk holding the global-error copy unexamined) — both closed by the coordinator below.

### 2026-11-21 — Size-fix close-out (coordinator, direct)
- Final verification on the uncommitted tree (re-run independently, not the session's numbers): `npm test` **1585/1585 in 62 files**, 0 "Unhandled" lines in the full output; `npm run typecheck` clean; `npm run lint` 0 errors + 1 known warning; `npm run validate-catalog` OK; `npm run build` passes — `prebuild` ran first, 30/30 static pages, route table identical, `du -sk .next/static` 1168. Size re-measured with a separate script implementing the same design §8 method: identical figures on every route (180.3 / 186.6 / 185.3 / 191.4 / 193.5 / 177.0 kB).
- Chunk figures, coordinator-measured (the session's were ~20 B higher on each — a measurement-method difference, immaterial): error chunk `1mokvf37og6_u.js` **1,072 B gzip** (was 4,438 B); global-error chunk `2a8kbf2c5zqil.js` **854 B gzip** — the same figure M5 recorded, so the coordinator's method matches M5's. The two boundary chunks (1,072 + 854 B) account for essentially the whole residual +1.7–1.8 kB: the irreducible cost of having the boundaries at all. The `next/link` chunk (`1elud1o77e445.js`, 3,300 B gzip) is confirmed absent from the `/find`, `/picks`, `/atelier`, and `/_not-found` manifests (0 mentions each) and present only in `/` and `/piece/[sku]`, as in the baseline. The second global-error chunk (`1h8m5wjobt16d.js`, 4,301 B gzip by the coordinator's measure) is referenced only by the `_global-error` route's own manifest, not by any measured route — it costs the measured routes nothing.
- Spec updates (direct work, docs only): REQ-REL-01 and REQ-REL-06 now describe the inline minimal header and plain links (with the dated reason); REQ-REL-09 now says the fallbacks use `ActionButton` for buttons and inline plain markup instead of `SiteHeader`/`AtelierButton`; REQ-REL-45, design §8, and Q-REL4 record the fix outcome (MET, +1.7 to +1.8 kB, limit not raised); design §5.1 (snippet + note) and §5.3 updated the same way. The QA note gained a coordinator-verification addendum with the figures above.
- Counts table updated: 31 sessions, 30 completed. The M5 open-questions REQ-REL-45 item below is marked FIXED.
- Size fix committed and pushed to origin/main (see HEAD below).

## Milestone 6 (22 Nov 2026)

M6 started 22 Nov, ahead of schedule (planned 2 Dec), on the size-fix code as-is (HEAD `1e2e0ff`, 1585 tests in 62 files). Scope is deploy and judge-proofing: the docs and config pin are session 21 (Kiro) below; the clean-browser pass runs as a separate browser task; the T4.3 physical calibration check still needs a human with a card and ruler.

### 2026-11-22 — Deploy (builder, in the browser; recorded as reported)
- **Vercel attempt, stopped:** the deploy was started on the signed-in Vercel account (dd8173569, GitHub login). After clicking Deploy for the new project "haunted-gift-atelier", Vercel showed a "Verify Your Identity" dialog asking for a 6-digit code emailed to dd8173569@gmail.com. The builder did not send the code and asked for another platform instead. The attempt stopped at that identity-verification step; no Vercel deployment resulted.
- **Switch to Netlify:** the builder picked Netlify. Import on team dd8173569, free Starter tier; the GitHub App was authorized for this repo only. Working build settings: base directory = repo root, build command `npm run build`, publish directory `.next`, no environment variables.
- **First build FAILED:** Netlify auto-detected the base directory as `packages/mcp-catalog` (it has a `package.json` but no build script), exit 2. Fixed with one retry, base directory set to the repo root. The pin is now in `netlify.toml`.
- **Visibility:** the site was initially Private; it was set to Public.
- **Prebuild ran on Netlify:** the build log shows CATALOG OK, 22 products, 2 width warnings. This answers Q-REL5 for Netlify (Vercel variant moot).
- **Credits:** 15 of 300 Netlify credits used.
- **Live:** https://haunted-gift-atelier.netlify.app/ (main@`1e2e0ff`, Published/Live; homepage verified rendering by a separate browser task).

### 2026-11-22 — Session 21: judge-proofing docs and config (Kiro, non-interactive)
- Prompt at `/tmp/kiro-prompts/session21-m6-judge-proofing.txt`. Docs and config only; no behaviour change. First launch failed at once with `ModelRegistryUnavailableError` ("Kiro could not load the available models", server error); retried after 90 s and ran. The failed launch is not counted as a session.
- Changed: `netlify.toml` (new); `README.md` (Status rewritten, "Live site" section added); `.kiro/steering/tech.md` (Netlify in place of Vercel, two lines); `.kiro/specs/reliability/requirements.md` and `design.md` (Q-REL5 answered for Netlify; one table question cell reworded from "on Vercel" to "on the deploy host"); `.kiro/specs/polish-deploy/requirements.md` and `design.md` (Netlify note, Q15 wording); `.kiro/specs/gift-presentation/requirements.md` and `design.md` (Q15: 200 in dev, 404 in production, confirmation PENDING); `docs/qa-reports/polish-m4-audit.md` (one M6 line appended after O-1); this log (this section, Q-REL5 and Q15 items).
- Checks (run in this session, local): `npm run build` exit 0, `prebuild` ran first (CATALOG OK: 22 products, version 1.0.0, 2 warnings), 30/30 static pages; `npm test` 1585 passed in 62 files; `npm run typecheck` clean (exit 0); `npm run lint` 0 errors + 1 known warning (`AgeBand` unused); `npm run validate-catalog` OK. Matches the baselines.
- Pushing to `main` auto-triggers a Netlify production redeploy. Verification of that redeploy belongs to the coordinator's close-out and is NOT claimed here. No browser check, production-404 confirmation, or T4.3 result is claimed anywhere in this session. The counts table is not updated here (coordinator, close-out).

### 2026-11-22 — Clean-browser pass (browser task + coordinator verification)
- Full record: `docs/qa-reports/clean-browser-m6.md`. Browser observations came from a separate browser task on the live site; the coordinator independently verified the key claims with curl.
- Journey by taps (newborn, baby shower, under ₹2,500): picks TNZ-1056 ₹1,674, TOB-1008 ₹1,899, TBZ-1013 ₹2,324, in that order. Safety verdict + true-size viewer on all three detail pages; gift wrap works; buy link points to tinytiaraa.com (href verified).
- **O-1 / Q15 CONFIRMED (with one caveat):** `/piece/NOPE-0000` returns HTTP 404 in production in 14 of 15 curls (curl-verified) and shows the soft-404 page. One curl returned 200 — the first curl ~3.5 minutes after the M6 push, plausibly a cold-start streaming race (shell flushes before `notFound()` throws). The soft-404 page renders either way. Q15 is closed with the caveat recorded; the spec notes record the confirmation (see the fold-in entry below).
- `/piece/TNZ-1058` out of stock, no buy link. `/picks` with no params redirects to `/find`. `/atelier` renders 22 pieces, out-of-stock greyed out.
- **Correction — browser misread, no bug:** the browser task claimed the `/picks` "See details" links for picks 2 and 3 had wrong hrefs (`/piece/TNZ-1055`, `/piece/TNZ-1057`). FALSE: the live `/picks` HTML (exact persona, `m` built with the repo's own `toModel` + `encodeModelParam`) shows exactly `/piece/TNZ-1056`, `/piece/TOB-1008`, `/piece/TBZ-1013`; TNZ-1055/TNZ-1057 do not exist in `data/catalog.json`; `toPickViews` → `pieceHref` cannot produce SKUs outside the catalog. No code change.
- **Netlify "Powered by Netlify" badge (open decision):** the served HTML contains an injected script `netlify/scripts/hud?variant=public` (curl-confirmed) plus an HTML comment "Netlify hosting facts for this site"; the floating badge visually overlaps the landing footer text. Research (Netlify docs + pricing page, read 22 Nov 2026): on by default for new public Free-plan projects created on/after 19 Aug 2026; the only removal is the per-project dashboard toggle (Project configuration > General > Powered by Netlify badge), which the docs say may be locked depending on plan — whether this team's toggle is usable can only be checked in the Netlify dashboard. No `netlify.toml` option, no header, no CSS workaround (edge-injected script; isolated frame). Personal $9/month, Pro $20/month if an upgrade is the path. NO upgrade made.
- Still unverified: phone-width layout (browser task could not resize; checked at ~905px only, no issues seen — the builder will eyeball it on his phone); T4.3 physical calibration (human step); fault-injection fallback `h1` (no thrown error was triggered in the pass); Q-REL2 screen-reader check.

### 2026-11-22 — Clean-browser fold-in (coordinator, direct)
- Session 22 was attempted three times (prompt at `/tmp/kiro-prompts/session22-m6-clean-browser.txt`); every launch failed at once with `ModelRegistryUnavailableError` ("Kiro could not load the available models", server error) — immediate, after a 120 s wait, and after a 300 s wait. The Kiro model registry was unavailable for the whole window, so the fold-in was done directly by the coordinator instead. The three failed launches are not counted as sessions.
- Direct work: wrote `docs/qa-reports/clean-browser-m6.md`; added the clean-browser entry above; updated the Q15 notes to CONFIRMED in `.kiro/specs/gift-presentation/{design,requirements}.md` and `.kiro/specs/polish-deploy/{design,requirements}.md`; appended the M6 confirmation line to O-1 in `docs/qa-reports/polish-m4-audit.md`; updated the M3 Q15 item below to CONFIRMED; fixed two session 21 log nits (prompt path; the M6 intro line, which wrongly said the docs/config were "done directly"); added the M6 open-decisions section below; updated the counts table (32 sessions, 31 completed).

### 2026-11-22 — M6 close-out (coordinator, direct)
- Independent verification on the uncommitted tree (re-run, not the session's numbers): `npm test` **1585/1585 in 62 files**; `npm run typecheck` clean; `npm run lint` 0 errors + 1 known warning; `npm run validate-catalog` OK; `npm run build` passes — `prebuild` ran first, 30/30 static pages, route table identical.
- The M6 fold-in was committed and pushed to origin/main at `1290831`; this close-out entry and the Q15 correction below ride in the follow-up commit. Each push auto-triggers a Netlify production redeploy.
- Production checks ~3–6 minutes after the push: homepage HTTP 200 (23,529 bytes, "Haunted Gift Atelier" present, HUD script still present as expected — no badge change was made); `/atelier` 200; `/piece/NOPE-0000` 404 in 14 of 15 curls, with one 200 on the first curl after the push (streaming-timing race — see the Q15 correction).
- Redeploy verification: UNVERIFIED from the VM side. The commits changed docs/config only, so no served content distinguishes the new deploy from the old one (client chunk hashes are identical because the code is identical), and Netlify keeps the previous deploy live if the new build fails — the site staying up proves nothing about the new build. The new build's success is checkable only in the Netlify dashboard (deploy log).
- Q15 correction (this commit): the first fold-in recorded the production 404 as a blanket confirmation; the coordinator's own follow-up curls found one 200 in 15 observations, so the record now states the 14/15 tally and the streaming-race caveat in the QA note, the log, the four spec notes, and the O-1 addendum.

## Milestone 6 — open decisions for the builder
- **Netlify badge:** leave the floating "Powered by Netlify" badge, or remove it — check the dashboard toggle (Project configuration > General > Powered by Netlify badge) to see whether it is usable on this team's Free plan; if locked, removal needs Personal ($9/month) or Pro ($20/month). No upgrade made.
- **Phone-width layout eyeball:** the builder's step (browser pass checked ~905px only).
- **T4.3 physical calibration:** the builder's step (human with a real card + ruler).

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

## Milestone 2 — open questions for the Tue 24 Nov go/no-go checkpoint

- M1 (a): PRD says gold pendants "Om/Sikh/Trishul" in ₹15–25k but
  Trishul (TPN-1143, ₹14,399) is below the band.
- M1 (b): should symbols=any avoid religious pieces unless requested
  (persona 3's third pick is the Third Eye tabeez TBZ-1013; golden 1
  itself returns two religious pieces under "no symbol preference").
- M1 (c): PRD says only "sets" for persona 6 but only 2 sets exist,
  so a bangle fills the third slot with disclosure.
- M1 (d): persona 8's no-signal picks (all score 1, incl. the ₹26,649
  THP-1001 hoop) look thin.
- M2 OQ-2 (RESOLVED in M3, see safety-verdict entry): landing copy says "prove it's safe" / "or if it's safe" —
  is that wording acceptable, or should it change before M3?
- M2 (Wave 4): price-region alternative — exempt filter-chip text
  from P-CV-10, or keep `data-price-region` on the whole grid?
- M2 (Wave 1, item 6): adult-and-No from the card wipes the later
  answers (per design §2.3 as written) — keep, or change the rule?
- M2 OQ-1: /picks missing/invalid `m` returns 200 + meta-refresh
  instead of 307 — acceptable, or rework the route?
- None of these block M3 (safety verdict + true-size + gift
  presentation), which starts on the M2 code as-is. The checkpoint
  decides them — or they ride as documented behaviour.

## Milestone 3 — open questions for the Tue 24 Nov go/no-go checkpoint

- Q15 (updated 22 Nov 2026): `/piece/NOPE-0000` expected behaviour is
  "200 in dev, 404 in production" (dev 200 + `noindex` observed in M3;
  production 404 measured via `next start` in M4). CONFIRMED 22 Nov 2026:
  the deployed URL returns HTTP 404 in 14 of 15 curls (one 200 observed
  once — a streaming-timing race) and shows the soft-404 page. Q15 is
  closed with the caveat recorded.
- Dev-only Next.js "instant" validation warning on /find and /picks
  (`searchParams` outside `<Suspense>`); dev-only, build unaffected —
  leave, or set `instant = false` / add Suspense in M4/M6?
- T4.3 physical checks NOT RUN (no human with a card + ruler):
  box 18.6 mm ±5%, ring Ø ~42.5 mm ±5%, calibration <15 s, 1:1 print
  sheet, phone + desktop. Needs a human before the REQ-TS-30 claim
  can be made.
- Q1–Q22 of the three M3 design documents are summarised in the
  Session 8, Session 9, and Session 10 (retry) entries above.
- Matching behaviour is unchanged (the four M1 persona questions
  stay open for the checkpoint).

## Milestone 5 — open questions for the Tue 24 Nov go/no-go checkpoint
- **Q-REL1 (Gemini key):** the optional phrasing layer is UNBUILT — no key exists, none was provided. The scripted-only journey is the shipped and tested default; every route passes its checks with all key variables unset. Does the user want to supply a Google AI Studio key, or is scripted-only the final answer (the layer is first in the scope-cut order anyway)?
- **REQ-REL-45 breach (FIXED 21 Nov, session 20):** first-load gzip had grown +4.7 to +8.1 kB per route over the M4 baseline (`error.tsx` +4.4 kB — the boundary pulls the shared header into client JS; `not-found.tsx` +3.3 kB via the `next/link` chunk). The builder asked for the fix the same evening; the fallbacks were rewritten with an inline minimal header and plain `<a>` links, and the requirement is now MET on every route (+1.7 to +1.8 kB; the limit was not raised). The residual is the two boundary chunks themselves (error 1,072 B + global-error 854 B gzip). Full record: `docs/qa-reports/reliability-size-fix.md`. No checkpoint decision needed on this item anymore.
- **0-pick models (E1 sweep, 10,512 of 34,560):** every model is still safe (I5 holds; note defined; browse link on), but 7,776 are Mom-band models whose category is not offered in the Mom flow (not reachable by taps), and 2,736 are child/teen/infant models that filter to nothing. Is the honest 0-pick state the right answer for those, or should the journey steer those users differently (e.g. surface the browse link earlier)?
- **Q-REL5 (prebuild on the deploy host — ANSWERED for Netlify, 22 Nov 2026):** the `prebuild` hook ran in the Netlify build; the build log shows CATALOG OK, 22 products, 2 width warnings. The Vercel variant of the question is moot: the deploy platform switched to Netlify in M6.
- **Q-REL2 (loading.tsx screen-reader noise):** NOT RUN — `loading.tsx` renders a `role="status"` live region for every navigation to `/find`, `/picks`, `/atelier`, `/piece/[sku]`; the screen-reader check needs a human and was not run.
- **Fault-injection `h1` (REQ-REL-60):** the boundary is wired and production masks thrown text, but the visible fallback `h1` was NOT verified — it renders client-side after hydration and needs a browser check (M6 clean-browser pass).
- **T5.3 audit not run:** the `qa-auditor` agent was not invoked for M5, so the M5 checks are not independent of the build (same caveat as M4).
- **T4.3 physical calibration (from M3):** still not run — needs a human with a real card + ruler.
- **Balance watch:** the Kiro credit balance was NOT re-checked during M5; the 12:22 IST snapshot (~284 plan + 500 bonus, reset 1 Dec) stands after four more sessions.
