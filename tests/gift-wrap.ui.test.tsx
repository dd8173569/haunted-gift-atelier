// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import GiftWrap from "../components/GiftWrap";
import { catalog } from "../lib/catalog-store";
import { CARD_FADE_MS, WRAP_REVEAL_MAX_MS, WRAP_REVEAL_MS, draftMessage, presentationFor } from "../lib/gift-message";

const DRAFT = draftMessage({ relationship: "niece-nephew", occasion: "naming" }, "Little Moon");
const PRESENTATION = presentationFor({ relationship: "niece-nephew", occasion: "naming" });
const URL_ = "https://www.tinytiaraa.com/product/Little-Moon";

const setup = (over: Partial<Parameters<typeof GiftWrap>[0]> = {}) =>
  render(<GiftWrap name="Little Moon" url={URL_} initialMessage={DRAFT} presentation={PRESENTATION} {...over} />);

const wrapButton = () => screen.getByRole("button", { name: "Wrap this gift" });
const textarea = () => screen.getByLabelText("Gift message — a draft you can edit") as HTMLTextAreaElement;
const buyLinks = (c: HTMLElement | Document = document) =>
  Array.from(c.querySelectorAll("a")).filter((a) => a.textContent?.includes("Buy on Tiny Tiaraa"));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // @ts-expect-error test cleanup of a stub
  delete window.matchMedia;
  // @ts-expect-error test cleanup of a stub
  delete navigator.clipboard;
});

describe("phases and timing (REQ-GP-14, 15, 17; P-GP-4)", () => {
  it("idle: button, buy link, no textarea, no card", () => {
    setup();
    expect(wrapButton()).toBeInTheDocument();
    expect(buyLinks()).toHaveLength(1);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(PRESENTATION.heading)).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  });

  it("the constants keep the reveal and the card fade inside 3 seconds", () => {
    expect(WRAP_REVEAL_MS + CARD_FADE_MS).toBeLessThanOrEqual(WRAP_REVEAL_MAX_MS);
    expect(WRAP_REVEAL_MAX_MS).toBeLessThanOrEqual(3000);
  });

  it("click: wrapping with aria-busy and a status; still wrapping at 2399 ms; revealed at 2400 ms", () => {
    const { container } = setup();
    fireEvent.click(wrapButton());
    const section = container.querySelector("section") as HTMLElement;
    expect(section).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Wrapping your gift…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(WRAP_REVEAL_MS - 1);
    });
    expect(section).toHaveAttribute("data-phase", "wrapping");
    expect(screen.queryByRole("textbox")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(section).toHaveAttribute("data-phase", "revealed");
    expect(section).toHaveAttribute("aria-busy", "false");
    expect(screen.getByText("Your gift is wrapped")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: PRESENTATION.heading })).toBeInTheDocument();
    expect(textarea().value).toBe(DRAFT);
  });

  it("moves focus to the card heading on reveal", () => {
    setup();
    fireEvent.click(wrapButton());
    act(() => {
      vi.advanceTimersByTime(WRAP_REVEAL_MS);
    });
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: PRESENTATION.heading }));
  });

  it("Skip reaches revealed at 0 ms and the old timer changes nothing", () => {
    const { container } = setup();
    fireEvent.click(wrapButton());
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    const section = container.querySelector("section") as HTMLElement;
    expect(section).toHaveAttribute("data-phase", "revealed");
    fireEvent.change(textarea(), { target: { value: "kept" } });
    act(() => {
      vi.advanceTimersByTime(WRAP_REVEAL_MAX_MS);
    });
    expect(section).toHaveAttribute("data-phase", "revealed");
    expect(textarea().value).toBe("kept");
  });

  it("reduced motion goes straight to revealed, with no wrapping phase", () => {
    vi.stubGlobal("matchMedia", undefined);
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { container } = setup();
    fireEvent.click(wrapButton());
    expect(container.querySelector("section")).toHaveAttribute("data-phase", "revealed");
    expect(screen.queryByText("Wrapping your gift…")).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("matchMedia reporting no preference still plays the wrap", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    const { container } = setup();
    fireEvent.click(wrapButton());
    expect(container.querySelector("section")).toHaveAttribute("data-phase", "wrapping");
  });

  it("the animated box carries the wrap classes only while wrapping", () => {
    setup();
    expect(screen.getByTestId("gift-box").className).not.toContain("wrap-box-out");
    fireEvent.click(wrapButton());
    expect(screen.getByTestId("gift-box").className).toContain("wrap-box-out");
  });
});

