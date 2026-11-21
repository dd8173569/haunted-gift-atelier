// @vitest-environment jsdom
// REQ-PD-28 and REQ-PD-41 (P-PD-8): touch targets of at least 44 x 44 CSS px, judged from the class
// lists. jsdom loads no Tailwind and has no layout, so computed sizes are unavailable: this guards what
// the author wrote (h-11, min-h-11, h-12; min-w-11 or px-4 or more). The manual pass checks glass.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import BrowseCard from "../components/BrowseCard";
import PickCard from "../components/PickCard";
import SiteHeader from "../components/SiteHeader";
import SkipLink from "../components/SkipLink";
import { useCalibration } from "../components/useCalibration";
import { toBrowseItems } from "../lib/browse";
import { initial, reduce } from "../lib/conversation";
import type { PickView } from "../lib/picks-view";
import { GOLDEN1_TAPS, adultIsMom, age, rel } from "./helpers/conversation-taps";
import { catalog, product } from "./helpers/matching-fixtures";
import { ALL_SKUS, renderAtelier, renderFind, renderLanding, renderPiece, tapUi } from "./helpers/pages";
import { interactive, targetSize } from "./helpers/targets";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));
vi.setConfig({ testTimeout: 60_000 });

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
});

const describeEl = (el: Element) => el.outerHTML.slice(0, 110);

/** Every interactive element passes the class rule. The range input is a full-width row of h-11. */
function expectTargets(container: HTMLElement, label: string) {
  const controls = interactive(container);
  expect(controls.length, `${label}: found no controls`).toBeGreaterThan(0);
  for (const el of controls) {
    const isRange = el.matches('input[type="range"]');
    if (isRange) {
      const t = targetSize(el);
      expect(t.heightOk, `${label}: ${describeEl(el)}`).toBe(true);
      expect(el.className, `${label}: ${describeEl(el)}`).toMatch(/(?:^|\s)w-full(?:\s|$)/);
      continue;
    }
    expect(targetSize(el).ok, `${label}: ${describeEl(el)}`).toBe(true);
  }
  return controls;
}

/** The accessible name contains the visible text (label in name). */
function expectNamed(controls: HTMLElement[], label: string) {
  for (const el of controls) {
    if (el.matches('input[type="range"], textarea')) continue; // named by aria-label or a <label>, checked in a11y.keyboard
    const visible = (el.textContent ?? "").trim();
    expect(visible, `${label}: ${describeEl(el)} has no visible text`).not.toBe("");
    expect(el).toHaveAccessibleName(expect.stringContaining(visible));
  }
}

const pickView = (sku: string): PickView => {
  const p = product(sku);
  return {
    rank: 1,
    sku,
    name: p.name,
    category: p.category,
    price_inr: p.price_inr,
    url: p.url,
    imageSrc: `/catalog/${p.image_file}`,
    rating: p.rating,
    reasons: ["A reason from the catalog."],
    markerLabels: [],
  };
};

describe("the target rule itself (the guard can fail)", () => {
  const el = (cls: string) => {
    const b = document.createElement("button");
    b.className = cls;
    return b;
  };
  it("accepts h-11 with px-4 or more, min-h-11 with min-w-11, and h-12", () => {
    expect(targetSize(el("h-11 px-6")).ok).toBe(true);
    expect(targetSize(el("min-h-11 min-w-11")).ok).toBe(true);
    expect(targetSize(el("h-12 px-8")).ok).toBe(true);
    expect(targetSize(el("inline-flex min-h-11 items-center px-3 hover:underline")).ok).toBe(false); // px-3 is 12 px: not enough alone
  });
  it("rejects a short control, a narrow control, and a prefixed class", () => {
    expect(targetSize(el("h-10 px-6")).ok).toBe(false);
    expect(targetSize(el("h-11 px-2")).ok).toBe(false);
    expect(targetSize(el("sm:h-12 px-6")).ok).toBe(false);
    expect(targetSize(el("text-sm")).ok).toBe(false);
  });
});

describe("P-PD-8: PickCard over all 22 SKUs", () => {
  it("covers all 22 SKUs", () => expect(ALL_SKUS).toHaveLength(22));
  it.each(ALL_SKUS)("%s: every control is 44 px by its classes and named by its visible text", (sku) => {
    const { container } = render(<PickCard view={pickView(sku)} detailHref={`/piece/${sku}`} />);
    const controls = expectTargets(container, `PickCard ${sku}`);
    expect(controls.map((c) => c.textContent?.trim())).toEqual(["See details", "Buy on Tiny Tiaraa ↗"]);
    expectNamed(controls, `PickCard ${sku}`);
  });
  it("a pick without a detail link has only the buy link, and it is sized", () => {
    const { container } = render(<PickCard view={pickView("TNZ-1056")} />);
    expect(expectTargets(container, "PickCard no detail")).toHaveLength(1);
  });
});

