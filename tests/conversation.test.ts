import { describe, expect, it } from "vitest";
import {
  ADULT_END_MESSAGE,
  AGE_CHIPS,
  BUDGET_CHIPS,
  CATEGORY_CHIPS,
  KNOWN_SYMBOL_KEYS,
  METAL_CHIPS,
  OCCASION_CHIPS,
  QUESTIONS,
  RELATIONSHIP_CHIPS,
  SYMBOL_CHIPS,
  SYMBOL_SUBCHIPS,
  chipForYears,
  describeModel,
  initial,
  momSkipNote,
  normalize,
  reduce,
  stateFromModel,
  toModel,
  validateModel,
  type Answers,
} from "../lib/conversation";
import type { ParsedCatalog } from "../lib/catalog";
import type { RecipientModel } from "../lib/matching/types";
import { catalog, GOLDEN1, GOLDEN2, GOLDEN3 } from "./helpers/matching-fixtures";
import {
  GOLDEN1_TAPS,
  GOLDEN2_TAPS,
  GOLDEN3_TAPS,
  adultIsMom,
  age,
  budget,
  cat,
  metal,
  occ,
  rel,
  run,
  sym,
} from "./helpers/conversation-taps";

const model = (s: ReturnType<typeof run>) => {
  const r = toModel(s.answers);
  if (!r.ok) throw new Error("no model");
  return r.model;
};

describe("chip tables (REQ-CV-04)", () => {
  it("relationship chips", () => {
    expect(RELATIONSHIP_CHIPS.map((c) => [c.label, c.value])).toEqual([
      ["Niece or nephew", "niece-nephew"],
      ["Grandchild", "grandchild"],
      ["A friend's baby", "friends-baby"],
      ["Godchild", "godchild"],
      ["My own child", "own-child"],
      ["Mom", "mom"],
      ["Someone else", "other"],
    ]);
    expect(RELATIONSHIP_CHIPS.map((c) => c.phrase)).toEqual([
      "your niece or nephew",
      "your grandchild",
      "your friend's baby",
      "your godchild",
      "your own child",
      "Mom",
      "someone special",
    ]);
  });
  it("age chips are half-open intervals with bands (REQ-CV-05)", () => {
    expect(AGE_CHIPS.map((c) => [c.id, c.label, c.band, c.years])).toEqual([
      ["0-1", "0–1", "infants", 0],
      ["1-3", "1–3", "infants", 1],
      ["3-6", "3–6", "kids", 3],
      ["6-12", "6–12", "kids", 6],
      ["12-19", "12–19", "teens", 12],
      ["adult", "An adult", undefined, undefined],
    ]);
  });
  it("occasion chips omit 'other'", () => {
    expect(OCCASION_CHIPS.map((c) => [c.label, c.value])).toEqual([
      ["Naming ceremony", "naming"],
      ["Birthday", "birthday"],
      ["First birthday", "first-birthday"],
      ["Baby shower", "baby-shower"],
      ["Festival", "festival"],
      ["Rakhi", "rakhi"],
      ["Just because", "just-because"],
    ]);
  });
  it("budget, metal, symbol, category chips", () => {
    expect(BUDGET_CHIPS.map((c) => [c.label, c.value])).toEqual([
      ["Under ₹2,500", "under-2500"],
      ["₹2,500–₹15,000", "2500-15000"],
      ["₹15,000–₹25,000", "15000-25000"],
      ["₹25,000+", "25000-plus"],
      ["No limit", "no-limit"],
    ]);
    expect(METAL_CHIPS.map((c) => [c.label, c.value])).toEqual([
      ["18KT gold", "gold"],
      ["925 silver", "silver"],
      ["No preference", "any"],
    ]);
    expect(SYMBOL_CHIPS.map((c) => [c.label, c.value])).toEqual([
      ["Any", "any"],
      ["Zodiac", "zodiac"],
      ["Evil eye / nazariya", "evil-eye"],
      ["Religious", "religious"],
      ["No religious symbols", "none-religious"],
    ]);
    expect(SYMBOL_SUBCHIPS.map((c) => [c.label, c.value])).toEqual([
      ["Om", "om"],
      ["Ganesha", "ganesha"],
      ["Cross", "cross"],
      ["Sikh", "sikh"],
      ["Trishul", "trishul"],
      ["Jain", "jain"],
      ["Tabeez", "tabeez"],
    ]);
    expect(CATEGORY_CHIPS.map((c) => [c.label, c.value])).toEqual([
      ["Pendant", "pendant"],
      ["Bracelet", "bracelet"],
      ["Earrings", "earrings"],
      ["Set", "set"],
      ["Tabeez", "tabeez"],
      ["Surprise me", "any"],
    ]);
  });
  it("sub-chip keys equal the matching table's keys", () => {
    expect([...KNOWN_SYMBOL_KEYS].sort()).toEqual(SYMBOL_SUBCHIPS.map((c) => c.value).sort());
  });
  it("prompts: the five PRD §4 lines are verbatim; progress numbers", () => {
    expect(QUESTIONS.relationship.prompt).toBe("Who are we finding a gift for?");
    expect(QUESTIONS.occasion.prompt).toBe("What's the occasion?");
    expect(QUESTIONS.budget.prompt).toBe("What shall we spend?");
    expect(QUESTIONS.metal.prompt).toBe("Gold or silver?");
    expect(QUESTIONS.symbols.prompt).toBe("Any symbols you'd love — or like to avoid?");
    expect(QUESTIONS.category.prompt).toBe("What kind of piece?");
    expect(QUESTIONS.age.prompt).toBe("How old is the little one?");
    expect(QUESTIONS["adult-check"].prompt).toBe("Is this for Mom?");
    expect(Object.values(QUESTIONS).map((q) => q.number)).toEqual([1, 1, 1, 2, 3, 4, 5, 6]);
  });
  it("chipForYears covers the boundaries", () => {
    expect([0, 0.99, 1, 2.99, 3, 5.9, 6, 11.99, 12, 18.99].map(chipForYears)).toEqual([
      "0-1", "0-1", "1-3", "1-3", "3-6", "3-6", "6-12", "6-12", "12-19", "12-19",
    ]);
    for (const bad of [-1, 19, NaN, Infinity]) expect(chipForYears(bad)).toBeUndefined();
  });
});

