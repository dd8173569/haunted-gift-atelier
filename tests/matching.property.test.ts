// Property tests I1–I7 and P-MC-8..15 (design §8) against the real catalog.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RELIGIOUS, SYMBOL_CHIP_TAGS } from "../data/product-tags";
import { OCCASION_MAP, type Occasion } from "../data/occasion-map";
import { match } from "../lib/matching";
import { AGE_LABEL, ageYearsToBand } from "../lib/matching/age";
import { eligible, initialConstraints, passes } from "../lib/matching/filters";
import { rank, type Scored } from "../lib/matching/rank";
import { LADDER, relax } from "../lib/matching/relax";
import { centrality, scoreProduct, sum } from "../lib/matching/scoring";
import type { Constraints, RecipientModel } from "../lib/matching/types";
import { catalog } from "./helpers/matching-fixtures";
import type { Product } from "../lib/catalog";

const SEED = 20261121;
const RUNS = 600;
const assert = <T>(p: fc.IPropertyWithHooks<[T]>) => fc.assert(p, { seed: SEED, numRuns: RUNS });

const OCCASIONS = Object.keys(OCCASION_MAP) as Occasion[];
const CHIPS = Object.keys(SYMBOL_CHIP_TAGS);

const arbModel: fc.Arbitrary<RecipientModel> = fc
  .record({
    ageBand: fc.constantFrom("infants", "kids", "teens", "mom"),
    occasion: fc.constantFrom(...OCCASIONS),
    budgetBand: fc.constantFrom("under-2500", "2500-15000", "15000-25000", "25000-plus", "no-limit"),
    metal: fc.constantFrom("gold", "silver", "any"),
    category: fc.constantFrom("pendant", "bracelet", "earrings", "set", "tabeez", "any"),
    symbols: fc.constantFrom("any", "none-religious", "zodiac", "evil-eye", "religious"),
    relationship: fc.constantFrom("niece-nephew", "grandchild", "friends-baby", "godchild", "own-child", "mom", "other"),
    list: fc.uniqueArray(fc.constantFrom(...CHIPS), { maxLength: 4 }),
  })
  .map(({ list, ...m }) => {
    const model = m as RecipientModel;
    if (model.symbols === "religious") model.symbolList = list;
    return model;
  });

const byId = new Map(catalog.products.map((p) => [p.sku, p]));
const prod = (sku: string): Product => byId.get(sku)!;
const religious = (p: Product) => p.tags.some((t) => RELIGIOUS.has(t));
const BANDS = ["under-2500", "2500-15000", "15000-25000", "25000-plus"];

/** Independent reference: eligible count after the ladder, written without the matching internals. */
function referenceCount(m: RecipientModel): number {
  const idx = BANDS.indexOf(m.budgetBand);
  const catOf = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
  const listTags = new Set<string>();
  if (m.symbols === "religious") for (const c of m.symbolList ?? []) for (const t of SYMBOL_CHIP_TAGS[c] ?? []) listTags.add(t);
  const count = (bands: Set<string> | null, broadened: boolean, metal: string, cat: string) =>
    catalog.products.filter((p) => {
      if (p.availability !== "In Stock") return false;
      if (!p.age_groups.includes(AGE_LABEL[m.ageBand])) return false;
      if (bands && !bands.has(p.price_band)) return false;
      if (metal !== "any" && p.metal !== metal) return false;
      if (cat !== "any" && p.category !== catOf(cat)) return false;
      const rel = p.tags.some((t) => t.startsWith("symbol:") && ["om", "sikh", "cross", "ganesha", "trishul", "jain", "swastik", "third-eye"].includes(t.slice(7)));
      switch (m.symbols) {
        case "none-religious": return !rel;
        case "any": return true;
        case "zodiac": return p.tags.includes("symbol:zodiac");
        case "evil-eye": return p.tags.includes("symbol:evil-eye");
        default:
          if (listTags.size === 0 || broadened) return rel;
          return p.tags.some((t) => listTags.has(t));
      }
    }).length;
  const bands: Set<string> | null = m.budgetBand === "no-limit" ? null : new Set([m.budgetBand]);
  let metal: string = m.metal;
  let cat: string = m.category;
  let broadened = false;
  let n = count(bands, broadened, metal, cat);
  const step = (f: () => boolean) => {
    if (n >= 3) return;
    if (f()) n = count(bands, broadened, metal, cat);
  };
  step(() => (bands && idx > 0 ? (bands.add(BANDS[idx - 1]), true) : false));
  step(() => (bands && idx < 3 ? (bands.add(BANDS[idx + 1]), true) : false));
  step(() => (m.symbols === "religious" && listTags.size > 0 ? ((broadened = true), true) : false));
  step(() => (metal !== "any" ? ((metal = "any"), true) : false));
  step(() => (cat !== "any" ? ((cat = "any"), true) : false));
  return n;
}

