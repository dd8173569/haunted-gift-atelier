// Label maps, price formatter and sentence templates (REQ-MC-24, 26, 28).
// Pure string building. No ICU / toLocaleString: output must not depend on the runtime.
import type { AgeGroup, PriceBand } from "../catalog";
import type { Occasion } from "../../data/occasion-map";
import type {
  BudgetBand,
  LadderStepName,
  RecipientModel,
} from "./types";

/** Indian digit grouping: 2324 -> "₹2,324", 61599 -> "₹61,599", 1234567 -> "₹12,34,567". */
export function formatInr(amount: number): string {
  const n = Math.round(Math.abs(amount));
  const s = String(n);
  let grouped: string;
  if (s.length <= 3) {
    grouped = s;
  } else {
    const head = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    grouped = `${head},${s.slice(-3)}`;
  }
  return `${amount < 0 ? "-" : ""}₹${grouped}`;
}

/** Lookup key stays the catalog string; the en dash is output only. */
export const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  "Infants 0-3 years": "infants 0–3 years",
  "Kids 3-12 years": "kids 3–12 years",
  "Teens 12-19 years": "teens 12–19 years",
  Mom: "Mom",
};

export const BAND_LABEL: Record<PriceBand, string> = {
  "under-2500": "under ₹2,500",
  "2500-15000": "₹2,500–₹15,000",
  "15000-25000": "₹15,000–₹25,000",
  "25000-plus": "₹25,000+",
};

/** Reason form of the budget label (only under-2500 differs). */
export const BAND_REASON_LABEL: Record<PriceBand, string> = {
  ...BAND_LABEL,
  "under-2500": "under-₹2,500",
};

export const OCCASION_LABEL: Record<Occasion, string> = {
  naming: "a naming ceremony",
  birthday: "a birthday",
  "first-birthday": "a first birthday",
  "baby-shower": "a baby shower",
  festival: "a festival",
  rakhi: "Rakhi",
  "just-because": "a just-because gift",
  other: "a gift",
};

export const METAL_LABEL: Record<"gold" | "silver", string> = {
  gold: "18KT gold",
  silver: "925 silver",
};

export const CATEGORY_LABEL: Record<string, string> = {
  Pendant: "pendant",
  Bracelet: "bracelet",
  Earrings: "earrings",
  Set: "set",
  Tabeez: "tabeez",
};

/** Symbol tag -> display label (reasons and marker sentence). */
export const SYMBOL_TAG_LABEL: Record<string, string> = {
  "symbol:om": "Om",
  "symbol:sikh": "Sikh",
  "symbol:cross": "Cross",
  "symbol:ganesha": "Ganesha",
  "symbol:trishul": "Trishul",
  "symbol:jain": "Jain",
  "symbol:swastik": "Swastik",
  "symbol:third-eye": "Third Eye",
  "symbol:zodiac": "zodiac",
  "symbol:evil-eye": "evil eye",
};

/** Symbol chip (symbolList entry) -> display label. */
export const SYMBOL_CHIP_LABEL: Record<string, string> = {
  om: "Om",
  ganesha: "Ganesha",
  cross: "Cross",
  sikh: "Sikh",
  trishul: "Trishul",
  jain: "Jain",
  tabeez: "Tabeez",
};

const plural = (n: number) => (n === 1 ? "piece" : "pieces");

export function budgetLabel(b: BudgetBand): string {
  return b === "no-limit" ? "no-limit" : BAND_LABEL[b];
}

/** What the user asked for, in words, for "your {symbol} request". */
export function requestedSymbolLabel(model: RecipientModel): string {
  const list = (model.symbolList ?? [])
    .map((s) => SYMBOL_CHIP_LABEL[s])
    .filter((s): s is string => Boolean(s));
  if (model.symbols === "religious" && list.length > 0) return list.join(" / ");
  if (model.symbols === "zodiac") return "zodiac";
  if (model.symbols === "evil-eye") return "evil eye";
  return "religious symbol";
}

const STEP_TEXT: Record<
  LadderStepName,
  { constraint: (m: RecipientModel) => string; action: string }
> = {
  widenBelow: {
    constraint: (m) => `${budgetLabel(m.budgetBand)} budget`,
    action: "widened it to the band just below",
  },
  widenAbove: {
    constraint: (m) => `${budgetLabel(m.budgetBand)} budget`,
    action: "widened it to the band just above",
  },
  broadenSymbol: {
    constraint: (m) => `${requestedSymbolLabel(m)} request`,
    action: "broadened it to other religious symbols",
  },
  dropMetal: {
    constraint: (m) =>
      `${m.metal === "any" ? "metal" : METAL_LABEL[m.metal]} preference`,
    action: "set it aside",
  },
  dropCategory: {
    constraint: (m) => `${m.category} choice`,
    action: "set it aside",
  },
};

/** Disclosure for one ladder step; n = eligible count before the step. */
export function disclosure(
  step: LadderStepName,
  n: number,
  model: RecipientModel,
): string {
  const t = STEP_TEXT[step];
  const lead = n === 0 ? "No pieces matched" : `Only ${n} ${plural(n)} matched`;
  return `${lead} your ${t.constraint(model)}, so we ${t.action} — your picks are marked.`;
}

/** "Your Ganesha pendant sits just below your budget at ₹14,249, so we widened the search slightly." */
export function markerSentence(
  symbolLabel: string | undefined,
  category: string,
  direction: "below" | "above",
  price: number,
): string {
  const noun = [symbolLabel, CATEGORY_LABEL[category] ?? category.toLowerCase()]
    .filter(Boolean)
    .join(" ");
  return `Your ${noun} sits just ${direction} your budget at ${formatInr(price)}, so we widened the search slightly.`;
}

export function shortfallNote(
  listedForAge: number,
  pickCount: number,
  ageGroup: AgeGroup,
): string {
  if (listedForAge < 3) {
    const label = AGE_GROUP_LABEL[ageGroup];
    if (listedForAge === 0) return `No pieces in the atelier are listed for ${label}`;
    return listedForAge === 1
      ? `Only 1 piece in the atelier is listed for ${label}`
      : `Only ${listedForAge} pieces in the atelier are listed for ${label}`;
  }
  const lead =
    pickCount === 0 ? "No pieces fit" : `Only ${pickCount} ${plural(pickCount)} ${pickCount === 1 ? "fits" : "fit"}`;
  return `${lead} this recipient even after widening — browse the full atelier.`;
}

// Reason templates (REQ-MC-28).
export const reasonAge = (group: AgeGroup) => `Listed for ${AGE_GROUP_LABEL[group]}`;
export const reasonBudgetInside = (price: number, band: PriceBand) =>
  `${formatInr(price)} — inside your ${BAND_REASON_LABEL[band]} budget`;
export const reasonBudgetRelaxed = (
  price: number,
  band: PriceBand,
  dir: "below" | "above",
) => `${formatInr(price)} — just ${dir} your ${BAND_REASON_LABEL[band]} budget`;
export const reasonBudgetNoLimit = (price: number) =>
  `${formatInr(price)} — no budget limit set`;
export const reasonOccasion = (o: Occasion) =>
  `Our atelier's pick for ${OCCASION_LABEL[o]}`;
export const reasonSymbol = (label: string) => `Carries the ${label} you asked for`;
export const reasonSymbolBroadened = (label: string, requested: string) =>
  `A ${label} piece, in the same family as the ${requested} you asked for`;
export const reasonMetal = (m: "gold" | "silver") => `${METAL_LABEL[m]}, as you preferred`;
export const reasonRating = (ratingText: string) => `Rated ${ratingText} by customers`;
