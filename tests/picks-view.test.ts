import { describe, expect, it } from "vitest";
import { toModel } from "../lib/conversation";
import { match } from "../lib/matching";
import type { MatchResult, Pick } from "../lib/matching/types";
import { MARKER_LABEL, toPickViews } from "../lib/picks-view";
import { catalog, product } from "./helpers/matching-fixtures";
import { GOLDEN1_TAPS, GOLDEN2_TAPS, GOLDEN3_TAPS, run } from "./helpers/conversation-taps";

const modelOf = (taps: Parameters<typeof run>[0]) => {
  const r = toModel(run(taps).answers);
  if (!r.ok) throw new Error("incomplete");
  return r.model;
};

const forged = (picks: Partial<Pick>[]): MatchResult => ({
  picks: picks.map((p) => ({
    sku: "TBZ-1013",
    score: 1,
    breakdown: { occasion: 0, symbol: 0, metal: 0, rating: 0, centrality: 0 },
    reasons: [],
    relaxations: [],
    ...p,
  })),
  disclosures: [],
  showBrowseLink: false,
  trace: [],
});

describe("toPickViews on the golden models", () => {
  it("golden 1: three views in match() order, catalog facts verbatim", () => {
    const result = match(modelOf(GOLDEN1_TAPS), catalog);
    const views = toPickViews(result, catalog);
    expect(views.map((v) => v.sku)).toEqual(["TBZ-1013", "TNZ-1056", "TBZ-1017"]);
    expect(views.map((v) => v.rank)).toEqual([1, 2, 3]);
    views.forEach((v, i) => {
      const p = product(v.sku);
      expect(v.name).toBe(p.name);
      expect(v.url).toBe(p.url);
      expect(v.price_inr).toBe(p.price_inr);
      expect(v.rating).toBe(p.rating);
      expect(v.category).toBe(p.category);
      expect(v.imageSrc).toBe(`/catalog/${p.image_file}`);
      expect(v.reasons).toEqual(result.picks[i].reasons.map((r) => r.text));
      expect(v.markerLabels).toEqual([]);
      expect(v.relaxationNote).toBeUndefined();
    });
  });
  it("golden 2: two views", () => {
    expect(toPickViews(match(modelOf(GOLDEN2_TAPS), catalog), catalog).map((v) => v.sku)).toEqual([
      "THP-1001",
      "THP-1017",
    ]);
  });
  it("golden 3: marker labels and the TPN-1141 relaxation sentence", () => {
    const result = match(modelOf(GOLDEN3_TAPS), catalog);
    const views = toPickViews(result, catalog);
    expect(views.map((v) => v.sku)).toEqual(["TPN-1141", "TPN-1147", "TPN-1143"]);
    expect(views[0].markerLabels).toContain("Just below your budget");
    expect(views[0].relaxationNote).toBe(result.picks[0].relaxationNote);
    expect(views[0].relaxationNote).toBeTruthy();
  });
  it("an empty result gives no views", () => {
    expect(toPickViews(forged([]), catalog)).toEqual([]);
  });
  it("marker labels are the REQ-CV-30 words", () => {
    expect(MARKER_LABEL).toEqual({
      "budget-below": "Just below your budget",
      "budget-above": "Just above your budget",
      "symbol-broadened": "A related symbol",
      "metal-dropped": "A different metal",
      "category-dropped": "A different kind of piece",
    });
    const views = toPickViews(
      forged([{ relaxations: ["budget-above", "symbol-broadened", "metal-dropped", "category-dropped"] }]),
      catalog,
    );
    expect(views[0].markerLabels).toEqual([
      "Just above your budget",
      "A related symbol",
      "A different metal",
      "A different kind of piece",
    ]);
  });
});

describe("toPickViews fails loudly", () => {
  it("unknown SKU", () => {
    expect(() => toPickViews(forged([{ sku: "NOPE-0000" }]), catalog)).toThrow(/NOPE-0000 not in catalog/);
  });
  it("TNZ-1058 (Out of Stock)", () => {
    expect(() => toPickViews(forged([{ sku: "TNZ-1058" }]), catalog)).toThrow(/not In Stock/);
  });
  it("four picks", () => {
    const skus = ["TBZ-1013", "TNZ-1056", "TBZ-1017", "TPN-1141"];
    expect(() => toPickViews(forged(skus.map((sku) => ({ sku }))), catalog)).toThrow(/at most 3/);
  });
  it("duplicate SKUs", () => {
    expect(() => toPickViews(forged([{ sku: "TBZ-1013" }, { sku: "TBZ-1013" }]), catalog)).toThrow(/duplicate/);
  });
});
