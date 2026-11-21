// Conversation state machine (conversation design §2). Pure: no React, no I/O,
// no clock, no randomness. Fixed strings only; no language model.
import type { ParsedCatalog } from "./catalog";
import type { Occasion } from "../data/occasion-map";
import { SYMBOL_CHIP_TAGS } from "../data/product-tags";
import { ageYearsToBand } from "./matching/age";
import { SYMBOL_CHIP_LABEL } from "./matching/templates";
import type {
  AgeBand,
  BudgetBand,
  CategoryPref,
  MetalPref,
  RecipientModel,
  Relationship,
  SymbolChoice,
} from "./matching/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuestionId =
  | "relationship"
  | "age"
  | "adult-check"
  | "occasion"
  | "budget"
  | "metal"
  | "symbols"
  | "category";
export type Step = QuestionId | "card" | "adult-end";

export type AgeChipId = "0-1" | "1-3" | "3-6" | "6-12" | "12-19" | "adult";
export type ChildAgeChipId = Exclude<AgeChipId, "adult">;
export type SymbolKey = "om" | "ganesha" | "cross" | "sikh" | "trishul" | "jain" | "tabeez";
export type ChipOccasion = Exclude<Occasion, "other">;

export interface Answers {
  relationship?: Relationship;
  age?: AgeChipId;
  adultIsMom?: boolean;
  occasion?: ChipOccasion;
  budget?: BudgetBand;
  metal?: MetalPref;
  symbols?: SymbolChoice;
  symbolList?: SymbolKey[];
  category?: CategoryPref;
}

export interface ConversationState {
  answers: Answers;
  step: Step;
  /** True while editing from the card (REQ-CV-16). */
  returnToCard: boolean;
}

export type Action =
  | { type: "answer"; question: "relationship"; value: Relationship }
  | { type: "answer"; question: "age"; value: AgeChipId }
  | { type: "answer"; question: "adult-check"; value: boolean }
  | { type: "answer"; question: "occasion"; value: ChipOccasion }
  | { type: "answer"; question: "budget"; value: BudgetBand }
  | { type: "answer"; question: "metal"; value: MetalPref }
  | { type: "answer"; question: "category"; value: CategoryPref }
  | { type: "pick-symbol"; value: SymbolChoice }
  | { type: "toggle-symbol"; key: SymbolKey }
  | { type: "continue" }
  | { type: "back" }
  | { type: "edit"; question: QuestionId }
  | { type: "restart" };

// ---------------------------------------------------------------------------
// Runtime enum lists, with compile-time exhaustiveness checks
// ---------------------------------------------------------------------------

export const RELATIONSHIPS = [
  "niece-nephew",
  "grandchild",
  "friends-baby",
  "godchild",
  "own-child",
  "mom",
  "other",
] as const satisfies readonly Relationship[];
export const AGE_BANDS = ["infants", "kids", "teens", "mom"] as const satisfies readonly AgeBand[];
export const OCCASIONS = [
  "naming",
  "baby-shower",
  "birthday",
  "first-birthday",
  "festival",
  "rakhi",
  "just-because",
  "other",
] as const satisfies readonly Occasion[];
export const BUDGET_BANDS = [
  "under-2500",
  "2500-15000",
  "15000-25000",
  "25000-plus",
  "no-limit",
] as const satisfies readonly BudgetBand[];
export const METALS = ["gold", "silver", "any"] as const satisfies readonly MetalPref[];
export const SYMBOL_CHOICES = [
  "any",
  "none-religious",
  "zodiac",
  "evil-eye",
  "religious",
] as const satisfies readonly SymbolChoice[];
export const CATEGORIES = [
  "pendant",
  "bracelet",
  "earrings",
  "set",
  "tabeez",
  "any",
] as const satisfies readonly CategoryPref[];
export const SYMBOL_KEYS = [
  "om",
  "ganesha",
  "cross",
  "sikh",
  "trishul",
  "jain",
  "tabeez",
] as const satisfies readonly SymbolKey[];

