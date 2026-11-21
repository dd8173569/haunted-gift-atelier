// Property tests P-CV-1..9, P-CV-11 (logic), 12, 13 (conversation design §11). Seeded; real catalog.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  AGE_CHIPS,
  BUDGET_BANDS,
  CATEGORIES,
  METALS,
  OCCASIONS,
  ORDER,
  RELATIONSHIPS,
  SYMBOL_CHOICES,
  SYMBOL_KEYS,
  OCCASION_CHIPS,
  chipForYears,
  describeModel,
  firstUnansweredQuestion,
  initial,
  isEnded,
  normalize,
  reduce,
  stateFromModel,
  toModel,
  validateModel,
  type Action,
  type Answers,
  type ConversationState,
} from "../lib/conversation";
import { MAX_PARAM_LENGTH, encodeModelParam, modelHref, parseModelParam } from "../lib/model-param";
import { match } from "../lib/matching";
import { ageYearsToBand } from "../lib/matching/age";
import type { RecipientModel } from "../lib/matching/types";
import { toPickViews } from "../lib/picks-view";
import {
  ALL_FILTERS,
  filterItems,
  filtersToQuery,
  parseBrowseFilters,
  toBrowseItems,
  type BrowseFilters,
} from "../lib/browse";
import { catalog } from "./helpers/matching-fixtures";
import { age, run, rel, occ, budget, metal, sym, cat, adultIsMom } from "./helpers/conversation-taps";
import { legalActions } from "./helpers/conversation-actions";

const SEED = 20261121;
const RUNS = 300;
const assert = <T extends unknown[]>(p: fc.IPropertyWithHooks<T>, numRuns = RUNS) =>
  fc.assert(p, { seed: SEED, numRuns });

// ---------------------------------------------------------------- generators

const arbIndexes = fc.array(fc.nat(10_000), { maxLength: 60 });
type Trace = { before: ConversationState; action: Action; after: ConversationState }[];

/** Biased toward progress: mostly answer chips, sometimes back/edit/restart. */
const arbFlow = fc.array(fc.tuple(fc.nat(10_000), fc.integer({ min: 0, max: 9 })), { maxLength: 70 });
function playBiased(flow: [number, number][]): { trace: Trace; final: ConversationState } {
  let s = initial;
  const trace: Trace = [];
  for (const [i, bias] of flow) {
    const legal = legalActions(s);
    const answers = legal.filter((a) => a.type !== "back" && a.type !== "restart" && a.type !== "edit");
    const pool = bias < 7 && answers.length > 0 ? answers : legal;
    const action = pool[i % pool.length];
    const after = reduce(s, action);
    trace.push({ before: s, action, after });
    s = after;
  }
  return { trace, final: s };
}

const arbAnswers: fc.Arbitrary<Answers> = fc
  .record(
    {
      relationship: fc.constantFrom(...RELATIONSHIPS),
      age: fc.constantFrom(...AGE_CHIPS.map((c) => c.id)),
      adultIsMom: fc.boolean(),
      occasion: fc.constantFrom(...OCCASION_CHIPS.map((c) => c.value)),
      budget: fc.constantFrom(...BUDGET_BANDS),
      metal: fc.constantFrom(...METALS),
      symbols: fc.constantFrom(...SYMBOL_CHOICES),
      symbolList: fc.uniqueArray(fc.constantFrom(...SYMBOL_KEYS), { maxLength: 4 }),
      category: fc.constantFrom(...CATEGORIES),
    },
    { requiredKeys: [] },
  )
  .map((a) => a as Answers);

