// The 8 scripted personas (PRD §4) as models. Expected values were computed from the real
// catalog and reviewed by hand before pinning; see the notes on personas 2, 3 and 8.
import { describe, expect, it } from "vitest";
import { match } from "../lib/matching";
import { GOLDEN1, GOLDEN2, GOLDEN3, RELIGIOUS_SKUS, catalog, model } from "./helpers/matching-fixtures";

const summary = (m: ReturnType<typeof model>) => {
  const r = match(m, catalog);
  return { r, picks: r.picks.map((p) => [p.sku, p.score]) };
};

describe("scripted personas (PRD §4)", () => {
  it("1. Aunt, 6-month niece, naming, <₹2,500, silver: golden case 1", () => {
    expect(summary(GOLDEN1).picks).toEqual([["TBZ-1013", 6], ["TNZ-1056", 6], ["TBZ-1017", 6]]);
  });

  it("2. Grandmother, 5-yr grandson, birthday, ₹15–25k, gold: gold pendants, no relaxation", () => {
    const { r, picks } = summary(
      model({ relationship: "grandchild", ageBand: "kids", ageYears: 5, occasion: "birthday", budgetBand: "15000-25000", metal: "gold" }),
    );
    // Note: PRD names Om/Sikh/Trishul, but Trishul (TPN-1143, ₹14,399) is below this band.
    // In band: Sikh TPN-1147 and Om TPN-1149 (pendants) plus the TPN-1206 set. Raised as a spec question.
    expect(picks).toEqual([["TPN-1147", 6], ["TPN-1149", 6], ["TPN-1206", 4]]);
    expect(r.disclosures).toEqual([]);
    expect(r.picks.every((p) => p.relaxations.length === 0)).toBe(true);
  });

  it("3. Friend, newborn, baby shower, <₹2,500, any: TNZ-1058 never appears", () => {
    const { r, picks } = summary(
      model({ relationship: "friends-baby", ageBand: "infants", ageYears: 0, occasion: "baby-shower", budgetBand: "under-2500" }),
    );
    expect(r.picks.map((p) => p.sku)).not.toContain("TNZ-1058");
    // Two nazariya/bangle pieces. The third is TBZ-1013 (a tabeez with a Third Eye symbol): allowed
    // because symbols = 'any' is an explicit opt-in (REQ-MC-11). Raised as a spec question.
    expect(picks).toEqual([["TNZ-1056", 4], ["TOB-1008", 4], ["TBZ-1013", 1]]);
    expect(r.disclosures).toEqual([]);
  });

  it("4. Uncle, 14-yr nephew, festival, ₹15–25k, gold, Ganesha: golden case 3 (relaxation disclosed)", () => {
    const { r, picks } = summary(GOLDEN3);
    expect(picks).toEqual([["TPN-1141", 9], ["TPN-1147", 7], ["TPN-1143", 7]]);
    expect(r.disclosures).toHaveLength(2);
  });

  it("5. Daughter, Mom, birthday, ₹25k+, gold: golden case 2 (2 picks + honest note)", () => {
    const { r, picks } = summary(GOLDEN2);
    expect(picks).toEqual([["THP-1001", 7], ["THP-1017", 6]]);
    expect(r.shortfallNote).toBe("Only 2 pieces in the atelier are listed for Mom");
    expect(r.showBrowseLink).toBe(true);
  });

  it("6. Parent, 8-yr daughter, first birthday, ₹25k+, any metal, set: both sets, relaxation disclosed", () => {
    const { r, picks } = summary(
      model({ relationship: "own-child", ageBand: "kids", ageYears: 8, occasion: "first-birthday", budgetBand: "25000-plus", category: "set" }),
    );
    expect(picks).toEqual([["TPN-1199", 4], ["TPN-1206", 4], ["TOB-1009", 3]]);
    expect(r.picks.map((p) => p.relaxations)).toEqual([[], ["budget-below"], ["category-dropped"]]);
    expect(r.disclosures).toEqual([
      "Only 1 piece matched your ₹25,000+ budget, so we widened it to the band just below — your picks are marked.",
      "Only 2 pieces matched your set choice, so we set it aside — your picks are marked.",
    ]);
  });

  it("7. Godparent, 2-yr-old, Rakhi, ₹2.5–15k, silver, evil-eye: TNZ-1056, one honest pick", () => {
    const { r, picks } = summary(
      model({ relationship: "godchild", ageBand: "infants", ageYears: 2, occasion: "rakhi", budgetBand: "2500-15000", metal: "silver", symbols: "evil-eye" }),
    );
    expect(picks).toEqual([["TNZ-1056", 9]]);
    expect(r.picks[0].relaxations).toEqual(["budget-below"]);
    expect(r.picks.every((p) => !RELIGIOUS_SKUS.includes(p.sku))).toBe(true);
    expect(r.showBrowseLink).toBe(true);
    expect(r.shortfallNote).toBe("Only 1 piece fits this recipient even after widening — browse the full atelier.");
  });

  it("8. Buyer, 10-yr-old, just because, no limit, no religious symbols: none, even after relaxation", () => {
    const { r, picks } = summary(
      model({ ageBand: "kids", ageYears: 10, occasion: "just-because", budgetBand: "no-limit", symbols: "none-religious" }),
    );
    // With no occasion, metal, symbol or budget signal, only rating separates the pieces.
    expect(picks).toEqual([["TPN-1199", 1], ["TPN-1206", 1], ["THP-1001", 1]]);
    expect(r.picks.every((p) => !RELIGIOUS_SKUS.includes(p.sku))).toBe(true);
    // Even a hostile variant that forces the ladder cannot reach a religious piece.
    const squeezed = match(
      model({ ageBand: "kids", budgetBand: "2500-15000", metal: "gold", category: "pendant", symbols: "none-religious" }),
      catalog,
    );
    expect(squeezed.picks.every((p) => !RELIGIOUS_SKUS.includes(p.sku))).toBe(true);
  });
});

describe("regression: I3/I4 counterexample from the property run", () => {
  // infants / naming / under-2500 / gold / set / religious ['om'] used to return a budget-above
  // and symbol-broadened pick with no budget or symbol disclosure, because those steps added
  // nothing on their own and only the later dropCategory step was disclosed.
  it("discloses an earlier no-op step when a final pick relies on it", () => {
    const r = match(
      model({ ageBand: "infants", occasion: "naming", budgetBand: "under-2500", metal: "gold", category: "set", symbols: "religious", symbolList: ["om"] }),
      catalog,
    );
    expect(r.picks.map((p) => p.sku)).toEqual(["TBZ-1013", "TBZ-1017", "TPN-1141"]);
    expect(r.picks[2].relaxations).toEqual(["budget-above", "symbol-broadened", "category-dropped"]);
    expect(r.disclosures).toEqual([
      "No pieces matched your under ₹2,500 budget, so we widened it to the band just above — your picks are marked.",
      "No pieces matched your Om request, so we broadened it to other religious symbols — your picks are marked.",
      "No pieces matched your 18KT gold preference, so we set it aside — your picks are marked.",
      "No pieces matched your set choice, so we set it aside — your picks are marked.",
    ]);
  });
});