describe("I1–I7 (REQ-MC-36..42)", () => {
  it("I1 every pick is In Stock (TNZ-1058 never appears)", () => {
    assert(fc.property(arbModel, (m) => {
      for (const p of match(m, catalog).picks) {
        expect(prod(p.sku).availability).toBe("In Stock");
        expect(p.sku).not.toBe("TNZ-1058");
      }
    }));
  });

  it("I2 every pick lists the recipient age band", () => {
    assert(fc.property(arbModel, (m) => {
      for (const p of match(m, catalog).picks) expect(prod(p.sku).age_groups).toContain(AGE_LABEL[m.ageBand]);
    }));
  });

  it("I3 inside the original band, or disclosed and marked", () => {
    assert(fc.property(arbModel, (m) => {
      const r = match(m, catalog);
      for (const p of r.picks) {
        const inBand = m.budgetBand === "no-limit" || prod(p.sku).price_band === m.budgetBand;
        if (inBand) {
          expect(p.relaxations).not.toContain("budget-below");
          expect(p.relaxations).not.toContain("budget-above");
        } else {
          expect(r.disclosures.some((d) => d.includes("budget"))).toBe(true);
          expect(p.relaxations.some((x) => x === "budget-below" || x === "budget-above")).toBe(true);
        }
      }
    }));
  });

  it("I4 no religious piece without explicit opt-in; none-religious never relaxed", () => {
    assert(fc.property(arbModel, (m) => {
      const r = match(m, catalog);
      for (const p of r.picks) {
        const rel = religious(prod(p.sku));
        if (m.symbols === "none-religious" || m.symbols === "zodiac" || m.symbols === "evil-eye") expect(rel).toBe(false);
        if (m.symbols === "religious") expect(rel).toBe(true);
        if (m.symbols === "religious" && m.symbolList && m.symbolList.length > 0) {
          const wanted = new Set(m.symbolList.flatMap((c) => SYMBOL_CHIP_TAGS[c]));
          const exact = prod(p.sku).tags.some((t) => wanted.has(t));
          // a non-listed religious piece must be marked as broadened and disclosed
          if (!exact) {
            expect(p.relaxations).toContain("symbol-broadened");
            expect(r.disclosures.some((d) => d.includes("request"))).toBe(true);
          }
        }
      }
    }));
  });

  it("I5 exactly min(3, N) picks, N from an independent reference; no duplicates", () => {
    assert(fc.property(arbModel, (m) => {
      const r = match(m, catalog);
      const n = referenceCount(m);
      expect(r.picks.length).toBe(Math.min(3, n));
      expect(new Set(r.picks.map((p) => p.sku)).size).toBe(r.picks.length);
      expect(r.showBrowseLink).toBe(r.picks.length < 3);
      expect(r.shortfallNote !== undefined).toBe(r.picks.length < 3);
    }));
  });

  it("I6 deterministic, inputs untouched", () => {
    assert(fc.property(arbModel, (m) => {
      const mClone = structuredClone(m);
      const cClone = structuredClone(catalog);
      const a = match(m, catalog);
      const b = match(mClone, cClone);
      expect(b).toEqual(a);
      expect(m).toEqual(mClone);
      expect(catalog).toEqual(cClone);
    }));
  });

  it("I7 reasons are grounded and never for a zero signal; 2..4 reasons", () => {
    assert(fc.property(arbModel, (m) => {
      for (const pick of match(m, catalog).picks) {
        const p = prod(pick.sku);
        expect(pick.reasons.length).toBeGreaterThanOrEqual(2);
        expect(pick.reasons.length).toBeLessThanOrEqual(4);
        expect(pick.reasons[0].type).toBe("age");
        expect(pick.reasons[1].type).toBe("budget");
        for (const r of pick.reasons) {
          switch (r.type) {
            case "age": expect(r.source).toBe("age_groups"); expect(p.age_groups.length).toBeGreaterThan(0); break;
            case "budget": expect(r.source).toBe("price_inr"); break;
            case "metal": expect(r.source).toBe("materials"); expect(pick.breakdown.metal).toBeGreaterThan(0); expect(p.materials.length).toBeGreaterThan(0); break;
            case "rating": expect(r.source).toBe("rating"); expect(pick.breakdown.rating).toBeGreaterThan(0); expect(p.rating).not.toBeNull(); break;
            case "occasion": expect(r.source).toBe(`occasion-map:${m.occasion}`); expect(pick.breakdown.occasion).toBeGreaterThan(0); break;
            case "symbol": {
              expect(pick.breakdown.symbol).toBeGreaterThan(0);
              const tag = r.source.replace("product-tags:", "");
              expect(r.source.startsWith("product-tags:")).toBe(true);
              expect(p.tags).toContain(tag);
              break;
            }
          }
        }
      }
    }));
  });
});