type Covers<T, L extends readonly unknown[]> = [Exclude<T, L[number]>] extends [never] ? true : false;
type AssertTrue<T extends true> = T;
/** A new member in a matching type makes one of these resolve to `false`, so typecheck fails here. */
export type EnumExhaustiveness = [
  AssertTrue<Covers<Relationship, typeof RELATIONSHIPS>>,
  AssertTrue<Covers<AgeBand, typeof AGE_BANDS>>,
  AssertTrue<Covers<Occasion, typeof OCCASIONS>>,
  AssertTrue<Covers<BudgetBand, typeof BUDGET_BANDS>>,
  AssertTrue<Covers<MetalPref, typeof METALS>>,
  AssertTrue<Covers<SymbolChoice, typeof SYMBOL_CHOICES>>,
  AssertTrue<Covers<CategoryPref, typeof CATEGORIES>>,
  AssertTrue<Covers<SymbolKey, typeof SYMBOL_KEYS>>,
];

// ---------------------------------------------------------------------------
// Chip tables (REQ-CV-04)
// ---------------------------------------------------------------------------

export interface Chip<V extends string> {
  value: V;
  label: string;
}

export const RELATIONSHIP_CHIPS: readonly (Chip<Relationship> & { phrase: string })[] = [
  { value: "niece-nephew", label: "Niece or nephew", phrase: "your niece or nephew" },
  { value: "grandchild", label: "Grandchild", phrase: "your grandchild" },
  { value: "friends-baby", label: "A friend's baby", phrase: "your friend's baby" },
  { value: "godchild", label: "Godchild", phrase: "your godchild" },
  { value: "own-child", label: "My own child", phrase: "your own child" },
  { value: "mom", label: "Mom", phrase: "Mom" },
  { value: "other", label: "Someone else", phrase: "someone special" },
];

export interface AgeChip {
  id: AgeChipId;
  label: string;
  band?: Exclude<AgeBand, "mom">;
  /** Lower bound of the half-open interval; stored as the model's ageYears. */
  years?: number;
}

export const AGE_CHIPS: readonly AgeChip[] = [
  { id: "0-1", label: "0–1", band: "infants", years: 0 },
  { id: "1-3", label: "1–3", band: "infants", years: 1 },
  { id: "3-6", label: "3–6", band: "kids", years: 3 },
  { id: "6-12", label: "6–12", band: "kids", years: 6 },
  { id: "12-19", label: "12–19", band: "teens", years: 12 },
  { id: "adult", label: "An adult" },
];

export const OCCASION_CHIPS: readonly (Chip<ChipOccasion> & { word: string })[] = [
  { value: "naming", label: "Naming ceremony", word: "naming" },
  { value: "birthday", label: "Birthday", word: "birthday" },
  { value: "first-birthday", label: "First birthday", word: "first birthday" },
  { value: "baby-shower", label: "Baby shower", word: "baby shower" },
  { value: "festival", label: "Festival", word: "festival" },
  { value: "rakhi", label: "Rakhi", word: "Rakhi" },
  { value: "just-because", label: "Just because", word: "just-because" },
];

export const BUDGET_CHIPS: readonly Chip<BudgetBand>[] = [
  { value: "under-2500", label: "Under ₹2,500" },
  { value: "2500-15000", label: "₹2,500–₹15,000" },
  { value: "15000-25000", label: "₹15,000–₹25,000" },
  { value: "25000-plus", label: "₹25,000+" },
  { value: "no-limit", label: "No limit" },
];

export const METAL_CHIPS: readonly Chip<MetalPref>[] = [
  { value: "gold", label: "18KT gold" },
  { value: "silver", label: "925 silver" },
  { value: "any", label: "No preference" },
];

export const SYMBOL_CHIPS: readonly Chip<SymbolChoice>[] = [
  { value: "any", label: "Any" },
  { value: "zodiac", label: "Zodiac" },
  { value: "evil-eye", label: "Evil eye / nazariya" },
  { value: "religious", label: "Religious" },
  { value: "none-religious", label: "No religious symbols" },
];

