// @vitest-environment jsdom
// Copy lock and brand invariants after the polish pass (REQ-PD-15, 16, 42, 63; P-PD-10).
// Every pinned string is written here as a literal, so a change to the source string fails this file
// even when the source constant changes with it. Pieces are rendered for all 22 SKUs.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import { useCalibration } from "../components/useCalibration";
import { ADULT_END_MESSAGE, QUESTIONS, initial, reduce } from "../lib/conversation";
import { FIT_CHECK_LINE } from "../lib/safety";
import { STORAGE_KEY, serializeCalibration } from "../lib/true-size";
import { GOLDEN1_TAPS, GOLDEN2_TAPS, GOLDEN3_TAPS, adultIsMom, age, rel } from "./helpers/conversation-taps";
import { product } from "./helpers/matching-fixtures";
import {
  ALL_SKUS,
  modelParamFor,
  renderAtelier,
  renderFind,
  renderLanding,
  renderNotFound,
  renderPicks,
  renderPiece,
  storeCalibration,
  tapUi,
} from "./helpers/pages";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));
vi.setConfig({ testTimeout: 60_000 });

const FOOTNOTE = "Price as listed on tinytiaraa.com on 21 Nov 2026 — check the store for the current price.";
const APPROX = "Approximate size — calibrate with a card for true size.";
const FIT = "A fit check from the atelier — guidance, not a safety certification. When in doubt, check with the brand or the child's parents.";
const NO_CERT = "No certifications are stated on this product's page.";
const PHOTO_NOTE = "Photo as listed — shown enlarged, not to scale.";
const BUY = "Buy on Tiny Tiaraa ↗";
const OOS_NOTE = "This piece is out of stock on the listing.";
const NO_RECIPIENT = "No recipient selected — age fit shown against all listed age groups";
const PRIVACY = "Your message stays on this page. It is not sent to us or to the store.";
const OOS_SKU = "TNZ-1058";

