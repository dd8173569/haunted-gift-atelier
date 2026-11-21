import { describe, expect, it } from "vitest";
import type { AgeGroup } from "../lib/catalog";
import { AGE_LABEL } from "../lib/matching/age";
import type { AgeBand } from "../lib/matching/types";
import { FIT_CHECK_LINE, computeVerdict, type SafetyVerdict } from "../lib/safety";
import { SAFETY_RULES, SAFETY_RULES_VERSION } from "../lib/safety-rules";
import { catalog, product } from "./helpers/matching-fixtures";

const BANDS: AgeBand[] = ["infants", "kids", "teens", "mom"];
const CONTEXTS: (AgeBand | null)[] = [...BANDS, null];
const v = (sku: string, band: AgeBand | null) => computeVerdict(product(sku), catalog, band);
const row = (x: SafetyVerdict, id: string) => x.rows.find((r) => r.id === id)!;

describe("verdict labels (REQ-SV-01, 04)", () => {
  it("TNZ-1056 / infants is Check this, flagged on weight and the bracelet wear note", () => {
    const x = v("TNZ-1056", "infants");
    expect(x.verdict).toBe("Check this");
    expect(x.flagged).toEqual(["weight", "wear:SR-WEAR-BRACELET"]);
    expect(row(x, "weight").text).toBe(
      "6 g — more than 50% above the median of 1.51 g for infants 0–3 years pieces here (18 pieces); check comfort with the parents.",
    );
    expect(x.weight).toEqual({ band: "infants", median_g: 1.51, n: 18, threshold_g: 2.265 });
  });

  it("TPN-1149 / infants is Good fit with no flags", () => {
    const x = v("TPN-1149", "infants");
    expect(x.verdict).toBe("Good fit");
    expect(x.flagged).toEqual([]);
  });

  it("TPN-1149 against mom is Check this through the age row", () => {
    const x = v("TPN-1149", "mom");
    expect(x.verdict).toBe("Check this");
    expect(x.flagged).toEqual(["age-fit"]);
    expect(row(x, "age-fit").text).toBe(
      "Not listed for Mom. Tiny Tiaraa lists this piece for infants 0–3 years, kids 3–12 years, teens 12–19 years.",
    );
  });

  it("carries the disclaimer, rules version, sku, and context", () => {
    const x = v("TPN-1149", "kids");
    expect(x.disclaimer).toBe(FIT_CHECK_LINE);
    expect(x.rulesVersion).toBe(SAFETY_RULES_VERSION);
    expect(x.sku).toBe("TPN-1149");
    expect(x.context).toEqual({ kind: "recipient", band: "kids" });
  });
});

describe("check 1: age fit", () => {
  it("pass text names the band label", () => {
    const r = row(v("TPN-1149", "infants"), "age-fit");
    expect(r).toMatchObject({
      severity: "pass",
      text: "Listed by Tiny Tiaraa for infants 0–3 years",
      sources: ["age_groups"],
    });
  });

  it("no band: note row listing every age group, no recipient detail", () => {
    const x = v("TPN-1149", null);
    expect(x.context).toEqual({ kind: "none" });
    expect(row(x, "age-fit")).toMatchObject({
      severity: "note",
      text: "No recipient selected — age fit shown against all listed age groups: infants 0–3 years, kids 3–12 years, teens 12–19 years.",
    });
  });
});

describe("check 2: materials", () => {
  it("shows the verbatim string, decoded segments, de-duplicated guidance, and sources", () => {
    const r = row(v("TPN-1149", "infants"), "materials");
    expect(r.severity).toBe("note");
    expect(r.asListed).toBe("18KT Gold; Diamond 0.06 Cts, Quality GH-VS");
    expect(r.segments?.map((s) => s.display)).toEqual(["18KT gold", "Diamond 0.06 ct, GH-VS"]);
    expect(r.sources).toEqual(["materials", "SR-MAT-GOLD18", "SR-MAT-DIAMOND"]);
    expect(r.guidance).toHaveLength(2);
  });

  it("an undecoded segment adds no rule and no guidance", () => {
    const r = row(v("TBZ-1013", "infants"), "materials");
    expect(r.sources).toEqual(["materials", "SR-MAT-SILVER925"]);
  });
});