describe("reducer transitions", () => {
  it("starts on relationship and walks the golden 1 path", () => {
    expect(initial.step).toBe("relationship");
    let s = initial;
    const steps: string[] = [];
    for (const a of GOLDEN1_TAPS) {
      s = reduce(s, a);
      steps.push(s.step);
    }
    expect(steps).toEqual(["age", "occasion", "budget", "metal", "symbols", "category", "card"]);
    expect(model(s)).toEqual({
      relationship: "niece-nephew",
      ageBand: "infants",
      ageYears: 0,
      occasion: "naming",
      budgetBand: "under-2500",
      metal: "silver",
      symbols: "any",
      category: "any",
    });
  });
  it("Mom skips age and piece", () => {
    const steps: string[] = [];
    let s = initial;
    for (const a of GOLDEN2_TAPS) {
      s = reduce(s, a);
      steps.push(s.step);
    }
    expect(steps).toEqual(["occasion", "budget", "metal", "symbols", "card"]);
    expect(model(s)).toEqual({ ...GOLDEN2, symbols: "any", category: "any" });
    expect(model(s)).not.toHaveProperty("ageYears");
  });
  it("adult + No ends at adult-end with no model", () => {
    const s = run([rel("other"), age("adult"), adultIsMom(false)]);
    expect(s.step).toBe("adult-end");
    expect(toModel(s.answers)).toEqual({ ok: false, reason: "adult", missing: [] });
    expect(ADULT_END_MESSAGE).toBe("This atelier specialises in babies, kids, and Mom.");
  });
  it("adult + Yes continues as Mom", () => {
    const s = run([rel("other"), age("adult")]);
    expect(s.step).toBe("adult-check");
    const t = run([adultIsMom(true), occ("birthday"), budget("25000-plus"), metal("gold"), sym("any")], s);
    expect(t.step).toBe("card");
    expect(model(t)).toMatchObject({ relationship: "mom", ageBand: "mom", category: "any" });
    expect(model(t)).not.toHaveProperty("ageYears");
  });
  it("Golden 3 path: Religious stays on symbols until Continue", () => {
    let s = run(GOLDEN3_TAPS.slice(0, 6));
    expect(s.step).toBe("symbols");
    s = reduce(s, { type: "toggle-symbol", key: "ganesha" });
    expect(s.step).toBe("symbols");
    s = reduce(s, { type: "continue" });
    expect(s.step).toBe("category");
    expect(model(run(GOLDEN3_TAPS))).toEqual({ ...GOLDEN3, ageYears: 12 });
  });
  it("Religious with no sub-chip: no symbolList; toggle keeps chip order and un-toggles", () => {
    let s = run([...GOLDEN3_TAPS.slice(0, 6)]);
    s = run(
      [
        { type: "toggle-symbol", key: "jain" },
        { type: "toggle-symbol", key: "om" },
        { type: "toggle-symbol", key: "jain" },
        { type: "toggle-symbol", key: "ganesha" },
      ],
      s,
    );
    expect(s.answers.symbolList).toEqual(["om", "ganesha"]);
    s = run([{ type: "toggle-symbol", key: "om" }, { type: "toggle-symbol", key: "ganesha" }], s);
    expect(s.answers.symbolList).toBeUndefined();
    s = run([{ type: "continue" }, cat("any")], s);
    const m = model(s);
    expect(m.symbols).toBe("religious");
    expect(m).not.toHaveProperty("symbolList");
  });
  it("Religious → Zodiac clears symbolList and advances", () => {
    let s = reduce(run(GOLDEN3_TAPS.slice(0, 5)), sym("religious"));
    s = run([{ type: "toggle-symbol", key: "ganesha" }], s);
    expect(s.answers.symbolList).toEqual(["ganesha"]);
    s = reduce(s, sym("zodiac"));
    expect(s.answers.symbolList).toBeUndefined();
    expect(s.step).toBe("category");
  });
  it("toggle and continue outside Religious do nothing", () => {
    const s = run(GOLDEN1_TAPS.slice(0, 5));
    expect(reduce(s, { type: "toggle-symbol", key: "om" })).toBe(s);
    expect(reduce(s, { type: "continue" })).toBe(s);
  });
  it("answers for a question that is not the current step are ignored", () => {
    expect(reduce(initial, budget("no-limit"))).toBe(initial);
    expect(reduce(initial, sym("any"))).toBe(initial);
  });
  it("unknown values are ignored", () => {
    expect(reduce(initial, rel("nobody" as never))).toBe(initial);
    const atSymbols = run([rel("mom"), occ("birthday"), budget("no-limit"), metal("any")]);
    expect(reduce(atSymbols, sym("bogus" as never))).toBe(atSymbols);
  });
  it("edit is ignored for a question that does not apply", () => {
    const s = run(GOLDEN2_TAPS);
    expect(reduce(s, { type: "edit", question: "category" })).toBe(s);
    expect(reduce(s, { type: "edit", question: "age" })).toBe(s);
  });
  it("restart returns a fresh initial state", () => {
    const s = reduce(run(GOLDEN1_TAPS), { type: "restart" });
    expect(s).toEqual(initial);
    expect(s).not.toBe(initial);
  });
});

