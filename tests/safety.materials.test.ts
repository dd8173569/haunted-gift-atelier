import { describe, expect, it } from "vitest";
import { decodeMaterials } from "../lib/safety-materials";
import { catalog, product } from "./helpers/matching-fixtures";

const display = (m: string) => decodeMaterials(m).map((s) => s.display).join(" · ");

describe("decodeMaterials: pinned real displays", () => {
  it("TPN-1149: gold + diamond with carat and grade", () => {
    expect(display(product("TPN-1149").materials)).toBe("18KT gold · Diamond 0.06 ct, GH-VS");
  });

  it("TPN-1206: set diamond without carat, then pearl", () => {
    expect(display(product("TPN-1206").materials)).toBe("18KT gold · Diamond, GH-VS · pearl");
  });

  it("TOB-1008: silver and CZ", () => {
    expect(display(product("TOB-1008").materials)).toBe("925 sterling silver · CZ (cubic zirconia)");
  });

  it("TBZ-1013: the openable-locket tail passes through unchanged", () => {
    const segs = decodeMaterials(product("TBZ-1013").materials);
    expect(segs[0]).toEqual({
      raw: "925 Silver",
      display: "925 sterling silver",
      ruleId: "SR-MAT-SILVER925",
    });
    expect(segs[1]).toEqual({
      raw: "openable locket, black thread (as listed in description)",
      display: "openable locket, black thread (as listed in description)",
      ruleId: null,
    });
  });

  it("TPN-1459: the silver parenthetical is kept verbatim", () => {
    expect(display(product("TPN-1459").materials)).toBe(
      "925 sterling silver (sterling silver Libra balance-symbol pendant)",
    );
  });

  it("THP-1001: the free-text tail passes through", () => {
    const segs = decodeMaterials(product("THP-1001").materials);
    expect(segs.map((s) => s.ruleId)).toEqual(["SR-MAT-GOLD18", "SR-MAT-DIAMOND", null]);
    expect(segs[2].display).toBe("triple-tone floral hoops (Yellow/White gold)");
  });

  it("black beads and pearl bow map to their rules", () => {
    expect(decodeMaterials(product("TNZ-1016").materials).map((s) => s.ruleId)).toEqual([
      "SR-MAT-GOLD18",
      "SR-MAT-DIAMOND",
      "SR-MAT-BEADS",
    ]);
    expect(decodeMaterials(product("TPN-1199").materials)[2]).toMatchObject({
      display: "pearl bow",
      ruleId: "SR-MAT-PEARL",
    });
  });
});

describe("decodeMaterials: all 22 real strings", () => {
  it("round trips the raw segments and copies numbers from the string", () => {
    for (const p of catalog.products) {
      const segs = decodeMaterials(p.materials);
      expect(segs.length, p.sku).toBeGreaterThan(0);
      expect(segs.map((s) => s.raw).join("; "), p.sku).toBe(p.materials.trim());
      for (const s of segs) {
        for (const num of s.display.match(/\d+(?:\.\d+)?/g) ?? []) {
          const fixed = ["18", "925"].includes(num); // fixed template numbers
          expect(fixed || p.materials.includes(num), `${p.sku} ${num}`).toBe(true);
        }
      }
    }
  });

  it("every segment of the 22 strings is either decoded or passes through raw", () => {
    for (const p of catalog.products) {
      for (const s of decodeMaterials(p.materials)) {
        if (s.ruleId === null) expect(s.display).toBe(s.raw);
      }
    }
  });
});

describe("decodeMaterials: synthetic segments", () => {
  it("is case-insensitive and drops empty segments", () => {
    expect(decodeMaterials(" 18kt gold ;; cz ;")).toEqual([
      { raw: "18kt gold", display: "18KT gold", ruleId: "SR-MAT-GOLD18" },
      { raw: "cz", display: "CZ (cubic zirconia)", ruleId: "SR-MAT-CZ" },
    ]);
  });

  it("returns [] for an empty string", () => {
    expect(decodeMaterials("  ")).toEqual([]);
  });

  it("decodes Diamond with carat only, and with grade only", () => {
    expect(display("Diamond 0.5 Cts")).toBe("Diamond 0.5 ct");
    expect(display("Diamond, Quality GH-VS")).toBe("Diamond, GH-VS");
    expect(display("Diamond")).toBe("Diamond");
  });

  it("leaves a near-miss undecoded", () => {
    expect(decodeMaterials("Diamond 0.06 Cts, Quality")).toEqual([
      {
        raw: "Diamond 0.06 Cts, Quality",
        display: "Diamond 0.06 Cts, Quality",
        ruleId: null,
      },
    ]);
    expect(decodeMaterials("platinum")[0].ruleId).toBeNull();
  });
});