// The calibration store keeps an in-memory copy besides localStorage; a throwaway harness resets both.
function ResetStore() {
  const { reset } = useCalibration();
  return <button onClick={reset}>reset-store</button>;
}
beforeEach(() => {
  const { unmount } = render(<ResetStore />);
  fireEvent.click(screen.getByText("reset-store"));
  unmount();
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ helpers */

const text = (c: HTMLElement) => (c.textContent ?? "").replace(/\s+/g, " ");
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/** Visible text plus every attribute a screen reader can speak, for the "true size" count. */
function spoken(c: HTMLElement): string {
  const attrs = Array.from(c.querySelectorAll<HTMLElement>("[aria-label],[aria-valuetext],[aria-description],[title],[alt]")).flatMap((el) =>
    ["aria-label", "aria-valuetext", "aria-description", "title", "alt"].map((a) => el.getAttribute(a) ?? ""),
  );
  return `${text(c)} ${attrs.join(" ")}`;
}
const trueSizeCount = (c: HTMLElement) => (spoken(c).match(/true[- ]size/gi) ?? []).length;

// "off" alone is not a discount word ("turn off 'Fit to page'" is pinned ruler copy) and a percent sign alone is not
// either ("75% gold" is a metal fact), so the pattern names the discount forms: "% off", "off ₹", "save ₹", "was ₹".
const DISCOUNT = /\bdiscount|\bMRP\b|\bsave\b|\bsaving|\bsale\b|\bdeal\b|\bcoupon|\bpromo|%\s*off\b|\boff\s*(?:₹|\d)|\bwas\s*₹|\bnow\s*₹|\bstrike|\bmarked down|\bslashed/i;
// The landing trust strip says "No discounts invented" (REQ-SV-29): a promise, not a discount. It is the one allowed phrase.
const TRUST_PHRASE = "No discounts invented";
function expectNoDiscount(c: HTMLElement, where: string) {
  expect(text(c).split(TRUST_PHRASE).join(""), `${where}: discount wording`).not.toMatch(DISCOUNT);
  if (where !== "/") expect(text(c), `${where}: the landing trust phrase belongs to the landing only`).not.toContain(TRUST_PHRASE);
  expect(c.querySelectorAll("s, del, strike"), `${where}: a strike-through element`).toHaveLength(0);
  expect(c.innerHTML, `${where}: a line-through class`).not.toMatch(/line-through/);
}

/**
 * A rupee amount that is a budget band the user picks or that a disclosure names, not a listed price:
 * "Under ₹2,500", "₹15,000–₹25,000", "₹25,000+", or any sentence about "budget". A listed price is a
 * single bare amount ("₹18,299"). Bands are chip labels, the recipient card, and relaxation disclosures
 * (pinned copy, REQ-PD-16), which cannot take a footnote; see the evidence log, Q-PD18.
 */
const isBudgetBand = (s: string) => /budget/i.test(s) || /^\s*(?:Under\s+|Over\s+)?₹[\d,]+(?:\s*[–-]\s*₹[\d,]+|\+)?\s*$/.test(s) && !/^\s*₹[\d,]+\s*$/.test(s);

/** Every listed-price text node (a rupee sign, not a budget band) sits inside a [data-price-region] with the exact footnote. */
function expectFootnoteOnEveryPrice(c: HTMLElement, where: string) {
  const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
  let prices = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent ?? "";
    if (!t.includes("₹") || isBudgetBand(t)) continue;
    prices += 1;
    const region = n.parentElement?.closest("[data-price-region]");
    expect(region, `${where}: "${t}" has no price region`).not.toBeNull();
    expect(text(region as HTMLElement), `${where}: region lacks the footnote`).toContain(FOOTNOTE);
  }
  return prices;
}

const FILTER_OR_OVERLAY =
  /(?:^|[\s:])(?:opacity-\S+|grayscale\S*|blur\S*|sepia\S*|brightness-\S+|contrast-\S+|saturate-\S+|hue-rotate-\S+|invert\S*|filter|backdrop-\S+|mix-blend-\S+|scale-\S+|-?rotate-\S+|-?skew-\S+|bg-gradient-\S+|bg-linear-\S+)(?=\s|$)/;

/** A catalog photo is shown unaltered: object-contain, no filter class up to its card, no overlay beside it. */
function expectCleanPhotos(c: HTMLElement, where: string) {
  const imgs = Array.from(c.querySelectorAll("img"));
  for (const img of imgs) {
    expect(img.className, `${where}: ${img.getAttribute("src")}`).toMatch(/\bobject-contain\b/);
    expect(img.className, `${where}: photo class`).not.toMatch(FILTER_OR_OVERLAY);
    expect(img.className, `${where}: photo is cropped`).not.toMatch(/\bobject-(?:cover|fill|none)\b/);
    // Ancestors up to (and including) the card or section.
    for (let el: HTMLElement | null = img.parentElement; el && el !== c; el = el.parentElement) {
      expect(el.className, `${where}: ancestor <${el.tagName.toLowerCase()}> of a photo`).not.toMatch(FILTER_OR_OVERLAY);
      if (el.matches("article, section, main")) break;
    }
    // Nothing is laid over it: its wrapper holds the photo and nothing else, and carries no text.
    const wrapper = img.parentElement!;
    expect(Array.from(wrapper.children), `${where}: a sibling next to a photo`).toEqual([img]);
    expect((wrapper.textContent ?? "").trim(), `${where}: text over a photo`).toBe("");
  }
  return imgs.length;
}

/** The only images are catalog photos: /catalog/<SKU>.<ext>, alt equal to a catalog name. */
function expectNoLogo(c: HTMLElement, where: string) {
  for (const img of Array.from(c.querySelectorAll("img"))) {
    const src = img.getAttribute("src") ?? "";
    expect(src, `${where}: image ${src}`).toMatch(/^\/catalog\/[A-Z]{3}-\d{4}\.(?:png|jpe?g)$/);
    expect(`${src} ${img.getAttribute("alt")}`, where).not.toMatch(/logo|watermark|tiny\s*tiaraa/i);
  }
  expect(c.querySelectorAll("svg image, picture, canvas, [style*='background-image']"), `${where}: a non-photo image`).toHaveLength(0);
}

/* ------------------------------------------------- the 22 pieces, approximate */

describe("P-PD-10: /piece/[sku], all 22 SKUs, approximate mode", () => {
  it("covers all 22 SKUs", () => expect(ALL_SKUS).toHaveLength(22));

  it.each(ALL_SKUS)("%s", async (sku) => {
    const p = product(sku);
    const { container } = await renderPiece(sku);
    const t = text(container);
    const inStock = p.availability === "In Stock";

    // Pinned strings (REQ-PD-16)
    expect(count(t, FIT), "fit-check line, once").toBe(1);
    expect(FIT_CHECK_LINE).toBe(FIT);
    expect(count(t, NO_CERT), "no-certifications line, once").toBe(1);
    expect(count(t, PHOTO_NOTE), "photo note, once").toBe(1);
    expect(count(t, NO_RECIPIENT), "no-recipient age line").toBeGreaterThanOrEqual(1);
    expect(t).toContain("Size on your screen");
    expect(t).toContain("Calibrate with a card");
    expect(t).toContain("Print a 1:1 paper ruler");
    expect(t).not.toMatch(/\bsafe\b|\bunsafe\b|hypoallergenic|nickel-free|BIS[ -]certified/i);
    expect(screen.getAllByRole("heading", { level: 1 })[0]).toHaveTextContent(p.name);

    // The "true size" rule: exactly once, inside the approximate label
    expect(count(t, APPROX), "approximate label, once").toBe(1);
    expect(trueSizeCount(container), "true size, once").toBe(1);

    // Footnote on every price
    expect(expectFootnoteOnEveryPrice(container, sku)).toBeGreaterThanOrEqual(1);

    // Brand
    expectNoDiscount(container, sku);
    expect(expectCleanPhotos(container, sku)).toBeGreaterThanOrEqual(1);
    expectNoLogo(container, sku);

    // Buy control and gift wrap
    const buy = screen.queryAllByRole("link", { name: /Buy on Tiny Tiaraa/ });
    if (inStock) {
      expect(count(t, BUY)).toBeGreaterThanOrEqual(1);
      expect(t).toContain("Wrap this gift");
      expect(buy.length).toBeGreaterThanOrEqual(1);
      for (const a of buy) expect(a.getAttribute("href")).toBe(p.url); // verbatim catalog url
    } else {
      expect(buy, `${sku}: a buy control on an out-of-stock piece`).toHaveLength(0);
      expect(t).not.toContain("Wrap this gift");
      expect(t).not.toContain("tinytiaraa.com/");
      expect(t).toContain(OOS_NOTE);
      expect(t).toContain("Out of stock");
      expect(container.querySelector('a[href^="https://"]')).toBeNull();
    }
  });
});

describe("P-PD-10: /piece/[sku], all 22 SKUs, stale mode", () => {
  it.each(ALL_SKUS)("%s", async (sku) => {
    // A calibration stored at device pixel ratio 2 is stale where the ratio is 1.
    window.localStorage.setItem(STORAGE_KEY, serializeCalibration({ pxPerMm: 4, dpr: 2 }));
    const { container } = await renderPiece(sku);
    const t = text(container);
    await waitFor(() => expect(t.length).toBeGreaterThan(0));
    await waitFor(() => expect(text(container)).toContain("sizes are approximate again"));
    const now = text(container);
    expect(count(now, APPROX), "approximate label, once").toBe(1);
    expect(trueSizeCount(container), "true size, once").toBe(1);
    expect(now).not.toContain("Calibrated to your screen");
    expectNoDiscount(container, sku);
    expectFootnoteOnEveryPrice(container, sku);
  });
});

describe("the calibrated and calibrating modes keep the label rules", () => {
  it("calibrating (slider open): the approximate label stays once and nothing new says true size", async () => {
    const { container } = await renderPiece("TNZ-1056");
    fireEvent.click(screen.getByRole("button", { name: "Calibrate with a card" }));
    expect(count(text(container), APPROX)).toBe(1);
    expect(trueSizeCount(container)).toBe(1);
    expect(text(container)).toContain("This matches");
    expect(text(container)).toContain("Cancel");
  });
  it("calibrated: the approximate label is gone and 'Calibrated to your screen' shows with 'Reset calibration'", async () => {
    storeCalibration(4);
    const { container } = await renderPiece("TNZ-1056");
    await waitFor(() => expect(text(container)).toContain("Calibrated to your screen"));
    expect(text(container)).not.toContain(APPROX);
    expect(text(container)).toContain("Reset calibration");
    expect(screen.queryByText("Calibrate with a card")).toBeNull();
  });
});

/* --------------------------------------------------------------- gift wrap */

describe("gift wrap strings (REQ-GP-14 to 20)", () => {
  it("idle, wrapping and revealed carry the pinned lines", async () => {
    const { container } = await renderPiece("TNZ-1056");
    expect(screen.getByRole("button", { name: "Wrap this gift" })).toBeInTheDocument();
    expect(screen.getByTestId("wrap-status")).toHaveTextContent("");

    fireEvent.click(screen.getByRole("button", { name: "Wrap this gift" }));
    expect(screen.getByTestId("wrap-status")).toHaveTextContent("Wrapping your gift…");
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByTestId("wrap-status")).toHaveTextContent("Your gift is wrapped");
    const t = text(container);
    for (const s of ["Gift message — a draft you can edit", "Reset to draft", "Copy message", PRIVACY, BUY]) {
      expect(t, s).toContain(s);
    }
    expectNoDiscount(container, "revealed");
    expect(trueSizeCount(container)).toBe(1);
  });

  it("Copied and the manual fallback line", async () => {
    await renderPiece("TNZ-1056");
    fireEvent.click(screen.getByRole("button", { name: "Wrap this gift" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    const ok = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: ok } });
    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    await waitFor(() => expect(screen.getByText("Copied")).toBeInTheDocument());

    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("no")) } });
    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    await waitFor(() => expect(screen.getByText("Select the text and copy it yourself.")).toBeInTheDocument());
    Reflect.deleteProperty(navigator, "clipboard");
  });
});