export const SYMBOL_SUBCHIPS: readonly Chip<SymbolKey>[] = SYMBOL_KEYS.map((k) => ({
  value: k,
  label: SYMBOL_CHIP_LABEL[k],
}));

export const CATEGORY_CHIPS: readonly Chip<CategoryPref>[] = [
  { value: "pendant", label: "Pendant" },
  { value: "bracelet", label: "Bracelet" },
  { value: "earrings", label: "Earrings" },
  { value: "set", label: "Set" },
  { value: "tabeez", label: "Tabeez" },
  { value: "any", label: "Surprise me" },
];

const ageChip = (id: AgeChipId): AgeChip => AGE_CHIPS.find((c) => c.id === id) as AgeChip;
const labelOf = <V extends string>(chips: readonly Chip<V>[], v: V): string =>
  chips.find((c) => c.value === v)?.label ?? v;

/** The child age chip whose half-open interval holds `years`, or undefined outside [0,19). */
export function chipForYears(years: number): ChildAgeChipId | undefined {
  if (typeof years !== "number" || !Number.isFinite(years) || years < 0 || years >= 19) {
    return undefined;
  }
  const child = AGE_CHIPS.filter((c) => c.years !== undefined);
  let found = child[0];
  for (const c of child) if (years >= (c.years as number)) found = c;
  return found.id as ChildAgeChipId;
}

// ---------------------------------------------------------------------------
// Questions (REQ-CV-01, 02). Prompts are fixed strings.
// ---------------------------------------------------------------------------

export interface QuestionDef {
  id: QuestionId;
  /** Progress marker value; "age" and "adult-check" share 1. */
  number: 1 | 2 | 3 | 4 | 5 | 6;
  prompt: string;
}

export const QUESTIONS: Record<QuestionId, QuestionDef> = {
  relationship: { id: "relationship", number: 1, prompt: "Who are we finding a gift for?" },
  age: { id: "age", number: 1, prompt: "How old is the little one?" },
  "adult-check": { id: "adult-check", number: 1, prompt: "Is this for Mom?" },
  occasion: { id: "occasion", number: 2, prompt: "What's the occasion?" },
  budget: { id: "budget", number: 3, prompt: "What shall we spend?" },
  metal: { id: "metal", number: 4, prompt: "Gold or silver?" },
  symbols: {
    id: "symbols",
    number: 5,
    prompt: "Any symbols you'd love — or like to avoid?",
  },
  category: { id: "category", number: 6, prompt: "What kind of piece?" },
};

export const ADULT_END_MESSAGE = "This atelier specialises in babies, kids, and Mom.";

export const ORDER: readonly QuestionId[] = [
  "relationship",
  "age",
  "adult-check",
  "occasion",
  "budget",
  "metal",
  "symbols",
  "category",
];

// ---------------------------------------------------------------------------
// Applicability and normalisation (design §2.3)
// ---------------------------------------------------------------------------

const isMom = (a: Answers): boolean => a.relationship === "mom" || a.adultIsMom === true;
const ended = (a: Answers): boolean =>
  a.age === "adult" && a.adultIsMom === false && a.relationship !== "mom";

export function applicable(q: QuestionId, a: Answers): boolean {
  if (ended(a)) return q === "relationship" || q === "age" || q === "adult-check";
  switch (q) {
    case "age":
      return a.relationship !== "mom";
    case "adult-check":
      return a.relationship !== "mom" && a.age === "adult";
    case "category":
      return !isMom(a);
    default:
      return true;
  }
}

const isAnswered = (q: QuestionId, a: Answers): boolean => {
  switch (q) {
    case "adult-check":
      return a.adultIsMom !== undefined;
    case "budget":
      return a.budget !== undefined;
    default:
      return a[q] !== undefined;
  }
};

