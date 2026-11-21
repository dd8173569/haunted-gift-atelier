// The fit check (REQ-SV-01 to REQ-SV-20). Pure: no I/O, clock, randomness, network, or LLM.
// A fit check is guidance, not a certification; it asserts only what the listing states.
import type { ParsedCatalog, Product } from "./catalog";
import { AGE_LABEL } from "./matching/age";
import { AGE_GROUP_LABEL } from "./matching/templates";
import type { AgeBand } from "./matching/types";
import { decodeMaterials, type DecodedSegment } from "./safety-materials";
import { SAFETY_RULES, SAFETY_RULES_VERSION, ruleById, type SafetyRule } from "./safety-rules";
import {
  formatGrams,
  referenceBand,
  weightContext,
  weightPool,
  type WeightContext,
} from "./safety-weight";

export type { DecodedSegment, WeightContext };

export const FIT_CHECK_LINE =
  "A fit check from the atelier — guidance, not a safety certification. When in doubt, check with the brand or the child's parents.";

export type Verdict = "Good fit" | "Check this";
export type RowSeverity = "pass" | "flag" | "note";
export type CheckId = "age-fit" | "materials" | "weight" | "certifications" | "wear" | "not-stated";

/** Catalog field names a row may cite. */
export type CatalogField =
  | "age_groups"
  | "materials"
  | "weight"
  | "weight_g"
  | "claims"
  | "category"
  | "dimensions"
  | "chain";

export const CATALOG_FIELDS: ReadonlySet<string> = new Set<CatalogField>([
  "age_groups",
  "materials",
  "weight",
  "weight_g",
  "claims",
  "category",
  "dimensions",
  "chain",
]);

export interface VerdictRow {
  /** 'age-fit' | 'materials' | 'weight' | 'certifications' | 'wear:SR-…' | 'not-stated:nickel' | … */
  id: string;
  check: CheckId;
  severity: RowSeverity;
  label: string;
  /** The main sentence: atelier-written or a verbatim quote. */
  text: string;
  /** Verbatim catalog value shown as "As listed: …". */
  asListed?: string;
  /** Materials only. */
  segments?: DecodedSegment[];
  /** Rule texts shown under "General guidance" (may be empty). */
  guidance: string[];
  /** CatalogField names and/or rule IDs; length ≥ 1. */
  sources: string[];
}

export interface SafetyVerdict {
  sku: string;
  verdict: Verdict;
  context: { kind: "recipient"; band: AgeBand } | { kind: "none" };
  rows: VerdictRow[];
  /** Ids of rows with severity 'flag', in row order. */
  flagged: string[];
  /** null when no weight context could be computed. */
  weight: WeightContext | null;
  disclaimer: string;
  rulesVersion: string;
}

const groupLabel = (band: AgeBand) => AGE_GROUP_LABEL[AGE_LABEL[band]];

function ageRow(product: Product, band: AgeBand | null): VerdictRow {
  const listed = product.age_groups.map((g) => AGE_GROUP_LABEL[g]).join(", ");
  const base = { id: "age-fit", check: "age-fit" as const, label: "Age fit", guidance: [], sources: ["age_groups"] };
  if (band === null) {
    return {
      ...base,
      severity: "note",
      text: `No recipient selected — age fit shown against all listed age groups: ${listed}.`,
    };
  }
  if (product.age_groups.includes(AGE_LABEL[band])) {
    return { ...base, severity: "pass", text: `Listed by Tiny Tiaraa for ${groupLabel(band)}` };
  }
  return {
    ...base,
    severity: "flag",
    text: `Not listed for ${groupLabel(band)}. Tiny Tiaraa lists this piece for ${listed}.`,
  };
}

function materialsRow(product: Product, rules: readonly SafetyRule[]): VerdictRow {
  const segments = decodeMaterials(product.materials);
  const ruleIds: string[] = [];
  for (const s of segments) if (s.ruleId && !ruleIds.includes(s.ruleId)) ruleIds.push(s.ruleId);
  return {
    id: "materials",
    check: "materials",
    severity: "note",
    label: "Materials",
    text: "Materials as listed, with plain-language notes.",
    asListed: product.materials,
    segments,
    guidance: ruleIds.map((id) => ruleById(id, rules).text),
    sources: ["materials", ...ruleIds],
  };
}

