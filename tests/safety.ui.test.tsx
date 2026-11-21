// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "./helpers/dom";
import SafetyVerdict from "../components/SafetyVerdict";
import { FIT_CHECK_LINE, computeVerdict } from "../lib/safety";
import type { AgeBand } from "../lib/matching/types";
import { catalog, product } from "./helpers/matching-fixtures";

const card = (sku: string, band: AgeBand | null) => {
  const verdict = computeVerdict(product(sku), catalog, band);
  const view = render(<SafetyVerdict verdict={verdict} />);
  return { verdict, region: screen.getByRole("region"), ...view };
};
const rowEl = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-row-id="${id}"]`) as HTMLElement;

describe("SafetyVerdict card: TNZ-1056 / infants", () => {
  it("shows Check this, labelled by its heading", () => {
    const { region } = card("TNZ-1056", "infants");
    expect(screen.getByRole("heading", { level: 2, name: "Check this" })).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-labelledby", screen.getByRole("heading", { level: 2 }).id);
    expect(region.className).toContain("bg-champagne");
  });

  it("marks both flagged rows with 'Worth a look' in text", () => {
    const { region } = card("TNZ-1056", "infants");
    for (const id of ["weight", "wear:SR-WEAR-BRACELET"]) {
      const r = rowEl(region, id);
      expect(r).toHaveAttribute("data-severity", "flag");
      expect(within(r).getByText("Worth a look")).toBeInTheDocument();
    }
    expect(screen.getByText("Worth a look: Weight, Wear note")).toBeInTheDocument();
    expect(region.querySelectorAll('[data-severity="flag"]')).toHaveLength(2);
  });

  it("shows the bracelet guidance with its rule ID", () => {
    const { region } = card("TNZ-1056", "infants");
    const r = rowEl(region, "wear:SR-WEAR-BRACELET");
    expect(r).toHaveTextContent("General guidance (SR-WEAR-BRACELET):");
    expect(r).toHaveTextContent("Check the fit as the child grows, and take it off for sleep.");
    expect(r).toHaveTextContent("Source: category, dimensions, SR-WEAR-BRACELET");
  });

  it("shows the weight sentence with 6 g and 1.51 g, and the listing's weight text", () => {
    const { region } = card("TNZ-1056", "infants");
    const r = rowEl(region, "weight");
    expect(r).toHaveTextContent("6 g");
    expect(r).toHaveTextContent("1.51 g");
    expect(r).toHaveTextContent("As listed: 5.50-6.50 gross gms approx");
    expect(r).toHaveTextContent("Source: weight, weight_g, SR-WEIGHT-MEDIAN");
  });

  it("shows the certifications sentence without a General guidance label", () => {
    const { region } = card("TNZ-1056", "infants");
    const r = rowEl(region, "certifications");
    expect(r).toHaveTextContent("No certifications are stated on this product's page.");
    expect(r).not.toHaveTextContent("General guidance");
    expect(r).toHaveTextContent("Source: claims, SR-CLAIMS-ONLY");
  });

  it("shows the three not-stated sentences once each, labeled as guidance", () => {
    const { region } = card("TNZ-1056", "infants");
    for (const [id, rule, sentence] of [
      ["not-stated:nickel", "SR-NS-NICKEL", "Nickel content is not stated on the listing."],
      ["not-stated:plating", "SR-NS-PLATING", "Plating or finish is not stated on the listing."],
      ["not-stated:clasp", "SR-NS-CLASP", "Clasp or closure type is not stated on the listing."],
    ]) {
      const r = rowEl(region, id);
      expect(r).toHaveTextContent(`General guidance (${rule}): ${sentence}`);
      expect(r.textContent!.split(sentence)).toHaveLength(2);
    }
  });

  it("ends with the exact fit-check line as one text node", () => {
    const { region } = card("TNZ-1056", "infants");
    const last = region.lastElementChild as HTMLElement;
    expect(last.textContent).toBe(FIT_CHECK_LINE);
    expect(last.childNodes).toHaveLength(1);
  });
});

describe("SafetyVerdict card: other verdicts", () => {
  it("TPN-1149 / infants shows Good fit on sage, with no 'Worth a look'", () => {
    const { region } = card("TPN-1149", "infants");
    expect(screen.getByRole("heading", { level: 2, name: "Good fit" })).toBeInTheDocument();
    expect(region.className).toContain("bg-sage/60");
    expect(region).not.toHaveTextContent("Worth a look");
    expect(rowEl(region, "age-fit")).toHaveTextContent("Listed by Tiny Tiaraa for infants 0–3 years");
  });

  it("a no-band card shows the fallback line once, in the age row", () => {
    const { region } = card("TPN-1149", null);
    const line = "No recipient selected — age fit shown against all listed age groups";
    expect(region.textContent!.split(line)).toHaveLength(2);
    expect(rowEl(region, "age-fit")).toHaveTextContent(line);
  });

  it("a band the piece does not list flags the age row", () => {
    const { region } = card("TPN-1149", "mom");
    expect(screen.getByRole("heading", { level: 2, name: "Check this" })).toBeInTheDocument();
    expect(rowEl(region, "age-fit")).toHaveTextContent("Worth a look");
  });

  it("shows materials as listed, decoded, with rule guidance", () => {
    const { region } = card("TPN-1149", "infants");
    const r = rowEl(region, "materials");
    expect(r).toHaveTextContent("As listed: 18KT Gold; Diamond 0.06 Cts, Quality GH-VS");
    expect(r).toHaveTextContent("18KT gold · Diamond 0.06 ct, GH-VS");
    expect(r).toHaveTextContent("General guidance (SR-MAT-GOLD18):");
    expect(r).toHaveTextContent("Source: materials, SR-MAT-GOLD18, SR-MAT-DIAMOND");
  });

  it("quotes stated claims verbatim when present", () => {
    const p = { ...product("TPN-1149"), claims: ["BIS Hallmarked"] };
    render(<SafetyVerdict verdict={computeVerdict(p, catalog, "infants")} />);
    expect(screen.getByText("Stated on this product's page: BIS Hallmarked")).toBeInTheDocument();
  });
});

describe("SafetyVerdict card: invariants over all pieces", () => {
  it("no element text says safe/unsafe, and every row has a Source line", () => {
    for (const p of catalog.products) {
      for (const band of [null, "infants", "kids", "teens", "mom"] as (AgeBand | null)[]) {
        const verdict = computeVerdict(p, catalog, band);
        const { container, unmount } = render(<SafetyVerdict verdict={verdict} />);
        for (const el of container.querySelectorAll("*")) {
          const own = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent)
            .join("");
          expect(own).not.toMatch(/\b(un)?safe\b/i);
        }
        const rows = container.querySelectorAll("[data-row-id]");
        expect(rows).toHaveLength(verdict.rows.length);
        for (const r of rows) expect(r.textContent).toMatch(/Source: \S/);
        expect(container.querySelector("img, svg")).toBeNull();
        unmount();
      }
    }
  });
});
