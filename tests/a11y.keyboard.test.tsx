// @vitest-environment jsdom
// REQ-PD-39 (and P-PD-7, P-PD-8): role and query assertions where axe cannot judge. Outline and
// landmarks, the skip link, tabindex rules, focus hand-offs, live regions, names and descriptions,
// alt text, the slider, and drawing labels. Testing Library queries only; no axe here.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import fc from "fast-check";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import RootLayout from "../app/layout";
import BrowseCard from "../components/BrowseCard";
import PickCard from "../components/PickCard";
import SkipLink from "../components/SkipLink";
import { useCalibration } from "../components/useCalibration";
import { catalog as storeCatalog } from "../lib/catalog-store";
import {
  ADULT_END_MESSAGE,
  QUESTIONS,
  describeModel,
  initial,
  momSkipNote,
  reduce,
  toModel,
  type Action,
  type ConversationState,
} from "../lib/conversation";
import { WRAP_REVEAL_MS } from "../lib/gift-message";
import { toBrowseItems } from "../lib/browse";
import type { PickView } from "../lib/picks-view";
import { buildSizeSpec } from "../lib/size-spec";
import { GOLDEN1_TAPS, GOLDEN2_TAPS, GOLDEN3_TAPS, adultIsMom, age, rel } from "./helpers/conversation-taps";
import { pickAction } from "./helpers/conversation-actions";
import { focusOrder, headingOutline, outlineHasNoSkips } from "./helpers/outline";
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
import { interactive, targetSize } from "./helpers/targets";
import { catalog, product } from "./helpers/matching-fixtures";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));
// The layout loads fonts through next/font, which only exists inside the Next build.
vi.mock("next/font/google", () => ({
  Cormorant_Garamond: () => ({ variable: "font-display-test" }),
  Inter: () => ({ variable: "font-sans-test" }),
}));

vi.setConfig({ testTimeout: 60_000 });

const APPROX = "Approximate size — calibrate with a card for true size.";
const NOTICE = "That link did not carry a complete recipient, so let's start again.";
const active = () => document.activeElement as HTMLElement;

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
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ screens */

type Screen = { name: string; render: () => Promise<HTMLElement>; landing?: boolean };
const G1 = modelParamFor(GOLDEN1_TAPS);

async function findAfter(taps: Action[]): Promise<HTMLElement> {
  const { container } = await renderFind();
  let s = initial;
  for (const a of taps) {
    tapUi(s, a);
    s = reduce(s, a);
  }
  return container;
}

const SCREENS: Screen[] = [
  { name: "/", render: async () => renderLanding().container, landing: true },
  { name: "/find question 1", render: () => findAfter([]) },
  { name: "/find question 2", render: () => findAfter([rel("niece-nephew")]) },
  { name: "/find recipient card", render: () => findAfter(GOLDEN1_TAPS) },
  { name: "/find adult-end", render: () => findAfter([rel("other"), age("adult"), adultIsMom(false)]) },
  { name: "/find incomplete notice", render: async () => (await renderFind({ notice: "incomplete" })).container },
  { name: "/picks golden 1", render: async () => (await renderPicks(G1)).container },
  { name: "/picks golden 2", render: async () => (await renderPicks(modelParamFor(GOLDEN2_TAPS))).container },
  { name: "/picks golden 3", render: async () => (await renderPicks(modelParamFor(GOLDEN3_TAPS))).container },
  { name: "/atelier", render: async () => (await renderAtelier()).container },
  { name: "/atelier empty state", render: async () => (await renderAtelier({ category: "tabeez", metal: "gold" })).container },
  { name: "/piece/TNZ-1056", render: async () => (await renderPiece("TNZ-1056")).container },
  { name: "/piece/TNZ-1058 (out of stock)", render: async () => (await renderPiece("TNZ-1058")).container },
  { name: "/piece/TBZ-1013 with ?m=", render: async () => (await renderPiece("TBZ-1013", G1)).container },
  { name: "piece not-found", render: async () => renderNotFound().container },
];

/* ------------------------------------------------------------ outline, landmarks */

