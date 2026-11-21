# Kiro evidence log — Haunted Gift Atelier (Kiroween 2026)

Honest record of what Kiro did vs what was done directly. This log is the raw
material for the Devpost Kiro write-up. Nothing here is embellished: if Kiro
did not do something, it says so.

## How Kiro is driven

Kiro CLI 3.5.0, signed in as Builder ID muktiyarahmed380@gmail.com
(Google device flow, 21 Nov 2026 ~12:00 IST). Sessions run non-interactively
from the repo root:

```
kiro-cli chat --no-interactive --trust-all-tools "<prompt>"
```

`--no-interactive` selects the v2 engine unless `--trust-all-tools` is passed,
which selects v3. Prompts are stored in `/tmp/kiro-prompts/` on the build VM
(not in the repo). Default mode is used deliberately: spec mode was not tried
non-interactively in Milestone 1 (reliability over novelty; may be revisited
in later milestones).

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
  (Outcome recorded in the session-1 re-run entry below.)

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

### 2026-11-21 — Session 1b: specs re-run (Kiro) — PENDING LOGIN
- Prompt ready at `/tmp/kiro-prompts/session1b-specs-rerun.txt`: verify the
  existing `catalog-data/requirements.md`, then write the remaining 18 files
  (catalog-data design + tasks, matching-core requirements/design/tasks,
  4 steering files, 2 hooks, 3 agents, MCP settings).
- BLOCKED on the parent agent confirming the new Google login (`whoami`).
  No `kiro-cli` command will run before that confirmation.

## Counts (running totals)

| Metric | Count |
|---|---|
| Kiro sessions (non-interactive CLI) | 2 (smoke test + session 1) |
| Kiro sessions completed successfully | 1 (smoke test; session 1 pending) |
| MCP server calls | 0 (server scaffolded in M1; first calls in M2) |
| Hook firings observed | 0 (hooks defined in M1; CLI firing to be verified) |
| Property-test counterexamples found | 0 |

## Notes

- The Kiro CLI session is Builder ID (free), not the Identity Center Pro plan
  on app.kiro.dev. If a credit/allowance limit is hit, it will be recorded
  here and flagged to the builder — no workarounds.
- Hooks are defined as Kiro hooks v1 JSON. Whether they fire in the CLI (vs
  the IDE) is UNVERIFIED in M1; the write-up will say so if they never fire.
