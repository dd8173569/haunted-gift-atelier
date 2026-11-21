// Property tests V1–V10 (P-SV-1..10, P-SV-12) from safety-verdict design §8.1. Seeded.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { AgeGroup, Category, Dims, ParsedCatalog, Product } from "../lib/catalog";
import { AGE_LABEL } from "../lib/matching/age";
import type { AgeBand } from "../lib/matching/types";
import { CATALOG_FIELDS, FIT_CHECK_LINE, computeVerdict, type SafetyVerdict } from "../lib/safety";
import { decodeMaterials } from "../lib/safety-materials";
import { RULE_IDS, ruleById } from "../lib/safety-rules";
import { weightContext } from "../lib/safety-weight";
import { catalog } from "./helpers/matching-fixtures";

const SEED = 20261124;
const RUNS = 300;
const assert = <T extends unknown[]>(p: fc.IPropertyWithHooks<T>) =>
  fc.assert(p, { seed: SEED, numRuns: RUNS });

const BANDS: AgeBand[] = ["infants", "kids", "teens", "mom"];
const GROUPS = BANDS.map((b) => AGE_LABEL[b] as AgeGroup);
const CERT = ["BIS", "hallmark", "hypoallergenic", "nickel-free", "certified", "tested"] as const;
const certRe = (t: string) => new RegExp(`\\b${t}`, "i");
const SAFE = /\b(un)?safe\b/i;

const arbBand = fc.constantFrom<AgeBand | null>("infants", "kids", "teens", "mom", null);

// Free text: words that never contain safe/unsafe or a certification term (verbatim quotes are exempt from V7).
const WORDS = [
  "gold", "silver", "pearl", "nickel", "rhodium", "plated", "plating", "clasp", "closure", "hook",
  "lobster", "screw back", "screwback", "thread", "13 inch", "18 inch", "weight 1 gms", "Height 12 mm",
  "18KT Gold", "925 Silver", "CZ", "black beads", "Diamond 0.1 Cts", "chain", "locket",
];
const arbSegment = fc.constantFrom(...WORDS);
const arbText = fc
  .array(fc.array(arbSegment, { minLength: 1, maxLength: 3 }).map((ws) => ws.join(" ")), { minLength: 0, maxLength: 4 })
  .map((segs) => segs.join("; "));

const arbClaim = fc.constantFrom(
  "BIS Hallmarked", "Hypoallergenic", "nickel-free", "Certified by a lab", "Tested for lead", "plain claim",
);
const DIMS: Dims[] = [
  { kind: "item", height_mm: 10, width_mm: 5 },
  { kind: "set", pendant_height_mm: 1, pendant_width_mm: 1, earring_height_mm: 1, earring_width_mm: 1 },
  { kind: "string-bracelet", circumference_mm: 150, width_mm: null },
  { kind: "bangle", diameter_mm: 50, width_mm: null },
];
const CATEGORIES: Category[] = ["Pendant", "Bracelet", "Earrings", "Set", "Tabeez"];

const arbProduct: fc.Arbitrary<Product> = fc
  .record({
    base: fc.constantFrom(...catalog.products),
    claims: fc.array(arbClaim, { maxLength: 3 }),
    weightH: fc.option(fc.integer({ min: 1, max: 900 }), { nil: null }),
    groups: fc.subarray(GROUPS, { minLength: 1 }),
    category: fc.constantFrom(...CATEGORIES),
    dims: fc.constantFrom(...DIMS),
    materials: arbText,
    chain: fc.option(arbText, { nil: null }),
    dimensions: arbText,
    weight: arbText,
  })
  .map(({ base, weightH, groups, ...o }) => ({
    ...base,
    ...o,
    age_groups: groups,
    weight_g: weightH === null ? null : weightH / 100,
  }));

const arbCatalog: fc.Arbitrary<ParsedCatalog> = fc
  .array(fc.option(fc.integer({ min: 1, max: 900 }), { nil: null }), {
    minLength: catalog.products.length,
    maxLength: catalog.products.length,
  })
  .map((ws) => ({
    ...catalog,
    products: catalog.products.map((p, i) => ({ ...p, weight_g: ws[i] === null ? null : ws[i]! / 100 })),
  }));

const row = (x: SafetyVerdict, id: string) => x.rows.find((r) => r.id === id)!;
const allText = (r: SafetyVerdict["rows"][number]) =>
  [r.label, r.text, r.asListed ?? "", ...r.guidance, ...(r.segments ?? []).map((s) => s.display)];