describe("Back (REQ-CV-03)", () => {
  it("never changes answers and returns to the previous applicable question", () => {
    let s = run(GOLDEN1_TAPS);
    const before = structuredClone(s.answers);
    const seen: string[] = [];
    for (let i = 0; i < 9; i++) {
      s = reduce(s, { type: "back" });
      seen.push(s.step);
      expect(s.answers).toEqual(before);
    }
    expect(seen).toEqual(["category", "symbols", "metal", "budget", "occasion", "age", "relationship", "relationship", "relationship"]);
  });
  it("Mom: Back from the card lands on symbols, then skips age", () => {
    let s = run(GOLDEN2_TAPS);
    s = reduce(s, { type: "back" });
    expect(s.step).toBe("symbols");
    s = run([{ type: "back" }, { type: "back" }, { type: "back" }, { type: "back" }], s);
    expect(s.step).toBe("relationship");
  });
  it("Back from adult-end goes to adult-check", () => {
    const s = run([rel("other"), age("adult"), adultIsMom(false), { type: "back" }]);
    expect(s.step).toBe("adult-check");
    expect(s.answers.adultIsMom).toBe(false);
  });
  it("Back cancels an edit and returns to the card", () => {
    const s = run([...GOLDEN1_TAPS, { type: "edit", question: "budget" }, { type: "back" }]);
    expect(s.step).toBe("card");
    expect(s.returnToCard).toBe(false);
  });
  it("Back while an edit left the answers incomplete does not land on the card", () => {
    const s = run([...GOLDEN1_TAPS, { type: "edit", question: "age" }, age("adult"), { type: "back" }]);
    expect(s.step).not.toBe("card");
    expect(s.step).toBe("age");
    expect(s.returnToCard).toBe(false);
  });
});

