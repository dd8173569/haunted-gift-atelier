import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { match } from "../lib/matching";
import { explain } from "../lib/matching/explain";
import { applyDiversity, compare, rank, type Scored } from "../lib/matching/rank";
import { relax } from "../lib/matching/relax";
import { scoreProduct, sum } from "../lib/matching/scoring";
import { initialConstraints } from "../lib/matching/filters";
import { GOLDEN1, GOLDEN3, RELIGIOUS_SKUS, catalog, model, product } from "./helpers/matching-fixtures";

const scored = (sku: string, score: number): Scored => ({
  product: product(sku),
  score,
  breakdown: { occasion: 0, symbol: 0, metal: 0, rating: 0, centrality: 0 },
});

describe("purity (grep-based, REQ-MC-31)", () => {
  const root = path.resolve(__dirname, "..");
  const files = [
    "lib/matching.ts",
    ...fs.readdirSync(path.join(root, "lib/matching")).map((f) => `lib/matching/${f}`),
  ];
  const banned: [string, RegExp][] = [
    ["fs / path import", /from\s+["'](node:)?(fs|path|os|child_process)(\/\w+)?["']|require\(\s*["'](node:)?fs/],
    ["Date", /\bDate\b/],
    ["Math.random", /Math\.random/],
    ["fetch", /\bfetch\s*\(/],
    ["XMLHttpRequest", /XMLHttpRequest/],
    ["LLM client", /openai|anthropic|@google\/generative-ai|@google\/genai|gemini|langchain|bedrock/i],
    ["toLocaleString", /toLocale(String|DateString|TimeString)/],
    ["catalog.json import", /catalog\.json/],
    ["process.env", /process\.env/],
  ];
  it("scans the expected files", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "lib/matching.ts",
        "lib/matching/age.ts",
        "lib/matching/explain.ts",
        "lib/matching/filters.ts",
        "lib/matching/rank.ts",
        "lib/matching/relax.ts",
        "lib/matching/scoring.ts",
        "lib/matching/templates.ts",
        "lib/matching/types.ts",
      ]),
    );
  });
  for (const f of files) {
    it(`${f} has no banned construct`, () => {
      const code = fs
        .readFileSync(path.join(root, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const [name, re] of banned) expect(code, `${f}: ${name}`).not.toMatch(re);
    });
  }
});

describe("rank / compare (REQ-MC-18)", () => {
  const m = model({ budgetBand: "under-2500" });
  it("score desc first", () => {
    expect(compare(scored("TBZ-1013", 5), scored("TNZ-1056", 6), m)).toBeGreaterThan(0);
  });
  it("then rating desc, null last", () => {
    // TBZ-1013 5.0, TBZ-1017 3.9, THP-1027 null
    const r = rank([scored("THP-1027", 2), scored("TBZ-1017", 2), scored("TBZ-1013", 2)], m);
    expect(r.map((s) => s.product.sku)).toEqual(["TBZ-1013", "TBZ-1017", "THP-1027"]);
  });
  it("then distance to the original band midpoint (2000)", () => {
    // both null rating: THP-1027 1874 (126) vs TOB-1008 1899 (101)
    const r = rank([scored("THP-1027", 2), scored("TOB-1008", 2)], m);
    expect(r.map((s) => s.product.sku)).toEqual(["TOB-1008", "THP-1027"]);
  });
  it("skips the midpoint key for no-limit and falls to SKU asc", () => {
    const nl = model();
    const r = rank([scored("TPN-1459", 1), scored("TPN-1149", 1)], nl); // both null rating
    expect(r.map((s) => s.product.sku)).toEqual(["TPN-1149", "TPN-1459"]);
  });
  it("is total: equal items compare 0 only against themselves", () => {
    const a = scored("TPN-1149", 1);
    expect(compare(a, a, m)).toBe(0);
  });
  it("does not mutate its input", () => {
    const input = [scored("TPN-1459", 1), scored("TPN-1149", 3)];
    const before = input.map((s) => s.product.sku);
    rank(input, m);
    expect(input.map((s) => s.product.sku)).toEqual(before);
  });
});