function wearExpected(p: Product): string | null {
  if (p.category === "Tabeez") return "wear:SR-WEAR-TABEEZ";
  if (p.dims.kind === "string-bracelet") return "wear:SR-WEAR-BRACELET";
  if (p.dims.kind === "bangle") return "wear:SR-WEAR-BANGLE";
  if (p.category === "Set") return "wear:SR-WEAR-SET-EARRINGS";
  return null;
}

/** V1, V2, V3, V5, V7, V10 for one verdict. */
function checkInvariants(x: SafetyVerdict, p: Product, band: AgeBand | null) {
  // V10
  const ids = x.rows.map((r) => r.id);
  const wear = wearExpected(p);
  expect(ids).toEqual([
    "age-fit", "materials", "weight", "certifications",
    ...(wear ? [wear] : []),
    "not-stated:nickel", "not-stated:plating", "not-stated:clasp",
  ]);
  // V5
  const flags = x.rows.filter((r) => r.severity === "flag").map((r) => r.id);
  expect(x.flagged).toEqual(flags);
  expect(x.verdict).toBe(flags.length > 0 ? "Check this" : "Good fit");
  // V2
  if (band && !p.age_groups.includes(AGE_LABEL[band])) {
    expect(x.verdict).toBe("Check this");
    expect(row(x, "age-fit").severity).toBe("flag");
  }
  // V3
  for (const r of x.rows) {
    expect(r.sources.length).toBeGreaterThanOrEqual(1);
    for (const s of r.sources) {
      expect(CATALOG_FIELDS.has(s) || RULE_IDS.has(s), s).toBe(true);
      if (RULE_IDS.has(s) && r.check !== "not-stated") {
        const viaGuidance = r.guidance.includes(ruleById(s).text);
        const viaSegments = (r.segments ?? []).some((g) => g.ruleId === s);
        expect(viaGuidance || viaSegments, `${r.id} cites ${s}`).toBe(true);
      }
    }
  }
  // V1
  const claims = p.claims.join("\n").toLowerCase();
  for (const r of x.rows) {
    const texts = allText(r).join("\n");
    for (const t of CERT) {
      if (certRe(t).test(texts)) {
        expect(r.id === "certifications" && claims.includes(t.toLowerCase()), `${t} in ${r.id}`).toBe(true);
      }
    }
  }
  if (p.claims.length === 0) {
    expect(row(x, "certifications").text).toBe("No certifications are stated on this product's page.");
  }
  // V7
  const everything = [x.verdict, x.disclaimer, ...x.rows.flatMap((r) => [r.label, r.text, ...r.guidance])];
  for (const t of everything) expect(t).not.toMatch(SAFE);
  expect(x.disclaimer).toBe(FIT_CHECK_LINE);
}

describe("P-SV-1/2/3/5/7/10: invariants over generated products", () => {
  it("V1, V2, V3, V5, V7, V10 hold", () => {
    assert(
      fc.property(arbProduct, arbCatalog, arbBand, (p, c, band) => {
        checkInvariants(computeVerdict(p, c, band), p, band);
      }),
    );
  });

  it("V2 specifically: any band outside age_groups is Check this", () => {
    assert(
      fc.property(arbProduct, arbCatalog, fc.constantFrom(...BANDS), (p, c, band) => {
        fc.pre(!p.age_groups.includes(AGE_LABEL[band]));
        const x = computeVerdict(p, c, band);
        expect(x.verdict).toBe("Check this");
        expect(row(x, "age-fit").severity).toBe("flag");
      }),
    );
  });
});

describe("P-SV-4: determinism and no mutation", () => {
  it("V4 holds", () => {
    assert(
      fc.property(arbProduct, arbCatalog, arbBand, (p, c, band) => {
        const pc = structuredClone(p);
        const cc = structuredClone(c);
        const a = computeVerdict(p, c, band);
        const b = computeVerdict(p, c, band);
        expect(a).toEqual(b);
        expect(p).toEqual(pc);
        expect(c).toEqual(cc);
      }),
    );
  });
});

