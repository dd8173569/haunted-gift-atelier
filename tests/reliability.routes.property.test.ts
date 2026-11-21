// R1 to R5: route-function totality (reliability design §4.1, §6.2; REQ-REL-13, 15 to 18, 27 to 31).
// Each page's async default export is called as a plain function. A thrown redirect() or notFound() is
// recognised by its digest; anything else is a failure. Resolved elements render with renderToStaticMarkup.
// Frozen M2 OQ-1: the served HTTP status of /picks without `m` (200 plus meta-refresh) is not asserted here;
// only the digest the route function throws is pinned, as tests/picks.ui.test.tsx does.
import fc from "fast-check";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AtelierPage from "../app/atelier/page";
import FindPage from "../app/find/page";
import PicksPage from "../app/picks/page";
import PiecePage from "../app/piece/[sku]/page";
import { INCOMPLETE_NOTICE } from "../components/Conversation";
import { describeModel, momSkipNote } from "../lib/conversation";
import { parseBrowseFilters } from "../lib/browse";
import { match } from "../lib/matching";
import { parseModelParam } from "../lib/model-param";
import { catalog } from "./helpers/matching-fixtures";
import { outOfStockSkus, referenceSkus, urlOfSku } from "./helpers/browse-reference";
import { arbSearchParams, arbParam, arbSku, arbValidParam, isCatalogSku, type SearchParams } from "./helpers/route-arbitrary";

// next/image is mocked to a plain <img>, as in tests/piece.route.test.tsx (createElement keeps this file .ts).
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    createElement("img", { src, alt, className }),
}));

const SEED = 20261201;
const RUNS = 300;
const TIMEOUT = 180_000;
const assert = <T extends unknown[]>(p: fc.IAsyncPropertyWithHooks<T>, numRuns = RUNS) =>
  fc.assert(p, { seed: SEED, numRuns });

/** React escapes quotes and ampersands in text; undo that so exact phrases can be compared. */
const text = (html: string) => html.replaceAll("&#x27;", "'").replaceAll("&amp;", "&").replaceAll("&quot;", '"');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const countRe = (hay: string, re: RegExp) => (hay.match(new RegExp(re.source, "g")) ?? []).length;

type Outcome =
  | { kind: "resolved"; html: string }
  | { kind: "redirect"; target: string }
  | { kind: "notfound" }
  | { kind: "other"; thrown: unknown };

/** Framework-signal recognition, design §4.1. */
async function run(call: () => Promise<unknown>): Promise<Outcome> {
  try {
    const el = (await call()) as ReactElement;
    return { kind: "resolved", html: text(renderToStaticMarkup(el)) };
  } catch (e) {
    const digest = (e as { digest?: unknown } | null)?.digest;
    if (typeof digest === "string") {
      const r = /^NEXT_REDIRECT;(replace|push);([^;]*);/.exec(digest);
      if (r) return { kind: "redirect", target: r[2] };
      if (digest === "NEXT_HTTP_ERROR_FALLBACK;404") return { kind: "notfound" };
    }
    return { kind: "other", thrown: e };
  }
}

const picks = (sp: SearchParams) => run(() => PicksPage({ searchParams: Promise.resolve(sp) }));
const find = (sp: SearchParams) => run(() => FindPage({ searchParams: Promise.resolve(sp) }));
const atelier = (sp: SearchParams) => run(() => AtelierPage({ searchParams: Promise.resolve(sp) }));
const piece = (sku: string, sp: SearchParams) =>
  run(() => PiecePage({ params: Promise.resolve({ sku }), searchParams: Promise.resolve(sp) }));

const FOOTNOTE = "Price as listed on tinytiaraa.com on 21 Nov 2026 — check the store for the current price.";

describe("generators reach their edge classes (a property over a generator that never varies proves nothing)", () => {
  it("arbParam yields missing, invalid, and ok; arbSku yields known and unknown", () => {
    const statuses = new Set(fc.sample(arbParam, { seed: SEED, numRuns: 400 }).map((p) => parseModelParam(p).status));
    expect([...statuses].sort()).toEqual(["invalid", "missing", "ok"]);
    const skus = fc.sample(arbSku, { seed: SEED, numRuns: 400 });
    expect(skus.some(isCatalogSku)).toBe(true);
    expect(skus.some((s) => !isCatalogSku(s))).toBe(true);
  });
});

describe("R1 /picks (REQ-REL-13, 27)", () => {
  it(
    "redirects to /find or /find?notice=incomplete, or renders exactly the match() picks; nothing else is thrown",
    async () => {
      const stats = { missing: 0, invalid: 0, ok: 0 };
      await assert(
        fc.asyncProperty(arbSearchParams, async (sp) => {
          const parsed = parseModelParam(sp.m);
          const out = await picks(sp);
          stats[parsed.status]++;
          if (parsed.status === "missing") return out.kind === "redirect" && out.target === "/find";
          if (parsed.status === "invalid") {
            return out.kind === "redirect" && out.target === "/find?notice=incomplete";
          }
          if (out.kind !== "resolved") return false;
          const expected = match(parsed.model, catalog).picks.map((p) => p.sku);
          const shown = [...out.html.matchAll(/id="pick-([A-Z]{3}-\d{4})-name"/g)].map((m) => m[1]);
          return (
            countRe(out.html, /<h1\b/) === 1 &&
            countRe(out.html, /<article\b/) <= 3 &&
            countRe(out.html, /<article\b/) === expected.length &&
            JSON.stringify(shown) === JSON.stringify(expected)
          );
        }),
        400,
      );
      console.info("R1 coverage of the generator:", JSON.stringify(stats));
      expect(stats.missing).toBeGreaterThan(0);
      expect(stats.invalid).toBeGreaterThan(0);
      expect(stats.ok).toBeGreaterThan(0);
    },
    TIMEOUT,
  );
});