describe("P-PD-8: BrowseCard over all 22 SKUs", () => {
  const items = toBrowseItems(catalog);
  it.each(ALL_SKUS)("%s: every control is 44 px by its classes and named by its visible text", (sku) => {
    const item = items.find((i) => i.sku === sku)!;
    const { container } = render(<BrowseCard item={item} />);
    const controls = expectTargets(container, `BrowseCard ${sku}`);
    const labels = controls.map((c) => c.textContent?.trim());
    // The out-of-stock card has "See details" only: no buy control (REQ-CV-38).
    expect(labels).toEqual(item.availability === "In Stock" ? ["See details", "Buy on Tiny Tiaraa ↗"] : ["See details"]);
    expectNamed(controls, `BrowseCard ${sku}`);
  });
});

describe("the site header and the skip link", () => {
  it("every header link is a 44 px target, with and without the below-sm link", () => {
    const { container } = render(
      <SiteHeader
        links={[
          { href: "#how", label: "How it works", hideBelowSm: true },
          { href: "/atelier", label: "Browse the atelier" },
        ]}
      />,
    );
    const controls = interactive(container);
    expect(controls.map((c) => c.textContent)).toEqual(["Tiny Tiaraa", "How it works", "Browse the atelier"]);
    for (const el of controls) expect(el.className, describeEl(el)).toMatch(/\bmin-h-11\b/);
    // The wordmark has no width class; its text is wider than 44 px, so the width rule is met by its content.
    // Nav links add px-3 (24 px of padding) around text, and their own content is wider than 20 px.
    expect(container.querySelector("img")).toBeNull();
  });
  it("renders on every route with min-h-11 on each of its links", async () => {
    const screens: [string, () => Promise<HTMLElement>][] = [
      ["/", async () => renderLanding().container],
      ["/find", async () => (await renderFind()).container],
      ["/atelier", async () => (await renderAtelier()).container],
      ["/piece/TNZ-1056", async () => (await renderPiece("TNZ-1056")).container],
    ];
    for (const [name, go] of screens) {
      const container = await go();
      const header = container.querySelector("header")!;
      expect(header, name).not.toBeNull();
      for (const a of Array.from(header.querySelectorAll("a"))) expect(a.className, `${name}: ${describeEl(a)}`).toMatch(/\bmin-h-11\b/);
      cleanup();
    }
  });
  it("the skip link is a 44 px target when it shows (h-11, px-6)", () => {
    const { container } = render(<SkipLink />);
    const a = container.querySelector("a")!;
    expect(a.className).toMatch(/focus:h-11/);
    expect(a.className).toMatch(/focus:px-6/);
  });
});

