// Relaxation ladder (design §3, REQ-MC-21..24). Pure.
// The ladder never touches availability or the age check (they live in filters.passes,
// not in Constraints), and broadenSymbol is a no-op unless the mode is `list`.
import type { ParsedCatalog, PriceBand, Product } from "../catalog";
import { RELIGIOUS } from "../../data/product-tags";
import { eligible, initialConstraints } from "./filters";
import { disclosure } from "./templates";
import type {
  Constraints,
  LadderStepName,
  LadderTrace,
  RecipientModel,
} from "./types";

export const BAND_ORDER: readonly PriceBand[] = [
  "under-2500",
  "2500-15000",
  "15000-25000",
  "25000-plus",
];

type Step = (c: Constraints, model: RecipientModel) => Constraints;

function widen(offset: -1 | 1): Step {
  return (c, model) => {
    if (model.budgetBand === "no-limit" || c.bands === "any") return c;
    const adjacent = BAND_ORDER[BAND_ORDER.indexOf(model.budgetBand) + offset];
    if (!adjacent) return c;
    return { ...c, bands: new Set([...c.bands, adjacent]) };
  };
}

export const LADDER: ReadonlyArray<readonly [LadderStepName, Step]> = [
  ["widenBelow", widen(-1)],
  ["widenAbove", widen(1)],
  [
    "broadenSymbol",
    (c) =>
      c.symbolMode === "list"
        ? { ...c, symbolMode: "religious", symbolTags: new Set(RELIGIOUS) }
        : c,
  ],
  ["dropMetal", (c) => (c.metal === "any" ? c : { ...c, metal: "any" })],
  ["dropCategory", (c) => (c.category === "any" ? c : { ...c, category: "any" })],
];

export interface RelaxResult {
  constraints: Constraints;
  eligible: Product[];
  /** Disclosures for steps that ADDED products (design §3). */
  disclosures: string[];
  /** Steps that were disclosed above. */
  disclosed: Set<LadderStepName>;
  trace: LadderTrace[];
}

export function relax(model: RecipientModel, catalog: ParsedCatalog): RelaxResult {
  let c = initialConstraints(model);
  let current = eligible(c, model, catalog);
  const disclosures: string[] = [];
  const disclosed = new Set<LadderStepName>();
  const trace: LadderTrace[] = [];
  for (const [name, step] of LADDER) {
    if (current.length >= 3) break;
    const next = step(c, model);
    if (next === c) continue;
    const widened = eligible(next, model, catalog);
    trace.push({ step: name, before: current.length, after: widened.length });
    if (widened.length > current.length) {
      disclosures.push(disclosure(name, current.length, model));
      disclosed.add(name);
    }
    c = next;
    current = widened;
  }
  return { constraints: c, eligible: current, disclosures, disclosed, trace };
}

/**
 * Counterexample fix (I3): a step that added nothing on its own can still be what lets a
 * later step's products in (e.g. widenAbove, then dropCategory). When a final pick relies
 * on such a step, it is disclosed too, in ladder order, so no marker goes unexplained.
 */
export function finalDisclosures(
  model: RecipientModel,
  relaxed: RelaxResult,
  used: ReadonlySet<LadderStepName>,
): string[] {
  const out: string[] = [];
  for (const [name] of LADDER) {
    const t = relaxed.trace.find((x) => x.step === name);
    if (!t) continue;
    if (relaxed.disclosed.has(name) || used.has(name)) {
      out.push(disclosure(name, t.before, model));
    }
  }
  return out;
}