const RANGE: Record<string, [number, number]> = { infants: [0, 3], kids: [3, 12], teens: [12, 19] };
const arbModel: fc.Arbitrary<RecipientModel> = fc
  .tuple(
    fc.constantFrom("infants", "kids", "teens", "mom"),
    fc.constantFrom(...RELATIONSHIPS.filter((r) => r !== "mom")),
    fc.oneof(fc.constant(undefined), fc.double({ min: 0, max: 1, noNaN: true })),
    fc.constantFrom(...OCCASIONS),
    fc.constantFrom(...BUDGET_BANDS),
    fc.constantFrom(...METALS),
    fc.constantFrom(...SYMBOL_CHOICES),
    fc.uniqueArray(fc.constantFrom(...SYMBOL_KEYS), { maxLength: 7 }),
    fc.constantFrom(...CATEGORIES),
  )
  .map(([band, relationship, frac, occasion, budgetBand, metalPref, symbols, list, category]) => {
    const m: RecipientModel = {
      relationship: band === "mom" ? "mom" : relationship,
      ageBand: band as RecipientModel["ageBand"],
      occasion,
      budgetBand,
      metal: metalPref,
      symbols,
      category,
    };
    if (band !== "mom" && frac !== undefined) {
      const [lo, hi] = RANGE[band];
      m.ageYears = Math.min(lo + frac * (hi - lo), hi - 0.001);
    }
    if (symbols === "religious" && list.length > 0) m.symbolList = list;
    return m;
  });

const mutate = (m: RecipientModel, kind: number): unknown => {
  const o: Record<string, unknown> = { ...m };
  switch (kind % 6) {
    case 0: delete o.metal; break;
    case 1: o.budgetBand = "cheap"; break;
    case 2: o.extra = 1; break;
    case 3: o.occasion = 7; break;
    case 4: o.symbols = "religious"; o.symbolList = ["om", "om"]; break;
    default: o.ageYears = 25; break;
  }
  return o;
};

const arbParam: fc.Arbitrary<string | string[] | undefined> = fc.oneof(
  arbModel.map((m) => encodeModelParam(m)),
  fc.tuple(arbModel, fc.nat(100)).map(([m, k]) => JSON.stringify(mutate(m, k))),
  fc.tuple(arbModel, fc.nat(400)).map(([m, n]) => encodeModelParam(m).slice(0, n)),
  fc.tuple(arbModel, arbModel).map(([a, b]) => [encodeModelParam(a), encodeModelParam(b)]),
  fc.anything().map((x) => JSON.stringify(x) ?? "undefined"),
  fc.string({ maxLength: MAX_PARAM_LENGTH + 20 }),
  fc.constant(undefined),
);

// ------------------------------------------------------------------ properties

describe("P-CV-1 every path yields a valid model", () => {
  it("any action sequence that reaches the card has a valid model", () => {
    assert(
      fc.property(arbFlow, (flow) => {
        const { trace } = playBiased(flow);
        for (const { after } of trace) {
          if (after.step === "card") {
            const r = toModel(after.answers);
            expect(r.ok).toBe(true);
            if (r.ok) expect(validateModel(r.model).ok).toBe(true);
          }
        }
      }),
    );
  });
  it("any answers: toModel ok implies validateModel ok", () => {
    assert(
      fc.property(arbAnswers, (a) => {
        const r = toModel(a);
        if (r.ok) expect(validateModel(r.model)).toEqual({ ok: true, model: r.model });
        else expect(["adult", "incomplete"]).toContain(r.reason);
      }),
    );
  });
  it("complete child answers always yield a model", () => {
    assert(
      fc.property(arbAnswers, (a) => {
        const full: Answers = { ...a, relationship: a.relationship === "mom" || a.relationship === undefined ? "other" : a.relationship };
        if (full.age === "adult") full.age = "3-6";
        full.age ??= "3-6";
        full.occasion ??= "birthday";
        full.budget ??= "no-limit";
        full.metal ??= "any";
        full.symbols ??= "any";
        full.category ??= "any";
        expect(toModel(full).ok).toBe(true);
      }),
    );
  });
});

