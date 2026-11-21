// E1: whole-space model sweep (reliability design §4.2; REQ-REL-14, 32). Exhaustive, not sampled: no seed, no run count.
// match() reads ageBand, occasion, budgetBand, metal, symbols, symbolList and category; it does not read
// relationship (REQ-MC) and reads ageYears only through the band. So relationship is fixed ('mom' for the
// Mom band, 'other' otherwise), ageYears is omitted, and the rest is enumerated. Multi-symbol lists are not
// enumerated (2^7 lists); the sampled matching.property suite covers them.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PicksPage from "../app/picks/page";
import {
  AGE_BANDS,
  BUDGET_BANDS,
  CATEGORIES,
  METALS,
  OCCASIONS,
  SYMBOL_KEYS,
} from "../lib/conversation";
import { match } from "../lib/matching";
import type { RecipientModel } from "../lib/matching/types";
import { encodeModelParam } from "../lib/model-param";
import { toPickViews } from "../lib/picks-view";
import { RELIGIOUS_SKUS, catalog } from "./helpers/matching-fixtures";

// next/image is mocked to a plain <img>, as in tests/piece.route.test.tsx.
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    createElement("img", { src, alt, className }),
}));

// Full space: 4 age bands × 8 occasions × 5 budgets × 3 metals × 6 categories × 12 symbol choices.
const OCCASION_AXIS: readonly RecipientModel["occasion"][] = OCCASIONS;

const SYMBOL_AXIS: Pick<RecipientModel, "symbols" | "symbolList">[] = [
  { symbols: "any" },
  { symbols: "zodiac" },
  { symbols: "evil-eye" },
  { symbols: "none-religious" },
  { symbols: "religious" },
  ...SYMBOL_KEYS.map((k) => ({ symbols: "religious" as const, symbolList: [k] })),
];

function* models(): Generator<RecipientModel> {
  for (const ageBand of AGE_BANDS)
    for (const occasion of OCCASION_AXIS)
      for (const budgetBand of BUDGET_BANDS)
        for (const metal of METALS)
          for (const category of CATEGORIES)
            for (const sym of SYMBOL_AXIS)
              yield {
                relationship: ageBand === "mom" ? "mom" : "other",
                ageBand,
                occasion,
                budgetBand,
                metal,
                category,
                ...sym,
              };
}

const text = (html: string) => html.replaceAll("&#x27;", "'").replaceAll("&amp;", "&").replaceAll("&quot;", '"');
const countRe = (hay: string, re: RegExp) => (hay.match(new RegExp(re.source, "g")) ?? []).length;

