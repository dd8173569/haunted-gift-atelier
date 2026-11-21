// Human-curated tag map (REQ-CD-21). Never generated, never LLM-edited.
// Source: .kiro/specs/catalog-data/requirements.md, REQ-CD-21.

// Table: tag -> SKUs. This table is the export (design §3.6).
export const PRODUCT_TAGS: Record<string, readonly string[]> = {
  "symbol:om": ["TPN-1149"],
  "symbol:sikh": ["TPN-1147"],
  "symbol:cross": ["TPN-1145"],
  "symbol:ganesha": ["TPN-1141"],
  "symbol:trishul": ["TPN-1143"],
  "symbol:jain": ["TPN-1144"],
  "symbol:swastik": ["TBZ-1017"],
  "symbol:third-eye": ["TBZ-1013"],
  "symbol:zodiac": ["TPN-1459", "TPN-1433"],
  "symbol:evil-eye": ["TNZ-1056", "TNZ-1058"],
  "material:black-beads": ["TNZ-1016", "TNZ-1010", "TNZ-1015"],
  "material:pearl": ["TPN-1206", "TPN-1199"],
  "material:cz": ["TOB-1008"],
};

/** Religious-symbol tags. Shown only when the user explicitly opts in. */
export const RELIGIOUS_TAGS: readonly string[] = [
  "symbol:om",
  "symbol:sikh",
  "symbol:cross",
  "symbol:ganesha",
  "symbol:trishul",
  "symbol:jain",
  "symbol:swastik",
  "symbol:third-eye",
];

/** Set form of RELIGIOUS_TAGS (matching-core design §2). One source: RELIGIOUS_TAGS. */
export const RELIGIOUS: ReadonlySet<string> = new Set(RELIGIOUS_TAGS);

/** Symbol chip -> catalog tags (matching-core design §2). */
export const SYMBOL_CHIP_TAGS: Record<string, readonly string[]> = {
  om: ["symbol:om"],
  ganesha: ["symbol:ganesha"],
  cross: ["symbol:cross"],
  sikh: ["symbol:sikh"],
  trishul: ["symbol:trishul"],
  jain: ["symbol:jain"],
  tabeez: ["symbol:swastik", "symbol:third-eye"],
};

export function getTags(sku: string): string[] {
  return Object.entries(PRODUCT_TAGS)
    .filter(([, skus]) => skus.includes(sku))
    .map(([tag]) => tag);
}
