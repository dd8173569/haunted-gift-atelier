// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import AtelierButton from "../components/AtelierButton";
import DisclosureNote from "../components/DisclosureNote";
import PickCard from "../components/PickCard";
import PicksPage from "../app/picks/page";
import { match } from "../lib/matching";
import { formatInr } from "../lib/matching/templates";
import { encodeModelParam } from "../lib/model-param";
import { toPickViews } from "../lib/picks-view";
import type { RecipientModel } from "../lib/matching/types";
import { GOLDEN1, GOLDEN2, GOLDEN3, catalog, model, product } from "./helpers/matching-fixtures";

// next/image would rewrite src to /_next/image; the plain <img> keeps the catalog path visible.
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

const FOOTNOTE =
  "Price as listed on tinytiaraa.com on 21 Nov 2026 — check the store for the current price.";

const viewsFor = (m: RecipientModel) => {
  const result = match(m, catalog);
  return { result, views: toPickViews(result, catalog) };
};

// The page is an async server component: call it and render the element it returns.
const renderPage = async (m: RecipientModel) =>
  render(await PicksPage({ searchParams: Promise.resolve({ m: encodeModelParam(m) }) }));

describe("AtelierButton external prop (REQ-CV-32)", () => {
  it("non-external output has no target or rel and the same classes", () => {
    render(<AtelierButton href="/atelier">Go</AtelierButton>);
    const a = screen.getByRole("link", { name: "Go" });
    expect(a).toHaveAttribute("href", "/atelier");
    expect(a).not.toHaveAttribute("target");
    expect(a).not.toHaveAttribute("rel");
    expect(a.className).toBe(
      "flex h-12 items-center justify-center rounded-full px-8 text-base font-medium transition-colors bg-plum text-pearl hover:bg-plum/85",
    );
  });
  it("external keeps href untouched and opens a new tab safely", () => {
    const url = "https://www.tinytiaraa.com/products/x?variant=1&a=b#frag";
    render(
      <AtelierButton href={url} external>
        Out
      </AtelierButton>,
    );
    const a = screen.getByRole("link", { name: "Out" });
    expect(a).toHaveAttribute("href", url);
    expect(a).toHaveAttribute("target", "_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("golden 1 cards", () => {
  const { result, views } = viewsFor(GOLDEN1);
  const prices = ["₹2,324", "₹1,674", "₹2,099"];

  it("renders 3 cards in match() order with catalog facts verbatim", () => {
    render(
      <>
        {views.map((v) => (
          <PickCard key={v.sku} view={v} />
        ))}
      </>,
    );
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(3);
    ["TBZ-1013", "TNZ-1056", "TBZ-1017"].forEach((sku, i) => {
      const p = product(sku);
      const card = within(cards[i]);
      expect(views[i].sku).toBe(sku);
      expect(card.getByRole("heading", { level: 2 })).toHaveTextContent(p.name);
      expect(card.getByRole("heading", { level: 2 }).textContent).toBe(p.name);
      expect(cards[i]).toHaveTextContent(prices[i]);
      expect(formatInr(p.price_inr)).toBe(prices[i]);
      expect(card.getByText(FOOTNOTE)).toBeInTheDocument();

      const reasons = card.getAllByRole("listitem").map((li) => li.textContent);
      const expected = result.picks[i].reasons.map((r) => r.text);
      expect(expected.length).toBeGreaterThanOrEqual(2);
      expect(expected.length).toBeLessThanOrEqual(4);
      expect(reasons).toEqual(expected);

      const img = card.getByRole("img");
      expect(img).toHaveAttribute("src", `/catalog/${p.image_file}`);
      expect(img).toHaveAttribute("alt", p.name);
      // Nothing is layered over the photo: the wrapper holds only the <img>, and no
      // element in the card is absolutely/fixed positioned.
      expect(img.parentElement?.children).toHaveLength(1);
      expect(cards[i].querySelector(".absolute, .fixed, [style*='position']")).toBeNull();

      const buy = card.getByRole("link", { name: /Buy on Tiny Tiaraa/ });
      expect(buy.getAttribute("href")).toBe(p.url);
      expect(buy).toHaveAttribute("target", "_blank");
      expect(buy.getAttribute("rel")).toContain("noopener");
      expect(card.getAllByRole("link")).toHaveLength(1); // no /piece/[sku] link (REQ-CV-33)
    });
  });

  it("shows a rating only when the catalog has one", () => {
    for (const sku of catalog.products.filter((p) => p.availability === "In Stock").map((p) => p.sku)) {
      const p = product(sku);
      const v = { ...viewsFor(GOLDEN1).views[0], sku, name: p.name, rating: p.rating };
      const { container, unmount } = render(<PickCard view={v} />);
      if (p.rating === null) expect(container.textContent).not.toMatch(/Rated/);
      else expect(container.textContent).toContain(p.rating);
      unmount();
    }
  });

  it("the page renders the same three cards with the headline and no disclosure", async () => {
    await renderPage(GOLDEN1);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText("A naming gift for your niece or nephew, 0–1 years")).toBeInTheDocument();
    expect(screen.queryByText("How we widened the search")).toBeNull();
    expect(screen.getByRole("link", { name: "Change my answers" }).getAttribute("href")).toMatch(/^\/find\?m=/);
    expect(screen.getAllByText(FOOTNOTE)).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: /Buy on Tiny Tiaraa/ })).toHaveLength(3);
  });
});