/** Returns a new Answers without any answer whose question no longer applies. */
export function normalize(input: Answers): Answers {
  // Drop the answers other questions' applicability depends on first (age, then adultIsMom),
  // so a stale adultIsMom cannot hide the piece question.
  const a: Answers = { ...input };
  if (a.relationship === "mom") delete a.age;
  if (!(a.age === "adult" && a.relationship !== "mom")) delete a.adultIsMom;
  const out: Answers = {};
  if (a.relationship !== undefined) out.relationship = a.relationship;
  if (a.age !== undefined) out.age = a.age;
  if (a.adultIsMom !== undefined) out.adultIsMom = a.adultIsMom;
  if (a.occasion !== undefined && applicable("occasion", a)) out.occasion = a.occasion;
  if (a.budget !== undefined && applicable("budget", a)) out.budget = a.budget;
  if (a.metal !== undefined && applicable("metal", a)) out.metal = a.metal;
  if (a.symbols !== undefined && applicable("symbols", a)) {
    out.symbols = a.symbols;
    if (a.symbols === "religious" && a.symbolList !== undefined) out.symbolList = [...a.symbolList];
  }
  if (a.category !== undefined && applicable("category", a)) out.category = a.category;
  return out;
}

function firstUnanswered(a: Answers): QuestionId | undefined {
  return ORDER.find((q) => applicable(q, a) && !isAnswered(q, a));
}

function nextApplicable(q: QuestionId, a: Answers): QuestionId | undefined {
  for (let i = ORDER.indexOf(q) + 1; i < ORDER.length; i++) {
    if (applicable(ORDER[i], a)) return ORDER[i];
  }
  return undefined;
}

function prevApplicable(q: QuestionId, a: Answers): QuestionId | undefined {
  for (let i = ORDER.indexOf(q) - 1; i >= 0; i--) {
    if (applicable(ORDER[i], a)) return ORDER[i];
  }
  return undefined;
}

function lastApplicable(a: Answers): QuestionId {
  for (let i = ORDER.length - 1; i >= 0; i--) if (applicable(ORDER[i], a)) return ORDER[i];
  return "relationship";
}

/** Exported for the property tests: the first applicable question without an answer. */
export const firstUnansweredQuestion = firstUnanswered;
/** Exported for the property tests: true when the answers end the flow (adult, not Mom). */
export const isEnded = ended;

// ---------------------------------------------------------------------------
// Reducer (design §2.4)
// ---------------------------------------------------------------------------

export const initial: ConversationState = { answers: {}, step: "relationship", returnToCard: false };

const freshInitial = (): ConversationState => ({ answers: {}, step: "relationship", returnToCard: false });

function advance(s: ConversationState, answers: Answers, from: QuestionId): ConversationState {
  if (ended(answers)) return { answers, step: "adult-end", returnToCard: false };
  if (s.returnToCard) {
    const f = firstUnanswered(answers);
    return { answers, step: f ?? "card", returnToCard: f !== undefined };
  }
  const step = nextApplicable(from, answers) ?? firstUnanswered(answers) ?? "card";
  return { answers, step, returnToCard: false };
}

const isCompleteAnswers = (a: Answers): boolean => !ended(a) && firstUnanswered(a) === undefined;

const hasValue = <V extends string>(chips: readonly Chip<V>[], v: unknown): boolean =>
  chips.some((c) => c.value === v);

function validAnswerValue(action: Extract<Action, { type: "answer" }>): boolean {
  const v: unknown = action.value;
  switch (action.question) {
    case "relationship":
      return hasValue(RELATIONSHIP_CHIPS, v);
    case "age":
      return AGE_CHIPS.some((c) => c.id === v);
    case "adult-check":
      return typeof v === "boolean";
    case "occasion":
      return hasValue(OCCASION_CHIPS, v);
    case "budget":
      return hasValue(BUDGET_CHIPS, v);
    case "metal":
      return hasValue(METAL_CHIPS, v);
    case "category":
      return hasValue(CATEGORY_CHIPS, v);
  }
}