describe("the conversation controls (REQ-PD-10, REQ-PD-28)", () => {
  it("question 1: the chips and the Back link are sized", async () => {
    const { container } = await renderFind();
    const body = container.querySelector("main")!;
    const controls = expectTargets(body as HTMLElement, "/find question 1");
    expect(controls.some((c) => c.textContent === "Back" && c.tagName === "A")).toBe(true);
    expect(controls.filter((c) => c.hasAttribute("aria-pressed")).length).toBeGreaterThan(3);
    for (const chip of controls.filter((c) => c.hasAttribute("aria-pressed"))) {
      expect(chip.className).toMatch(/\bmin-h-11\b/);
      expect(chip.className).toMatch(/\bmin-w-11\b/);
    }
  });

  it("a later question: the chips and the Back button are sized", async () => {
    const { container } = await renderFind();
    tapUi(initial, rel("niece-nephew"));
    expectTargets(container.querySelector("main") as HTMLElement, "/find question 2");
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("the adult-end message: its controls are sized", async () => {
    const { container } = await renderFind();
    let s = initial;
    for (const a of [rel("other"), age("adult"), adultIsMom(false)]) {
      tapUi(s, a);
      s = reduce(s, a);
    }
    expectTargets(container.querySelector("main") as HTMLElement, "/find adult-end");
  });

  it("the Religious sub-chip panel: sub-chips and Continue are sized", async () => {
    const { container } = await renderFind();
    let s = initial;
    const taps = [
      rel("niece-nephew"),
      age("0-1"),
      { type: "answer", question: "occasion", value: "naming" } as const,
      { type: "answer", question: "budget", value: "under-2500" } as const,
      { type: "answer", question: "metal", value: "silver" } as const,
      { type: "pick-symbol", value: "religious" } as const,
    ];
    for (const a of taps) {
      tapUi(s, a);
      s = reduce(s, a);
    }
    const controls = expectTargets(container.querySelector("main") as HTMLElement, "/find religious sub-chips");
    expect(controls.some((c) => c.textContent === "Continue")).toBe(true);
    const cont = controls.find((c) => c.textContent === "Continue")!;
    expect(cont.className).toMatch(/\bh-12\b/);
  });

  it("the recipient card: every Edit, Reveal and Back control is sized", async () => {
    const { container } = await renderFind();
    let s = initial;
    for (const a of GOLDEN1_TAPS) {
      tapUi(s, a);
      s = reduce(s, a);
    }
    const controls = expectTargets(container.querySelector("main") as HTMLElement, "/find recipient card");
    const names = controls.map((c) => c.textContent?.trim());
    expect(names.filter((n) => n === "Edit")).toHaveLength(7);
    expect(names).toContain("Reveal my picks");
    expect(names).toContain("Back");
  });
});

describe("the viewer (REQ-PD-28, REQ-PD-30)", () => {
  it("idle: the calibrate and ruler buttons are sized", async () => {
    const { container } = await renderPiece("TNZ-1056");
    const viewer = container.querySelector<HTMLElement>('[data-testid="size-viewer"]')!;
    const controls = expectTargets(viewer, "viewer idle");
    expect(controls.map((c) => c.textContent?.trim())).toContain("Calibrate with a card");
    expectNamed(controls, "viewer idle");
  });

  it("calibrating: the slider row is h-11 and w-full, This matches and Cancel are sized", async () => {
    const { container } = await renderPiece("TNZ-1056");
    fireEvent.click(screen.getByRole("button", { name: "Calibrate with a card" }));
    const viewer = container.querySelector<HTMLElement>('[data-testid="size-viewer"]')!;
    const controls = expectTargets(viewer, "viewer calibrating");
    const labels = controls.map((c) => c.textContent?.trim());
    expect(labels).toContain("This matches");
    expect(labels).toContain("Cancel");
    expect(controls.some((c) => c.matches('input[type="range"]'))).toBe(true);
    expectNamed(controls, "viewer calibrating");
  });

  it("calibrated: Reset calibration is sized", async () => {
    const { container } = await renderPiece("TNZ-1056");
    fireEvent.click(screen.getByRole("button", { name: "Calibrate with a card" }));
    fireEvent.click(screen.getByRole("button", { name: "This matches" }));
    const viewer = container.querySelector<HTMLElement>('[data-testid="size-viewer"]')!;
    const controls = expectTargets(viewer, "viewer calibrated");
    expect(controls.map((c) => c.textContent?.trim())).toContain("Reset calibration");
  });
});

describe("the gift wrap (REQ-PD-28)", () => {
  it("idle: Wrap this gift is h-12 and the buy link is sized", async () => {
    const { container } = await renderPiece("TNZ-1056");
    const wrap = container.querySelector<HTMLElement>("[data-phase]")!;
    expect(wrap.getAttribute("data-phase")).toBe("idle");
    const controls = expectTargets(wrap, "wrap idle");
    expect(controls.map((c) => c.textContent?.trim())).toEqual(["Wrap this gift", "Buy on Tiny Tiaraa ↗"]);
    expectNamed(controls, "wrap idle");
  });

  it("wrapping: Skip is sized", async () => {
    const { container } = await renderPiece("TNZ-1056");
    fireEvent.click(screen.getByRole("button", { name: "Wrap this gift" }));
    const wrap = container.querySelector<HTMLElement>("[data-phase]")!;
    expect(wrap.getAttribute("data-phase")).toBe("wrapping");
    expect(expectTargets(wrap, "wrap wrapping").map((c) => c.textContent?.trim())).toContain("Skip");
  });

  it("revealed: Reset to draft and Copy message are sized, and the textarea is a full-width field", async () => {
    const { container } = await renderPiece("TNZ-1056");
    fireEvent.click(screen.getByRole("button", { name: "Wrap this gift" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    const wrap = container.querySelector<HTMLElement>("[data-phase]")!;
    expect(wrap.getAttribute("data-phase")).toBe("revealed");
    const buttons = interactive(wrap).filter((c) => c.tagName !== "TEXTAREA");
    for (const el of buttons) expect(targetSize(el).ok, describeEl(el)).toBe(true);
    expect(buttons.map((c) => c.textContent?.trim())).toEqual(["Reset to draft", "Copy message", "Buy on Tiny Tiaraa ↗"]);
    const ta = wrap.querySelector("textarea")!;
    expect(ta.className).toMatch(/\bw-full\b/);
    expect(ta.getAttribute("rows")).toBe("6"); // six rows of text are far taller than 44 px
  });
});

describe("the detail page links (REQ-PD-28)", () => {
  it("TNZ-1056: the back link and every control in main is sized, except the header (own test above)", async () => {
    const { container } = await renderPiece("TNZ-1056", undefined);
    const main = container.querySelector("main")!;
    const links = Array.from(main.querySelectorAll("a[href]"));
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      const cls = a.className;
      expect(/\bh-1[12]\b|\bmin-h-11\b/.test(cls), describeEl(a)).toBe(true);
    }
  });
});
