import { describe, expect, it } from "vitest";
import type { Dims, Product } from "../lib/catalog";
import { PHOTO_BOX_MAX_ASPECT, PHOTO_BOX_MIN_SHORT_MM, buildSizeSpec, photoFitsBox } from "../lib/size-spec";
import { catalog, product } from "./helpers/matching-fixtures";

const withDims = (sku: string, dims: Dims): Product => ({ ...product(sku), dims });
const only = (sku: string) => {
  const items = buildSizeSpec(product(sku)).items;
  expect(items).toHaveLength(1);
  return items[0];
};

const PHOTO_INSIDE = ["TPN-1459", "TPN-1433", "TBZ-1013", "TBZ-1017"];
const EMPTY = ["TPN-1149", "TPN-1147", "TPN-1145", "TPN-1141", "TPN-1143", "TPN-1144", "THP-1017", "THP-1001", "THP-1027"];
const SETS = ["TPN-1206", "TPN-1199"];
const BRACELETS = ["TNZ-1058", "TNZ-1016", "TNZ-1010", "TNZ-1015", "TNZ-1056"];
const BANGLES = ["TOB-1009", "TOB-1008"];

describe("photoFitsBox", () => {
  it("needs a short side of at least 6 mm and an aspect of at most 2.5", () => {
    expect([PHOTO_BOX_MIN_SHORT_MM, PHOTO_BOX_MAX_ASPECT]).toEqual([6, 2.5]);
    expect(photoFitsBox(26, 18.6)).toBe(true);
    expect(photoFitsBox(6, 6)).toBe(true);
    expect(photoFitsBox(15, 6)).toBe(true); // aspect exactly 2.5
    expect(photoFitsBox(15.1, 6)).toBe(false);
    expect(photoFitsBox(5.9, 5.9)).toBe(false);
    expect(photoFitsBox(14.4, 1.9)).toBe(false);
  });
});

describe("the 22 real products (design §3.1)", () => {
  it("covers every product and every group once", () => {
    const all = [...PHOTO_INSIDE, ...EMPTY, ...SETS, ...BRACELETS, ...BANGLES];
    expect(all).toHaveLength(22);
    expect(new Set(all)).toEqual(new Set(catalog.products.map((p) => p.sku)));
  });

  it("photo inside the box for exactly 4 SKUs", () => {
    for (const sku of PHOTO_INSIDE) {
      const it = only(sku);
      expect(it.kind, sku).toBe("box");
      expect(it.kind === "box" && it.photoInside, sku).toBe(true);
    }
  });

  it("empty size outline for the 9 thin pieces", () => {
    for (const sku of EMPTY) {
      const it = only(sku);
      expect(it.kind, sku).toBe("box");
      expect(it.kind === "box" && it.photoInside, sku).toBe(false);
    }
  });

  it("sets give two boxes with no photo inside", () => {
    for (const sku of SETS) {
      const items = buildSizeSpec(product(sku)).items;
      expect(items.map((i) => (i.kind === "box" ? i.id : i.kind))).toEqual(["pendant", "earring"]);
      for (const i of items) expect(i.kind === "box" && i.photoInside).toBe(false);
    }
  });

  it("bracelets and bangles are rings; TNZ-1058 and TNZ-1056 band width is not stated", () => {
    for (const sku of [...BRACELETS, ...BANGLES]) expect(only(sku).kind, sku).toBe("ring");
    for (const sku of ["TNZ-1058", "TNZ-1056"]) {
      const it = only(sku);
      expect(it.kind === "ring" && it.detail).toContain("Band width not stated on the listing.");
    }
    const withWidth = only("TNZ-1016");
    expect(withWidth.kind === "ring" && withWidth.detail).toBe(
      "Drawn as a closed circle, Ø ≈ 42 mm. Band width: 2 mm.",
    );
    const bangle = only("TOB-1008");
    expect(bangle.kind === "ring" && bangle.detail).toBe("Band width: 1.6 mm.");
  });

  it("every spec carries the verbatim name and the /catalog/ photo path", () => {
    for (const p of catalog.products) {
      const s = buildSizeSpec(p);
      expect(s.sku).toBe(p.sku);
      expect(s.name).toBe(p.name);
      expect(s.imageSrc).toBe(`/catalog/${p.image_file}`);
    }
  });
});