describe("P-MC-8..15", () => {
  it("P-MC-8 score is the sum of its breakdown, 0..10", () => {
    assert(fc.property(arbModel, (m) => {
      for (const p of match(m, catalog).picks) {
        const b = p.breakdown;
        expect(p.score).toBe(b.occasion + b.symbol + b.metal + b.rating + b.centrality);
        expect(p.score).toBeGreaterThanOrEqual(0);
        expect(p.score).toBeLessThanOrEqual(10);
      }
    }));
  });

  const scoredAll = (m: RecipientModel): Scored[] => {
    const r = relax(m, catalog);
    return rank(
      r.eligible.map((product) => {
        const breakdown = scoreProduct(product, m, r.constraints, catalog);
        return { product, breakdown, score: sum(breakdown) };
      }),
      m,
    );
  };

  it("P-MC-9 picks follow comparator order except a diversity swap in third place", () => {
    assert(fc.property(arbModel, (m) => {
      const order = scoredAll(m).map((s) => s.product.sku);
      const picks = match(m, catalog).picks.map((p) => p.sku);
      expect(picks.slice(0, 2)).toEqual(order.slice(0, 2));
      if (picks.length === 3 && picks[2] !== order[2]) expect(order.indexOf(picks[2])).toBeGreaterThan(2);
      else expect(picks).toEqual(order.slice(0, 3));
    }));
  });

  it("P-MC-10 diversity: swap iff a different-category alternative within 2 points exists", () => {
    assert(fc.property(arbModel, (m) => {
      const L = scoredAll(m);
      const picks = match(m, catalog).picks;
      if (L.length < 3) return;
      const top = L.slice(0, 3);
      const same = top.every((s) => s.product.category === top[0].product.category);
      const alt = L.slice(3).find((s) => s.product.category !== top[0].product.category && s.score >= top[2].score - 2);
      if (same && alt) {
        expect(picks[2].sku).toBe(alt.product.sku);
        expect(new Set(picks.map((p) => prod(p.sku).category)).size).toBeGreaterThan(1);
      } else {
        expect(picks.map((p) => p.sku)).toEqual(top.map((s) => s.product.sku));
      }
    }));
  });

  it("P-MC-11 each ladder step yields a superset of the eligible set before it", () => {
    assert(fc.property(arbModel, (m) => {
      let c: Constraints = initialConstraints(m);
      let before = new Set(eligible(c, m, catalog).map((p) => p.sku));
      for (const [, step] of LADDER) {
        c = step(c, m);
        const after = new Set(eligible(c, m, catalog).map((p) => p.sku));
        for (const s of before) expect(after.has(s)).toBe(true);
        before = after;
      }
    }));
  });

  it("P-MC-12 a model with >= 3 strict-eligible products has no disclosures and no markers", () => {
    assert(fc.property(arbModel, (m) => {
      fc.pre(eligible(initialConstraints(m), m, catalog).length >= 3);
      const r = match(m, catalog);
      expect(r.disclosures).toEqual([]);
      expect(r.trace).toEqual([]);
      for (const p of r.picks) {
        expect(p.relaxations).toEqual([]);
        expect(p.relaxationNote).toBeUndefined();
      }
    }));
  });

  it("P-MC-13 age mapping", () => {
    assert(fc.property(fc.double({ min: 0, max: 130, noNaN: true }), (y) => {
      const band = ageYearsToBand(y);
      expect(band).toBe(y < 3 ? "infants" : y < 12 ? "kids" : y < 19 ? "teens" : "adult");
    }));
    const edge: [number, string][] = [[2.999, "infants"], [3, "kids"], [11.999, "kids"], [12, "teens"], [18.999, "teens"], [19, "adult"]];
    for (const [y, b] of edge) expect(ageYearsToBand(y)).toBe(b);
  });

  it("P-MC-14 centrality is 1 iff P25 <= price <= P75 of the ORIGINAL band; 0 for no-limit", () => {
    assert(fc.property(arbModel, (m) => {
      for (const pick of match(m, catalog).picks) {
        const p = prod(pick.sku);
        if (m.budgetBand === "no-limit") {
          expect(pick.breakdown.centrality).toBe(0);
        } else {
          const q = catalog.band_quartiles[m.budgetBand];
          expect(pick.breakdown.centrality).toBe(p.price_inr >= q.p25 && p.price_inr <= q.p75 ? 1 : 0);
          expect(centrality(p, m, catalog)).toBe(pick.breakdown.centrality);
        }
      }
    }));
  });

  it("P-MC-15 no discount token or certification word in any output", () => {
    assert(fc.property(arbModel, (m) => {
      const r = match(m, catalog);
      const text = JSON.stringify({ d: r.disclosures, s: r.shortfallNote, p: r.picks.map((p) => [p.reasons, p.relaxationNote]) });
      expect(text).not.toMatch(/%|\boff\b|\bsave\b|strike|discount|\bmrp\b|hypoallergenic|\bBIS\b|nickel|certified|\bsafe\b|unsafe|sensitive skin/i);
    }));
  });

  it("every pick passes the strict hard filters except for the relaxable fields (sanity)", () => {
    assert(fc.property(arbModel, (m) => {
      const relaxed = relax(m, catalog).constraints;
      for (const pick of match(m, catalog).picks) expect(passes(prod(pick.sku), relaxed, m)).toBe(true);
    }));
  });
});