/** Fresh-state taps that reproduce a normalised, complete Answers. */
function tapsFor(a: Answers) {
  const t: Action[] = [rel(a.relationship!)];
  if (a.relationship !== "mom") t.push(age(a.age!));
  if (a.age === "adult" && a.relationship !== "mom") t.push(adultIsMom(a.adultIsMom!));
  t.push(occ(a.occasion!), budget(a.budget!), metal(a.metal!), sym(a.symbols!));
  if (a.symbols === "religious") {
    for (const key of a.symbolList ?? []) t.push({ type: "toggle-symbol", key });
    t.push({ type: "continue" });
  }
  if (!(a.relationship === "mom" || a.adultIsMom === true)) t.push(cat(a.category!));
  return t;
}

describe("P-CV-2 back and change never corrupt", () => {
  it("back never changes answers", () => {
    assert(
      fc.property(arbFlow, (flow) => {
        const { trace } = playBiased(flow);
        for (const { before, after, action } of trace) {
          if (action.type === "back") expect(after.answers).toEqual(before.answers);
        }
      }),
    );
  });
  it("answers are always normalised: no stale age, adultIsMom, category, symbolList", () => {
    assert(
      fc.property(arbFlow, (flow) => {
        for (const { after } of playBiased(flow).trace) {
          const a = after.answers;
          expect(normalize(a)).toEqual(a);
          if (a.relationship === "mom") {
            expect(a.age).toBeUndefined();
            expect(a.adultIsMom).toBeUndefined();
            expect(a.category).toBeUndefined();
          }
          if (a.adultIsMom === true) expect(a.category).toBeUndefined();
          if (a.symbols !== "religious") expect(a.symbolList).toBeUndefined();
          if (a.age !== "adult") expect(a.adultIsMom).toBeUndefined();
        }
      }),
    );
  });
  it("the model of the final answers equals the model from answering them in order on a fresh state", () => {
    assert(
      fc.property(arbFlow, (flow) => {
        const { final } = playBiased(flow);
        const r = toModel(final.answers);
        if (!r.ok) return;
        const fresh = run(tapsFor(normalize(final.answers)));
        expect(fresh.step).toBe("card");
        expect(toModel(fresh.answers)).toEqual(r);
      }),
    );
  });
});

describe("P-CV-3 step gating and purity", () => {
  it("card implies a model; outside edit mode the step never passes the first unanswered question", () => {
    assert(
      fc.property(arbFlow, (flow) => {
        for (const { after } of playBiased(flow).trace) {
          const a = after.answers;
          const first = firstUnansweredQuestion(a);
          if (after.step === "card") {
            expect(toModel(a).ok).toBe(true);
            expect(after.returnToCard).toBe(false);
          }
          if (after.step === "adult-end") expect(isEnded(a)).toBe(true);
          if (isEnded(a)) expect(["relationship", "age", "adult-check", "adult-end"]).toContain(after.step);
          if (!after.returnToCard && first !== undefined && after.step !== "card" && after.step !== "adult-end") {
            expect(ORDER.indexOf(after.step)).toBeLessThanOrEqual(ORDER.indexOf(first));
          }
          if (!after.returnToCard && first !== undefined && !isEnded(a)) expect(after.step).not.toBe("card");
        }
      }),
    );
  });
  it("reduce is pure: the input state is never mutated", () => {
    assert(
      fc.property(arbIndexes, (idx) => {
        let s = initial;
        for (const i of idx) {
          const legal = legalActions(s);
          const snapshot = structuredClone(s);
          const action = legal[i % legal.length];
          const actionSnapshot = structuredClone(action);
          const next = reduce(s, action);
          expect(s).toEqual(snapshot);
          expect(action).toEqual(actionSnapshot);
          s = next;
        }
        expect(initial).toEqual({ answers: {}, step: "relationship", returnToCard: false });
      }),
    );
  });
});

