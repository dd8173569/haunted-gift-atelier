import { describe, expect, it } from "vitest";
import { initialConstraints } from "../lib/matching/filters";
import { centrality, scoreProduct, sum } from "../lib/matching/scoring";
import { relax } from "../lib/matching/relax";
import { GOLDEN1, GOLDEN2, GOLDEN3, catalog, model, product } from "./helpers/matching-fixtures";
import type { RecipientModel } from "../lib/matching/types";

const score = (sku: string, m: RecipientModel, relaxed = false) => {
  const c = relaxed ? relax(m, catalog).constraints : initialConstraints(m);
  const b = scoreProduct(product(sku), m, c, catalog);
  return { b, total: sum(b) };
};

describe("centrality", () => {
  const m = (budgetBand: RecipientModel["budgetBand"]) => model({ budgetBand });
  it("inclusive at exact P25 and P75", () => {
    expect(centrality(product("TPN-1149"), m("15000-25000"), catalog)).toBe(1); // 18299 = P25
    expect(centrality(product("THP-1017"), m("25000-plus"), catalog)).toBe(1); // 27949 = P75
  });
  it("0 just outside the range", () => {
    expect(centrality(product("TBZ-1013"), m("under-2500"), catalog)).toBe(0); // 2324 > 2267.75
    expect(centrality(product("TNZ-1056"), m("under-2500"), catalog)).toBe(0); // 1674 < 1880.25
    expect(centrality(product("TBZ-1017"), m("under-2500"), catalog)).toBe(1); // 2099
  });
  it("is skipped for no-limit", () => {
    expect(centrality(product("TBZ-1017"), m("no-limit"), catalog)).toBe(0);
  });
  it("uses the ORIGINAL band, not the product's band", () => {
    // TPN-1141 (14249) is P75 of 2500-15000 but must score 0 for a 15000-25000 recipient
    expect(centrality(product("TPN-1141"), m("2500-15000"), catalog)).toBe(1);
    expect(centrality(product("TPN-1141"), m("15000-25000"), catalog)).toBe(0);
  });
  it("is 0 when the band has no in-stock prices", () => {
    const empty = { ...catalog, band_quartiles: { ...catalog.band_quartiles, "under-2500": { p25: NaN, p75: NaN, n: 0 } } };
    expect(centrality(product("TBZ-1017"), m("under-2500"), empty)).toBe(0);
  });
});

describe("worked totals (design §4)", () => {
  it.each([
    ["TBZ-1013", [3, 0, 2, 1, 0], 6],
    ["TNZ-1056", [3, 0, 2, 1, 0], 6],
    ["TBZ-1017", [3, 0, 2, 0, 1], 6],
    ["TOB-1008", [0, 0, 2, 0, 1], 3],
    ["THP-1027", [0, 0, 2, 0, 0], 2],
    ["TPN-1433", [0, 0, 2, 0, 0], 2],
  ])("case 1 %s", (sku, parts, total) => {
    const { b, total: t } = score(sku as string, GOLDEN1);
    expect([b.occasion, b.symbol, b.metal, b.rating, b.centrality]).toEqual(parts);
    expect(t).toBe(total);
  });
  it.each([
    ["THP-1001", [3, 0, 2, 1, 1], 7],
    ["THP-1017", [3, 0, 2, 0, 1], 6],
  ])("case 2 %s", (sku, parts, total) => {
    const { b, total: t } = score(sku as string, GOLDEN2);
    expect([b.occasion, b.symbol, b.metal, b.rating, b.centrality]).toEqual(parts);
    expect(t).toBe(total);
  });
  it.each([
    ["TPN-1141", [3, 3, 2, 1, 0], 9],
    ["TPN-1147", [3, 1, 2, 1, 0], 7],
    ["TPN-1143", [3, 1, 2, 1, 0], 7],
    ["TPN-1149", [3, 1, 2, 0, 1], 7],
    ["TPN-1145", [3, 1, 2, 0, 0], 6],
    ["TPN-1144", [3, 1, 2, 0, 0], 6],
  ])("case 3 %s (after ladder)", (sku, parts, total) => {
    const { b, total: t } = score(sku as string, GOLDEN3, true);
    expect([b.occasion, b.symbol, b.metal, b.rating, b.centrality]).toEqual(parts);
    expect(t).toBe(total);
  });
});

describe("signals", () => {
  it("symbol +1 needs the broadened constraints; strict constraints give 0 to non-requested", () => {
    expect(score("TPN-1147", GOLDEN3, false).b.symbol).toBe(0);
    expect(score("TPN-1147", GOLDEN3, true).b.symbol).toBe(1);
  });
  it("symbol is 0 for any and none-religious", () => {
    expect(score("TPN-1141", model({ ageBand: "teens", symbols: "any" })).b.symbol).toBe(0);
    expect(score("TNZ-1056", model({ ageBand: "infants", symbols: "none-religious" })).b.symbol).toBe(0);
  });
  it("zodiac and evil-eye give +3 exactly", () => {
    expect(score("TPN-1433", model({ ageBand: "infants", symbols: "zodiac" })).b.symbol).toBe(3);
    expect(score("TNZ-1056", model({ ageBand: "infants", symbols: "evil-eye" })).b.symbol).toBe(3);
  });
  it("religious (no list) gives +3 to any religious piece", () => {
    expect(score("TPN-1149", model({ ageBand: "kids", symbols: "religious" })).b.symbol).toBe(3);
  });
  it("metal uses the ORIGINAL metal: 0 after dropMetal for the wrong metal", () => {
    const m = model({ ageBand: "mom", metal: "silver", occasion: "birthday" });
    expect(score("THP-1001", m).b.metal).toBe(0);
  });
  it("rating +1 at >= 4.5 only; null scores 0", () => {
    const m = model({ ageBand: "teens" });
    expect(score("TPN-1143", m).b.rating).toBe(1); // 4.5
    expect(score("TPN-1145", m).b.rating).toBe(0); // 4.4
    expect(score("TPN-1149", m).b.rating).toBe(0); // null
  });
  it("just-because / other earn no occasion points", () => {
    expect(score("TPN-1141", model({ ageBand: "teens", occasion: "just-because" })).b.occasion).toBe(0);
    expect(score("TPN-1141", model({ ageBand: "teens", occasion: "other" })).b.occasion).toBe(0);
  });
});
