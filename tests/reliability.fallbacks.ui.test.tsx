// @vitest-environment jsdom
// REQ-REL-36, P-REL-F1: the four fallbacks (app/error, app/global-error, app/not-found, app/loading)
// render fixed copy, never show error.message or error.stack, call retry only on click, log once,
// pass axe, and carry no price, forbidden word, or image. Browser rendering is NOT RUN.
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import { formatViolations, runAxe } from "./helpers/axe";
import { interactive, targetSize } from "./helpers/targets";
import RouteError from "../app/error";
import GlobalError from "../app/global-error";
import NotFound from "../app/not-found";
import Loading from "../app/loading";

const FORBIDDEN = /\b(safe|unsafe|certified|hypoallergenic|true size|off|save)\b|₹/i;
const PREFIX = "[atelier] route error";

type Thrown = { name: string; value: unknown; digest?: string };
const withDigest = (e: Error, digest: string) => Object.assign(e, { digest });
const THROWN: Thrown[] = [
  { name: "Error without a digest", value: new Error("secret detail") },
  { name: "Error with a digest", value: withDigest(new Error("secret detail"), "d1g3st"), digest: "d1g3st" },
  { name: "Error with an empty digest", value: withDigest(new Error("secret detail"), "") },
  { name: "string", value: "secret detail" },
  { name: "null", value: null },
  { name: "object", value: { message: "secret detail", stack: "secret detail", digest: "not-an-error" } },
];

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const hrefs = (c: Element) => interactive(c).filter((e) => e.tagName === "A").map((e) => e.getAttribute("href"));

function expectCommon(container: Element, retryLabel?: string) {
  expect(container.querySelectorAll("h1")).toHaveLength(1);
  expect(container.querySelectorAll("main")).toHaveLength(1);
  expect(container.querySelectorAll("main#main-content")).toHaveLength(1);
  expect(container.querySelectorAll("img, svg, picture")).toHaveLength(0);
  expect(container.textContent ?? "").not.toMatch(FORBIDDEN);
  expect(container.querySelectorAll("[tabindex]")).toHaveLength(1); // only main carries one
  expect(container.querySelector("main")?.getAttribute("tabindex")).toBe("-1");
  expect(container.querySelector("main")?.className).toContain("outline-none");
  for (const el of interactive(container)) {
    expect(["A", "BUTTON"], `${el.outerHTML} is native`).toContain(el.tagName);
    expect(targetSize(el).heightOk, `${el.textContent} has a 44 px height class`).toBe(true);
  }
  // Header links are inline text links in the fallback's own header (height class only); every control in main has the full 44 px target.
  for (const el of interactive(container.querySelector("main")!)) {
    expect(targetSize(el).ok, `${el.textContent} has a 44 px target`).toBe(true);
  }
  expect(container.querySelectorAll("button")).toHaveLength(retryLabel ? 1 : 0);
  if (retryLabel) expect(container.querySelector("button")?.textContent).toBe(retryLabel);
}

describe("app/error.tsx (REQ-REL-01 to 04)", () => {
  it("renders the header, one h1, the sentence and the three controls in order", () => {
    const { container } = render(<RouteError error={new Error("x")} retry={() => {}} />);
    expectCommon(container, "Try again");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Something went wrong with that page.");
    expect(container.textContent).toContain("You can try again, start a new search, or browse the atelier.");
    expect(container.querySelector("header")).not.toBeNull();
    expect(container.textContent).toContain("Tiny Tiaraa");
    const labels = interactive(container.querySelector("main")!).map((e) => e.textContent);
    expect(labels).toEqual(["Try again", "Find a gift", "Browse the atelier"]);
    expect(hrefs(container.querySelector("main")!)).toEqual(["/find", "/atelier"]);
    expect(hrefs(container.querySelector("header")!)).toContain("/atelier");
  });

  it("offers a way out that leaves the failed segment (no dead end)", () => {
    const { container } = render(<RouteError error={null} retry={() => {}} />);
    expect(hrefs(container).length).toBeGreaterThanOrEqual(2);
  });

  it("does not move focus on mount", () => {
    const { container } = render(<RouteError error={null} retry={() => {}} />);
    expect(document.activeElement).toBe(document.body);
    expect(container.contains(document.activeElement)).toBe(false);
  });

  it("calls retry once per Try again click and never on mount", () => {
    const retry = vi.fn();
    render(<RouteError error={new Error("x")} retry={retry} />);
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(2);
  });

  describe.each(THROWN)("thrown value: $name", ({ value, digest }) => {
    it("renders no message, no stack, and the digest line only for a non-empty string digest", () => {
      const { container } = render(<RouteError error={value} retry={() => {}} />);
      const text = container.textContent ?? "";
      expect(text).not.toContain("secret detail");
      if (value instanceof Error && value.stack) expect(text).not.toContain(value.stack.split("\n")[1] ?? "never");
      expect(text).not.toContain("not-an-error");
      if (digest) expect(text).toContain(`Reference: ${digest}`);
      else expect(text).not.toContain("Reference:");
    });

    it("logs once with the fixed prefix and the digest, and nothing else from the error", () => {
      render(<RouteError error={value} retry={() => {}} />);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(PREFIX, digest ?? "no digest");
    });
  });

  it("logs once per distinct digest, not once per render", () => {
    const e = withDigest(new Error("x"), "abc");
    const { rerender } = render(<RouteError error={e} retry={() => {}} />);
    rerender(<RouteError error={e} retry={() => {}} />);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    rerender(<RouteError error={withDigest(new Error("y"), "def")} retry={() => {}} />);
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenLastCalledWith(PREFIX, "def");
  });

  it("passes axe with and without a digest", async () => {
    for (const value of [null, withDigest(new Error("x"), "d1g3st")]) {
      const { container, unmount } = render(<RouteError error={value} retry={() => {}} />);
      const v = await runAxe(container);
      expect(v, formatViolations(v)).toEqual([]);
      unmount();
    }
  });
});