describe("outline and landmarks per screen (REQ-PD-24, P-PD-6)", () => {
  it.each(SCREENS.map((s) => [s.name, s] as const))("%s", async (_n, s) => {
    const container = await s.render();

    const outline = headingOutline(container);
    expect(outline.filter((h) => h.level === 1), JSON.stringify(outline)).toHaveLength(1);
    expect(outline[0].level).toBe(1);
    expect(outlineHasNoSkips(outline), JSON.stringify(outline)).toBe(true);

    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute("id", "main-content");
    expect(container.querySelectorAll("#main-content")).toHaveLength(1);

    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    if (s.landing) expect(screen.getAllByRole("contentinfo")).toHaveLength(1);

    // Content sits inside a landmark (the skip link, rendered by the layout, is the only exception).
    const outside = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
      (el) =>
        Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "") &&
        !el.closest("header, main, footer, nav"),
    );
    expect(outside.map((e) => e.outerHTML.slice(0, 80))).toEqual([]);
  });

  it("the piece page has the outline of design §5.4", async () => {
    const { container } = await renderPiece("TNZ-1056");
    const o = headingOutline(container).map((h) => `h${h.level} ${h.text}`);
    expect(o[0]).toBe("h1 Blue Evil Eye Nazariya – 925 Silver Baby Bracelet");
    expect(o[1]).toBe("h2 Catalog facts");
    expect(o.filter((t) => t === "h2 Good fit" || t === "h2 Check this")).toHaveLength(1);
    expect(o).toContain("h2 Size on your screen");
    expect(o).toContain("h2 Gift this piece");
  });

  it("the out-of-stock piece page has no gift heading", async () => {
    const { container } = await renderPiece("TNZ-1058");
    expect(headingOutline(container).map((h) => h.text)).not.toContain("Gift this piece");
  });
});

describe("the root layout (REQ-PD-05, REQ-PD-31)", () => {
  it("is lang=en with the skip link as the first child of body, outside the Suspense", () => {
    const html = RootLayout({ children: null }) as ReactElement<{ lang: string; children: ReactElement }>;
    expect(html.type).toBe("html");
    expect(html.props.lang).toBe("en");
    const body = html.props.children as ReactElement<{ children: ReactElement[] }>;
    expect(body.type).toBe("body");
    const kids = body.props.children;
    expect(kids[0].type).toBe(SkipLink);
  });
});

/* -------------------------------------------------------------------- skip link */

describe("skip link is first in focus order on every screen (REQ-PD-05)", () => {
  it.each(SCREENS.map((s) => [s.name, s] as const))("%s", async (_n, s) => {
    const container = await s.render();
    // The layout puts SkipLink first in <body>; mirror that here, before the page.
    const host = document.createElement("div");
    document.body.prepend(host);
    render(<SkipLink />, { container: host });

    const first = focusOrder(document.body)[0];
    expect(first).toBe(screen.getByRole("link", { name: "Skip to main content" }));
    expect(first).toHaveAttribute("href", "#main-content");
    // Its target exists exactly once and is a programmatic focus target.
    const target = container.querySelector("#main-content");
    expect(target).not.toBeNull();
    expect(target).toHaveAttribute("tabindex", "-1");
    host.remove();
  });
});

/* -------------------------------------------------------------------- tabindex */