describe("captions, byte for byte", () => {
  it("TPN-1149 pendant", () => {
    const it = only("TPN-1149");
    expect(it.kind === "box" && it.caption).toEqual({
      approximate: "pendant face, 14.4 mm tall — chain not shown to scale",
      calibrated: "pendant face, 14.4 mm tall — chain not shown to scale",
    });
    expect(it.kind === "box" && it.detail).toBe("Listed: 14.4 mm tall × 1.9 mm wide.");
  });

  it("TPN-1459 pendant", () => {
    const it = only("TPN-1459");
    expect(it.kind === "box" && it.caption.calibrated).toBe("pendant face, 26 mm tall — chain not shown to scale");
    expect(it.kind === "box" && it.detail).toBe("Listed: 26 mm tall × 18.6 mm wide.");
  });

  it("TNZ-1056 ring", () => {
    const it = only("TNZ-1056");
    expect(it.kind === "ring" && it.caption).toEqual({
      calibrated: "ring outline at true size — 5.25 in around",
      approximate: "ring outline, approximate size — 5.25 in around",
    });
    expect(it.kind === "ring" && it.diameterMm).toBeCloseTo(133.4 / Math.PI, 12);
    expect(it.kind === "ring" && it.detail).toBe(
      "Drawn as a closed circle, Ø ≈ 42 mm. Band width not stated on the listing.",
    );
  });

  it("TOB-1009 bangle", () => {
    const it = only("TOB-1009");
    expect(it.kind === "ring" && it.caption).toEqual({
      calibrated: "bangle outline at true size — 39.6 mm across",
      approximate: "bangle outline, approximate size — 39.6 mm across",
    });
    expect(it.kind === "ring" && it.diameterMm).toBe(39.6);
  });

  it("TPN-1206 pendant and earring", () => {
    const [pendant, earring] = buildSizeSpec(product("TPN-1206")).items;
    expect(pendant.kind === "box" && [pendant.heightMm, pendant.widthMm]).toEqual([11.5, 4.55]);
    expect(pendant.kind === "box" && pendant.caption.approximate).toBe(
      "pendant face, 11.5 mm tall — chain not shown to scale",
    );
    expect(pendant.kind === "box" && pendant.detail).toBe("Listed: 11.5 mm tall × 4.55 mm wide.");
    expect(earring.kind === "box" && [earring.heightMm, earring.widthMm]).toEqual([5.35, 3.9]);
    expect(earring.kind === "box" && earring.caption.approximate).toBe("one earring, 5.35 mm tall");
    expect(earring.kind === "box" && earring.detail).toBe("Listed: 5.35 mm tall × 3.9 mm wide.");
  });

  it("earrings and tabeez", () => {
    const e = only("THP-1017");
    expect(e.kind === "box" && e.caption.approximate).toBe("one earring, 11 mm tall");
    const t = only("TBZ-1013");
    expect(t.kind === "box" && t.caption.approximate).toBe("tabeez, 12.1 mm tall — thread not shown to scale");
  });
});

describe("missing dimensions (fixtures)", () => {
  it("null height gives one missing item and no drawing", () => {
    const s = buildSizeSpec(withDims("TPN-1149", { kind: "item", height_mm: null, width_mm: 1.9 }));
    expect(s.items).toEqual([{ kind: "missing", id: "piece", message: "Size not stated on the listing." }]);
    const both = buildSizeSpec(withDims("TPN-1149", { kind: "item", height_mm: null, width_mm: null }));
    expect(both.items[0].kind).toBe("missing");
  });

  it("null width gives a height line", () => {
    const s = buildSizeSpec(withDims("TPN-1149", { kind: "item", height_mm: 14.4, width_mm: null }));
    expect(s.items).toHaveLength(1);
    const it = s.items[0];
    expect(it.kind).toBe("line");
    expect(it.kind === "line" && it.heightMm).toBe(14.4);
    expect(it.kind === "line" && it.caption.calibrated).toBe("pendant face, 14.4 mm tall — chain not shown to scale");
    expect(it.kind === "line" && it.detail).toBe("Listed: 14.4 mm tall. Width not stated on the listing.");
  });

  it("never draws 0 or a negative size", () => {
    const zero = buildSizeSpec(withDims("TPN-1149", { kind: "item", height_mm: 0, width_mm: 3 }));
    expect(zero.items[0].kind).toBe("missing");
    const zeroW = buildSizeSpec(withDims("TPN-1149", { kind: "item", height_mm: 5, width_mm: 0 }));
    expect(zeroW.items[0].kind).toBe("line");
    const ring = buildSizeSpec(withDims("TOB-1009", { kind: "bangle", diameter_mm: 0, width_mm: null }));
    expect(ring.items[0].kind).toBe("missing");
    const br = buildSizeSpec(withDims("TNZ-1056", { kind: "string-bracelet", circumference_mm: NaN, width_mm: 2 }));
    expect(br.items[0].kind).toBe("missing");
    const set = buildSizeSpec(
      withDims("TPN-1206", {
        kind: "set",
        pendant_height_mm: 1,
        pendant_width_mm: 1,
        earring_height_mm: 0,
        earring_width_mm: 1,
      }),
    );
    expect(set.items[0].kind).toBe("missing");
  });

  it("a category without a part word falls back to a neutral caption", () => {
    const s = buildSizeSpec(withDims("TNZ-1056", { kind: "item", height_mm: 20, width_mm: 20 }));
    const it = s.items[0];
    expect(it.kind === "box" && it.caption.approximate).toBe("piece, 20 mm tall");
  });
});
