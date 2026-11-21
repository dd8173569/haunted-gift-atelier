// @vitest-environment jsdom
// REQ-PD-38, P-PD-6: axe-core over the screen matrix of design §7.2, zero violations per state.
// Each state is its own `it`, so a failure names the screen. Pages are async server components:
// the page function is called and the element it returns is rendered (helpers/pages.tsx).
//
// Axe runs here with color-contrast, target-size and scrollable-region-focusable off (helpers/axe.ts
// gives each reason). Page-level rules (landmark-one-main, page-has-heading-one, region,
// document-title, html-has-lang, skip-link, meta-viewport) cannot judge a fragment rendered in a
// container, so they are NOT asserted through axe; tests/a11y.keyboard.test.tsx covers them with
// role and query assertions, and the root layout is checked statically.
import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import { reduce, initial, type Action } from "../lib/conversation";
import { formatViolations, runAxe } from "./helpers/axe";
import { headingOutline, outlineHasNoSkips } from "./helpers/outline";
import {
  GOLDEN1_TAPS,
  GOLDEN2_TAPS,
  GOLDEN3_TAPS,
  adultIsMom,
  age,
  budget,
  metal,
  occ,
  rel,
  sym,
} from "./helpers/conversation-taps";
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

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
});

/** P-PD-6 (A6): one h1, no skipped heading level, one main, in every state of the matrix. */
function expectOutline(container: HTMLElement) {
  const outline = headingOutline(container);
  expect(outline.filter((h) => h.level === 1), JSON.stringify(outline)).toHaveLength(1);
  expect(outline[0]?.level, "the first heading is the h1").toBe(1);
  expect(outlineHasNoSkips(outline), JSON.stringify(outline)).toBe(true);
  expect(container.querySelectorAll("main")).toHaveLength(1);
}

async function expectClean(container: HTMLElement) {
  expectOutline(container);
  const violations = await runAxe(container);
  expect(violations, formatViolations(violations)).toEqual([]);
}

/** Renders /find, then performs the taps through the real controls. */
async function findAfter(taps: Action[]) {
  const { container } = await renderFind();
  let s = initial;
  for (const a of taps) {
    tapUi(s, a);
    s = reduce(s, a);
  }
  return container;
}

describe("axe: landing", () => {
  it("/ default", async () => {
    const { container } = renderLanding();
    await expectClean(container);
  });
});

describe("axe: /find", () => {
  const steps: [string, Action[]][] = [
    ["question 1 relationship", []],
    ["question 2 age", [rel("niece-nephew")]],
    ["question 1b adult check", [rel("other"), age("adult")]],
    ["question 3 occasion", [rel("niece-nephew"), age("0-1")]],
    ["question 4 budget", [rel("niece-nephew"), age("0-1"), occ("naming")]],
    ["question 5 metal", [rel("niece-nephew"), age("0-1"), occ("naming"), budget("under-2500")]],
    [
      "question 6 symbols",
      [rel("niece-nephew"), age("0-1"), occ("naming"), budget("under-2500"), metal("silver")],
    ],
    [
      "symbols with the Religious sub-chip panel open",
      [rel("niece-nephew"), age("0-1"), occ("naming"), budget("under-2500"), metal("silver"), sym("religious")],
    ],
    [
      "question 7 category",
      [rel("niece-nephew"), age("0-1"), occ("naming"), budget("under-2500"), metal("silver"), sym("any")],
    ],
    ["adult-end message", [rel("other"), age("adult"), adultIsMom(false)]],
    ["recipient card (golden 1)", GOLDEN1_TAPS],
  ];
  it.each(steps)("%s", async (_name, taps) => {
    await expectClean(await findAfter(taps));
  });

  it("recipient card resumed from ?m= (golden 3, with sub-chip answers)", async () => {
    const { container } = await renderFind({ m: modelParamFor(GOLDEN3_TAPS) });
    expect(screen.getAllByRole("button", { name: /^Edit / }).length).toBeGreaterThan(0);
    await expectClean(container);
  });

  it("incomplete-link notice", async () => {
    const { container } = await renderFind({ notice: "incomplete" });
    expect(screen.getByRole("status")).toBeInTheDocument();
    await expectClean(container);
  });

  it("card while editing a question (edit returns to the step)", async () => {
    const { container } = await renderFind({ m: modelParamFor(GOLDEN1_TAPS) });
    fireEvent.click(screen.getAllByRole("button", { name: /^Edit / })[0]);
    await expectClean(container);
  });
});