describe("app/global-error.tsx (REQ-REL-05)", () => {
  const markup = renderToStaticMarkup(<GlobalError error={new Error("secret detail")} retry={() => {}} />);
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html>${markup}`, "text/html");

  it("renders its own html and body with the token classes", () => {
    expect(markup.startsWith('<html lang="en">')).toBe(true);
    expect(doc.documentElement.getAttribute("lang")).toBe("en");
    expect(doc.body.className).toBe("min-h-full flex flex-col bg-pearl text-plum font-sans");
  });

  it("has one h1, one main, the sentence, a Reload button and one plain link to /", () => {
    expectCommon(doc.body, "Reload");
    expect(doc.querySelector("h1")?.textContent).toBe("The atelier couldn't open.");
    expect(doc.querySelector("title")?.textContent).toBe("The atelier couldn't open");
    expect(doc.body.textContent).toContain("Please reload the page. If it keeps happening, come back in a little while.");
    expect(interactive(doc.body).map((e) => e.textContent)).toEqual(["Reload", "Back to the start"]);
    expect(hrefs(doc.body)).toEqual(["/"]);
  });

  it("has no wordmark, header, skip link, or error detail", () => {
    expect(doc.querySelector("header")).toBeNull();
    expect(doc.querySelector("nav")).toBeNull();
    expect(markup).not.toContain("Tiny Tiaraa");
    expect(markup).not.toContain("secret detail");
    expect(markup).not.toMatch(/skip/i);
  });

  it("calls retry once per Reload click, never on mount", () => {
    const retry = vi.fn();
    // React builds the <html> element with createElement, so it mounts inside the test container
    // (the nesting warning goes to the mocked console.error and is filtered out below).
    const { container } = render(<GlobalError error={null} retry={retry} />);
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector("button")!);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls.filter((c: unknown[]) => !String(c[0]).includes("validateDOMNesting") && !String(c[0]).includes("cannot be a child"))).toEqual([]);
  });

  it("passes axe", async () => {
    // axe reads the global document, so swap the parsed head and body in, then put the originals back.
    const { head, body } = document;
    head.replaceWith(document.importNode(doc.head, true));
    document.body.replaceWith(document.importNode(doc.body, true));
    document.documentElement.setAttribute("lang", "en");
    try {
      const v = await runAxe(document.documentElement);
      expect(v, formatViolations(v)).toEqual([]);
    } finally {
      document.head.replaceWith(head);
      document.body.replaceWith(body);
      document.documentElement.removeAttribute("lang");
    }
  });
});

describe("app/not-found.tsx (REQ-REL-06)", () => {
  it("renders the header, one h1, and the two links in order", () => {
    const { container } = render(<NotFound />);
    expectCommon(container);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("We couldn't find that page.");
    const main = container.querySelector("main")!;
    expect(interactive(main).map((e) => e.textContent)).toEqual(["Browse the atelier", "Find a gift"]);
    expect(hrefs(main)).toEqual(["/atelier", "/find"]);
    expect(container.querySelector("header")).not.toBeNull();
  });

  it("passes axe", async () => {
    const { container } = render(<NotFound />);
    const v = await runAxe(container);
    expect(v, formatViolations(v)).toEqual([]);
  });
});

describe("app/loading.tsx (REQ-REL-10)", () => {
  it("is one busy status line with the fixed text and nothing else", () => {
    const { container } = render(<Loading />);
    const status = screen.getByRole("status");
    expect(container.children).toHaveLength(1);
    expect(status).toBe(container.firstElementChild);
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.textContent).toBe("Opening the atelier…");
    expect(container.querySelectorAll("img, svg, a, button, article, h1, main, [class*='animate']")).toHaveLength(0);
    expect(container.textContent ?? "").not.toMatch(FORBIDDEN);
    expect(status.className).not.toMatch(/animate|transition|\[|#/);
  });

  it("passes axe", async () => {
    const { container } = render(<Loading />);
    const v = await runAxe(container);
    expect(v, formatViolations(v)).toEqual([]);
  });
});
