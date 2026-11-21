---
inclusion: always
---

# Tech

## Refusals

- NEVER call an LLM, or import an LLM client, anywhere in `lib/`. Matching, safety, true-size, and conversation logic are pure functions. The same input returns the same output.
- NEVER use randomness, the clock, `fetch`, or file I/O inside `lib/matching.ts` or `lib/safety.ts`. Pass the catalog in as an argument.
- NEVER put an ad-hoc colour (`#hex`, `rgb()`, arbitrary Tailwind value like `bg-[#fff]`) in a component. Use Tailwind theme tokens defined in the one design-token config.
- NEVER add a database, auth, payments, or a runtime external API. With the optional LLM route off, the app makes no network call beyond its own origin.
- NEVER disable a failing test or loosen a golden case to make it pass. Fix the code or raise a spec change.
- NEVER commit an API key. Keys live in Vercel env vars.
- NEVER write Next.js code from memory: this repo's Next.js version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` first (see `AGENTS.md`).

## Stack

- Next.js App Router, TypeScript with `strict: true`, Tailwind CSS 4 (design tokens in one config), deployed on Vercel Hobby. Versions are pinned in `package.json`.
- Data: `data/catalog.json` (versioned) and `public/catalog/` photos. No database.
- Fonts: one serif display and one sans through `next/font` (self-hosted).
- Optional LLM: server route `app/api/chat/route.ts` only, phrasing only, absent until Milestone 5, scripted fallback is the default.

## Tests

- Vitest for unit, golden, and property tests; fast-check for properties (seeded, `numRuns ≥ 200`; matching ≥ 500); Testing Library for components. Test files live in `tests/` as `*.test.ts(x)`.
- The three golden cases (PRD §3) are unit tests with exact SKU order and scores.
- Property tests cover the matching invariants I1–I7, the safety invariants, and the calibration round trip (mm → px → mm).
- Coverage target: ≥ 80% on `lib/`.
- No snapshot tests of product data (data changes; invariants do not).
- Commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run validate-catalog`. CI runs all four on every push.
- A property-test counterexample is logged in `docs/kiro-evidence-log.md` with the fix.

## Conventions

- `lib/` files export pure functions and types, with no React imports.
- Product facts reach the UI only through `lib/catalog.ts`. Components do not read `catalog.json` directly.
- Derived fields (`metal`, `price_band`, `weight_g`, `dims`, `tags`) are computed in `parseCatalog()` and never hand-edited.
- Money is an integer number of rupees, formatted by one shared helper in the Indian grouping style (₹2,324).
- Specs are updated when reality diverges from them. They are never silently ignored.