describe("Edit (REQ-CV-16, 13)", () => {
  it("edit returns to the card with the new value", () => {
    const s = run([...GOLDEN1_TAPS, { type: "edit", question: "budget" }]);
    expect(s.step).toBe("budget");
    expect(s.returnToCard).toBe(true);
    const t = reduce(s, budget("2500-15000"));
    expect(t.step).toBe("card");
    expect(t.returnToCard).toBe(false);
    expect(model(t).budgetBand).toBe("2500-15000");
  });
  it("Mom → Grandchild asks age first, then piece, then returns to the card", () => {
    let s = run([...GOLDEN2_TAPS, { type: "edit", question: "relationship" }, rel("grandchild")]);
    expect(s.step).toBe("age");
    expect(s.returnToCard).toBe(true);
    s = reduce(s, age("3-6"));
    expect(s.step).toBe("category");
    s = reduce(s, cat("pendant"));
    expect(s.step).toBe("card");
    expect(model(s)).toMatchObject({ relationship: "grandchild", ageBand: "kids", ageYears: 3, category: "pendant" });
  });
  it("Grandchild → Mom clears age, adultIsMom and category and keeps the rest", () => {
    const s = run([...GOLDEN1_TAPS, { type: "edit", question: "relationship" }, rel("mom")]);
    expect(s.step).toBe("card");
    expect(s.answers).toEqual({
      relationship: "mom",
      occasion: "naming",
      budget: "under-2500",
      metal: "silver",
      symbols: "any",
    });
    expect(model(s)).toMatchObject({ relationship: "mom", ageBand: "mom", category: "any" });
  });
  it("child age → adult asks Is this for Mom?; No ends the flow", () => {
    let s = run([...GOLDEN1_TAPS, { type: "edit", question: "age" }, age("adult")]);
    expect(s.step).toBe("adult-check");
    s = reduce(s, adultIsMom(false));
    expect(s.step).toBe("adult-end");
    expect(s.returnToCard).toBe(false);
  });
  it("adult+Yes then a child age drops adultIsMom", () => {
    const s = run([rel("other"), age("adult"), adultIsMom(true), { type: "edit", question: "age" }, age("6-12")]);
    expect(s.answers.adultIsMom).toBeUndefined();
    expect(s.step).toBe("occasion"); // nothing else was answered yet
  });
  it("regression: a stale adultIsMom does not hide the piece answer (property P-CV-1 counterexample)", () => {
    expect(normalize({ relationship: "other", age: "3-6", adultIsMom: true, category: "set" })).toEqual({
      relationship: "other",
      age: "3-6",
      category: "set",
    });
    const mom = run([rel("other"), age("adult"), adultIsMom(true), occ("birthday"), budget("no-limit"), metal("any"), sym("any")]);
    const s = run([{ type: "edit", question: "age" }, age("6-12"), cat("pendant")], mom);
    expect(s.step).toBe("card");
    expect(model(s)).toMatchObject({ relationship: "other", ageBand: "kids", ageYears: 6, category: "pendant" });
  });
  it("edit symbols to Religious waits for Continue", () => {
    let s = run([...GOLDEN1_TAPS, { type: "edit", question: "symbols" }, sym("religious")]);
    expect(s.step).toBe("symbols");
    s = run([{ type: "toggle-symbol", key: "cross" }, { type: "continue" }], s);
    expect(s.step).toBe("card");
    expect(model(s).symbolList).toEqual(["cross"]);
  });
});

