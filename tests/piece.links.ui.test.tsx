// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import BrowseCard from "../components/BrowseCard";
import PickCard from "../components/PickCard";
import { toBrowseItems } from "../lib/browse";
import { match } from "../lib/matching";
import { parseModelParam, pieceHref } from "../lib/model-param";
import { toPickViews } from "../lib/picks-view";
import { GOLDEN1, catalog } from "./helpers/matching-fixtures";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

const views = toPickViews(match(GOLDEN1, catalog), catalog);

describe("PickCard See details (REQ-GP-10)", () => {
  it("renders the exact href it is given, and the buy link is unchanged", () => {
    const view = views[0];
    const href = pieceHref(view.sku, GOLDEN1);
    render(<PickCard view={view} detailHref={href} />);
    const details = screen.getByRole("link", { name: "See details" });
    expect(details.getAttribute("href")).toBe(href);
    expect(details).not.toHaveAttribute("target");
    const buy = screen.getByRole("link", { name: "Buy on Tiny Tiaraa ↗" });
    expect(buy.getAttribute("href")).toBe(view.url);
    expect(buy.getAttribute("target")).toBe("_blank");
  });

  it("the href decodes back to the model", () => {
    const view = views[1];
    render(<PickCard view={view} detailHref={pieceHref(view.sku, GOLDEN1)} />);
    const href = screen.getByRole("link", { name: "See details" }).getAttribute("href") as string;
    const [path, query] = href.split("?");
    expect(path).toBe(`/piece/${view.sku}`);
    expect(parseModelParam(new URLSearchParams(query).get("m") ?? undefined)).toEqual({
      status: "ok",
      model: GOLDEN1,
    });
  });

  it("without the prop there is no See details link", () => {
    render(<PickCard view={views[0]} />);
    expect(screen.queryByRole("link", { name: "See details" })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("golden 1 still lists TBZ-1013, TNZ-1056, TBZ-1017 in order", () => {
    expect(views.map((v) => v.sku)).toEqual(["TBZ-1013", "TNZ-1056", "TBZ-1017"]);
  });
});

describe("BrowseCard See details (REQ-GP-11)", () => {
  const items = toBrowseItems(catalog);
  const item = (sku: string) => {
    const found = items.find((i) => i.sku === sku);
    if (!found) throw new Error(sku);
    return found;
  };

  it("links an in-stock card to /piece/<sku> and keeps its buy link", () => {
    const it_ = item("TNZ-1056");
    render(<BrowseCard item={it_} />);
    expect(screen.getByRole("link", { name: "See details" }).getAttribute("href")).toBe("/piece/TNZ-1056");
    expect(screen.getByRole("link", { name: "Buy on Tiny Tiaraa ↗" }).getAttribute("href")).toBe(it_.url);
  });

  it("links the out-of-stock card too, and it still has no buy control", () => {
    const { container } = render(<BrowseCard item={item("TNZ-1058")} />);
    expect(screen.getByRole("link", { name: "See details" }).getAttribute("href")).toBe("/piece/TNZ-1058");
    expect(container.querySelector('a[href^="https://www.tinytiaraa.com"]')).toBeNull();
    expect(screen.queryByText(/Buy on Tiny Tiaraa/)).toBeNull();
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });

  it("all 22 cards link to their own piece, with no query", () => {
    expect(items).toHaveLength(22);
    for (const i of items) {
      const { unmount } = render(<BrowseCard item={i} />);
      expect(screen.getByRole("link", { name: "See details" }).getAttribute("href")).toBe(`/piece/${i.sku}`);
      unmount();
    }
  });
});
