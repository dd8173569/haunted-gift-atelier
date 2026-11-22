# Haunted Gift Atelier

A haunted-gift-atelier experience that finds the right baby-jewelry gift by
conversation — then gives it a plain-language fit check, shows it at a size
you calibrate, and wraps it beautifully. Built for **Kiroween 2026** (AWS Kiro
hackathon, Devpost).

The catalog is real: 22 pieces from [Tiny Tiaraa](https://www.tinytiaraa.com)
(prices as listed on 21 Nov 2026), with exact product photos, deterministic
matching, a per-pick safety verdict, and a true-size viewer.

## Status

Milestones 1–5 are done, plus the REQ-REL-45 size fix (21 Nov 2026).
Milestone 6 deployed the app live on Netlify on 22 Nov 2026. Phase 7 (judge
simulation + fixes) followed the same day: 1589 tests in 63 files. See
`docs/kiro-evidence-log.md` for an honest record of what Kiro did vs what
was done directly.

## Live site

- URL: https://haunted-gift-atelier.netlify.app/
- Platform: Netlify, Starter tier (free), connected to this GitHub repo. A push
  to `main` auto-deploys to production.
- Build settings are pinned in `netlify.toml`: base directory = repo root, build
  command `npm run build`, publish directory `.next`, no environment variables.
- `npm run build` runs the `prebuild` catalog validation first. The Netlify
  build log shows `CATALOG OK` (22 products).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest (unit + property tests)
npm run validate-catalog
```

## How Kiro was used

Specs first: `.kiro/specs/` (requirements → design → tasks), steering files
with refusal-led brand rules, hooks (catalog validation, matching tests), a
custom MCP server over the catalog (`packages/mcp-catalog`), and
role-specialised agents (`.kiro/agents/`). 32 Kiro CLI sessions (31 completed)
built it spec-first across 8 specs; the MCP server served 28 live catalog
calls during the build; the suite holds 1589 tests, including property-based
invariants over the whole matching space. Full evidence:
`docs/kiro-evidence-log.md`.

## Data honesty

- Prices are a snapshot as of 21 Nov 2026 — the app carries a snapshot-date
  footnote on every price; the buy link goes to the live store page.
- No MRP exists in the data, so no discounts are ever shown.
- Out-of-stock items are never recommended; they appear greyed-out in browse
  only.
- Safety verdicts are fit checks, not certifications. Nothing is asserted
  without a source field in the catalog record.

## License

MIT — see `LICENSE`.
