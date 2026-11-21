# Haunted Gift Atelier

A haunted-gift-atelier experience that finds the right baby-jewelry gift by
conversation — then proves it's safe, shows it true to size, and wraps it
beautifully. Built for **Kiroween 2026** (AWS Kiro hackathon, Devpost).

The catalog is real: 22 pieces from [Tiny Tiaraa](https://www.tinytiaraa.com)
(prices as listed on 21 Nov 2026), with exact product photos, deterministic
matching, a per-pick safety verdict, and a true-size viewer.

## Status

Milestone 1 in progress (22–23 Nov 2026): repo scaffold, Kiro specs
(`catalog-data`, `matching-core`), design tokens, catalog validation, MCP
server skeleton. See `docs/kiro-evidence-log.md` for an honest record of what
Kiro did vs what was done directly.

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
role-specialised agents (`.kiro/agents/`). Full evidence:
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
