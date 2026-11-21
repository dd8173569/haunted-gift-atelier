// Matching-core types (design §1). Types only: no logic, no React, no I/O.
import type { Category, PriceBand } from "../catalog";
import type { Occasion } from "../../data/occasion-map";

export type AgeBand = "infants" | "kids" | "teens" | "mom";
export type BudgetBand = PriceBand | "no-limit";
export type MetalPref = "gold" | "silver" | "any";
export type SymbolChoice =
  | "any"
  | "none-religious"
  | "zodiac"
  | "evil-eye"
  | "religious";
export type CategoryPref = "pendant" | "bracelet" | "earrings" | "set" | "tabeez" | "any";
export type Relationship =
  | "niece-nephew"
  | "grandchild"
  | "friends-baby"
  | "godchild"
  | "own-child"
  | "mom"
  | "other";

export interface RecipientModel {
  relationship: Relationship;
  ageBand: AgeBand;
  ageYears?: number;
  occasion: Occasion;
  budgetBand: BudgetBand;
  metal: MetalPref;
  symbols: SymbolChoice;
  symbolList?: string[];
  category: CategoryPref;
}

export type Relaxation =
  | "budget-below"
  | "budget-above"
  | "symbol-broadened"
  | "metal-dropped"
  | "category-dropped";

export type SymbolMode =
  | "any"
  | "none-religious"
  | "zodiac"
  | "evil-eye"
  | "religious"
  | "list";

/** The mutable-by-ladder view of the model. */
export interface Constraints {
  bands: Set<PriceBand> | "any";
  symbolMode: SymbolMode;
  symbolTags: Set<string>;
  metal: "gold" | "silver" | "any";
  category: Category | "any";
}

export interface ScoreBreakdown {
  occasion: 0 | 3;
  symbol: 0 | 1 | 3;
  metal: 0 | 2;
  rating: 0 | 1;
  centrality: 0 | 1;
}

export interface Reason {
  type: "age" | "budget" | "occasion" | "symbol" | "metal" | "rating";
  text: string;
  /** Catalog field or curated-map entry the reason is rendered from. */
  source: string;
}

export interface Pick {
  sku: string;
  score: number;
  breakdown: ScoreBreakdown;
  reasons: Reason[];
  relaxations: Relaxation[];
  relaxationNote?: string;
}

export type LadderStepName =
  | "widenBelow"
  | "widenAbove"
  | "broadenSymbol"
  | "dropMetal"
  | "dropCategory";

export interface LadderTrace {
  step: LadderStepName;
  before: number;
  after: number;
}

export interface MatchResult {
  picks: Pick[];
  disclosures: string[];
  shortfallNote?: string;
  showBrowseLink: boolean;
  trace: LadderTrace[];
}