describe("the message (REQ-GP-19, 22, 24)", () => {
  const reveal = () => {
    const r = setup();
    fireEvent.click(wrapButton());
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    return r;
  };

  it("is prefilled, limited to 500 characters, and labelled", () => {
    reveal();
    expect(textarea().value).toBe(DRAFT);
    expect(textarea().maxLength).toBe(500);
  });

  it("the card shows the edit in the same render, with line breaks kept", () => {
    const { container } = reveal();
    fireEvent.change(textarea(), { target: { value: "Line one\nLine two" } });
    const p = container.querySelector("article p.whitespace-pre-line") as HTMLElement;
    expect(p.textContent).toBe("Line one\nLine two");
    expect(screen.getByText("The gift: Little Moon")).toBeInTheDocument();
  });

  it("Reset to draft restores the draft", () => {
    reveal();
    fireEvent.change(textarea(), { target: { value: "mine" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset to draft" }));
    expect(textarea().value).toBe(DRAFT);
  });

  it("states that the message stays on the page", () => {
    reveal();
    expect(
      screen.getByText("Your message stays on this page. It is not sent to us or to the store."),
    ).toBeInTheDocument();
  });

  it("the card uses its tone token and shows no price, photo or image", () => {
    const { container } = reveal();
    const card = container.querySelector("article") as HTMLElement;
    expect(card.className).toContain("bg-blush");
    expect(card.textContent).not.toMatch(/₹|\d{3}/);
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("copy (REQ-GP-20)", () => {
  const reveal = () => {
    setup();
    fireEvent.click(wrapButton());
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  };
  const copyButton = () => screen.getByRole("button", { name: "Copy message" });

  it("copies the current text and says Copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    reveal();
    fireEvent.change(textarea(), { target: { value: "edited" } });
    await act(async () => {
      fireEvent.click(copyButton());
    });
    expect(writeText).toHaveBeenCalledWith("edited");
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("shows the fallback when the clipboard is missing, without throwing", async () => {
    reveal();
    await act(async () => {
      fireEvent.click(copyButton());
    });
    expect(screen.getByText("Select the text and copy it yourself.")).toBeInTheDocument();
  });

  it("shows the fallback when the clipboard rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    reveal();
    await act(async () => {
      fireEvent.click(copyButton());
    });
    expect(screen.getByText("Select the text and copy it yourself.")).toBeInTheDocument();
  });
});

describe("buy link, P-GP-1 / REQ-GP-25", () => {
  it("equals the catalog url byte for byte in all three phases, for all 22 products", () => {
    expect(catalog.products).toHaveLength(22);
    for (const p of catalog.products) {
      const { container, unmount } = setup({ name: p.name, url: p.url });
      const check = (variant: "secondary" | "primary") => {
        const links = buyLinks(container);
        expect(links, `${p.sku} ${variant}`).toHaveLength(1);
        expect(links[0].getAttribute("href"), p.sku).toBe(p.url);
        expect(links[0].getAttribute("target")).toBe("_blank");
        expect(links[0].getAttribute("rel")).toContain("noopener");
        // REQ-PD-49: the secondary border moved from border-plum/30 (1.76:1) to border-plum/60 (3.46:1 or more) for non-text contrast (REQ-PD-26).
        expect(links[0].className).toContain(variant === "primary" ? "bg-plum" : "border-plum/60");
      };
      check("secondary"); // idle
      fireEvent.click(wrapButton());
      check("secondary"); // wrapping
      fireEvent.click(screen.getByRole("button", { name: "Skip" }));
      check("primary"); // revealed
      unmount();
    }
  });
});

describe("no network, storage, form or image (REQ-GP-16, 19, 27)", () => {
  it("makes no call through a network or storage API in any phase", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "open");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    const { container } = setup();
    fireEvent.click(wrapButton());
    act(() => {
      vi.advanceTimersByTime(WRAP_REVEAL_MS);
    });
    fireEvent.change(textarea(), { target: { value: "hello" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset to draft" }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(container.querySelector("img, form")).toBeNull();
    expect(window.location.search).toBe("");
  });
});