describe("applyDiversity (REQ-MC-20)", () => {
  it("swaps the third for the best different-category item within 2 points", () => {
    const list = [
      scored("TPN-1149", 5),
      scored("TPN-1147", 5),
      scored("TPN-1145", 5),
      scored("TNZ-1056", 3), // different category, 5-2 = 3 -> qualifies
      scored("TOB-1008", 3),
    ];
    expect(applyDiversity(list).map((s) => s.product.sku)).toEqual(["TPN-1149", "TPN-1147", "TNZ-1056"]);
  });
  it("does not swap when the alternative is more than 2 points lower", () => {
    const list = [scored("TPN-1149", 5), scored("TPN-1147", 5), scored("TPN-1145", 5), scored("TNZ-1056", 2)];
    expect(applyDiversity(list).map((s) => s.product.sku)).toEqual(["TPN-1149", "TPN-1147", "TPN-1145"]);
  });
  it("does not swap when the top 3 are not one category", () => {
    const list = [scored("TPN-1149", 5), scored("TPN-1147", 5), scored("TNZ-1056", 5), scored("TBZ-1013", 5)];
    expect(applyDiversity(list).map((s) => s.product.sku)).toEqual(["TPN-1149", "TPN-1147", "TNZ-1056"]);
  });
  it("does not swap with fewer than 3", () => {
    expect(applyDiversity([scored("TPN-1149", 5), scored("TPN-1147", 5)])).toHaveLength(2);
    expect(applyDiversity([])).toEqual([]);
  });
  it("same-category lower items are skipped as alternatives", () => {
    const list = [scored("TPN-1149", 5), scored("TPN-1147", 5), scored("TPN-1145", 5), scored("TPN-1141", 5), scored("TOB-1008", 4)];
    expect(applyDiversity(list).map((s) => s.product.sku)).toEqual(["TPN-1149", "TPN-1147", "TOB-1008"]);
  });
});

describe("relax (REQ-MC-21..24)", () => {
  it("does nothing and discloses nothing when >= 3 are eligible", () => {
    const r = relax(GOLDEN1, catalog);
    expect(r.trace).toEqual([]);
    expect(r.disclosures).toEqual([]);
    expect(r.eligible).toHaveLength(6);
  });
  it("golden 3 trace", () => {
    expect(relax(GOLDEN3, catalog).trace).toEqual([
      { step: "widenBelow", before: 0, after: 1 },
      { step: "widenAbove", before: 1, after: 1 },
      { step: "broadenSymbol", before: 1, after: 6 },
    ]);
  });
  it("none-religious never reaches a religious piece, whatever the ladder does", () => {
    for (const ageBand of ["infants", "kids", "teens", "mom"] as const) {
      for (const budgetBand of ["under-2500", "2500-15000", "15000-25000", "25000-plus"] as const) {
        const r = relax(model({ ageBand, budgetBand, symbols: "none-religious", metal: "gold", category: "set" }), catalog);
        for (const p of r.eligible) expect(RELIGIOUS_SKUS).not.toContain(p.sku);
        expect(r.trace.map((t) => t.step)).not.toContain("broadenSymbol");
      }
    }
  });
  it("never adds an out-of-stock or wrong-age product", () => {
    const m = model({ ageBand: "infants", budgetBand: "2500-15000", metal: "silver", category: "bracelet", symbols: "evil-eye" });
    const r = relax(m, catalog);
    expect(r.eligible.map((p) => p.sku)).not.toContain("TNZ-1058");
    expect(r.eligible.every((p) => p.age_groups.includes("Infants 0-3 years"))).toBe(true);
  });
  it("skips no-op steps: no band below under-2500, none above 25000-plus, no-limit", () => {
    const low = relax(model({ ageBand: "mom", budgetBand: "under-2500" }), catalog);
    expect(low.trace.map((t) => t.step)).toEqual(["widenAbove"]);
    const nl = relax(model({ ageBand: "mom", budgetBand: "no-limit" }), catalog);
    expect(nl.trace).toEqual([]);
  });
  it("a step that adds nothing records a trace but no disclosure", () => {
    const r = relax(model({ ageBand: "mom", budgetBand: "25000-plus", metal: "gold" }), catalog);
    expect(r.trace.length).toBeGreaterThan(0);
    expect(r.disclosures).toEqual([]);
  });
  it("metal and category steps disclose when they add products", () => {
    const r = relax(model({ ageBand: "kids", budgetBand: "25000-plus", metal: "silver", category: "set" }), catalog);
    expect(r.disclosures.some((d) => d.includes("set choice") || d.includes("925 silver preference"))).toBe(true);
  });
});

