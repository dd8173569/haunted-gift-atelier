// Test helper: drive the conversation reducer by taps.
import {
  initial,
  reduce,
  type Action,
  type AgeChipId,
  type ChipOccasion,
  type ConversationState,
} from "../../lib/conversation";
import type {
  BudgetBand,
  CategoryPref,
  MetalPref,
  Relationship,
  SymbolChoice,
} from "../../lib/matching/types";

export const run = (actions: Action[], from: ConversationState = initial): ConversationState =>
  actions.reduce(reduce, from);

export const rel = (value: Relationship): Action => ({ type: "answer", question: "relationship", value });
export const age = (value: AgeChipId): Action => ({ type: "answer", question: "age", value });
export const adultIsMom = (value: boolean): Action => ({ type: "answer", question: "adult-check", value });
export const occ = (value: ChipOccasion): Action => ({ type: "answer", question: "occasion", value });
export const budget = (value: BudgetBand): Action => ({ type: "answer", question: "budget", value });
export const metal = (value: MetalPref): Action => ({ type: "answer", question: "metal", value });
export const sym = (value: SymbolChoice): Action => ({ type: "pick-symbol", value });
export const cat = (value: CategoryPref): Action => ({ type: "answer", question: "category", value });

/** Golden case 1 by taps (design §12, persona 1). */
export const GOLDEN1_TAPS: Action[] = [
  rel("niece-nephew"),
  age("0-1"),
  occ("naming"),
  budget("under-2500"),
  metal("silver"),
  sym("any"),
  cat("any"),
];

/** Golden case 2 by taps (Mom). */
export const GOLDEN2_TAPS: Action[] = [
  rel("mom"),
  occ("birthday"),
  budget("25000-plus"),
  metal("gold"),
  sym("any"),
];

/** Golden case 3 by taps (Religious + Ganesha). */
export const GOLDEN3_TAPS: Action[] = [
  rel("other"),
  age("12-19"),
  occ("festival"),
  budget("15000-25000"),
  metal("gold"),
  sym("religious"),
  { type: "toggle-symbol", key: "ganesha" },
  { type: "continue" },
  cat("any"),
];
