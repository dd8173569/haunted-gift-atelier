// @vitest-environment jsdom
// Foundation components of the polish pass (T1.4, REQ-PD-05, 06, 14, 20) and the two test helpers they use.
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "./helpers/dom";
import ActionButton, { ACTION_SIZE_CLASSES, ACTION_VARIANT_CLASSES } from "../components/ActionButton";
import AtelierButton from "../components/AtelierButton";
import CobwebCorner from "../components/CobwebCorner";
import SiteHeader from "../components/SiteHeader";
import SkipLink from "../components/SkipLink";
import { focusOrder, headingOutline, outlineHasNoSkips } from "./helpers/outline";
import { interactive, targetSize } from "./helpers/targets";

/** The primary AtelierButton class string pinned in tests/picks.ui.test.tsx (first test of "AtelierButton external prop"). */
const PINNED_PRIMARY =
  "flex h-12 items-center justify-center rounded-full px-8 text-base font-medium transition-colors bg-plum text-pearl hover:bg-plum/85";

describe("the pinned primary string is the one picks.ui.test.tsx asserts", () => {
  it("appears verbatim in tests/picks.ui.test.tsx", () => {
    const picks = readFileSync(join(__dirname, "picks.ui.test.tsx"), "utf8");
    expect(picks).toContain(`"${PINNED_PRIMARY}"`);
  });
});

describe("SiteHeader (REQ-PD-05)", () => {
  const links = [
    { href: "#how", label: "How it works", hideBelowSm: true },
    { href: "/atelier", label: "Browse the atelier" },
  ];

  it("renders the wordmark as text in a link to /", () => {
    render(<SiteHeader links={links} />);
    const wordmark = screen.getByRole("link", { name: "Tiny Tiaraa" });
    expect(wordmark).toHaveAttribute("href", "/");
    expect(wordmark.textContent).toBe("Tiny Tiaraa");
    expect(wordmark.className).toContain("font-display");
    expect(wordmark.querySelector("img, svg")).toBeNull();
  });
  it('has a banner and a nav named "Primary" holding the given links with their hrefs', () => {
    render(<SiteHeader links={links} />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const inNav = within(nav).getAllByRole("link");
    expect(inNav.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["How it works", "#how"],
      ["Browse the atelier", "/atelier"],
    ]);
  });
  it("hides a link below sm only when asked", () => {
    render(<SiteHeader links={links} />);
    expect(screen.getByRole("link", { name: "How it works" }).className).toContain("hidden sm:inline-flex");
    expect(screen.getByRole("link", { name: "Browse the atelier" }).className).not.toContain("hidden");
  });
  it('renders one #new-tab-hint reading "Opens in a new tab"', () => {
    const { container } = render(<SiteHeader links={links} />);
    const hints = container.querySelectorAll("#new-tab-hint");
    expect(hints).toHaveLength(1);
    expect(hints[0].textContent).toBe("Opens in a new tab");
    expect(hints[0].className).toContain("sr-only");
    expect(hints[0].textContent).not.toMatch(/true[- ]size/i);
  });
  it("every link has min-h-11 and meets the target rule", () => {
    const { container } = render(<SiteHeader links={links} />);
    const all = container.querySelectorAll("a");
    expect(all).toHaveLength(3);
    for (const a of all) {
      expect(a.className, a.textContent ?? "").toContain("min-h-11");
      expect(targetSize(a).heightOk, a.textContent ?? "").toBe(true);
    }
  });
  it("accepts an empty link list", () => {
    render(<SiteHeader links={[]} />);
    expect(screen.getByRole("navigation", { name: "Primary" }).querySelectorAll("a")).toHaveLength(0);
  });
});

describe("SkipLink (REQ-PD-05)", () => {
  it('is an a[href="#main-content"] with the text, hidden until focused', () => {
    const { container } = render(<SkipLink />);
    const a = container.querySelector('a[href="#main-content"]');
    expect(a).not.toBeNull();
    expect(a?.textContent).toBe("Skip to main content");
    expect(a?.className).toContain("sr-only");
    expect(a?.className).toContain("focus:not-sr-only");
  });
  it("is the first focusable element when rendered before the header", () => {
    const { container } = render(
      <>
        <SkipLink />
        <SiteHeader links={[]} />
      </>,
    );
    expect(focusOrder(container)[0].textContent).toBe("Skip to main content");
  });
});