describe("axe: /picks", () => {
  it.each([
    ["golden 1: three picks", GOLDEN1_TAPS],
    ["golden 2: fewer picks, shortfall note and browse link", GOLDEN2_TAPS],
    ["golden 3: three picks with disclosures", GOLDEN3_TAPS],
  ] as [string, Action[]][])("%s", async (_n, taps) => {
    const { container } = await renderPicks(modelParamFor(taps));
    await expectClean(container);
  });
});

describe("axe: /atelier", () => {
  it("default, 22 cards", async () => {
    const { container } = await renderAtelier();
    expect(container.querySelectorAll("article[data-sku]")).toHaveLength(22);
    await expectClean(container);
  });
  it("one filter combination", async () => {
    const { container } = await renderAtelier({ metal: "silver", category: "bracelet" });
    await expectClean(container);
  });
  it("empty state", async () => {
    const { container } = await renderAtelier({ category: "tabeez", metal: "gold" });
    expect(screen.getByText("No piece matches those filters.")).toBeInTheDocument();
    await expectClean(container);
  });
  it("the out-of-stock card (TNZ-1058) among the 22", async () => {
    const { container } = await renderAtelier();
    expect(container.querySelector('article[data-sku="TNZ-1058"]')).not.toBeNull();
    await expectClean(container);
  });
});

describe("axe: /piece/[sku], all 22 SKUs idle and approximate", () => {
  it.each(ALL_SKUS)("%s", async (sku) => {
    const { container } = await renderPiece(sku);
    await expectClean(container);
  });
});

describe("axe: /piece/[sku], representative states", () => {
  const REPS = ["TNZ-1056", "TPN-1459", "TPN-1206", "TBZ-1013", "THP-1001", "TPN-1149"];

  it.each([...REPS, "TNZ-1058"])("%s with a stored calibration", async (sku) => {
    storeCalibration();
    const { container } = await renderPiece(sku);
    expect(screen.getByText("Calibrated to your screen")).toBeInTheDocument();
    await expectClean(container);
  });

  it.each([...REPS, "TNZ-1058"])("%s with the calibration slider open", async (sku) => {
    const { container } = await renderPiece(sku);
    fireEvent.click(screen.getByRole("button", { name: "Calibrate with a card" }));
    expect(screen.getByRole("slider", { name: "Card outline width" })).toBeInTheDocument();
    await expectClean(container);
  });

  it.each(REPS)("%s with the wrap in the wrapping phase", async (sku) => {
    const { container } = await renderPiece(sku);
    fireEvent.click(screen.getByRole("button", { name: "Wrap this gift" }));
    expect(screen.getByText("Wrapping your gift…")).toBeInTheDocument();
    await expectClean(container);
  });

  it.each(REPS)("%s with the wrap revealed", async (sku) => {
    const { container } = await renderPiece(sku);
    fireEvent.click(screen.getByRole("button", { name: "Wrap this gift" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByText("Your gift is wrapped")).toBeInTheDocument();
    await expectClean(container);
  });

  it("recipient context from ?m= (back link to picks, golden 1)", async () => {
    const { container } = await renderPiece("TBZ-1013", modelParamFor(GOLDEN1_TAPS));
    await expectClean(container);
  });
});

describe("axe: piece not-found", () => {
  it("PieceNotFound", async () => {
    const { container } = renderNotFound();
    await expectClean(container);
  });
});