describe("R2 /find (REQ-REL-15, 28)", () => {
  it(
    "resolves with one h1; shows the notice iff m is invalid or notice is 'incomplete'; shows the card for a valid m",
    async () => {
      await assert(
        fc.asyncProperty(arbSearchParams, async (sp) => {
          const parsed = parseModelParam(sp.m);
          const out = await find(sp);
          if (out.kind !== "resolved") return false;
          const wantNotice = parsed.status === "invalid" || sp.notice === "incomplete";
          const hasNotice = out.html.includes(INCOMPLETE_NOTICE);
          if (hasNotice !== wantNotice) return false;
          if (count(out.html, INCOMPLETE_NOTICE) > 1) return false;
          if (countRe(out.html, /<h1\b/) !== 1) return false;
          if (parsed.status === "ok") {
            // Resume (conversation design §2.6): the card shows only when every answer maps to a chip.
            // `occasion: "other"` has no chip, and a non-Mom model without ageYears has no age chip, so those
            // resume at the first unanswered question instead. Counterexample C-R2-1 (QA note, Wave 3).
            const m = parsed.model;
            const complete = m.occasion !== "other" && (m.ageBand === "mom" || m.ageYears !== undefined);
            const headline = describeModel(m, momSkipNote(catalog)).headline;
            return complete
              ? out.html.includes(headline) && out.html.includes("Reveal my picks")
              : !out.html.includes(headline) && !out.html.includes("Reveal my picks") && out.html.includes("Question ");
          }
          return true;
        }),
      );
    },
    TIMEOUT,
  );
});

describe("R3 /atelier (REQ-REL-16, 29)", () => {
  it(
    "resolves with one h1 and as many cards as an independent reference selects, in order",
    async () => {
      await assert(
        fc.asyncProperty(arbSearchParams, async (sp) => {
          const out = await atelier(sp);
          if (out.kind !== "resolved") return false;
          const shown = [...out.html.matchAll(/<article\b[^>]*data-sku="([^"]+)"/g)].map((m) => m[1]);
          const want = referenceSkus(parseBrowseFilters(sp));
          return (
            countRe(out.html, /<h1\b/) === 1 &&
            shown.length >= 0 &&
            shown.length <= 22 &&
            JSON.stringify(shown) === JSON.stringify(want)
          );
        }),
      );
    },
    TIMEOUT,
  );
});

describe("R4 /piece/[sku] (REQ-REL-17, 30)", () => {
  it(
    "resolves iff the SKU is a catalog SKU; otherwise throws the 404 signal and nothing else",
    async () => {
      const stats = { known: 0, unknown: 0 };
      await assert(
        fc.asyncProperty(arbSku, arbSearchParams, async (sku, sp) => {
          const out = await piece(sku, sp);
          if (!isCatalogSku(sku)) {
            stats.unknown++;
            return out.kind === "notfound";
          }
          stats.known++;
          if (out.kind !== "resolved") return false;
          const name = catalog.products.find((p) => p.sku === sku)!.name;
          const h1 = [...out.html.matchAll(/<h1\b[^>]*>([^<]*)<\/h1>/g)].map((m) => m[1]);
          return h1.length === 1 && h1[0] === name && count(out.html, FOOTNOTE) === 1;
        }),
      );
      console.info("R4 coverage of the generator:", JSON.stringify(stats));
      expect(stats.known).toBeGreaterThan(0);
      expect(stats.unknown).toBeGreaterThan(0);
    },
    TIMEOUT,
  );
});

describe("R5 out-of-stock and in-stock pieces for any m (REQ-REL-18, 31)", () => {
  const oos = outOfStockSkus();
  const inStock = catalog.products.filter((p) => p.availability === "In Stock").map((p) => p.sku);

  it("exactly one catalog SKU is out of stock, derived from availability", () => {
    expect(oos).toHaveLength(1);
    expect(inStock).toHaveLength(21);
  });

  it(
    "the out-of-stock piece has no buy link and no gift wrap for any m, and says so",
    async () => {
      await assert(
        fc.asyncProperty(arbParam, async (m) => {
          const out = await piece(oos[0], m === undefined ? {} : { m });
          if (out.kind !== "resolved") return false;
          return (
            !out.html.includes("Buy on Tiny Tiaraa") &&
            !out.html.includes(urlOfSku(oos[0])) &&
            !out.html.includes("Wrap this gift") &&
            !out.html.includes("Gift this piece") &&
            !out.html.includes("gift-box") &&
            out.html.includes("This piece is out of stock on the listing.")
          );
        }),
      );
    },
    TIMEOUT,
  );

  it(
    "every in-stock piece with a valid m has exactly one buy link equal to the catalog url",
    async () => {
      await assert(
        fc.asyncProperty(fc.constantFrom(...inStock), arbValidParam, async (sku, m) => {
          const out = await piece(sku, { m });
          if (out.kind !== "resolved") return false;
          const url = urlOfSku(sku);
          return count(out.html, "Buy on Tiny Tiaraa") === 1 && count(out.html, `href="${url}"`) === 1;
        }),
      );
    },
    TIMEOUT,
  );
});