describe("ActionButton (REQ-PD-06)", () => {
  it('defaults to type="button" and the primary md classes', () => {
    render(<ActionButton>Go</ActionButton>);
    const b = screen.getByRole("button", { name: "Go" });
    expect(b).toHaveAttribute("type", "button");
    expect(b.className).toBe(
      "inline-flex items-center justify-center rounded-full font-medium transition-colors bg-plum text-pearl hover:bg-plum/85 h-11 px-6 text-sm",
    );
  });
  it("lets a caller choose another type", () => {
    render(<ActionButton type="submit">Send</ActionButton>);
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("type", "submit");
  });
  it("renders each variant's classes", () => {
    for (const variant of ["primary", "secondary", "quiet"] as const) {
      const { unmount } = render(<ActionButton variant={variant}>{variant}</ActionButton>);
      const b = screen.getByRole("button", { name: variant });
      for (const c of ACTION_VARIANT_CLASSES[variant].split(" ")) expect(b.classList.contains(c), `${variant} ${c}`).toBe(true);
      unmount();
    }
    expect(ACTION_VARIANT_CLASSES.secondary).toContain("border-plum/60");
    expect(ACTION_VARIANT_CLASSES.primary).toContain("bg-plum text-pearl");
    expect(ACTION_VARIANT_CLASSES.quiet).toContain("min-h-11 min-w-11");
  });
  it("lg is h-12 px-8 text-base; quiet ignores size", () => {
    render(
      <>
        <ActionButton size="lg">Large</ActionButton>
        <ActionButton variant="quiet" size="lg">
          Quiet
        </ActionButton>
      </>,
    );
    expect(screen.getByRole("button", { name: "Large" }).className).toContain(ACTION_SIZE_CLASSES.lg);
    const quiet = screen.getByRole("button", { name: "Quiet" });
    expect(quiet.className).not.toContain("h-12");
    expect(quiet.className).toContain("text-sm");
  });
  it("meets the target rule in every variant and size", () => {
    for (const variant of ["primary", "secondary", "quiet"] as const) {
      for (const size of ["md", "lg"] as const) {
        const { container, unmount } = render(
          <ActionButton variant={variant} size={size}>
            x
          </ActionButton>,
        );
        const t = targetSize(container.querySelector("button")!);
        expect(t.ok, `${variant} ${size}`).toBe(true);
        unmount();
      }
    }
  });
  it("passes disabled, aria attributes and a caller class through", () => {
    render(
      <ActionButton disabled aria-label="Edit age" className="w-full">
        Edit
      </ActionButton>,
    );
    const b = screen.getByRole("button", { name: "Edit age" });
    expect(b).toBeDisabled();
    expect(b.className.endsWith("w-full")).toBe(true);
  });
  it("uses tokens only: no colour literal in any class", () => {
    const all = [...Object.values(ACTION_VARIANT_CLASSES), ...Object.values(ACTION_SIZE_CLASSES)].join(" ");
    expect(all).not.toMatch(/#[0-9a-f]{3,8}|rgb|hsl|\[/i);
  });
});

describe("AtelierButton (REQ-PD-06, 20)", () => {
  it("primary className equals the string pinned in picks.ui.test.tsx", () => {
    render(<AtelierButton href="/atelier">Go</AtelierButton>);
    expect(screen.getByRole("link", { name: "Go" }).className).toBe(PINNED_PRIMARY);
  });
  it("secondary has border-plum/60 and no border-plum/30", () => {
    render(
      <AtelierButton href="/atelier" variant="secondary">
        Go
      </AtelierButton>,
    );
    const a = screen.getByRole("link", { name: "Go" });
    expect(a.className).toContain("border-plum/60");
    expect(a.className).not.toContain("border-plum/30");
  });
  it("has no aria-describedby by default", () => {
    render(<AtelierButton href="/atelier">Go</AtelierButton>);
    expect(screen.getByRole("link", { name: "Go" })).not.toHaveAttribute("aria-describedby");
  });
  it("describedBy yields aria-describedby and leaves the accessible name alone", () => {
    render(
      <>
        <h2 id="pick-X-name">Some piece</h2>
        <AtelierButton href="/piece/X" describedBy="pick-X-name">
          See details
        </AtelierButton>
      </>,
    );
    const a = screen.getByRole("link", { name: "See details" });
    expect(a).toHaveAttribute("aria-describedby", "pick-X-name");
    expect(a).toHaveAccessibleDescription("Some piece");
  });
  it("external adds new-tab-hint, after describedBy when both are given", () => {
    render(
      <>
        <SiteHeader links={[]} />
        <h2 id="pick-X-name">Some piece</h2>
        <AtelierButton href="https://example.com/p" external describedBy="pick-X-name">
          Buy
        </AtelierButton>
        <AtelierButton href="https://example.com/q" external>
          Buy alone
        </AtelierButton>
      </>,
    );
    const both = screen.getByRole("link", { name: "Buy" });
    expect(both).toHaveAttribute("aria-describedby", "pick-X-name new-tab-hint");
    expect(both).toHaveAccessibleDescription("Some piece Opens in a new tab");
    expect(screen.getByRole("link", { name: "Buy alone" })).toHaveAttribute("aria-describedby", "new-tab-hint");
  });
  it("keeps href verbatim and the new-tab attributes", () => {
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

describe("CobwebCorner (REQ-PD-14)", () => {
  it("is decorative: aria-hidden, no pointer events, plum stroke, low opacity, no text", () => {
    const { container } = render(<CobwebCorner />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.getAttribute("class")).toContain("pointer-events-none");
    expect(svg.getAttribute("class")).toContain("stroke-plum");
    expect(svg.getAttribute("class")).toContain("opacity-20");
    expect(svg.textContent).toBe("");
    expect(svg.getAttribute("class")).toContain("left-0");
  });
  it("mirrors on the right", () => {
    const { container } = render(<CobwebCorner side="right" />);
    const cls = container.querySelector("svg")!.getAttribute("class")!;
    expect(cls).toContain("right-0");
    expect(cls).toContain("-scale-x-100");
  });
});

describe("test helpers", () => {
  it("targetSize reads unprefixed height and width utilities only", () => {
    const el = (c: string) => {
      const d = document.createElement("a");
      d.setAttribute("class", c);
      return d;
    };
    expect(targetSize(el("h-12 px-8")).ok).toBe(true);
    expect(targetSize(el("min-h-11 min-w-11")).ok).toBe(true);
    expect(targetSize(el("h-10 px-8")).heightOk).toBe(false);
    expect(targetSize(el("h-11 px-3")).widthOk).toBe(false);
    expect(targetSize(el("sm:h-12 hover:min-h-11 px-8")).heightOk).toBe(false);
    expect(targetSize(el("")).ok).toBe(false);
    expect(targetSize(el("h-11 px-8")).heightStep).toBe(11);
  });
  it("interactive finds links, buttons, inputs and textareas but not hidden inputs", () => {
    const { container } = render(
      <div>
        <a href="/x">a</a>
        <a>no href</a>
        <button>b</button>
        <input type="hidden" />
        <input type="range" />
        <textarea />
      </div>,
    );
    expect(interactive(container).map((e) => e.tagName)).toEqual(["A", "BUTTON", "INPUT", "TEXTAREA"]);
  });
  it("headingOutline and outlineHasNoSkips", () => {
    const { container } = render(
      <div>
        <h1>One</h1>
        <h2>Two</h2>
        <h2 aria-hidden="true">
          <span>hidden</span>
        </h2>
        <h3>Three</h3>
      </div>,
    );
    const outline = headingOutline(container);
    expect(outline.map((h) => [h.level, h.text])).toEqual([
      [1, "One"],
      [2, "Two"],
      [3, "Three"],
    ]);
    expect(outlineHasNoSkips(outline)).toBe(true);
    expect(outlineHasNoSkips([{ level: 1, text: "a", id: null }, { level: 3, text: "b", id: null }])).toBe(false);
    expect(outlineHasNoSkips([{ level: 2, text: "a", id: null }])).toBe(false);
  });
  it("focusOrder is DOM order and skips tabindex=-1 and disabled controls", () => {
    const { container } = render(
      <div>
        <button>first</button>
        <h1 tabIndex={-1}>heading</h1>
        <button disabled>off</button>
        <a href="/x">link</a>
        <div tabIndex={0}>custom</div>
      </div>,
    );
    expect(focusOrder(container).map((e) => e.textContent)).toEqual(["first", "link", "custom"]);
  });
});