describe("E1 whole-space model sweep (REQ-REL-14, 32)", () => {
  it(
    "every model: match() returns, at most 3 distinct in-stock picks, views mirror them, shortfall is explained, none-religious holds",
    async () => {
      const started = Date.now();
      const dist = new Map<number, number>();
      const notes = new Map<string, number>();
      type Rep = { model: RecipientModel; skus: string[]; note: string };
      // Coarse classes (pick count, note, age band) are always kept; disclosure variants fill up to the cap of 300.
      const coarse = new Map<string, Rep>();
      const fine = new Map<string, Rep>();
      let total = 0;

      for (const model of models()) {
        total++;
        const r = match(model, catalog);
        const skus = r.picks.map((p) => p.sku);
        const tag = `${encodeModelParam(model)}`;

        if (r.picks.length > 3) expect.fail(`>3 picks for ${tag}`);
        if (new Set(skus).size !== skus.length) expect.fail(`duplicate SKU for ${tag}`);
        for (const p of r.picks) {
          const prod = catalog.products.find((x) => x.sku === p.sku);
          if (!prod || prod.availability !== "In Stock") expect.fail(`out-of-stock or unknown pick ${p.sku} for ${tag}`);
        }
        const views = toPickViews(r, catalog);
        if (JSON.stringify(views.map((v) => v.sku)) !== JSON.stringify(skus)) expect.fail(`views differ for ${tag}`);
        if (r.picks.length < 3 && (r.shortfallNote === undefined || r.shortfallNote === "" || !r.showBrowseLink)) {
          expect.fail(`short result without note or browse link for ${tag}`);
        }
        if (model.symbols === "none-religious" && skus.some((s) => RELIGIOUS_SKUS.includes(s))) {
          expect.fail(`religious piece under none-religious for ${tag}`);
        }

        dist.set(skus.length, (dist.get(skus.length) ?? 0) + 1);
        if (r.picks.length < 3) {
          const note = r.shortfallNote as string;
          notes.set(note, (notes.get(note) ?? 0) + 1);
          const rep = { model, skus, note };
          const ck = JSON.stringify([skus.length, note, model.ageBand]);
          if (!coarse.has(ck)) coarse.set(ck, rep);
          const fk = JSON.stringify([skus.length, note, r.disclosures, model.ageBand]);
          if (!fine.has(fk) && fine.size < 300) fine.set(fk, rep);
        }
      }

      const seconds = (Date.now() - started) / 1000;
      console.info(`E1 models enumerated: ${total} in ${seconds.toFixed(1)} s (checks only, before rendering)`);
      console.info("E1 pick-count distribution:", JSON.stringify(Object.fromEntries([...dist].sort())));
      console.info(`E1 distinct shortfall notes (${notes.size}):`);
      for (const [n, c] of [...notes].sort((a, b) => b[1] - a[1])) console.info(`  ${c} × ${n}`);
      const classes = new Set<Rep>([...coarse.values(), ...fine.values()]);
      const toRender = [...classes].slice(0, 300);
      console.info(
        `E1 shortfall classes: ${coarse.size} coarse, ${fine.size} with disclosures; rendered through PicksPage: ${toRender.length} (cap 300)`,
      );

      expect(total).toBe(4 * 8 * 5 * 3 * 6 * 12);
      expect(total).toBe(34560);

      // Render /picks once per shortfall class and check the REQ-REL-14 markup.
      for (const { model, skus, note } of toRender) {
        const el = await PicksPage({ searchParams: Promise.resolve({ m: encodeModelParam(model) }) });
        const html = text(renderToStaticMarkup(el));
        const label = JSON.stringify(model);
        expect(countRe(html, /<article\b/), `cards for ${label}`).toBe(skus.length);
        expect([...html.matchAll(/id="pick-([A-Z]{3}-\d{4})-name"/g)].map((m) => m[1]), label).toEqual(skus);
        expect(html, label).toContain(note);
        expect(html, label).toContain("Browse the full atelier");
        expect(html, label).toContain("Change my answers");
      }

      // Result of the first run (recorded in docs/qa-reports/reliability-m5.md): 10,512 of 34,560 models return 0
      // picks, 7,776 of them in the Mom band (two in-stock earrings pieces, and the Mom flow never asks for a
      // category). The design guessed a minimum of 1 or 2; the 0-pick rendering is therefore checked through
      // PicksPage above, and the pure-function branch below is only the fallback if the catalog ever changes.
      // Whether any model returns 0 picks is a result. When none does, the 0-pick rendering is checked
      // through the pure view function instead (REQ-REL-14).
      const zero = dist.get(0) ?? 0;
      console.info(`E1 models with 0 picks: ${zero}`);
      if (zero === 0) {
        const empty = match(
          { relationship: "other", ageBand: "kids", occasion: "other", budgetBand: "no-limit", metal: "any", symbols: "any", category: "any" },
          { ...catalog, products: [] },
        );
        expect(empty.picks).toEqual([]);
        expect(toPickViews(empty, catalog)).toEqual([]);
      } else {
        expect(toRender.some((c) => c.skus.length === 0)).toBe(true);
      }
      expect(dist.get(3) ?? 0).toBeGreaterThan(0);
    },
    600_000,
  );
});