describe("P-CV-4 invalid never reaches match()", () => {
  it("parseModelParam never throws; ok implies a valid model that match() accepts", () => {
    assert(
      fc.property(arbParam, (raw) => {
        const r = parseModelParam(raw);
        if (r.status === "ok") {
          expect(validateModel(r.model).ok).toBe(true);
          const result = match(r.model, catalog);
          expect(result.picks.length).toBeLessThanOrEqual(3);
        } else {
          expect(r).not.toHaveProperty("model");
        }
      }),
      600,
    );
  });
  it("arbitrary values of any type never throw", () => {
    assert(
      fc.property(fc.anything(), (x) => {
        expect(() => parseModelParam(x as never)).not.toThrow();
        expect(() => validateModel(x)).not.toThrow();
      }),
      600,
    );
  });
  it("every mutation of a valid model is rejected", () => {
    assert(
      fc.property(arbModel, fc.nat(100), (m, k) => {
        expect(parseModelParam(JSON.stringify(mutate(m, k))).status).toBe("invalid");
      }),
      600,
    );
  });
});

describe("P-CV-5 transport round trip", () => {
  it("encode then parse returns the model; the href query decodes to the same string", () => {
    assert(
      fc.property(arbModel, fc.constantFrom<"/picks" | "/find">("/picks", "/find"), (m, path) => {
        expect(parseModelParam(encodeModelParam(m))).toEqual({ status: "ok", model: m });
        const href = modelHref(path, m);
        expect(href.startsWith(`${path}?m=`)).toBe(true);
        expect(new URLSearchParams(href.slice(path.length + 1)).get("m")).toBe(encodeModelParam(m));
        expect(encodeModelParam(m).length).toBeLessThanOrEqual(MAX_PARAM_LENGTH);
      }),
    );
  });
});

describe("P-CV-6 religious only by opt-in", () => {
  it("the model's symbols value is one the user tapped, and symbolList needs Religious", () => {
    assert(
      fc.property(arbFlow, (flow) => {
        const { trace, final } = playBiased(flow);
        const tapped = new Set<string>();
        for (const { action, after } of trace) {
          if (action.type === "restart") tapped.clear();
          if (action.type === "pick-symbol" && after.answers.symbols === action.value) tapped.add(action.value);
        }
        const r = toModel(final.answers);
        if (!r.ok) return;
        expect(tapped.has(r.model.symbols)).toBe(true);
        if (r.model.symbolList) expect(r.model.symbols).toBe("religious");
        if (r.model.symbols === "religious") expect(final.answers.symbols).toBe("religious");
      }),
    );
  });
  it("no answer other than Religious ever produces religious", () => {
    assert(
      fc.property(arbAnswers, (a) => {
        const r = toModel({ ...a, symbols: a.symbols === "religious" ? "any" : a.symbols });
        if (r.ok) {
          expect(r.model.symbols).not.toBe("religious");
          expect(r.model).not.toHaveProperty("symbolList");
        }
      }),
    );
  });
});

describe("P-CV-7 age chips", () => {
  const child = AGE_CHIPS.filter((c) => c.years !== undefined);
  it("intervals are contiguous over [0,19) and each band matches ageYearsToBand", () => {
    const lows = child.map((c) => c.years!);
    expect(lows).toEqual([0, 1, 3, 6, 12]);
    expect(lows.every((v, i) => i === 0 || v > lows[i - 1])).toBe(true);
    for (const c of child) expect(c.band).toBe(ageYearsToBand(c.years!));
  });
  it("chipForYears covers [0,19) and inverts the lower bound", () => {
    assert(
      fc.property(fc.double({ min: 0, max: 19, noNaN: true, maxExcluded: true }), (y) => {
        const id = chipForYears(y)!;
        const i = child.findIndex((c) => c.id === id);
        expect(i).toBeGreaterThanOrEqual(0);
        const lo = child[i].years!;
        const hi = i + 1 < child.length ? child[i + 1].years! : 19;
        expect(y >= lo && y < hi).toBe(true);
        expect(child[i].band).toBe(ageYearsToBand(y));
      }),
    );
    for (const c of child) expect(chipForYears(c.years!)).toBe(c.id);
  });
  it("outside [0,19) there is no chip", () => {
    assert(fc.property(fc.oneof(fc.double({ max: -1e-9, noNaN: true }), fc.double({ min: 19, noNaN: true })), (y) => chipForYears(y) === undefined));
  });
});