describe("tabindex (REQ-PD-18)", () => {
  /** Selectors of the only elements allowed to carry tabindex="-1". */
  const ALLOWED = ["main#main-content", "[data-step-heading]", "article > h3"];

  async function check(container: HTMLElement) {
    for (const el of Array.from(container.querySelectorAll<HTMLElement>("[tabindex]"))) {
      const t = Number(el.getAttribute("tabindex"));
      expect(t, el.outerHTML.slice(0, 80)).not.toBeGreaterThan(0);
      expect(t, el.outerHTML.slice(0, 80)).toBe(-1);
      expect(
        ALLOWED.some((sel) => el.matches(sel)),
        `tabindex=-1 on ${el.outerHTML.slice(0, 80)}`,
      ).toBe(true);
    }
  }

  it.each(SCREENS.map((s) => [s.name, s] as const))("%s: none positive, -1 only on allowed targets", async (_n, s) => {
    await check(await s.render());
  });

  it("the piece page with the gift card revealed", async () => {
    const { container } = await renderPiece("TNZ-1056");
    fireEvent.click(screen.getByRole("button", { name: "Wrap this gift" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await check(container);
    expect(container.querySelectorAll('[tabindex="-1"]').length).toBe(2); // main + the card heading
  });

  it("no positive tabindex anywhere in the interactive states of the viewer", async () => {
    const { container } = await renderPiece("TNZ-1056");
    fireEvent.click(screen.getByRole("button", { name: "Calibrate with a card" }));
    await check(container);
  });
});

/* ---------------------------------------------------------- conversation focus */

describe("focus follows the conversation (REQ-PD-23)", () => {
  const headingNow = () => document.querySelector<HTMLElement>("[data-step-heading]")!;

  it("does not move on page load", async () => {
    await renderFind();
    expect(active()).toBe(document.body);
  });

  it("moves to the new heading after each answer, back, edit, and the return to the card", async () => {
    await renderFind();
    let s: ConversationState = initial;
    const go = (a: Action) => {
      tapUi(s, a);
      s = reduce(s, a);
    };

    go(rel("niece-nephew"));
    expect(active()).toBe(headingNow());
    expect(active()).toHaveTextContent(QUESTIONS.age.prompt);

    go({ type: "back" });
    expect(active()).toBe(headingNow());
    expect(active()).toHaveTextContent(QUESTIONS.relationship.prompt);

    for (const a of GOLDEN1_TAPS) go(a);
    expect(s.step).toBe("card");
    expect(active()).toBe(headingNow());
    expect(headingNow().tagName).toBe("H1");

    go({ type: "edit", question: "metal" });
    expect(active()).toBe(headingNow());
    expect(active()).toHaveTextContent(QUESTIONS.metal.prompt);

    go({ type: "answer", question: "metal", value: "gold" });
    expect(s.step).toBe("card");
    expect(active()).toBe(headingNow());
    const r = toModel(s.answers);
    if (!r.ok) throw new Error("card without a model");
    expect(active()).toHaveTextContent(describeModel(r.model, momSkipNote(storeCatalog)).headline);
  });

  it("moves to the adult-end message", async () => {
    await renderFind();
    let s: ConversationState = initial;
    for (const a of [rel("other"), age("adult"), adultIsMom(false)]) {
      tapUi(s, a);
      s = reduce(s, a);
    }
    expect(s.step).toBe("adult-end");
    expect(active()).toHaveTextContent(ADULT_END_MESSAGE);
    expect(active()).toBe(document.querySelector("[data-step-heading]"));
  });

  it("keeps the step headings non-empty and pairwise distinct", () => {
    const prompts = Object.values(QUESTIONS).map((q) => q.prompt);
    expect(prompts.every((p) => p.trim() !== "")).toBe(true);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  // P-PD-7 (A7): for random valid action sequences, after every step change the focused element is
  // the new step's heading. The index-based generator is shared (tests/helpers/conversation-actions.ts).
  it("P-PD-7: focus is on the new step heading after every step change", async () => {
    const momNote = momSkipNote(storeCatalog);
    await fc.assert(
      fc.asyncProperty(fc.array(fc.tuple(fc.nat(10_000), fc.integer({ min: 0, max: 9 })), { maxLength: 24 }), async (flow) => {
        cleanup();
        await renderFind();
        let s: ConversationState = initial;
        for (const [i, bias] of flow) {
          const a = pickAction(s, i, bias);
          const next = reduce(s, a);
          tapUi(s, a);
          if (next.step !== s.step) {
            const h = document.querySelector<HTMLElement>("[data-step-heading]");
            expect(h, `no heading after ${JSON.stringify(a)}`).not.toBeNull();
            expect(document.activeElement, `focus after ${JSON.stringify(a)} into ${next.step}`).toBe(h);
            if (next.step === "adult-end") expect(h!.textContent).toBe(ADULT_END_MESSAGE);
            else if (next.step === "card") {
              const r = toModel(next.answers);
              expect(r.ok).toBe(true);
              if (r.ok) expect(h!.textContent).toBe(describeModel(r.model, momNote).headline);
            } else expect(h!.textContent).toBe(QUESTIONS[next.step].prompt);
          }
          s = next;
        }
      }),
      { seed: 20261121, numRuns: 100 },
    );
    cleanup();
  });
});

/* ------------------------------------------------------- chips and chip groups */

describe("chips and groups (REQ-PD-21)", () => {
  function expectChips(container: HTMLElement) {
    const groups = Array.from(container.querySelectorAll<HTMLElement>('[role="group"]'));
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      expect(g.getAttribute("aria-label")?.trim(), g.outerHTML.slice(0, 60)).toBeTruthy();
      for (const b of Array.from(g.querySelectorAll("button"))) {
        expect(["true", "false"]).toContain(b.getAttribute("aria-pressed"));
      }
    }
  }
  it("/find question 1", async () => expectChips(await findAfter([])));
  it("/find Religious sub-chips", async () => {
    const c = await findAfter([
      rel("niece-nephew"),
      age("0-1"),
      { type: "answer", question: "occasion", value: "naming" },
      { type: "answer", question: "budget", value: "under-2500" },
      { type: "answer", question: "metal", value: "silver" },
      { type: "pick-symbol", value: "religious" },
    ]);
    expectChips(c);
    expect(screen.getAllByRole("group")).toHaveLength(2);
  });
  it("/atelier names its four groups", async () => {
    const { container } = await renderAtelier();
    expectChips(container);
    expect(screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual([
      "Age",
      "Category",
      "Metal",
      "Budget",
    ]);
  });
});

/* ----------------------------------------------------------------- live regions */

describe("live regions exist before their text changes (REQ-PD-22)", () => {
  it("/find: the incomplete notice is a status present at load; steps add no live region", async () => {
    await renderFind({ notice: "incomplete" });
    expect(screen.getByRole("status")).toHaveTextContent(NOTICE);
    cleanup();

    await renderFind();
    expect(screen.queryAllByRole("status")).toHaveLength(0);
    expect(document.querySelector("[aria-live], [role=alert]")).toBeNull();
    tapUi(initial, rel("niece-nephew")); // a step change: focus is the one mechanism
    expect(screen.queryAllByRole("status")).toHaveLength(0);
    expect(document.querySelector("[aria-live], [role=alert]")).toBeNull();
  });

  it("/atelier: the count is one polite container that keeps its node; the empty sentence is inside it", async () => {
    const { container } = await renderAtelier();
    const live = container.querySelector<HTMLElement>('[aria-live="polite"]')!;
    expect(live).toHaveTextContent("Showing 22 pieces");
    const chip = (g: string, n: string) => within(screen.getByRole("group", { name: g })).getByRole("button", { name: n });
    fireEvent.click(chip("Category", "Tabeez"));
    expect(container.querySelector('[aria-live="polite"]')).toBe(live);
    expect(live.textContent).not.toContain("Showing 22");
    fireEvent.click(chip("Metal", "18KT gold"));
    expect(container.querySelector('[aria-live="polite"]')).toBe(live);
    expect(live).toHaveTextContent("Showing 0 pieces");
    expect(live).toHaveTextContent("No piece matches those filters.");
  });

  it("gift wrap: one persistent status, text swapped; aria-busy while wrapping (fake timers)", async () => {
    await renderPiece("TNZ-1056");
    vi.useFakeTimers();
    const status = screen.getByTestId("wrap-status");
    expect(status).toHaveAttribute("role", "status");
    expect(status.textContent).toBe("");
    const section = screen.getByRole("region", { name: "Gift this piece" });
    expect(section).toHaveAttribute("aria-busy", "false");

    fireEvent.click(screen.getByRole("button", { name: "Wrap this gift" }));
    expect(screen.getByTestId("wrap-status")).toBe(status);
    expect(status.textContent).toBe("Wrapping your gift…");
    expect(section).toHaveAttribute("aria-busy", "true");

    act(() => {
      vi.advanceTimersByTime(WRAP_REVEAL_MS - 1);
    });
    expect(status.textContent).toBe("Wrapping your gift…");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("wrap-status")).toBe(status);
    expect(status.textContent).toBe("Your gift is wrapped");
    expect(section).toHaveAttribute("aria-busy", "false");
  });

  it("gift wrap: the copy result is a persistent status, empty until Copy is used", async () => {
    await renderPiece("TNZ-1056");
    fireEvent.click(screen.getByRole("button", { name: "Wrap this gift" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    const copyStatus = screen.getAllByRole("status").find((el) => el.dataset.testid !== "wrap-status" && el.getAttribute("data-testid") !== "size-status")!;
    expect(copyStatus.textContent).toBe("");

    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("no"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    });
    expect(copyStatus.textContent).toBe("Copied");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    });
    expect(copyStatus.textContent).toBe("Select the text and copy it yourself.");
  });

  it("viewer: one persistent status holds the mode line", async () => {
    await renderPiece("TNZ-1056");
    const status = screen.getByTestId("size-status");
    expect(status).toHaveAttribute("role", "status");
    expect(status.textContent).toBe(APPROX);
    fireEvent.click(screen.getByRole("button", { name: "Calibrate with a card" }));
    fireEvent.click(screen.getByRole("button", { name: "This matches" }));
    expect(screen.getByTestId("size-status")).toBe(status);
    expect(status.textContent).toBe("Calibrated to your screen");
    fireEvent.click(screen.getByRole("button", { name: "Reset calibration" }));
    expect(screen.getByTestId("size-status")).toBe(status);
    expect(status.textContent).toBe(APPROX);
  });
});

/* --------------------------------------------------------------- wrap focus */

describe("gift wrap focus hand-offs (REQ-PD-23)", () => {
  it("to Skip when wrapping starts, then to the card heading at revealed (timer)", async () => {
    await renderPiece("TNZ-1056");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Wrap this gift" }));
    expect(active()).toBe(screen.getByRole("button", { name: "Skip" }));
    act(() => {
      vi.advanceTimersByTime(WRAP_REVEAL_MS);
    });
    const card = screen.getByRole("article");
    expect(active()).toBe(within(card).getByRole("heading", { level: 3 }));
    expect(active()).toHaveAttribute("tabindex", "-1");
  });

  it("to the card heading when Skip is used", async () => {
    await renderPiece("TNZ-1056");
    fireEvent.click(screen.getByRole("button", { name: "Wrap this gift" }));
    expect(active()).toBe(screen.getByRole("button", { name: "Skip" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(active()).toBe(within(screen.getByRole("article")).getByRole("heading", { level: 3 }));
  });

  it("to the card heading at once when reduced motion is on (no Skip step)", async () => {
    await renderPiece("TNZ-1056");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }),
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: "Wrap this gift" }));
      expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
      expect(active()).toBe(within(screen.getByRole("article")).getByRole("heading", { level: 3 }));
    } finally {
      Reflect.deleteProperty(window, "matchMedia");
    }
  });

  it("does not move on page load", async () => {
    await renderPiece("TNZ-1056");
    expect(active()).toBe(document.body);
  });
});

/* ------------------------------------------------- slider and calibration focus */

describe("calibration slider and focus hand-offs (REQ-PD-23, REQ-PD-30)", () => {
  const openSlider = () => fireEvent.click(screen.getByRole("button", { name: "Calibrate with a card" }));

  it("focus goes to the slider on open", async () => {
    await renderPiece("TNZ-1056");
    openSlider();
    expect(active()).toBe(screen.getByRole("slider", { name: "Card outline width" }));
  });

  it("focus goes to Reset calibration after This matches", async () => {
    await renderPiece("TNZ-1056");
    openSlider();
    fireEvent.click(screen.getByRole("button", { name: "This matches" }));
    expect(active()).toBe(screen.getByRole("button", { name: "Reset calibration" }));
  });

  it("focus goes to Calibrate with a card after Cancel", async () => {
    await renderPiece("TNZ-1056");
    openSlider();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(active()).toBe(screen.getByRole("button", { name: "Calibrate with a card" }));
  });

  it("focus goes to Calibrate with a card after Reset calibration", async () => {
    storeCalibration();
    await renderPiece("TNZ-1056");
    expect(active()).toBe(document.body); // not on load
    fireEvent.click(screen.getByRole("button", { name: "Reset calibration" }));
    expect(active()).toBe(screen.getByRole("button", { name: "Calibrate with a card" }));
  });

  it("the slider has a name, a description, and a value text that follows the value", async () => {
    await renderPiece("TNZ-1056");
    openSlider();
    const slider = screen.getByRole("slider", { name: "Card outline width" });
    expect(slider).toHaveAttribute("aria-describedby", "cal-help");
    expect(document.getElementById("cal-help")).toHaveTextContent(/Hold a credit or debit card/);
    expect(slider).toHaveAccessibleDescription(/Hold a credit or debit card/);
    expect(slider.getAttribute("aria-valuetext")).toBe(`Outline ${(slider as HTMLInputElement).value} pixels wide`);
    fireEvent.change(slider, { target: { value: "300" } });
    expect(slider).toHaveAttribute("aria-valuetext", "Outline 300 pixels wide");
    expect(slider.className).toContain("h-11");
  });

  it('no "true size" in any attribute value on the piece page (idle, slider open); none new once calibrated', async () => {
    const attrs = () =>
      Array.from(document.body.querySelectorAll("*")).flatMap((el) =>
        Array.from(el.attributes).map((a) => ({ text: `${el.tagName}[${a.name}]=${a.value}`, value: a.value })),
      );
    const bad = () => attrs().filter((a) => /true[- ]?size/i.test(a.value)).map((a) => a.text);
    await renderPiece("TNZ-1056");
    expect(bad()).toEqual([]);
    openSlider();
    expect(bad()).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "This matches" }));
    // Calibrated, the pinned drawing captions say "true size" (REQ-TS caption pins), and each drawing
    // keeps its caption as a label. Nothing else carries it: not the slider, the hint, or a status.
    const captions = Array.from(document.querySelectorAll("figcaption p")).map((p) => p.textContent);
    const leftover = attrs()
      .filter((a) => /true[- ]?size/i.test(a.value) && !captions.includes(a.value))
      .map((a) => a.text);
    expect(leftover).toEqual([]);
  });

  it("the new-tab hint has no \"true size\" and exists once per screen", async () => {
    for (const s of SCREENS) {
      cleanup();
      const c = await s.render();
      const hints = c.querySelectorAll("#new-tab-hint");
      expect(hints, s.name).toHaveLength(1);
      expect(hints[0].textContent).toBe("Opens in a new tab");
    }
  });
});

