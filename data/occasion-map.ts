// Occasion -> match rules (PRD §3 scoring). Hand-curated; a product matches
// an occasion when ANY rule for that occasion holds.

export type Occasion =
  | "naming"
  | "baby-shower"
  | "birthday"
  | "first-birthday"
  | "festival"
  | "rakhi"
  | "just-because"
  | "other";

export type OccasionSubject = {
  category: string;
  metal: string;
  tags: string[];
};

/** One rule: every populated clause must hold (AND). */
export type Rule = { category?: string; metal?: string; tag?: string };

export const OCCASION_MAP: Record<Occasion, Rule[]> = {
  naming: [
    { tag: "symbol:evil-eye" },
    { tag: "material:black-beads" },
    { category: "Tabeez" },
  ],
  "baby-shower": [{ category: "Bracelet" }, { tag: "symbol:evil-eye" }],
  birthday: [
    { category: "Pendant" },
    { category: "Earrings" },
    { tag: "symbol:zodiac" },
  ],
  "first-birthday": [{ category: "Set" }, { category: "Bracelet" }],
  festival: [{ category: "Pendant", metal: "gold" }],
  rakhi: [{ category: "Bracelet" }],
  "just-because": [],
  other: [],
};

function ruleHolds(rule: Rule, p: OccasionSubject): boolean {
  return (
    (rule.category === undefined || p.category === rule.category) &&
    (rule.metal === undefined || p.metal === rule.metal) &&
    (rule.tag === undefined || p.tags.includes(rule.tag))
  );
}

function makeMatcher(occasion: Occasion) {
  return (p: OccasionSubject): boolean =>
    OCCASION_MAP[occasion].some((rule) => ruleHolds(rule, p));
}

export const OCCASION_MATCH: Record<Occasion, (p: OccasionSubject) => boolean> =
  {
    naming: makeMatcher("naming"),
    "baby-shower": makeMatcher("baby-shower"),
    birthday: makeMatcher("birthday"),
    "first-birthday": makeMatcher("first-birthday"),
    festival: makeMatcher("festival"),
    rakhi: makeMatcher("rakhi"),
    "just-because": makeMatcher("just-because"),
    other: makeMatcher("other"),
  };