export function reduce(s: ConversationState, action: Action): ConversationState {
  switch (action.type) {
    case "answer": {
      if (s.step !== action.question || !validAnswerValue(action)) return s;
      const draft: Answers = { ...s.answers };
      switch (action.question) {
        case "relationship":
          draft.relationship = action.value;
          break;
        case "age":
          draft.age = action.value;
          break;
        case "adult-check":
          draft.adultIsMom = action.value;
          break;
        case "occasion":
          draft.occasion = action.value;
          break;
        case "budget":
          draft.budget = action.value;
          break;
        case "metal":
          draft.metal = action.value;
          break;
        case "category":
          draft.category = action.value;
          break;
      }
      return advance(s, normalize(draft), action.question);
    }
    case "pick-symbol": {
      if (s.step !== "symbols" || !hasValue(SYMBOL_CHIPS, action.value)) return s;
      const draft: Answers = { ...s.answers, symbols: action.value };
      if (action.value !== "religious") delete draft.symbolList;
      const answers = normalize(draft);
      if (action.value === "religious") return { ...s, answers };
      return advance(s, answers, "symbols");
    }
    case "toggle-symbol": {
      if (s.step !== "symbols" || s.answers.symbols !== "religious") return s;
      if (!SYMBOL_KEYS.includes(action.key)) return s;
      const set = new Set(s.answers.symbolList ?? []);
      if (set.has(action.key)) set.delete(action.key);
      else set.add(action.key);
      const list = SYMBOL_KEYS.filter((k) => set.has(k));
      const answers: Answers = { ...s.answers };
      if (list.length > 0) answers.symbolList = list;
      else delete answers.symbolList;
      return { ...s, answers };
    }
    case "continue": {
      if (s.step !== "symbols" || s.answers.symbols !== "religious") return s;
      return advance(s, normalize(s.answers), "symbols");
    }
    case "back": {
      const a = s.answers;
      if (s.returnToCard && isCompleteAnswers(a)) {
        return { answers: a, step: "card", returnToCard: false };
      }
      let step: Step;
      if (s.step === "card") step = lastApplicable(a);
      else if (s.step === "adult-end") step = "adult-check";
      else step = prevApplicable(s.step, a) ?? s.step;
      return { answers: a, step, returnToCard: false };
    }
    case "edit": {
      if (!applicable(action.question, s.answers)) return s;
      return { answers: s.answers, step: action.question, returnToCard: true };
    }
    case "restart":
      return freshInitial();
  }
}

// ---------------------------------------------------------------------------
// toModel and validateModel (design §2.5)
// ---------------------------------------------------------------------------

export type ModelResult =
  | { ok: true; model: RecipientModel }
  | { ok: false; reason: "adult" | "incomplete"; missing: QuestionId[] };

/** Builds a model in canonical key order, omitting absent optional keys. */
export function canonicalModel(m: RecipientModel): RecipientModel {
  return {
    relationship: m.relationship,
    ageBand: m.ageBand,
    ...(m.ageYears !== undefined ? { ageYears: m.ageYears } : {}),
    occasion: m.occasion,
    budgetBand: m.budgetBand,
    metal: m.metal,
    symbols: m.symbols,
    ...(m.symbolList !== undefined ? { symbolList: [...m.symbolList] } : {}),
    category: m.category,
  };
}

