// @vitest-environment jsdom
// Phase 7 judge-sim fixes on the landing: the hero subhead names the
// calibrated size view, and one real piece is featured with its exact photo.
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import { renderLanding } from "./helpers/pages";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

describe("landing: Phase 7 judge-sim fixes", () => {
  it("the hero subhead names the calibrated size view, not only the fit check", () => {
    renderLanding();
    expect(
      screen.getByText(/shows it at a size you calibrate/i),
    ).toBeInTheDocument();
    // The phrase appears twice: hero subhead + step 3 ("Check it, see it, wrap it").
    expect(screen.getAllByText(/plain-language fit check/i)).toHaveLength(2);
  });

  it("the featured piece shows the exact TNZ-1056 photo with the verbatim name", () => {
    renderLanding();
    const img = screen.getByRole("img", {
      name: "Blue Evil Eye Nazariya – 925 Silver Baby Bracelet",
    });
    expect(img.getAttribute("src")).toBe("/catalog/TNZ-1056.png");
    expect(
      screen.getByText("Blue Evil Eye Nazariya – 925 Silver Baby Bracelet", {
        selector: "p",
      }),
    ).toBeInTheDocument();
  });

  it("the featured piece links to its detail page", () => {
    renderLanding();
    const link = screen.getByRole("link", { name: "See its fit check and size view" });
    expect(link.getAttribute("href")).toBe("/piece/TNZ-1056");
  });

  it("the featured block carries no price (the detail page carries price + footnote)", () => {
    renderLanding();
    const section = screen.getByRole("region", { name: "Featured piece" });
    expect(section.textContent).not.toContain("₹");
  });
});