/* ------------------------------------------------------------------ /atelier */

describe("P-PD-10: /atelier (22 cards)", () => {
  it("shows 22 cards, 21 buy links, one out-of-stock card without a buy control", async () => {
    const { container } = await renderAtelier();
    const cards = Array.from(container.querySelectorAll<HTMLElement>("article[data-sku]"));
    expect(cards).toHaveLength(22);
    expect(cards.map((c) => c.dataset.sku).sort()).toEqual([...ALL_SKUS].sort());

    const t = text(container);
    expect(count(t, "Out of stock")).toBe(1);
    expect(screen.getAllByRole("link", { name: /Buy on Tiny Tiaraa/ })).toHaveLength(21);
    expect(count(t, "See details")).toBe(22);

    const oos = container.querySelector<HTMLElement>(`article[data-sku="${OOS_SKU}"]`)!;
    expect(oos).toHaveTextContent("Out of stock");
    expect(oos.querySelectorAll("a")).toHaveLength(1);
    expect(oos).not.toHaveTextContent("Buy on Tiny Tiaraa");
    expect(oos.querySelector('a[href^="https://"]')).toBeNull();
    expect(oos.className).toContain("bg-plum/5");
    expect(oos.className).toContain("text-plum/75");
    for (const c of cards) {
      if (c !== oos) expect(c.className).not.toContain("bg-plum/5");
    }

    expect(expectFootnoteOnEveryPrice(container, "/atelier")).toBe(22);
    expect(count(t, FOOTNOTE)).toBeGreaterThanOrEqual(1);
    expectNoDiscount(container, "/atelier");
    expect(expectCleanPhotos(container, "/atelier")).toBe(22);
    expectNoLogo(container, "/atelier");
  });

  it("the out-of-stock card's photo is the exact catalog file with no filter on it or its card", async () => {
    const { container } = await renderAtelier();
    const oos = container.querySelector<HTMLElement>(`article[data-sku="${OOS_SKU}"]`)!;
    const img = oos.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(`/catalog/${product(OOS_SKU).image_file}`);
    expect(img.getAttribute("alt")).toBe(product(OOS_SKU).name);
    expect(oos.className).not.toMatch(FILTER_OR_OVERLAY);
  });

  it.each([
    ["metal gold", { metal: "gold" }],
    ["tabeez in gold (empty)", { category: "tabeez", metal: "gold" }],
  ])("filtered view (%s) keeps the rules", async (_n, sp) => {
    const { container } = await renderAtelier(sp);
    expectNoDiscount(container, "/atelier filtered");
    expectFootnoteOnEveryPrice(container, "/atelier filtered");
    expectCleanPhotos(container, "/atelier filtered");
  });
});