export function toModel(input: Answers): ModelResult {
  const a = normalize(input);
  if (ended(a)) return { ok: false, reason: "adult", missing: [] };
  const missing = ORDER.filter((q) => applicable(q, a) && !isAnswered(q, a));
  if (missing.length > 0) return { ok: false, reason: "incomplete", missing };
  const mom = isMom(a);
  const chip = mom ? undefined : ageChip(a.age as AgeChipId);
  const model: RecipientModel = canonicalModel({
    relationship: mom ? "mom" : (a.relationship as Relationship),
    ageBand: mom ? "mom" : (chip?.band as AgeBand),
    ...(mom ? {} : { ageYears: chip?.years }),
    occasion: a.occasion as ChipOccasion,
    budgetBand: a.budget as BudgetBand,
    metal: a.metal as MetalPref,
    symbols: a.symbols as SymbolChoice,
    ...(a.symbols === "religious" && a.symbolList && a.symbolList.length > 0
      ? { symbolList: a.symbolList }
      : {}),
    category: mom ? "any" : (a.category as CategoryPref),
  });
  return { ok: true, model };
}

export type Validation = { ok: true; model: RecipientModel } | { ok: false; reason: string };

const MODEL_KEYS: readonly string[] = [
  "relationship",
  "ageBand",
  "ageYears",
  "occasion",
  "budgetBand",
  "metal",
  "symbols",
  "symbolList",
  "category",
];

const inList = (list: readonly string[], v: unknown): boolean =>
  typeof v === "string" && list.includes(v);

const fail = (reason: string): Validation => ({ ok: false, reason });

/** The gate of REQ-CV-19. Never coerces, repairs, or defaults. Returns a rebuilt model. */
export function validateModel(x: unknown): Validation {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return fail("not an object");
  const proto = Object.getPrototypeOf(x);
  if (proto !== Object.prototype && proto !== null) return fail("not a plain object");
  const o = x as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!MODEL_KEYS.includes(k)) return fail(`unknown key ${k}`);

  if (!inList(RELATIONSHIPS, o.relationship)) return fail("relationship");
  if (!inList(AGE_BANDS, o.ageBand)) return fail("ageBand");
  if (!inList(OCCASIONS, o.occasion)) return fail("occasion");
  if (!inList(BUDGET_BANDS, o.budgetBand)) return fail("budgetBand");
  if (!inList(METALS, o.metal)) return fail("metal");
  if (!inList(SYMBOL_CHOICES, o.symbols)) return fail("symbols");
  if (!inList(CATEGORIES, o.category)) return fail("category");

  const mom = o.ageBand === "mom";
  if ((o.relationship === "mom") !== mom) return fail("relationship and ageBand disagree on mom");

  if ("ageYears" in o && o.ageYears !== undefined) {
    const y = o.ageYears;
    if (mom) return fail("ageYears with a mom model");
    if (typeof y !== "number" || !Number.isFinite(y) || y < 0 || y >= 19) return fail("ageYears");
    if (ageYearsToBand(y) !== o.ageBand) return fail("ageYears does not match ageBand");
  }

  if ("symbolList" in o && o.symbolList !== undefined) {
    const l = o.symbolList;
    if (o.symbols !== "religious") return fail("symbolList without religious");
    if (!Array.isArray(l) || l.length === 0) return fail("symbolList");
    if (!l.every((e) => inList(SYMBOL_KEYS, e))) return fail("symbolList entry");
    if (new Set(l).size !== l.length) return fail("symbolList duplicate");
  }

  return {
    ok: true,
    model: canonicalModel({
      relationship: o.relationship as Relationship,
      ageBand: o.ageBand as AgeBand,
      ...(o.ageYears !== undefined ? { ageYears: o.ageYears as number } : {}),
      occasion: o.occasion as Occasion,
      budgetBand: o.budgetBand as BudgetBand,
      metal: o.metal as MetalPref,
      symbols: o.symbols as SymbolChoice,
      ...(o.symbolList !== undefined ? { symbolList: o.symbolList as string[] } : {}),
      category: o.category as CategoryPref,
    }),
  };
}

// ---------------------------------------------------------------------------
// Resume and card text (design §2.6)
// ---------------------------------------------------------------------------