describe("P-CV-8 resume", () => {
  it("a conversation-made model resumes on the card and round-trips exactly", () => {
    const lowers = [0, 1, 3, 6, 12];
    const BANDS_OF: Record<number, RecipientModel["ageBand"]> = { 0: "infants", 1: "infants", 3: "kids", 6: "kids", 12: "teens" };
    assert(
      fc.property(arbModel, fc.constantFrom(...lowers), (m, years) => {
        const base: RecipientModel = { ...m };
        if (m.ageBand !== "mom") {
          base.ageBand = BANDS_OF[years];
          base.ageYears = years;
        }
        if (base.occasion === "other") base.occasion = "birthday";
        if (base.ageBand === "mom") base.category = "any"; // the flow never asks Mom's piece question
        const s = stateFromModel(base);
        expect(s.step).toBe("card");
        expect(toModel(s.answers)).toEqual({ ok: true, model: base });
      }),
    );
  });
  it("any valid model with ageYears resumes with ageYears moved to its chip's lower bound", () => {
    assert(
      fc.property(
        arbModel.filter((m) => m.ageYears !== undefined && m.occasion !== "other"),
        (m) => {
          const s = stateFromModel(m);
          expect(s.step).toBe("card");
          const r = toModel(s.answers);
          expect(r.ok && r.model).toEqual({ ...m, ageYears: AGE_CHIPS.find((c) => c.id === chipForYears(m.ageYears!))!.years });
        },
      ),
    );
  });
});

describe("P-CV-9 picks view", () => {
  it("toPickViews mirrors match() and the catalog for any valid model", () => {
    const byId = new Map(catalog.products.map((p) => [p.sku, p]));
    assert(
      fc.property(arbModel, (m) => {
        const result = match(m, catalog);
        const views = toPickViews(result, catalog);
        expect(views.map((v) => v.sku)).toEqual(result.picks.map((p) => p.sku));
        expect(views.length).toBeLessThanOrEqual(3);
        views.forEach((v, i) => {
          const p = byId.get(v.sku)!;
          expect(p.availability).toBe("In Stock");
          expect([v.name, v.url, v.price_inr, v.rating]).toEqual([p.name, p.url, p.price_inr, p.rating]);
          expect(v.reasons).toEqual(result.picks[i].reasons.map((r) => r.text));
          expect(v.rank).toBe(i + 1);
          expect(v.markerLabels).toHaveLength(result.picks[i].relaxations.length);
        });
      }),
      600,
    );
  });
});