function weightRow(
  product: Product,
  catalog: ParsedCatalog,
  band: AgeBand | null,
  rules: readonly SafetyRule[],
): { row: VerdictRow; ctx: WeightContext | null } {
  const rule = ruleById("SR-WEIGHT-MEDIAN", rules);
  const base = {
    id: "weight",
    check: "weight" as const,
    label: "Weight",
    asListed: product.weight,
    guidance: [rule.text],
  };
  if (product.weight_g === null) {
    return {
      ctx: null,
      row: {
        ...base,
        severity: "note",
        text: "A single weight could not be read from the listing, so no weight comparison is shown.",
        sources: ["weight", rule.id],
      },
    };
  }
  const ref = referenceBand(product, band) as AgeBand;
  const c = weightContext(product.weight_g, weightPool(catalog, ref), ref);
  const sources = ["weight", "weight_g", rule.id];
  if (!c.sufficient) {
    return {
      ctx: null,
      row: {
        ...base,
        severity: "note",
        text: `Too few comparable pieces listed for ${groupLabel(ref)} to give weight context.`,
        sources,
      },
    };
  }
  const w = formatGrams(product.weight_g);
  const m = formatGrams(c.median_g);
  const tail = `the median of ${m} g for ${groupLabel(ref)} pieces here (${c.n} pieces)`;
  const ctx: WeightContext = { band: ref, median_g: c.median_g, n: c.n, threshold_g: c.threshold_g };
  return {
    ctx,
    row: c.flag
      ? {
          ...base,
          severity: "flag",
          text: `${w} g — more than 50% above ${tail}; check comfort with the parents.`,
          sources,
        }
      : { ...base, severity: "pass", text: `${w} g — not more than 50% above ${tail}.`, sources },
  };
}

function certificationsRow(product: Product, rules: readonly SafetyRule[]): VerdictRow {
  const rule = ruleById("SR-CLAIMS-ONLY", rules);
  const text =
    product.claims.length === 0
      ? "No certifications are stated on this product's page."
      : product.claims.map((c) => `Stated on this product's page: ${c}`).join("\n");
  return {
    id: "certifications",
    check: "certifications",
    severity: "note",
    label: "Certifications",
    text,
    guidance: [rule.text],
    sources: ["claims", rule.id],
  };
}

function wearRuleFor(product: Product): string | null {
  if (product.category === "Tabeez") return "SR-WEAR-TABEEZ";
  if (product.dims.kind === "string-bracelet") return "SR-WEAR-BRACELET";
  if (product.dims.kind === "bangle") return "SR-WEAR-BANGLE";
  if (product.category === "Set") return "SR-WEAR-SET-EARRINGS";
  return null;
}

function wearRow(product: Product, rules: readonly SafetyRule[]): VerdictRow | null {
  const id = wearRuleFor(product);
  if (id === null) return null;
  const rule = ruleById(id, rules);
  const dimsUsed = product.dims.kind === "string-bracelet" || product.dims.kind === "bangle";
  return {
    id: `wear:${id}`,
    check: "wear",
    severity: rule.severity,
    label: "Wear note",
    text: rule.text,
    guidance: [rule.text],
    sources: dimsUsed ? ["category", "dimensions", id] : ["category", id],
  };
}

const NOT_STATED = [
  { key: "nickel", re: /nickel/i, rule: "SR-NS-NICKEL", label: "Nickel" },
  { key: "plating", re: /plated|plating|rhodium/i, rule: "SR-NS-PLATING", label: "Plating or finish" },
  {
    key: "clasp",
    re: /clasp|closure|hook|lobster|screw[- ]?back/i,
    rule: "SR-NS-CLASP",
    label: "Clasp or closure",
  },
] as const;
const SEARCHED = ["materials", "chain", "dimensions", "weight"] as const;

function notStatedRows(product: Product, rules: readonly SafetyRule[]): VerdictRow[] {
  return NOT_STATED.map((topic) => {
    const rule = ruleById(topic.rule, rules);
    const id = `not-stated:${topic.key}`;
    for (const field of SEARCHED) {
      const value = product[field];
      if (!value) continue;
      const hit = value
        .split(";")
        .map((s) => s.trim())
        .find((s) => topic.re.test(s));
      if (hit) {
        return {
          id,
          check: "not-stated" as const,
          severity: rule.severity,
          label: topic.label,
          text: `The listing says: “${hit}”`,
          guidance: [],
          sources: [field, rule.id],
        };
      }
    }
    return {
      id,
      check: "not-stated" as const,
      severity: rule.severity,
      label: topic.label,
      text: rule.text,
      guidance: [rule.text],
      sources: [rule.id, ...SEARCHED],
    };
  });
}

/**
 * `rules` defaults to the curated table; tests may inject another to prove severity is read
 * from the rule (REQ-SV-20).
 */
export function computeVerdict(
  product: Product,
  catalog: ParsedCatalog,
  band: AgeBand | null,
  rules: readonly SafetyRule[] = SAFETY_RULES,
): SafetyVerdict {
  const weight = weightRow(product, catalog, band, rules);
  const wear = wearRow(product, rules);
  const rows: VerdictRow[] = [
    ageRow(product, band),
    materialsRow(product, rules),
    weight.row,
    certificationsRow(product, rules),
    ...(wear ? [wear] : []),
    ...notStatedRows(product, rules),
  ];
  const flagged = rows.filter((r) => r.severity === "flag").map((r) => r.id);
  return {
    sku: product.sku,
    verdict: flagged.length > 0 ? "Check this" : "Good fit",
    context: band ? { kind: "recipient", band } : { kind: "none" },
    rows,
    flagged,
    weight: weight.ctx,
    disclaimer: FIT_CHECK_LINE,
    rulesVersion: SAFETY_RULES_VERSION,
  };
}