describe("check 3: weight", () => {
  it("a pass row for a light piece", () => {
    const r = row(v("TPN-1149", "infants"), "weight");
    expect(r.severity).toBe("pass");
    expect(r.text).toBe(
      "1 g — not more than 50% above the median of 1.51 g for infants 0–3 years pieces here (18 pieces).",
    );
    expect(r.asListed).toBe("Gold 1.00 gms");
    expect(r.sources).toEqual(["weight", "weight_g", "SR-WEIGHT-MEDIAN"]);
    expect(r.guidance).toEqual([SAFETY_RULES.find((x) => x.id === "SR-WEIGHT-MEDIAN")!.text]);
  });

  it("pool under 3 (mom): note, no flag, weight context null", () => {
    const x = v("THP-1017", "mom");
    expect(row(x, "weight")).toMatchObject({
      severity: "note",
      text: "Too few comparable pieces listed for Mom to give weight context.",
    });
    expect(x.weight).toBeNull();
  });

  it("null weight_g: note with the verbatim weight, never 0", () => {
    const base = product("TPN-1149");
    const x = computeVerdict({ ...base, weight_g: null, weight: "weight on request" }, catalog, "infants");
    const r = row(x, "weight");
    expect(r).toMatchObject({
      severity: "note",
      asListed: "weight on request",
      text: "A single weight could not be read from the listing, so no weight comparison is shown.",
      sources: ["weight", "SR-WEIGHT-MEDIAN"],
    });
    expect(r.text).not.toMatch(/\b0 g\b/);
    expect(x.weight).toBeNull();
  });

  it("TNZ-1058 (out of stock) still gets a verdict with the weight flag", () => {
    const x = v("TNZ-1058", "infants");
    expect(product("TNZ-1058").availability).toBe("Out of Stock");
    expect(x.flagged).toContain("weight");
    expect(x.verdict).toBe("Check this");
    expect(row(x, "weight").text.startsWith("7 g — more than 50% above")).toBe(true);
  });

  it("no band uses the youngest listed band: THP-1027 (3 bands) references infants", () => {
    const x = v("THP-1027", null);
    expect(x.weight?.band).toBe("infants");
    expect(x.flagged).toEqual([]); // 1.5 g is under the infants threshold of 2.265 g
    expect(x.verdict).toBe("Good fit");
  });

  it("no band: a teens+kids+mom earring is judged against kids, not teens", () => {
    const x = v("THP-1017", null);
    expect(x.weight?.band).toBe("kids");
    expect(x.verdict).toBe("Good fit");
  });
});

describe("check 4: certifications", () => {
  it("all 22 certifications rows are the no-certifications sentence in every context", () => {
    for (const p of catalog.products) {
      expect(p.claims, p.sku).toEqual([]);
      for (const b of CONTEXTS) {
        const r = row(computeVerdict(p, catalog, b), "certifications");
        expect(r.text).toBe("No certifications are stated on this product's page.");
        expect(r.severity).toBe("note");
        expect(r.sources).toEqual(["claims", "SR-CLAIMS-ONLY"]);
      }
    }
  });

  it("lists each stated claim verbatim with the prefix", () => {
    const p = { ...product("TPN-1149"), claims: ["BIS Hallmarked", "Nickel-free"] };
    const r = row(computeVerdict(p, catalog, "infants"), "certifications");
    expect(r.text).toBe(
      "Stated on this product's page: BIS Hallmarked\nStated on this product's page: Nickel-free",
    );
  });
});

describe("check 5: wear notes", () => {
  const cases: [string, string | null][] = [
    ["TBZ-1013", "wear:SR-WEAR-TABEEZ"],
    ["TNZ-1056", "wear:SR-WEAR-BRACELET"],
    ["TOB-1009", "wear:SR-WEAR-BANGLE"],
    ["TPN-1206", "wear:SR-WEAR-SET-EARRINGS"],
    ["TPN-1149", null],
    ["THP-1001", null],
  ];
  it.each(cases)("%s -> %s", (sku, id) => {
    const wear = v(sku, null).rows.filter((r) => r.check === "wear");
    expect(wear.map((r) => r.id)).toEqual(id ? [id] : []);
    if (id) expect(wear[0].severity).toBe("flag");
  });

  it("real counts: 11 pieces carry a wear row (2 tabeez, 5 bracelets, 2 bangles, 2 sets)", () => {
    const ids = catalog.products.map((p) => computeVerdict(p, catalog, null).rows.find((r) => r.check === "wear")?.id);
    const count = (id: string) => ids.filter((x) => x === id).length;
    expect(ids.filter(Boolean)).toHaveLength(11);
    expect(count("wear:SR-WEAR-TABEEZ")).toBe(2);
    expect(count("wear:SR-WEAR-BRACELET")).toBe(5);
    expect(count("wear:SR-WEAR-BANGLE")).toBe(2);
    expect(count("wear:SR-WEAR-SET-EARRINGS")).toBe(2);
  });

  it("bracelets and bangles cite dimensions too; tabeez and sets do not", () => {
    expect(row(v("TNZ-1056", null), "wear:SR-WEAR-BRACELET").sources).toEqual([
      "category",
      "dimensions",
      "SR-WEAR-BRACELET",
    ]);
    expect(row(v("TBZ-1013", null), "wear:SR-WEAR-TABEEZ").sources).toEqual(["category", "SR-WEAR-TABEEZ"]);
  });
});