describe("P-SV-6: weight flag is a monotone threshold", () => {
  const arbPool = fc
    .array(fc.integer({ min: 1, max: 900 }), { minLength: 0, maxLength: 14 })
    .map((hs) => hs.map((h) => h / 100).sort((a, b) => a - b));

  const naiveM2 = (pool: number[]) => {
    const h = pool.map((x) => Math.round(x * 100));
    const n = h.length;
    return n % 2 ? 2 * h[(n - 1) / 2] : h[n / 2 - 1] + h[n / 2];
  };

  it("raising the weight never turns a flag into a non-flag", () => {
    assert(
      fc.property(arbPool, fc.integer({ min: 1, max: 1500 }), (pool, wh) => {
        const w = wh / 100;
        if (weightContext(w, pool, "kids").flag) {
          expect(weightContext(w + 0.01, pool, "kids").flag).toBe(true);
        }
      }),
    );
  });

  it("exactly 1.5 × median does not flag; one hundredth above does (pool ≥ 3)", () => {
    assert(
      fc.property(arbPool, (pool) => {
        fc.pre(pool.length >= 3);
        const m2 = naiveM2(pool);
        fc.pre((3 * m2) % 4 === 0); // 1.5 × median representable in hundredths
        const atH = (3 * m2) / 4;
        expect(weightContext(atH / 100, pool, "kids").flag).toBe(false);
        expect(weightContext((atH + 1) / 100, pool, "kids").flag).toBe(true);
      }),
    );
  });

  it("a pool under 3 never flags", () => {
    assert(
      fc.property(arbPool, fc.integer({ min: 1, max: 100000 }), (pool, wh) => {
        fc.pre(pool.length < 3);
        expect(weightContext(wh / 100, pool, "mom").flag).toBe(false);
      }),
    );
  });
});

describe("P-SV-8: not-stated rows never assume", () => {
  const TOPICS = [
    { key: "nickel", words: ["nickel"], sentence: "Nickel content is not stated on the listing." },
    { key: "plating", words: ["plated", "plating", "rhodium"], sentence: "Plating or finish is not stated on the listing." },
    { key: "clasp", words: ["clasp", "closure", "hook", "lobster", "screw back", "screwback"], sentence: "Clasp or closure type is not stated on the listing." },
  ];
  const FIELDS = ["materials", "chain", "dimensions", "weight"] as const;

  it("V8 holds", () => {
    assert(
      fc.property(arbProduct, arbCatalog, arbBand, (p, c, band) => {
        const x = computeVerdict(p, c, band);
        for (const t of TOPICS) {
          const r = row(x, `not-stated:${t.key}`);
          let hit: { field: string; seg: string } | null = null;
          for (const f of FIELDS) {
            const v = p[f];
            if (!v || hit) continue;
            const seg = v.split(";").map((s) => s.trim()).find((s) => t.words.some((w) => s.toLowerCase().includes(w)));
            if (seg) hit = { field: f, seg };
          }
          if (hit) {
            expect(r.text).toBe(`The listing says: “${hit.seg}”`);
            expect(r.sources).toContain(hit.field);
          } else {
            expect(r.text).toBe(t.sentence);
          }
        }
      }),
    );
  });
});

describe("P-SV-9: decoder round trip", () => {
  const arbSeg = fc.oneof(
    arbSegment,
    fc.constantFrom(
      "925 Silver (sterling silver pendant)", "Diamond 0.06 Cts, Quality GH-VS", "Diamond, Quality GH-VS",
      "pearl bow", "Diamond 12.5 Cts",
    ),
    fc.stringMatching(/^[a-z0-9]{1,6}( [a-z0-9]{1,6}){0,2}$/),
  );
  it("joining raw segments reproduces materials; display numbers come from materials or fixed templates", () => {
    assert(
      fc.property(fc.array(arbSeg, { minLength: 1, maxLength: 5 }), (segs) => {
        const m = segs.join("; ");
        const decoded = decodeMaterials(m);
        expect(decoded.map((s) => s.raw).join("; ")).toBe(m.trim());
        for (const s of decoded) {
          for (const num of s.display.match(/\d+(?:\.\d+)?/g) ?? []) {
            expect(["18", "925"].includes(num) || m.includes(num), num).toBe(true);
          }
        }
      }),
    );
  });
});

describe("P-SV-12: the 22 real products × 5 band contexts", () => {
  it("V1–V10 hold for every combination", () => {
    for (const p of catalog.products) {
      for (const band of [...BANDS, null]) {
        const x = computeVerdict(p, catalog, band);
        checkInvariants(x, p, band);
        expect(computeVerdict(p, catalog, band)).toEqual(x);
      }
    }
  });
});