export function stateFromModel(model: RecipientModel): ConversationState {
  const v = validateModel(model);
  if (!v.ok) return freshInitial();
  const m = v.model;
  const answers: Answers = { relationship: m.relationship };
  if (m.ageBand !== "mom" && m.ageYears !== undefined) answers.age = chipForYears(m.ageYears);
  if (m.occasion !== "other") answers.occasion = m.occasion;
  answers.budget = m.budgetBand;
  answers.metal = m.metal;
  answers.symbols = m.symbols;
  if (m.symbolList) answers.symbolList = m.symbolList as SymbolKey[];
  if (m.ageBand !== "mom") answers.category = m.category;
  const clean = normalize(answers);
  return { answers: clean, step: firstUnanswered(clean) ?? "card", returnToCard: false };
}

export interface CardLine {
  question: QuestionId;
  /** Row heading, for example "Budget". */
  label: string;
  value: string;
}
export interface CardView {
  headline: string;
  lines: CardLine[];
  note?: string;
}

function ageText(m: RecipientModel): string {
  const id = m.ageYears !== undefined ? chipForYears(m.ageYears) : undefined;
  if (id) return `${ageChip(id).label} years`;
  // No chip recoverable: fall back to the band label from the shared maps.
  return m.ageBand === "infants"
    ? "infants 0–3 years"
    : m.ageBand === "kids"
      ? "kids 3–12 years"
      : "teens 12–19 years";
}

function symbolsText(m: RecipientModel): string {
  switch (m.symbols) {
    case "any":
      return "Any symbols";
    case "zodiac":
      return "Zodiac";
    case "evil-eye":
      return "Evil eye / nazariya";
    case "none-religious":
      return "No religious symbols";
    case "religious": {
      const names = (m.symbolList ?? []).map((k) => SYMBOL_CHIP_LABEL[k] ?? k);
      return names.length > 0 ? `Religious: ${names.join(", ")}` : "Religious, any symbol";
    }
  }
}

export function describeModel(model: RecipientModel, momNote: string): CardView {
  const mom = model.ageBand === "mom";
  const rel = RELATIONSHIP_CHIPS.find((c) => c.value === model.relationship);
  const occ = OCCASION_CHIPS.find((c) => c.value === model.occasion);
  const word = occ?.word ?? "";
  const gift = word ? `A ${word} gift` : "A gift";
  const headline = mom
    ? `${gift} for Mom`
    : `${gift} for ${rel?.phrase ?? "someone special"}, ${ageText(model)}`;
  const lines: CardLine[] = [
    { question: "relationship", label: "Who", value: rel?.label ?? model.relationship },
  ];
  if (!mom) lines.push({ question: "age", label: "Age", value: ageText(model) });
  lines.push(
    { question: "occasion", label: "Occasion", value: occ?.label ?? "A gift" },
    { question: "budget", label: "Budget", value: labelOf(BUDGET_CHIPS, model.budgetBand) },
    { question: "metal", label: "Metal", value: labelOf(METAL_CHIPS, model.metal) },
    { question: "symbols", label: "Symbols", value: symbolsText(model) },
  );
  if (!mom) {
    lines.push({
      question: "category",
      label: "Piece",
      value: model.category === "any" ? "Any piece" : labelOf(CATEGORY_CHIPS, model.category),
    });
    return { headline, lines };
  }
  return { headline, lines, note: momNote };
}

const pluralOf = (word: string): string => (word.endsWith("s") ? word : `${word}s`);

/** Built from the catalog, never a constant (REQ-CV-11). */
export function momSkipNote(catalog: ParsedCatalog): string {
  const cats = new Set(
    catalog.products
      .filter((p) => p.availability === "In Stock" && p.age_groups.includes("Mom"))
      .map((p) => p.category),
  );
  if (cats.size === 1) {
    const [only] = [...cats];
    return `Only ${pluralOf(only.toLowerCase())} are listed for Mom, so we skipped the piece question.`;
  }
  return "We skipped the piece question for Mom.";
}

/** Symbol chip keys known to matching; a guard for drift between the two tables. */
export const KNOWN_SYMBOL_KEYS: readonly string[] = Object.keys(SYMBOL_CHIP_TAGS);