/* -------------------------------------------------------- links: descriptions */

describe("repeated links and external links (REQ-PD-20)", () => {
  const hintId = "new-tab-hint";
  const ids = (el: Element) => (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);

  it("every target=_blank link on every screen references the hint, and carries rel noopener", async () => {
    let seen = 0;
    for (const s of SCREENS) {
      cleanup();
      const c = await s.render();
      for (const a of Array.from(c.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]'))) {
        seen++;
        expect(ids(a), `${s.name}: ${a.outerHTML.slice(0, 80)}`).toContain(hintId);
        expect(a.getAttribute("rel")).toContain("noopener");
        expect(a).toHaveAccessibleDescription(/Opens in a new tab/);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("/picks: See details and Buy point at their card heading; Buy adds the hint", async () => {
    const { container } = await renderPicks(G1);
    const cards = Array.from(container.querySelectorAll("article"));
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      const h2 = card.querySelector("h2")!;
      const name = h2.textContent!;
      expect(h2.id).toMatch(/^pick-[A-Z]{3}-\d{4}-name$/);
      const details = within(card).getByRole("link", { name: "See details" });
      const buy = within(card).getByRole("link", { name: "Buy on Tiny Tiaraa ↗" });
      expect(ids(details)).toEqual([h2.id]);
      expect(ids(buy)).toEqual([h2.id, hintId]);
      expect(details).toHaveAccessibleDescription(name);
      expect(buy).toHaveAccessibleDescription(`${name} Opens in a new tab`);
    }
  });

  it("/atelier: 22 See details link to their heading; 21 Buy links add the hint; none on the out-of-stock card", async () => {
    const { container } = await renderAtelier();
    const cards = Array.from(container.querySelectorAll<HTMLElement>("article[data-sku]"));
    expect(cards).toHaveLength(22);
    let buys = 0;
    for (const card of cards) {
      const sku = card.dataset.sku!;
      const h2 = card.querySelector("h2")!;
      expect(h2.id).toBe(`browse-${sku}-name`);
      expect(ids(within(card).getByRole("link", { name: "See details" }))).toEqual([h2.id]);
      const buy = within(card).queryByRole("link", { name: "Buy on Tiny Tiaraa ↗" });
      if (sku === "TNZ-1058") expect(buy).toBeNull();
      else {
        buys++;
        expect(ids(buy!)).toEqual([h2.id, hintId]);
      }
    }
    expect(buys).toBe(21);
  });

  it("/piece: the buy link references the hint", async () => {
    await renderPiece("TNZ-1056");
    const buy = screen.getByRole("link", { name: "Buy on Tiny Tiaraa ↗" });
    expect(ids(buy)).toContain(hintId);
    expect(buy).toHaveAttribute("target", "_blank");
  });
});

/* ------------------------------------------------------------------- alt text */

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

describe("photo alt equals the catalog name for all 22 SKUs (REQ-PD-29)", () => {
  it("covers all 22 SKUs", () => expect(ALL_SKUS).toHaveLength(22));

  it.each(ALL_SKUS)("%s on the pick card", (sku) => {
    const { container } = render(<PickCard view={pickView(sku)} detailHref={`/piece/${sku}`} />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute("alt", product(sku).name);
    expect(imgs[0].getAttribute("src")).toBe(`/catalog/${product(sku).image_file}`);
  });

  it("on the /atelier cards, every photo", async () => {
    const { container } = await renderAtelier();
    const byName = new Map(catalog.products.map((p) => [p.sku, p.name]));
    for (const card of Array.from(container.querySelectorAll<HTMLElement>("article[data-sku]"))) {
      const imgs = card.querySelectorAll("img");
      expect(imgs).toHaveLength(1);
      expect(imgs[0].getAttribute("alt")).toBe(byName.get(card.dataset.sku!));
    }
  });

  it.each(ALL_SKUS)("%s on the detail page (photo and drawing photo)", async (sku) => {
    const { container } = await renderPiece(sku);
    const name = product(sku).name;
    expect(container.querySelector("h1")).toHaveTextContent(name);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.length).toBeGreaterThanOrEqual(1);
    for (const img of imgs) expect(img.getAttribute("alt")).toBe(name);
  });

  it("the browse card renders its own alt when rendered alone", () => {
    const item = toBrowseItems(catalog)[0];
    const { container } = render(<BrowseCard item={item} />);
    expect(container.querySelector("img")).toHaveAttribute("alt", item.name);
  });
});

/* ------------------------------------------------------------------ drawings */

describe("a drawing whose caption repeats its label is aria-hidden (REQ-PD-29, Q-PD7)", () => {
  const checkFigures = (container: HTMLElement, where: string) => {
    for (const fig of Array.from(container.querySelectorAll<HTMLElement>('figure[data-testid^="size-item-"]'))) {
      const caption = fig.querySelector("figcaption p")?.textContent;
      for (const el of Array.from(fig.querySelectorAll<HTMLElement>("[aria-label]"))) {
        if (el.getAttribute("aria-label") === caption) {
          expect(el.getAttribute("aria-hidden"), `${where}: ${el.outerHTML.slice(0, 100)}`).toBe("true");
        }
      }
    }
  };

  it.each(ALL_SKUS)("%s, approximate and calibrated captions", async (sku) => {
    const { container, unmount } = await renderPiece(sku);
    checkFigures(container, `${sku} approximate`);
    unmount();
    storeCalibration();
    const again = await renderPiece(sku);
    checkFigures(again.container, `${sku} calibrated`);
  });

  it("a height-line drawing (a ring or line item with a missing width) is hidden too", () => {
    const base = product("TPN-1149");
    const spec = buildSizeSpec({ ...base, dims: { kind: "item", height_mm: 14.4, width_mm: null } });
    return import("../components/SizeOutlines").then(({ default: SizeOutlines }) => {
      const { container } = render(<SizeOutlines spec={spec} factor={5} calibrated={false} />);
      checkFigures(container, "line item");
      expect(container.querySelector('[data-testid="size-line"]')).toHaveAttribute("aria-hidden", "true");
    });
  });
});

/* ----------------------------------------------- names and targets (P-PD-8) */

describe("P-PD-8: every control on a card is named by its text and sized by its classes", () => {
  const check = (container: HTMLElement) => {
    const controls = interactive(container);
    expect(controls.length).toBeGreaterThan(0);
    for (const el of controls) {
      const visible = (el.textContent ?? "").trim();
      expect(visible).not.toBe("");
      expect(el).toHaveAccessibleName(visible); // label in name: the visible text is the name
      expect(targetSize(el).ok, `target size of ${el.outerHTML.slice(0, 90)}`).toBe(true);
    }
  };

  it.each(ALL_SKUS)("%s on PickCard", (sku) => {
    check(render(<PickCard view={pickView(sku)} detailHref={`/piece/${sku}`} />).container);
  });

  it.each(ALL_SKUS)("%s on BrowseCard", (sku) => {
    const item = toBrowseItems(catalog).find((i) => i.sku === sku)!;
    check(render(<BrowseCard item={item} />).container);
  });
});
