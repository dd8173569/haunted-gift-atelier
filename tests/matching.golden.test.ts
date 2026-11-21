// Golden cases (requirements §9). Asserted exactly; never loosen (tech.md).
import { describe, expect, it } from "vitest";
import { match } from "../lib/matching";
import { eligible, initialConstraints } from "../lib/matching/filters";
import { GOLDEN1, GOLDEN2, GOLDEN3, catalog } from "./helpers/matching-fixtures";

describe("REQ-MC-06 band depth and quartiles at catalog v1.0.0", () => {
  it("pins the version", () => {
    expect(catalog.version).toBe("1.0.0");
  });
  it("in-stock depth is 6 / 5 / 5 / 5", () => {
    const depth = (b: string) =>
      catalog.products.filter((p) => p.price_band === b && p.availability === "In Stock").length;
    expect([depth("under-2500"), depth("2500-15000"), depth("15000-25000"), depth("25000-plus")]).toEqual([6, 5, 5, 5]);
  });
  it("in-stock price ranges", () => {
    const range = (b: string) => {
      const prices = catalog.products
        .filter((p) => p.price_band === b && p.availability === "In Stock")
        .map((p) => p.price_inr);
      return [Math.min(...prices), Math.max(...prices)];
    };
    expect(range("under-2500")).toEqual([1674, 2400]);
    expect(range("2500-15000")).toEqual([2750, 14399]);
    expect(range("15000-25000")).toEqual([15149, 24649]);
    expect(range("25000-plus")).toEqual([25249, 61599]);
  });
  it("quartile ranges", () => {
    const q = catalog.band_quartiles;
    expect([q["under-2500"].p25, q["under-2500"].p75]).toEqual([1880.25, 2267.75]);
    expect([q["2500-15000"].p25, q["2500-15000"].p75]).toEqual([10199, 14249]);
    expect([q["15000-25000"].p25, q["15000-25000"].p75]).toEqual([18299, 24499]);
    expect([q["25000-plus"].p25, q["25000-plus"].p75]).toEqual([25299, 27949]);
  });
});

describe("golden 1: infant naming gift (REQ-MC-33)", () => {
  const r = match(GOLDEN1, catalog);
  it("the six strict-eligible products", () => {
    const e = eligible(initialConstraints(GOLDEN1), GOLDEN1, catalog).map((p) => p.sku).sort();
    expect(e).toEqual(["TBZ-1013", "TBZ-1017", "THP-1027", "TNZ-1056", "TOB-1008", "TPN-1433"]);
  });
  it("exact order, scores and breakdowns", () => {
    expect(r.picks.map((p) => [p.sku, p.score])).toEqual([
      ["TBZ-1013", 6],
      ["TNZ-1056", 6],
      ["TBZ-1017", 6],
    ]);
    expect(r.picks.map((p) => p.breakdown)).toEqual([
      { occasion: 3, symbol: 0, metal: 2, rating: 1, centrality: 0 },
      { occasion: 3, symbol: 0, metal: 2, rating: 1, centrality: 0 },
      { occasion: 3, symbol: 0, metal: 2, rating: 0, centrality: 1 },
    ]);
  });
  it("no relaxation, no markers, no disclosure, no shortfall", () => {
    expect(r.trace).toEqual([]);
    expect(r.disclosures).toEqual([]);
    expect(r.picks.every((p) => p.relaxations.length === 0 && p.relaxationNote === undefined)).toBe(true);
    expect(r.showBrowseLink).toBe(false);
    expect(r.shortfallNote).toBeUndefined();
  });
  it("tie broken by rating 5.0 > 4.7 > 3.9", () => {
    const ratings = r.picks.map((p) => catalog.products.find((x) => x.sku === p.sku)!.rating_value);
    expect(ratings).toEqual([5.0, 4.7, 3.9]);
  });
  it("reasons: 2 to 4, templated", () => {
    expect(r.picks[0].reasons.map((x) => x.text)).toEqual([
      "Listed for infants 0–3 years",
      "₹2,324 — inside your under-₹2,500 budget",
      "Our atelier's pick for a naming ceremony",
      "925 silver, as you preferred",
    ]);
  });
  it("no diversity swap: TNZ-1056 (Bracelet) is already in the top 3", () => {
    // top 3 by pure rank are the same three SKUs, mixed categories
    expect(new Set(r.picks.map((p) => p.sku)).size).toBe(3);
  });
});

