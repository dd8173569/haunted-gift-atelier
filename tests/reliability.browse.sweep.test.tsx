// B1: whole-space filter sweep, rendered (reliability design §4.3; REQ-REL-16, 33). Exhaustive: no seed, no run count.
// CatalogGrid renders to static markup for each of the 5 × 6 × 3 × 5 = 450 filter combinations and the cards are
// compared with an independent reference written from raw catalog fields (tests/helpers/browse-reference.ts;
// band edges 2500, 15000, 25000 as literals). The markers used are the ones the cards already carry:
// `<article data-sku="…">`, the "Out of stock" badge, and the "Buy on Tiny Tiaraa" link.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CatalogGrid from "../components/CatalogGrid";
import { toBrowseItems, type BrowseFilters } from "../lib/browse";
import { catalog } from "./helpers/matching-fixtures";
import { outOfStockSkus, referenceSkus, urlOfSku } from "./helpers/browse-reference";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

const AGES = ["all", "infants", "kids", "teens", "mom"] as const;
const CATEGORIES = ["all", "pendant", "bracelet", "earrings", "set", "tabeez"] as const;
const METALS = ["all", "gold", "silver"] as const;
const BUDGETS = ["all", "under-2500", "2500-15000", "15000-25000", "25000-plus"] as const;

const FOOTNOTE = "Price as listed on tinytiaraa.com on 21 Nov 2026 — check the store for the current price.";
const EMPTY = "No piece matches those filters.";

const text = (html: string) => html.replaceAll("&#x27;", "'").replaceAll("&amp;", "&").replaceAll("&quot;", '"');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

const items = toBrowseItems(catalog);
const oos = new Set(outOfStockSkus());

describe("B1 /atelier grid over all 450 filter combinations (REQ-REL-16, 33)", () => {
  it("the sweep covers 450 combinations and the reference sees both empty and non-empty selections", () => {
    expect(AGES.length * CATEGORIES.length * METALS.length * BUDGETS.length).toBe(450);
    expect(oos.size).toBe(1);
  });

  it(
    "each combination renders exactly the reference cards, in order, with the empty state, footnote and buy rules",
    () => {
      let combos = 0;
      let empty = 0;
      let withOos = 0;
      for (const age of AGES)
        for (const category of CATEGORIES)
          for (const metal of METALS)
            for (const budget of BUDGETS) {
              combos++;
              const f: BrowseFilters = { age, category, metal, budget };
              const label = JSON.stringify(f);
              const html = text(renderToStaticMarkup(<CatalogGrid items={items} initialFilters={f} />));
              const want = referenceSkus(f);

              // Cards: the same SKUs, in the same order.
              const cards = [...html.matchAll(/<article\b[^>]*data-sku="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
              expect(cards.map((c) => c[1]), label).toEqual(want);

              // Out-of-stock last: once an out-of-stock card appears, only out-of-stock cards follow.
              const flags = cards.map((c) => oos.has(c[1]));
              expect(flags, label).toEqual([...flags].sort((a, b) => Number(a) - Number(b)));
              if (flags.some(Boolean)) withOos++;

              // Empty state: the sentence appears once if and only if the selection is empty.
              if (want.length === 0) empty++;
              expect(count(html, EMPTY), label).toBe(want.length === 0 ? 1 : 0);
              expect(count(html, "Clear filters"), label).toBe(want.length === 0 ? 1 : 0);
              expect(html, label).toContain(`Showing ${want.length} ${want.length === 1 ? "piece" : "pieces"}`);

              // Footnote: one per grid (REQ-CV-35: the grid is one price region). The budget chips print ₹
              // ranges inside that region on every render, so the one footnote is present even when no card
              // is (Q-PD18, frozen: whether budget-band text needs the footnote is not resolved here).
              expect(count(html, FOOTNOTE), label).toBe(1);
              expect(count(html, "data-price-region"), label).toBe(1);
              if (cards.length > 0) {
                expect(html.indexOf(FOOTNOTE), label).toBeLessThan(html.indexOf("<article"));
              }

              // Per card: a price, and a buy control only on in-stock cards, equal to the catalog url.
              for (const [, sku, body] of cards) {
                expect(body, `${label} ${sku}`).toContain("₹");
                const buys = count(body, "Buy on Tiny Tiaraa");
                if (oos.has(sku)) {
                  expect(buys, `${label} ${sku} out-of-stock card`).toBe(0);
                  expect(body, `${label} ${sku}`).toContain("Out of stock");
                  expect(body, `${label} ${sku}`).not.toContain("tinytiaraa.com/product");
                } else {
                  expect(buys, `${label} ${sku}`).toBe(1);
                  expect(count(body, `href="${urlOfSku(sku)}"`), `${label} ${sku}`).toBe(1);
                  expect(body, `${label} ${sku}`).not.toContain("Out of stock");
                }
              }
            }
      console.info(`B1 combinations: ${combos}; empty selections: ${empty}; selections including the out-of-stock card: ${withOos}`);
      expect(combos).toBe(450);
      expect(empty).toBeGreaterThan(0);
      expect(withOos).toBeGreaterThan(0);
    },
    300_000,
  );
});