/* -------------------------------------------------------------------- /picks */

describe("P-PD-10: /picks, the three golden models", () => {
  it.each([
    ["golden 1", GOLDEN1_TAPS],
    ["golden 2", GOLDEN2_TAPS],
    ["golden 3", GOLDEN3_TAPS],
  ])("%s", async (_n, taps) => {
    const { container } = await renderPicks(modelParamFor(taps));
    const t = text(container);
    const cards = container.querySelectorAll("article");
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(cards.length).toBeLessThanOrEqual(3);
    expect(count(t, "Why this one")).toBe(cards.length);
    expect(count(t, "See details")).toBe(cards.length);
    expect(count(t, BUY)).toBe(cards.length);
    expect(t).toContain("Change my answers");
    expect(t).not.toContain(OOS_NOTE);
    expect(t).not.toContain("Out of stock"); // an out-of-stock piece is never picked
    expect(expectFootnoteOnEveryPrice(container, "/picks")).toBeGreaterThanOrEqual(cards.length);
    for (const card of Array.from(cards)) {
      expect(card.hasAttribute("data-price-region"), "each pick card is its own price region").toBe(true);
      expect(text(card)).toContain(FOOTNOTE);
    }
    expectNoDiscount(container, "/picks");
    expect(expectCleanPhotos(container, "/picks")).toBe(cards.length);
    expectNoLogo(container, "/picks");
    expect(trueSizeCount(container)).toBe(0); // the size rule is the viewer's, not a pick card's
  });

  it("golden 2 shows the shortfall note and the browse link", async () => {
    const { container } = await renderPicks(modelParamFor(GOLDEN2_TAPS));
    expect(container.querySelectorAll("article")).toHaveLength(2);
    expect(text(container)).toContain("Browse the full atelier");
  });

  it("golden 3 discloses how the search widened", async () => {
    const { container } = await renderPicks(modelParamFor(GOLDEN3_TAPS));
    expect(text(container)).toContain("How we widened the search");
  });
});