describe("normalize", () => {
  it("is idempotent and drops stale answers", () => {
    const a: Answers = {
      relationship: "mom",
      age: "3-6",
      adultIsMom: true,
      occasion: "naming",
      category: "set",
      symbols: "zodiac",
      symbolList: ["om"],
    };
    const n = normalize(a);
    expect(n).toEqual({ relationship: "mom", occasion: "naming", symbols: "zodiac" });
    expect(normalize(n)).toEqual(n);
    expect(a.age).toBe("3-6");
  });
  it("adult + No clears everything after the age questions", () => {
    expect(
      normalize({ relationship: "other", age: "adult", adultIsMom: false, occasion: "naming", metal: "gold" }),
    ).toEqual({ relationship: "other", age: "adult", adultIsMom: false });
  });
});

describe("toModel", () => {
  it("reports incomplete answers", () => {
    expect(toModel({})).toEqual({
      ok: false,
      reason: "incomplete",
      missing: ["relationship", "age", "occasion", "budget", "metal", "symbols", "category"],
    });
    expect(toModel({ relationship: "other", age: "adult" })).toMatchObject({
      reason: "incomplete",
      missing: ["adult-check", "occasion", "budget", "metal", "symbols", "category"],
    });
  });
  it("canonical key order and omitted optional keys", () => {
    expect(Object.keys(model(run(GOLDEN1_TAPS)))).toEqual([
      "relationship", "ageBand", "ageYears", "occasion", "budgetBand", "metal", "symbols", "category",
    ]);
    expect(Object.keys(model(run(GOLDEN2_TAPS)))).toEqual([
      "relationship", "ageBand", "occasion", "budgetBand", "metal", "symbols", "category",
    ]);
    expect(Object.keys(model(run(GOLDEN3_TAPS)))).toEqual([
      "relationship", "ageBand", "ageYears", "occasion", "budgetBand", "metal", "symbols", "symbolList", "category",
    ]);
  });
  it("is JSON-stable (no undefined values)", () => {
    const m = model(run(GOLDEN2_TAPS));
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
  });
});