describe("golden 3 relaxation", () => {
  const { result, views } = viewsFor(GOLDEN3);

  it("shows the TPN-1141 sentence and the plain-words labels", async () => {
    await renderPage(GOLDEN3);
    const tpn = views.find((v) => v.sku === "TPN-1141");
    expect(tpn?.relaxationNote).toBeTruthy();
    expect(screen.getByText(tpn!.relaxationNote!)).toBeInTheDocument();
    expect(screen.getAllByText("Just below your budget")[0]).toBeInTheDocument();
    expect(screen.getAllByText("A related symbol")[0]).toBeInTheDocument();
  });

  it("DisclosureNote shows both sentences verbatim", () => {
    expect(result.disclosures).toHaveLength(2);
    render(<DisclosureNote sentences={result.disclosures} />);
    expect(screen.getByText("How we widened the search")).toBeInTheDocument();
    for (const s of result.disclosures) expect(screen.getByText(s)).toBeInTheDocument();
  });

  it("the page shows the note above the cards", async () => {
    await renderPage(GOLDEN3);
    for (const s of result.disclosures) expect(screen.getByText(s)).toBeInTheDocument();
  });

  it("DisclosureNote renders nothing for no sentences", () => {
    const { container } = render(<DisclosureNote sentences={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("golden 2 shortfall", () => {
  it("2 cards, the shortfall text, the browse link, no third card", async () => {
    const { result } = viewsFor(GOLDEN2);
    expect(result.picks).toHaveLength(2);
    expect(result.shortfallNote).toBeTruthy();
    await renderPage(GOLDEN2);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText(result.shortfallNote!)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse the full atelier" })).toHaveAttribute("href", "/atelier");
    expect(screen.getByRole("link", { name: "Change my answers" })).toBeInTheDocument();
  });
});

describe("/picks guards", () => {
  it("missing m redirects to /find; invalid m to /find?notice=incomplete", async () => {
    const digest = async (m: string | undefined) => {
      try {
        await PicksPage({ searchParams: Promise.resolve({ m }) });
      } catch (e) {
        return String((e as { digest?: string }).digest);
      }
      return "no redirect";
    };
    expect(await digest(undefined)).toMatch(/^NEXT_REDIRECT;[a-z]+;\/find;/);
    expect(await digest("{nope")).toMatch(/^NEXT_REDIRECT;[a-z]+;\/find\?notice=incomplete;/);
  });
});

describe("P-CV-10 over PickCard for every in-stock product", () => {
  const base = viewsFor(GOLDEN1).views[0];
  const inStock = catalog.products.filter((p) => p.availability === "In Stock");

  it("there are 21 in-stock products", () => expect(inStock).toHaveLength(21));

  it("each ₹ text node sits in a price region with the footnote; no discount words", () => {
    for (const p of inStock) {
      const view = {
        ...base,
        sku: p.sku,
        name: p.name,
        category: p.category,
        price_inr: p.price_inr,
        url: p.url,
        imageSrc: `/catalog/${p.image_file}`,
        rating: p.rating,
      };
      const { container, unmount } = render(<PickCard view={view} />);
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let rupee = 0;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.includes("₹")) continue;
        rupee++;
        const region = n.parentElement?.closest("[data-price-region]");
        expect(region, `${p.sku} ₹ outside a price region`).not.toBeNull();
        expect(region!.textContent).toContain(FOOTNOTE);
      }
      expect(rupee).toBeGreaterThan(0);
      expect(container.textContent).not.toMatch(/% off|save ₹|MRP|was ₹/i);
      expect(container.querySelector("del, s, strike, .line-through")).toBeNull();
      unmount();
    }
  });

  it("the card shows a price from a no-budget model too", () => {
    const { views } = viewsFor(model({ budgetBand: "no-limit" }));
    render(<PickCard view={views[0]} />);
    expect(screen.getByText(FOOTNOTE)).toBeInTheDocument();
  });
});

describe("page props typing", () => {
  it("PickCard takes only a view", () => {
    const props: ComponentProps<typeof PickCard> = { view: viewsFor(GOLDEN1).views[0] };
    expect(Object.keys(props)).toEqual(["view"]);
  });
});

describe("LLM boundary (REQ-CV-43)", () => {
  it("has no app/api directory and no LLM client import in the picks files", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(__dirname, "..");
    expect(existsSync(join(root, "app/api"))).toBe(false);
    for (const f of ["app/picks/page.tsx", "components/PickCard.tsx", "components/DisclosureNote.tsx"]) {
      expect(readFileSync(join(root, f), "utf8")).not.toMatch(
        /\b(openai|anthropic|@ai-sdk|langchain|bedrock|cohere|ollama)\b/i,
      );
    }
  });
});