/* --------------------------------------------------------- landing, find, etc. */

describe("landing, /find and the not-found page", () => {
  it("the landing page: footnote, no discount, no logo image, the wordmark as text", () => {
    const { container } = renderLanding();
    const t = text(container);
    expect(t).toContain(FOOTNOTE);
    expect(t).toContain("Tiny Tiaraa");
    expectNoDiscount(container, "/");
    expect(container.querySelectorAll("img, svg image")).toHaveLength(0);
    expect(trueSizeCount(container)).toBe(0);
    expectFootnoteOnEveryPrice(container, "/");
  });

  it("/find question 1 carries 'Question 1 of 6' and its prompt", async () => {
    const { container } = await renderFind();
    expect(text(container)).toContain("Question 1 of 6");
    expect(text(container)).toContain(QUESTIONS.relationship.prompt);
    expect(QUESTIONS.relationship.prompt).toBe("Who are we finding a gift for?");
  });

  it("the six prompts and the adult-end message are pinned", () => {
    expect(QUESTIONS.age.prompt).toBe("How old is the little one?");
    expect(QUESTIONS.occasion.prompt).toBe("What's the occasion?");
    expect(QUESTIONS.budget.prompt).toBe("What shall we spend?");
    expect(QUESTIONS.metal.prompt).toBe("Gold or silver?");
    expect(QUESTIONS.symbols.prompt).toBe("Any symbols you'd love — or like to avoid?");
    expect(QUESTIONS.category.prompt).toBe("What kind of piece?");
    expect(ADULT_END_MESSAGE).toBe("This atelier specialises in babies, kids, and Mom.");
  });

  it("the adult-end screen shows ADULT_END_MESSAGE", async () => {
    const { container } = await renderFind();
    let s = initial;
    for (const a of [rel("other"), age("adult"), adultIsMom(false)]) {
      tapUi(s, a);
      s = reduce(s, a);
    }
    expect(text(container)).toContain("This atelier specialises in babies, kids, and Mom.");
  });

  it("the recipient card shows 'Reveal my picks'", async () => {
    const { container } = await renderFind();
    let s = initial;
    for (const a of GOLDEN1_TAPS) {
      tapUi(s, a);
      s = reduce(s, a);
    }
    expect(text(container)).toContain("Reveal my picks");
    expectNoDiscount(container, "/find card");
  });

  it("the incomplete-link notice is a status region", async () => {
    await renderFind({ notice: "incomplete" });
    expect(screen.getByRole("status")).toHaveTextContent("That link did not carry a complete recipient, so let's start again.");
  });

  it("the piece not-found page says 'We couldn't find that piece.' and has no photo or price", () => {
    const { container } = renderNotFound();
    expect(text(container)).toContain("We couldn't find that piece.");
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(text(container)).not.toContain("₹");
  });
});