describe("validateModel (REQ-CV-19)", () => {
  const base: RecipientModel = { ...GOLDEN1, ageYears: 0 };
  const bad = (x: unknown) => expect(validateModel(x).ok).toBe(false);

  it("accepts the golden models and rebuilds in canonical order", () => {
    for (const m of [base, GOLDEN2, { ...GOLDEN3, ageYears: 12 }]) {
      const v = validateModel(m);
      expect(v).toEqual({ ok: true, model: m });
    }
    const shuffled = { category: "any", symbols: "any", metal: "silver", budgetBand: "under-2500", occasion: "naming", ageYears: 0, ageBand: "infants", relationship: "niece-nephew" };
    const v = validateModel(shuffled);
    expect(v.ok && Object.keys(v.model)[0]).toBe("relationship");
    // golden 1 as stored in the fixtures carries ageYears 0.5, still valid
    expect(validateModel(GOLDEN1).ok).toBe(true);
  });
  it("accepts a model with no ageYears (resume asks the age again)", () => {
    expect(validateModel(GOLDEN3).ok).toBe(true);
  });
  it("rejects non-objects", () => {
    for (const x of [null, undefined, [], "x", 3, true]) bad(x);
    bad(new Date());
    bad(Object.create({ relationship: "other" }));
  });
  it("rejects an unknown key", () => bad({ ...base, extra: 1 }));
  it("rejects a missing required key and a wrong type", () => {
    const { metal: _metal, ...noMetal } = base;
    void _metal;
    bad(noMetal);
    bad({ ...base, metal: 1 });
    bad({ ...base, occasion: "diwali" });
    bad({ ...base, budgetBand: "cheap" });
    bad({ ...base, symbols: "all" });
    bad({ ...base, category: "ring" });
    bad({ ...base, relationship: "aunt" });
    bad({ ...base, ageBand: "adult" });
  });
  it("rejects bad ageYears", () => {
    for (const y of [-1, 19, NaN, Infinity, "3", null]) bad({ ...base, ageYears: y });
    bad({ ...base, ageYears: 5 }); // infants band but 5 years is kids
    bad({ ...base, ageBand: "kids", ageYears: 0 });
    bad({ ...GOLDEN2, ageYears: 0 });
  });
  it("rejects bad symbolList", () => {
    bad({ ...base, symbolList: ["om"] }); // symbols is 'any'
    const rel = { ...base, symbols: "religious" };
    bad({ ...rel, symbolList: [] });
    bad({ ...rel, symbolList: ["om", "om"] });
    bad({ ...rel, symbolList: ["swastik"] });
    bad({ ...rel, symbolList: "om" });
    expect(validateModel({ ...rel, symbolList: ["om", "tabeez"] }).ok).toBe(true);
    expect(validateModel(rel).ok).toBe(true);
  });
  it("mom iff mom band", () => {
    bad({ ...base, relationship: "mom" });
    bad({ ...GOLDEN2, relationship: "other" });
  });
  it("returns a copy, never the input object", () => {
    const v = validateModel(base);
    expect(v.ok && v.model).not.toBe(base);
  });
});

describe("stateFromModel", () => {
  it("resumes golden models on the card", () => {
    for (const taps of [GOLDEN1_TAPS, GOLDEN2_TAPS, GOLDEN3_TAPS]) {
      const m = model(run(taps));
      const s = stateFromModel(m);
      expect(s.step).toBe("card");
      expect(s.returnToCard).toBe(false);
      expect(toModel(s.answers)).toEqual({ ok: true, model: m });
    }
  });
  it("a model with no ageYears resumes at the age question", () => {
    expect(stateFromModel(GOLDEN3).step).toBe("age");
  });
  it("occasion 'other' is not a chip, so the occasion is asked again", () => {
    const s = stateFromModel({ ...GOLDEN1, occasion: "other" });
    expect(s.step).toBe("occasion");
  });
  it("an invalid model gives the initial state", () => {
    expect(stateFromModel({ ...GOLDEN1, metal: "bronze" } as never)).toEqual(initial);
  });
});

