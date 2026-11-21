// lib/page-meta.ts examples (REQ-PD-33 to 36). Node environment.
import { describe, expect, it } from "vitest";
import { ROUTE_TITLES, SITE_TITLE, TITLE_TEMPLATE, pieceDescription, pieceTitle } from "../lib/page-meta";
import { catalog, product } from "./helpers/matching-fixtures";

describe("constants (REQ-PD-33, 36)", () => {
  it("pins the site title, the template, and the route titles", () => {
    expect(SITE_TITLE).toBe("Haunted Gift Atelier — Tiny Tiaraa");
    expect(TITLE_TEMPLATE).toBe("%s | Haunted Gift Atelier");
    expect(ROUTE_TITLES).toEqual({
      find: "Find a gift",
      picks: "Your picks",
      atelier: "The atelier",
      pieceNotFound: "Piece not found",
    });
  });
  it("the template has exactly one %s placeholder", () => {
    expect(TITLE_TEMPLATE.split("%s")).toHaveLength(2);
  });
});

describe("pieceTitle (REQ-PD-34)", () => {
  it("an in-stock piece is its name only (TPN-1149)", () => {
    expect(pieceTitle(product("TPN-1149"))).toBe("Gold with Diamond Om Pendant");
  });
  it("the out-of-stock piece gets the suffix (TNZ-1058)", () => {
    expect(pieceTitle(product("TNZ-1058"))).toBe(
      "Red Square Evil Eye Nazariya – 925 Silver Baby Bracelet (out of stock)",
    );
  });
  it('keeps the site spelling "sudd set" verbatim (TPN-1206)', () => {
    expect(pieceTitle(product("TPN-1206"))).toBe("The Golden Pearl of Magical Moments pendant and sudd set");
  });
  it("keeps a trailing full stop (TBZ-1017)", () => {
    expect(pieceTitle(product("TBZ-1017"))).toBe("Swastik - Tabeez for Lucky Charms.");
  });
  it("only TNZ-1058 is out of stock, so only it carries the suffix", () => {
    const suffixed = catalog.products.filter((p) => pieceTitle(p) !== p.name).map((p) => p.sku);
    expect(suffixed).toEqual(["TNZ-1058"]);
  });
});

describe("pieceDescription (REQ-PD-35)", () => {
  it("is the exact sentence for TNZ-1056", () => {
    expect(pieceDescription(product("TNZ-1056"))).toBe(
      "Blue Evil Eye Nazariya – 925 Silver Baby Bracelet: Bracelet, 925 silver, listed for infants 0–3 years. See the fit check, a size view you calibrate, and a gift wrap.",
    );
  });
  it("joins several age groups with a comma (TPN-1149: gold, three groups)", () => {
    expect(pieceDescription(product("TPN-1149"))).toBe(
      "Gold with Diamond Om Pendant: Pendant, 18KT gold, listed for infants 0–3 years, kids 3–12 years, teens 12–19 years. See the fit check, a size view you calibrate, and a gift wrap.",
    );
  });
  it("leaves out the age clause rather than printing an empty one", () => {
    const p = { ...product("TNZ-1056"), age_groups: [] };
    expect(pieceDescription(p)).toBe(
      "Blue Evil Eye Nazariya – 925 Silver Baby Bracelet: Bracelet, 925 silver. See the fit check, a size view you calibrate, and a gift wrap.",
    );
  });
  it("does not mutate its input", () => {
    const p = product("TPN-1149");
    const before = JSON.stringify(p);
    pieceDescription(p);
    pieceTitle(p);
    expect(JSON.stringify(p)).toBe(before);
  });
});