describe("check 6: not stated", () => {
  it("all 22 pieces: exactly three rows with the not-stated sentences", () => {
    for (const p of catalog.products) {
      const rows = computeVerdict(p, catalog, null).rows.filter((r) => r.check === "not-stated");
      expect(rows.map((r) => r.id), p.sku).toEqual(["not-stated:nickel", "not-stated:plating", "not-stated:clasp"]);
      expect(rows.map((r) => r.text)).toEqual([
        "Nickel content is not stated on the listing.",
        "Plating or finish is not stated on the listing.",
        "Clasp or closure type is not stated on the listing.",
      ]);
      expect(rows.every((r) => r.severity === "note")).toBe(true);
    }
  });

  it("quotes the segment verbatim and cites the field when a field mentions the topic", () => {
    const p = { ...product("TPN-1149"), chain: "18 inch; rhodium plated; lobster clasp" };
    const x = computeVerdict(p, catalog, "infants");
    expect(row(x, "not-stated:plating")).toMatchObject({
      text: "The listing says: “rhodium plated”",
      sources: ["chain", "SR-NS-PLATING"],
    });
    expect(row(x, "not-stated:clasp").text).toBe("The listing says: “lobster clasp”");
    expect(row(x, "not-stated:nickel").text).toBe("Nickel content is not stated on the listing.");
  });

  it("'openable locket' does not count as a clasp", () => {
    expect(row(v("TBZ-1013", null), "not-stated:clasp").text).toBe("Clasp or closure type is not stated on the listing.");
  });

  it("severity is read from the rule: an injected flag on SR-NS-NICKEL flips every verdict", () => {
    const rules = SAFETY_RULES.map((r) => (r.id === "SR-NS-NICKEL" ? { ...r, severity: "flag" as const } : r));
    for (const p of catalog.products) {
      for (const b of CONTEXTS) {
        const x = computeVerdict(p, catalog, b, rules);
        expect(x.verdict).toBe("Check this");
        expect(x.flagged).toContain("not-stated:nickel");
      }
    }
  });
});

describe("row set and order (REQ-SV-08)", () => {
  it("every verdict has the fixed row order", () => {
    for (const p of catalog.products) {
      const ids = computeVerdict(p, catalog, null).rows.map((r) => r.check);
      const head = ids.slice(0, 4);
      expect(head).toEqual(["age-fit", "materials", "weight", "certifications"]);
      expect(ids.slice(-3)).toEqual(["not-stated", "not-stated", "not-stated"]);
      expect(ids.length === 7 || ids.length === 8).toBe(true);
    }
  });
});

describe("pinned Good fit lists (design §5.1)", () => {
  const expected: Record<AgeBand, string[]> = {
    infants: ["TPN-1149", "TPN-1147", "TPN-1145", "TPN-1141", "TPN-1143", "TPN-1144", "THP-1001", "THP-1027"],
    kids: ["TPN-1149", "TPN-1147", "TPN-1145", "TPN-1141", "TPN-1143", "TPN-1144", "THP-1017", "THP-1001", "THP-1027"],
    teens: ["TPN-1149", "TPN-1147", "TPN-1145", "TPN-1141", "TPN-1143", "TPN-1144"],
    mom: ["THP-1017", "THP-1001"],
  };
  it.each(BANDS)("%s", (band) => {
    const good = catalog.products
      .filter((p) => p.age_groups.includes(AGE_LABEL[band] as AgeGroup))
      .filter((p) => computeVerdict(p, catalog, band).verdict === "Good fit")
      .map((p) => p.sku);
    expect(good.sort()).toEqual([...expected[band]].sort());
  });

  it("a piece not listed for the band is never Good fit", () => {
    for (const p of catalog.products) {
      for (const b of BANDS) {
        if (!p.age_groups.includes(AGE_LABEL[b] as AgeGroup)) {
          expect(computeVerdict(p, catalog, b).verdict).toBe("Check this");
        }
      }
    }
  });
});

describe("no absolute words and purity", () => {
  it("no atelier text matches safe/unsafe, in any product and context", () => {
    for (const p of catalog.products) {
      for (const b of CONTEXTS) {
        const x = computeVerdict(p, catalog, b);
        const texts = [x.verdict, x.disclaimer, ...x.rows.flatMap((r) => [r.label, r.text, ...r.guidance])];
        for (const t of texts) expect(t).not.toMatch(/\b(un)?safe\b/i);
      }
    }
  });

  it("does not mutate its inputs and is deterministic", () => {
    const p = product("TNZ-1056");
    const before = JSON.stringify([p, catalog]);
    const a = computeVerdict(p, catalog, "infants");
    const b = computeVerdict(p, catalog, "infants");
    expect(a).toEqual(b);
    expect(JSON.stringify([p, catalog])).toBe(before);
  });

  it("never reads price, rating, or availability: changing them changes nothing", () => {
    const p = product("TPN-1149");
    const q = { ...p, price_inr: 1, rating: "1/5", availability: "Out of Stock" as const };
    expect(computeVerdict(q, catalog, "infants")).toEqual(computeVerdict(p, catalog, "infants"));
  });
});