describe("golden 2: Mom birthday, two picks (REQ-MC-34)", () => {
  const r = match(GOLDEN2, catalog);
  it("exactly two picks, in order, with scores", () => {
    expect(r.picks.map((p) => [p.sku, p.score])).toEqual([
      ["THP-1001", 7],
      ["THP-1017", 6],
    ]);
  });
  it("shortfall note and browse link, no disclosure, no markers", () => {
    expect(r.shortfallNote).toBe("Only 2 pieces in the atelier are listed for Mom");
    expect(r.showBrowseLink).toBe(true);
    expect(r.disclosures).toEqual([]);
    expect(r.picks.every((p) => p.relaxations.length === 0)).toBe(true);
  });
  it("no ladder step added a product", () => {
    expect(r.trace.every((t) => t.after === t.before)).toBe(true);
  });
});

describe("golden 3: budget widening plus symbol broadening (REQ-MC-35)", () => {
  const r = match(GOLDEN3, catalog);
  it("strict filtering yields 0", () => {
    expect(eligible(initialConstraints(GOLDEN3), GOLDEN3, catalog)).toHaveLength(0);
  });
  it("ladder: below 0->1, above 1->1, symbol 1->6", () => {
    expect(r.trace).toEqual([
      { step: "widenBelow", before: 0, after: 1 },
      { step: "widenAbove", before: 1, after: 1 },
      { step: "broadenSymbol", before: 1, after: 6 },
    ]);
  });
  it("exact order and scores", () => {
    expect(r.picks.map((p) => [p.sku, p.score])).toEqual([
      ["TPN-1141", 9],
      ["TPN-1147", 7],
      ["TPN-1143", 7],
    ]);
    expect(r.picks.map((p) => p.breakdown)).toEqual([
      { occasion: 3, symbol: 3, metal: 2, rating: 1, centrality: 0 },
      { occasion: 3, symbol: 1, metal: 2, rating: 1, centrality: 0 },
      { occasion: 3, symbol: 1, metal: 2, rating: 1, centrality: 0 },
    ]);
  });
  it("both disclosures present; the widenAbove step (no products added) has none", () => {
    expect(r.disclosures).toEqual([
      "No pieces matched your ₹15,000–₹25,000 budget, so we widened it to the band just below — your picks are marked.",
      "Only 1 piece matched your Ganesha request, so we broadened it to other religious symbols — your picks are marked.",
    ]);
  });
  it("markers", () => {
    expect(r.picks.map((p) => [p.sku, p.relaxations])).toEqual([
      ["TPN-1141", ["budget-below"]],
      ["TPN-1147", ["symbol-broadened"]],
      ["TPN-1143", ["budget-below", "symbol-broadened"]],
    ]);
  });
  it("TPN-1141 marker sentence", () => {
    expect(r.picks[0].relaxationNote).toBe(
      "Your Ganesha pendant sits just below your budget at ₹14,249, so we widened the search slightly.",
    );
    expect(r.picks[1].relaxationNote).toBeUndefined();
  });
  it("the 7-point tie is broken by rating: 4.8 > 4.5 > null (TPN-1149 Om is 4th)", () => {
    const om = catalog.products.find((p) => p.sku === "TPN-1149")!;
    expect(om.rating_value).toBeNull();
    expect(r.picks.map((p) => p.sku)).not.toContain("TPN-1149");
  });
  it("no diversity swap: all pendants, no different-category alternative", () => {
    expect(r.picks.every((p) => catalog.products.find((x) => x.sku === p.sku)!.category === "Pendant")).toBe(true);
  });
  it("reasons for TPN-1141", () => {
    expect(r.picks[0].reasons.map((x) => x.text)).toEqual([
      "Listed for teens 12–19 years",
      "₹14,249 — just below your ₹15,000–₹25,000 budget",
      "Carries the Ganesha you asked for",
      "18KT gold, as you preferred",
    ]);
  });
  it("full result is browse-link free (3 picks)", () => {
    expect(r.showBrowseLink).toBe(false);
    expect(r.shortfallNote).toBeUndefined();
  });
});
