---
inclusion: always
---

# Repo structure

```
haunted-gift-atelier/
├── .kiro/                    specs/, steering/, hooks/, agents/, settings/mcp.json (never gitignored)
├── .github/workflows/ci.yml  lint + typecheck + test + validate-catalog
├── app/                      routes only: page.tsx, find/, picks/, piece/[sku]/, atelier/, about/, api/chat/ (M5, optional)
├── components/               React components, PascalCase.tsx (PickCard, SafetyVerdict, TrueSizeViewer, GiftWrap,
│                             CalibrationSlider, SizeOutlines, SizeRuler, PieceFacts, CatalogGrid, PriceFootnote, ProductPhoto, AtelierButton,
│                             SiteHeader, SkipLink, ActionButton, CobwebCorner)
│                             + useCalibration.ts (calibration store hook)
├── lib/                      pure logic, kebab-case.ts: catalog.ts, matching.ts, safety.ts, safety-rules.ts,
│                             safety-materials.ts, safety-weight.ts, true-size.ts, size-spec.ts,
│                             gift-message.ts, piece-view.ts, conversation.ts,
│                             model-param.ts, picks-view.ts, browse.ts, page-meta.ts (page titles/descriptions), catalog-store.ts (parsed catalog for server pages)
│   └── matching/             pipeline stages used by matching.ts (age, filters, scoring, rank, relax, explain, templates, types)
├── data/                     catalog.json, catalog-changelog.md, product-tags.ts, occasion-map.ts, safety-rules.md
├── packages/mcp-catalog/     custom MCP server over the catalog (Node + MCP SDK, stdio)
├── public/catalog/           22 exact product photos named <SKU>.png|jpeg (never edited)
├── scripts/                  validate-catalog.ts (CI + save hook)
├── tests/                    *.test.ts(x): unit, golden, property, component; a11y.* (axe, keyboard, contrast, static, targets),
│                             page-meta.* (titles/descriptions), polish.* (components, copy); tests/helpers/ (axe, contrast, targets,
│                             outline, pages, conversation-actions, source-scan)
├── docs/                     kiro-evidence-log.md, qa-reports/
├── LICENSE (MIT), README.md
```

## Rules

- `app/` holds routes and layout only. Logic goes in `lib/`, UI in `components/`.
- Test files sit in `tests/`, named after what they test: `matching.golden.test.ts`, `matching.property.test.ts`, `catalog.test.ts`.
- One concept per file. Specs map to code: `catalog-data` → `lib/catalog.ts` + `data/` + `scripts/`; `matching-core` → `lib/matching.ts` + `lib/matching/`; `safety-verdict` → `lib/safety.ts` + `lib/safety-rules.ts` + `lib/safety-materials.ts` + `lib/safety-weight.ts` + `data/safety-rules.md`; `true-size-viewer` → `lib/true-size.ts` + `lib/size-spec.ts`; `gift-presentation` → `lib/gift-message.ts` + `lib/piece-view.ts` + `app/piece/[sku]/`; `conversation` → `lib/conversation.ts`.
- Design tokens (colour, spacing, type) live in one Tailwind config location. Components consume tokens only.
- Specs map to code (continued): `polish-deploy` → `lib/page-meta.ts` + `components/SiteHeader.tsx`, `SkipLink.tsx`, `ActionButton.tsx`, `CobwebCorner.tsx`.

## Where data lives

- Product facts: `data/catalog.json` only. Photos: `public/catalog/<SKU>.<ext>`, and `image_file` in the catalog is the bare filename.
- Hand-curated maps (never generated, never LLM-edited): `data/product-tags.ts`, `data/occasion-map.ts`, `data/safety-rules.md` (rules carry IDs, versioned).
- Catalog history: `data/catalog-changelog.md`.
- Evidence of Kiro use (agent runs, MCP calls, hook firings, counterexamples): `docs/kiro-evidence-log.md`.
- Source crawl outside the repo: `hidden_files/catalog/` in the project workspace. The repo copy is the working one.