describe("P-CV-11 browse logic", () => {
  const items = toBrowseItems(catalog);
  const arbFilters: fc.Arbitrary<BrowseFilters> = fc.record({
    age: fc.constantFrom("all", "infants", "kids", "teens", "mom"),
    category: fc.constantFrom("all", "pendant", "bracelet", "earrings", "set", "tabeez"),
    metal: fc.constantFrom("all", "gold", "silver"),
    budget: fc.constantFrom("all", "under-2500", "2500-15000", "15000-25000", "25000-plus"),
  }) as fc.Arbitrary<BrowseFilters>;
  const AGE_GROUP = { infants: "Infants 0-3 years", kids: "Kids 3-12 years", teens: "Teens 12-19 years", mom: "Mom" } as const;

  it("items: 22, the 21 in-stock first", () => {
    expect(items).toHaveLength(22);
    expect(items.map((i) => i.availability === "In Stock")).toEqual([...Array(21).fill(true), false]);
  });
  it("filterItems is an ordered sub-list equal to the AND of the four predicates", () => {
    assert(
      fc.property(arbFilters, (f) => {
        const got = filterItems(items, f);
        const want = items.filter(
          (i) =>
            (f.age === "all" || i.age_groups.includes(AGE_GROUP[f.age])) &&
            (f.category === "all" || i.category.toLowerCase() === f.category) &&
            (f.metal === "all" || i.metal === f.metal) &&
            (f.budget === "all" || i.price_band === f.budget),
        );
        expect(got).toEqual(want);
        expect(items.filter((i) => got.includes(i))).toEqual(got);
      }),
    );
  });
  it("adding a filter never grows the result; all filters give the input", () => {
    expect(filterItems(items, ALL_FILTERS)).toEqual(items);
    assert(
      fc.property(arbFilters, arbFilters, (f, g) => {
        const merged: BrowseFilters = {
          age: f.age !== "all" ? f.age : g.age,
          category: f.category !== "all" ? f.category : g.category,
          metal: f.metal !== "all" ? f.metal : g.metal,
          budget: f.budget !== "all" ? f.budget : g.budget,
        };
        expect(filterItems(items, merged).length).toBeLessThanOrEqual(filterItems(items, f).length);
      }),
    );
  });
});

describe("P-CV-12 browse parsing", () => {
  const arbValue = fc.oneof(fc.string(), fc.array(fc.string(), { maxLength: 3 }), fc.constant(undefined));
  it("never throws and always yields known values", () => {
    assert(
      fc.property(
        fc.dictionary(fc.oneof(fc.constantFrom("age", "category", "metal", "budget"), fc.string({ maxLength: 8 })), arbValue),
        (sp) => {
          const f = parseBrowseFilters(sp);
          expect(["all", "infants", "kids", "teens", "mom"]).toContain(f.age);
          expect(["all", "pendant", "bracelet", "earrings", "set", "tabeez"]).toContain(f.category);
          expect(["all", "gold", "silver"]).toContain(f.metal);
          expect(["all", "under-2500", "2500-15000", "15000-25000", "25000-plus"]).toContain(f.budget);
        },
      ),
    );
  });
  it("filtersToQuery then parseBrowseFilters round-trips", () => {
    assert(
      fc.property(
        fc.record({
          age: fc.constantFrom("all", "infants", "kids", "teens", "mom"),
          category: fc.constantFrom("all", "pendant", "bracelet", "earrings", "set", "tabeez"),
          metal: fc.constantFrom("all", "gold", "silver"),
          budget: fc.constantFrom("all", "under-2500", "2500-15000", "15000-25000", "25000-plus"),
        }) as fc.Arbitrary<BrowseFilters>,
        (f) => {
          const sp = Object.fromEntries(new URLSearchParams(filtersToQuery(f)));
          expect(parseBrowseFilters(sp)).toEqual(f);
        },
      ),
    );
  });
});

describe("P-CV-13 determinism", () => {
  it("same answers give the same model, the same m, the same card text", () => {
    assert(
      fc.property(arbFlow, (flow) => {
        const { final } = playBiased(flow);
        const again = playBiased(flow).final;
        expect(again).toEqual(final);
        const a = toModel(final.answers);
        const b = toModel(structuredClone(final.answers));
        expect(a).toEqual(b);
        if (a.ok && b.ok) {
          expect(encodeModelParam(a.model)).toBe(encodeModelParam(b.model));
          expect(describeModel(a.model, "n")).toEqual(describeModel(b.model, "n"));
        }
      }),
    );
  });
  it("toPickViews twice gives deep-equal output", () => {
    assert(
      fc.property(arbModel, (m) => {
        const r = match(m, catalog);
        expect(toPickViews(r, catalog)).toEqual(toPickViews(r, catalog));
      }),
    );
  });
});