describe("describeModel", () => {
  it("golden 1 headline and 7 lines", () => {
    const v = describeModel(model(run(GOLDEN1_TAPS)), "MOM");
    expect(v.headline).toBe("A naming gift for your niece or nephew, 0–1 years");
    expect(v.lines.map((l) => [l.question, l.label, l.value])).toEqual([
      ["relationship", "Who", "Niece or nephew"],
      ["age", "Age", "0–1 years"],
      ["occasion", "Occasion", "Naming ceremony"],
      ["budget", "Budget", "Under ₹2,500"],
      ["metal", "Metal", "925 silver"],
      ["symbols", "Symbols", "Any symbols"],
      ["category", "Piece", "Any piece"],
    ]);
    expect(v.note).toBeUndefined();
  });
  it("Mom: no age or piece line, note carried", () => {
    const v = describeModel(model(run(GOLDEN2_TAPS)), "the note");
    expect(v.headline).toBe("A birthday gift for Mom");
    expect(v.lines.map((l) => l.question)).toEqual(["relationship", "occasion", "budget", "metal", "symbols"]);
    expect(v.note).toBe("the note");
  });
  it("symbol lines", () => {
    const sy = (m: Partial<RecipientModel>) =>
      describeModel({ ...GOLDEN1, ageYears: 0, ...m }, "").lines.find((l) => l.question === "symbols")?.value;
    expect(sy({ symbols: "zodiac" })).toBe("Zodiac");
    expect(sy({ symbols: "evil-eye" })).toBe("Evil eye / nazariya");
    expect(sy({ symbols: "none-religious" })).toBe("No religious symbols");
    expect(sy({ symbols: "religious" })).toBe("Religious, any symbol");
    expect(sy({ symbols: "religious", symbolList: ["om", "ganesha"] })).toBe("Religious: Om, Ganesha");
  });
  it("headline for golden 3 and a model without ageYears", () => {
    expect(describeModel({ ...GOLDEN3, ageYears: 12 }, "").headline).toBe(
      "A festival gift for someone special, 12–19 years",
    );
    expect(describeModel(GOLDEN3, "").headline).toBe("A festival gift for someone special, teens 12–19 years");
    expect(describeModel({ ...GOLDEN1, ageBand: "kids", ageYears: undefined }, "").lines[1].value).toBe("kids 3–12 years");
    expect(describeModel({ ...GOLDEN1, ageYears: undefined }, "").lines[1].value).toBe("infants 0–3 years");
  });
  it("piece line shows the chip label", () => {
    const v = describeModel({ ...GOLDEN1, ageYears: 0, category: "pendant", occasion: "first-birthday" }, "");
    expect(v.lines.at(-1)?.value).toBe("Pendant");
    expect(v.headline).toBe("A first birthday gift for your niece or nephew, 0–1 years");
  });
});

describe("momSkipNote (REQ-CV-11)", () => {
  it("real catalog: only earrings", () => {
    expect(momSkipNote(catalog)).toBe("Only earrings are listed for Mom, so we skipped the piece question.");
  });
  it("two Mom categories: generic note", () => {
    const c: ParsedCatalog = structuredClone(catalog);
    const pendant = c.products.find((p) => p.category === "Pendant" && p.availability === "In Stock")!;
    pendant.age_groups = [...pendant.age_groups, "Mom"];
    expect(momSkipNote(c)).toBe("We skipped the piece question for Mom.");
  });
  it("no Mom product: generic note; out-of-stock Mom products are ignored", () => {
    const c: ParsedCatalog = structuredClone(catalog);
    for (const p of c.products) p.age_groups = p.age_groups.filter((g) => g !== "Mom");
    expect(momSkipNote(c)).toBe("We skipped the piece question for Mom.");
    const oos = c.products.find((p) => p.availability === "Out of Stock")!;
    oos.age_groups = ["Mom"];
    expect(momSkipNote(c)).toBe("We skipped the piece question for Mom.");
  });
  it("one other category pluralises from the catalog, not a constant", () => {
    const c: ParsedCatalog = structuredClone(catalog);
    for (const p of c.products) p.age_groups = p.age_groups.filter((g) => g !== "Mom");
    const set = c.products.find((p) => p.category === "Set" && p.availability === "In Stock")!;
    set.age_groups = ["Mom"];
    expect(momSkipNote(c)).toBe("Only sets are listed for Mom, so we skipped the piece question.");
  });
});