describe("explain (REQ-MC-27..30)", () => {
  const reasonsFor = (sku: string, m = GOLDEN1) => {
    const c = initialConstraints(m);
    const b = scoreProduct(product(sku), m, c, catalog);
    return explain(product(sku), b, m);
  };
  it("TBZ-1013 matches the design example, capped at 4 with rating dropped", () => {
    expect(reasonsFor("TBZ-1013").map((r) => r.text)).toEqual([
      "Listed for infants 0–3 years",
      "₹2,324 — inside your under-₹2,500 budget",
      "Our atelier's pick for a naming ceremony",
      "925 silver, as you preferred",
    ]);
  });
  it("always has age + budget; never pads", () => {
    const m = model({ ageBand: "kids", budgetBand: "no-limit" });
    const r = reasonsFor("TPN-1145", m);
    expect(r.map((x) => x.type)).toEqual(["age", "budget"]);
    expect(r[1].text).toBe("₹10,199 — no budget limit set");
    expect(sum(scoreProduct(product("TPN-1145"), m, initialConstraints(m), catalog))).toBe(0);
  });
  it("sources name catalog fields or map entries", () => {
    expect(reasonsFor("TBZ-1013").map((r) => r.source)).toEqual([
      "age_groups",
      "price_inr",
      "occasion-map:naming",
      "materials",
    ]);
  });
  it("symbol takes the slot over occasion when requested", () => {
    const m = model({ ageBand: "infants", occasion: "naming", symbols: "evil-eye", metal: "silver", budgetBand: "under-2500" });
    const r = reasonsFor("TNZ-1056", m);
    expect(r.map((x) => x.type)).toEqual(["age", "budget", "symbol", "metal"]);
    expect(r[2].text).toBe("Carries the evil eye you asked for");
    expect(r[2].source).toBe("product-tags:symbol:evil-eye");
  });
  it("rating appears when it is within the two extra slots", () => {
    const m = model({ ageBand: "kids", occasion: "just-because", budgetBand: "no-limit" });
    const r = reasonsFor("TPN-1147", m);
    expect(r.map((x) => x.type)).toEqual(["age", "budget", "rating"]);
    expect(r[2].text).toBe("Rated 4.8/5 by customers");
  });
  it("relaxed budget reasons say below / above", () => {
    const m = model({ ageBand: "teens", budgetBand: "15000-25000" });
    expect(reasonsFor("TPN-1141", m)[1].text).toBe("₹14,249 — just below your ₹15,000–₹25,000 budget");
    const up = model({ ageBand: "kids", budgetBand: "15000-25000" });
    expect(reasonsFor("TPN-1199", up)[1].text).toBe("₹25,249 — just above your ₹15,000–₹25,000 budget");
  });
});

describe("match entry point", () => {
  it("is deterministic and does not mutate its inputs", () => {
    const m = structuredClone(GOLDEN3);
    const cat = structuredClone(catalog);
    const a = match(m, cat);
    const b = match(structuredClone(m), cat);
    expect(a).toEqual(b);
    expect(m).toEqual(GOLDEN3);
    expect(cat).toEqual(catalog);
  });
  it("returns an empty, honest result when nothing can match", () => {
    // Mom has no kids-only pieces; ask for a set for Mom: set is dropped, earrings remain (2).
    const r = match(model({ ageBand: "mom", category: "set", budgetBand: "under-2500" }), catalog);
    expect(r.picks.length).toBeLessThan(3);
    expect(r.showBrowseLink).toBe(true);
    expect(r.shortfallNote).toBe("Only 2 pieces in the atelier are listed for Mom");
  });
  it("generic shortfall note when the age band has depth but the result is short", () => {
    const r = match(model({ ageBand: "infants", budgetBand: "2500-15000", metal: "silver", symbols: "evil-eye" }), catalog);
    expect(r.picks.map((p) => p.sku)).toEqual(["TNZ-1056"]);
    expect(r.shortfallNote).toBe("Only 1 piece fits this recipient even after widening — browse the full atelier.");
    expect(r.showBrowseLink).toBe(true);
  });
  it("3 picks carry no shortfall note and no browse link", () => {
    const r = match(GOLDEN1, catalog);
    expect(r.showBrowseLink).toBe(false);
    expect(r.shortfallNote).toBeUndefined();
  });
  it("metal-dropped and category-dropped markers", () => {
    const r = match(model({ ageBand: "kids", budgetBand: "25000-plus", metal: "silver", category: "set" }), catalog);
    const all = r.picks.flatMap((p) => p.relaxations);
    expect(all).toContain("category-dropped");
    expect(all).toContain("metal-dropped");
  });
  it("relationship does not change the result (REQ-MC-04)", () => {
    const base = match(GOLDEN1, catalog);
    for (const relationship of ["grandchild", "godchild", "mom", "own-child"] as const) {
      expect(match({ ...GOLDEN1, relationship }, catalog)).toEqual(base);
    }
  });
  it("output contains no discount or certification vocabulary", () => {
    const text = JSON.stringify(match(GOLDEN3, catalog));
    expect(text).not.toMatch(/%|\boff\b|\bsave\b|MRP|hypoallergenic|BIS|nickel|certified|\bsafe\b|unsafe/i);
  });
});
