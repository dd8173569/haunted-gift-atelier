// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import AtelierPage from "../app/atelier/page";
import CatalogGrid from "../components/CatalogGrid";
import {
  ALL_FILTERS,
  filterItems,
  filtersToQuery,
  parseBrowseFilters,
  toBrowseItems,
  type BrowseFilters,
} from "../lib/browse";
import { catalog } from "./helpers/matching-fixtures";

// next/image would rewrite src to /_next/image; the plain <img> keeps the catalog path visible.
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

const FOOTNOTE =
  "Price as listed on tinytiaraa.com on 21 Nov 2026 — check the store for the current price.";
const items = toBrowseItems(catalog);
const BUY = "Buy on Tiny Tiaraa";

const renderGrid = (f: BrowseFilters = ALL_FILTERS) =>
  render(<CatalogGrid items={items} initialFilters={f} />);
const cards = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>("article[data-sku]"));
const skus = (c: HTMLElement) => cards(c).map((a) => a.dataset.sku);
const chip = (group: string, name: string | RegExp) =>
  within(screen.getByRole("group", { name: group })).getByRole("button", { name });

afterEach(() => vi.restoreAllMocks());

describe("/atelier grid, no filter", () => {
  it("renders 22 cards, 21 in stock first", () => {
    const { container } = renderGrid();
    expect(cards(container)).toHaveLength(22);
    expect(screen.getByText("Showing 22 pieces")).toBeInTheDocument();
    expect(skus(container).at(-1)).toBe("TNZ-1058");
  });

  it("exactly one card is out of stock: TNZ-1058, muted, no buy control, photo untouched", () => {
    const { container } = renderGrid();
    const oos = cards(container).filter((a) => within(a).queryByText("Out of stock"));
    expect(oos).toHaveLength(1);
    const card = oos[0];
    expect(card.dataset.sku).toBe("TNZ-1058");
    expect(card.querySelector('a[href^="https://www.tinytiaraa.com"]')).toBeNull();
    // REQ-GP-11 supersedes "no link at all": the only link is the "See details" navigation.
    expect(Array.from(card.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual(["/piece/TNZ-1058"]);
    expect(card.querySelector("button")).toBeNull();
    expect(card.textContent).not.toContain(BUY);
    expect(card.className).toContain("bg-plum/5");
    // REQ-PD-49: text-plum/50 measured 2.77:1; the out-of-stock text is text-plum/75 (AA, design §7.5).
    expect(card.className).toContain("text-plum/75");
    const img = card.querySelector("img")!;
    expect(img.getAttribute("style")).toBeNull();
    expect(img.className).not.toMatch(/opacity|filter|grayscale/);
    // No ancestor of the photo up to the card sets opacity or a filter either.
    for (let el: HTMLElement | null = img; el && el !== card.parentElement; el = el.parentElement) {
      expect(el.className).not.toMatch(/opacity|filter|grayscale/);
      expect(el.getAttribute("style")).toBeNull();
    }
  });

  it("the 21 in-stock cards each link to their catalog url, in a new tab", () => {
    const { container } = renderGrid();
    const inStock = catalog.products.filter((p) => p.availability === "In Stock");
    expect(inStock).toHaveLength(21);
    for (const p of inStock) {
      const card = container.querySelector<HTMLElement>(`article[data-sku="${p.sku}"]`)!;
      const link = within(card).getByRole("link", { name: /Buy on Tiny Tiaraa/ });
      expect(link.getAttribute("href")).toBe(p.url);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
    expect(screen.getAllByText(/Buy on Tiny Tiaraa/)).toHaveLength(21);
  });

  it("shows ratings only when the catalog has one", () => {
    const { container } = renderGrid();
    for (const p of catalog.products) {
      const card = container.querySelector<HTMLElement>(`article[data-sku="${p.sku}"]`)!;
      if (p.rating === null) expect(card.textContent).not.toMatch(/Rated/);
      else expect(within(card).getByText(`Rated ${p.rating}`)).toBeInTheDocument();
    }
    expect(catalog.products.some((p) => p.rating === null)).toBe(true);
    expect(catalog.products.find((p) => p.sku === "TPN-1141")!.rating).not.toBeNull();
  });
});

describe("/atelier filters", () => {
  it("Infants shows only products listing Infants 0-3 years", () => {
    const { container } = renderGrid();
    fireEvent.click(chip("Age", /^Infants/));
    const expected = catalog.products
      .filter((p) => p.age_groups.includes("Infants 0-3 years"))
      .map((p) => p.sku);
    expect([...skus(container)].sort()).toEqual([...expected].sort());
    expect(expected.length).toBeLessThan(22);
  });

  it("Pendant + 18KT gold + ₹15,000–₹25,000 gives the independently computed SKUs", () => {
    const { container } = renderGrid();
    fireEvent.click(chip("Category", "Pendant"));
    fireEvent.click(chip("Metal", "18KT gold"));
    fireEvent.click(chip("Budget", /^₹15,000/));
    // Independent of lib/browse: raw fields only. Band edge: above 15,000, up to 25,000.
    const expected = catalog.products
      .filter(
        (p) =>
          p.category === "Pendant" &&
          !/silver/i.test(p.name) &&
          p.price_inr > 15000 &&
          p.price_inr <= 25000,
      )
      .map((p) => p.sku);
    expect(expected).toEqual(["TPN-1149", "TPN-1147"]);
    expect(skus(container)).toEqual(expected);
  });

  it("a no-match combination shows the empty state; Clear filters restores 22", () => {
    const { container } = renderGrid();
    fireEvent.click(chip("Category", "Tabeez"));
    fireEvent.click(chip("Metal", "18KT gold"));
    expect(screen.getByText("No piece matches those filters.")).toBeInTheDocument();
    expect(cards(container)).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(cards(container)).toHaveLength(22);
    expect(chip("Category", "All")).toHaveAttribute("aria-pressed", "true");
  });

  it("initial filters pre-select their chips and filter the grid", () => {
    const f = parseBrowseFilters({ metal: "silver" });
    const { container } = renderGrid(f);
    expect(chip("Metal", "925 silver")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Metal", "All")).toHaveAttribute("aria-pressed", "false");
    expect(skus(container)).toEqual(filterItems(items, f).map((i) => i.sku));
  });

  it("tapping a chip mirrors the filters with history.replaceState", () => {
    const spy = vi.spyOn(window.history, "replaceState");
    renderGrid();
    fireEvent.click(chip("Metal", "925 silver"));
    expect(spy).toHaveBeenLastCalledWith(null, "", `?${filtersToQuery({ ...ALL_FILTERS, metal: "silver" })}`);
    fireEvent.click(chip("Category", "Bracelet"));
    expect(spy).toHaveBeenLastCalledWith(null, "", "?category=bracelet&metal=silver");
    fireEvent.click(chip("Metal", "All"));
    fireEvent.click(chip("Category", "All"));
    expect(spy).toHaveBeenLastCalledWith(null, "", window.location.pathname);
  });
});

describe("/atelier page", () => {
  it("renders from searchParams, with invalid values treated as All", async () => {
    render(await AtelierPage({ searchParams: Promise.resolve({ metal: "junk" }) }));
    expect(screen.getAllByText(/Buy on Tiny Tiaraa/)).toHaveLength(21);
    expect(screen.getByRole("link", { name: "← Back to the atelier" })).toHaveAttribute("href", "/");
  });
});

describe("P-CV-10 for the grid", () => {
  it("every ₹ text sits in a price region carrying the footnote once; no discount wording", () => {
    const { container } = renderGrid();
    const regions = container.querySelectorAll("[data-price-region]");
    expect(regions).toHaveLength(1);
    expect(regions[0].textContent!.split(FOOTNOTE)).toHaveLength(2);
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let priced = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent!.includes("₹")) continue;
      if (n.parentElement!.closest("article[data-sku]")) priced++;
      expect(n.parentElement!.closest("[data-price-region]")).not.toBeNull();
    }
    expect(priced).toBe(22);
    expect(container.textContent).not.toMatch(/% off|save ₹|MRP|was ₹/i);
    expect(container.querySelector("del, s, strike, [class*='line-through']")).toBeNull();
  });
});

describe("P-CV-11 render part", () => {
  const options: Record<keyof BrowseFilters, { group: string; labels: (string | RegExp)[] }> = {
    age: { group: "Age", labels: [/^Infants/, /^Kids/, /^Teens/, "Mom"] },
    category: { group: "Category", labels: ["Pendant", "Bracelet", "Earrings", "Set", "Tabeez"] },
    metal: { group: "Metal", labels: ["18KT gold", "925 silver"] },
    budget: { group: "Budget", labels: [] },
  };

  it("for every single-filter combination, the out-of-stock card never has a buy link", () => {
    const budgetGroup = () => within(screen.getByRole("group", { name: "Budget" })).getAllByRole("button");
    const { container } = renderGrid();
    const budgetCount = budgetGroup().length;
    expect(budgetCount).toBe(5);
    let checked = 0;
    const check = () => {
      const oos = container.querySelector<HTMLElement>('article[data-sku="TNZ-1058"]');
      if (oos) {
        // REQ-GP-11: "See details" only; no buy control (REQ-CV-38).
        expect(Array.from(oos.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual([
          "/piece/TNZ-1058",
        ]);
        expect(oos.textContent).not.toContain(BUY);
      }
      for (const a of cards(container)) {
        const sku = a.dataset.sku;
        const p = catalog.products.find((x) => x.sku === sku)!;
        // "See details" on every card (REQ-GP-11), plus the buy link on in-stock cards.
        expect(a.querySelectorAll("a").length).toBe(p.availability === "In Stock" ? 2 : 1);
      }
      checked++;
    };
    for (const [key, { group, labels }] of Object.entries(options)) {
      const names =
        key === "budget"
          ? budgetGroup().map((b) => b.textContent!).filter((t) => t !== "All").map((t) => new RegExp(t.replace(/[^\w]/g, ".")))
          : labels;
      for (const name of names) {
        fireEvent.click(chip(group, name));
        check();
        fireEvent.click(chip(group, "All"));
      }
    }
    expect(checked).toBe(4 + 5 + 2 + 4);
  });
});
