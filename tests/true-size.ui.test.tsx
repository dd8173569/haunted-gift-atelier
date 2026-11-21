// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import CalibrationSlider from "../components/CalibrationSlider";
import SizeOutlines from "../components/SizeOutlines";
import SizeRuler from "../components/SizeRuler";
import TrueSizeViewer from "../components/TrueSizeViewer";
import { useCalibration } from "../components/useCalibration";
import { buildSizeSpec } from "../lib/size-spec";
import { CSS_PX_PER_MM, STORAGE_KEY, cardPx, mmToPx, serializeCalibration } from "../lib/true-size";
import { catalog, product } from "./helpers/matching-fixtures";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; className?: string; sizes?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} className={props.className} data-sizes={props.sizes} />
  ),
}));

// jsdom's CSS layer rounds inline `style` lengths to about 3 decimals, so style-based checks of
// non-integer px compare to 2 decimals. The code passes the unrounded number to React; the SVG
// attribute checks below (width/height, no CSS layer) compare to 9 decimals.
const catalogSkus = () => catalog.products.map((p) => p.sku);
const spec = (sku: string) => buildSizeSpec(product(sku));

/* ---------- useCalibration, through a tiny harness ---------- */

let lastResult: boolean | null = null;
function Harness({ px = 400 }: { px?: number }) {
  const c = useCalibration();
  return (
    <div>
      <output data-testid="mode">{c.mode}</output>
      <output data-testid="factor">{String(c.factor)}</output>
      <button onClick={() => (lastResult = c.calibrate(px))}>cal</button>
      <button onClick={() => c.reset()}>reset</button>
    </div>
  );
}
const mode = () => screen.getByTestId("mode").textContent;
const factor = () => Number(screen.getByTestId("factor").textContent);

/** Clears the module-level in-memory fallback as well as localStorage. */
function clearStore() {
  const { unmount } = render(<Harness />);
  fireEvent.click(screen.getByText("reset"));
  unmount();
  window.localStorage.clear();
}

const setDpr = (v: number) => Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: v });

beforeEach(() => {
  lastResult = null;
  setDpr(1);
  clearStore();
});
afterEach(() => {
  vi.restoreAllMocks();
  setDpr(1);
});

describe("useCalibration", () => {
  it("no stored value: approximate at the CSS millimetre", () => {
    render(<Harness />);
    expect(mode()).toBe("approximate");
    expect(factor()).toBe(CSS_PX_PER_MM);
  });

  it("a stored valid value: calibrated at the stored factor", () => {
    window.localStorage.setItem(STORAGE_KEY, serializeCalibration({ pxPerMm: 4.5, dpr: 1 }));
    render(<Harness />);
    expect(mode()).toBe("calibrated");
    expect(factor()).toBe(4.5);
  });

  it("a corrupt value is treated as not calibrated", () => {
    window.localStorage.setItem(STORAGE_KEY, "{oops");
    render(<Harness />);
    expect(mode()).toBe("approximate");
    expect(factor()).toBe(CSS_PX_PER_MM);
  });

  it("a stored dpr of 2 against jsdom's 1 is stale, and the value is kept", () => {
    const raw = serializeCalibration({ pxPerMm: 4.5, dpr: 2 });
    window.localStorage.setItem(STORAGE_KEY, raw);
    render(<Harness />);
    expect(mode()).toBe("stale");
    expect(factor()).toBe(CSS_PX_PER_MM);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("calibrate stores {v, pxPerMm, dpr} and switches in the same render; reset removes the key", () => {
    setDpr(1.5);
    render(<Harness px={400} />);
    fireEvent.click(screen.getByText("cal"));
    expect(lastResult).toBe(true);
    expect(mode()).toBe("calibrated");
    expect(factor()).toBeCloseTo(400 / 85.6, 12);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string)).toEqual({
      v: 1,
      pxPerMm: 400 / 85.6,
      dpr: 1.5,
    });
    fireEvent.click(screen.getByText("reset"));
    expect(mode()).toBe("approximate");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("rejects an out-of-range card width without storing anything", () => {
    render(<Harness px={50} />);
    fireEvent.click(screen.getByText("cal"));
    expect(lastResult).toBe(false);
    expect(mode()).toBe("approximate");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("a localStorage.setItem that throws still calibrates in memory, with no error", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    render(<Harness px={400} />);
    fireEvent.click(screen.getByText("cal"));
    expect(lastResult).toBe(true);
    expect(mode()).toBe("calibrated");
    expect(factor()).toBeCloseTo(400 / 85.6, 12);
  });

  it("a localStorage that throws on read falls back to memory", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<Harness px={400} />);
    expect(mode()).toBe("approximate");
    fireEvent.click(screen.getByText("cal"));
    expect(mode()).toBe("calibrated");
  });

  it("follows another tab's change through the storage event", () => {
    render(<Harness />);
    expect(mode()).toBe("approximate");
    act(() => {
      window.localStorage.setItem(STORAGE_KEY, serializeCalibration({ pxPerMm: 5, dpr: 1 }));
      window.dispatchEvent(new Event("storage"));
    });
    expect(mode()).toBe("calibrated");
  });
});

/* ---------- CalibrationSlider ---------- */

describe("CalibrationSlider", () => {
  const renderSlider = () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<CalibrationSlider onConfirm={onConfirm} onCancel={onCancel} />);
    return { onConfirm, onCancel, slider: screen.getByRole("slider", { name: "Card outline width" }) };
  };

  it("is a native range input, 171 to 856 in 1 px steps, starting at 324", () => {
    const { slider } = renderSlider();
    expect(slider.tagName).toBe("INPUT");
    expect(slider).toHaveAttribute("type", "range");
    expect(slider).toHaveAttribute("min", "171");
    expect(slider).toHaveAttribute("max", "856");
    expect(slider).toHaveAttribute("step", "1");
    expect(slider).toHaveValue("324");
  });

  it("associates the instruction with the slider", () => {
    const { slider } = renderSlider();
    expect(slider).toHaveAttribute("aria-describedby", "cal-help");
    const help = document.getElementById("cal-help");
    expect(help).toHaveTextContent(
      "Hold a credit or debit card flat against the screen. Drag the slider until the outline matches the card's long edge.",
    );
  });

  it("resizes the outline: width = value, height = value × 53.98 / 85.6", () => {
    const { slider } = renderSlider();
    const outline = screen.getByTestId("card-outline");
    expect(outline.style.width).toBe("324px");
    fireEvent.change(slider, { target: { value: "400" } });
    expect(outline.style.width).toBe("400px");
    expect(parseFloat(outline.style.height)).toBeCloseTo((400 * 53.98) / 85.6, 2);
    expect(outline.className).toContain("box-border");
    expect(outline.className).toContain("border-plum/60");
    expect(outline.className).toContain("bg-champagne/40");
  });

  it("moves with arrow keys, Home and End (native range behaviour, driven through change)", () => {
    const { slider } = renderSlider();
    const press = (key: string, next: string) => {
      fireEvent.keyDown(slider, { key });
      fireEvent.change(slider, { target: { value: next } });
    };
    press("ArrowRight", "325");
    expect(slider).toHaveValue("325");
    press("ArrowLeft", "324");
    expect(slider).toHaveValue("324");
    press("Home", "171");
    expect(screen.getByTestId("card-outline").style.width).toBe("171px");
    press("End", "856");
    expect(screen.getByTestId("card-outline").style.width).toBe("856px");
  });

  it("'This matches' confirms the current value; Cancel cancels", () => {
    const { slider, onConfirm, onCancel } = renderSlider();
    fireEvent.change(slider, { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "This matches" }));
    expect(onConfirm).toHaveBeenCalledWith(400);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("stands upright when the container is narrower than the long edge", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    renderSlider();
    const outline = screen.getByTestId("card-outline");
    expect(outline.style.height).toBe("324px");
    expect(parseFloat(outline.style.width)).toBeCloseTo((324 * 53.98) / 85.6, 2);
    spy.mockRestore();
  });

  it("lies down when there is room", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
    renderSlider();
    expect(screen.getByTestId("card-outline").style.width).toBe("324px");
    spy.mockRestore();
  });
});

/* ---------- SizeOutlines ---------- */

describe("SizeOutlines", () => {
  const px = (el: HTMLElement, prop: "width" | "height") => parseFloat(el.style[prop]);

  it("TPN-1459 at factor 5: a 93 × 130 px box holding only the photo, object-contain", () => {
    render(<SizeOutlines spec={spec("TPN-1459")} factor={5} calibrated={false} />);
    const box = screen.getByTestId("size-box-piece");
    expect(box.style.width).toBe("93px");
    expect(box.style.height).toBe("130px");
    expect(box.querySelectorAll("*")).toHaveLength(1);
    const img = box.firstElementChild as HTMLElement;
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "/catalog/TPN-1459.png");
    expect(img.className).toContain("object-contain");
    expect(img.className).not.toMatch(/object-(cover|fill)/);
    expect(img).toHaveAttribute("alt", product("TPN-1459").name);
    expect(img).toHaveAttribute("data-sizes", "93px");
    expect(box.textContent).toBe("");
  });

  it("TPN-1149 at factor 5: an empty 9.5 × 72 px outline, no photo anywhere in the drawing", () => {
    render(<SizeOutlines spec={spec("TPN-1149")} factor={5} calibrated={false} />);
    const box = screen.getByTestId("size-box-piece");
    expect(box.style.width).toBe("9.5px");
    expect(box.style.height).toBe("72px");
    expect(box.children).toHaveLength(0);
    expect(document.querySelector("img")).toBeNull();
    expect(
      screen.getByText("pendant face, 14.4 mm tall — chain not shown to scale"),
    ).toBeInTheDocument();
    expect(screen.getByText("Listed: 14.4 mm tall × 1.9 mm wide.")).toBeInTheDocument();
  });

  it("every drawn box edge equals mmToPx(mm, factor) exactly", () => {
    for (const f of [2, CSS_PX_PER_MM, 4.123456, 10]) {
      const { unmount } = render(<SizeOutlines spec={spec("TPN-1459")} factor={f} calibrated />);
      const box = screen.getByTestId("size-box-piece");
      expect(px(box, "width")).toBeCloseTo(mmToPx(18.6, f), 2);
      expect(px(box, "height")).toBeCloseTo(mmToPx(26, f), 2);
      unmount();
    }
  });

  it("TNZ-1056 ring: Ø 42.46 mm at factor 5, caption by mode, outer edge equals the diameter", () => {
    const { rerender } = render(<SizeOutlines spec={spec("TNZ-1056")} factor={5} calibrated={false} />);
    const ring = () => screen.getByTestId("size-ring-bracelet");
    expect(Math.abs(Number(ring().getAttribute("width")) - 212.32)).toBeLessThan(0.01);
    expect(Number(ring().getAttribute("width"))).toBeCloseTo(mmToPx(133.4 / Math.PI, 5), 9);
    expect(ring()).toHaveAttribute("role", "img");
    expect(ring()).toHaveAttribute("aria-label", "ring outline, approximate size — 5.25 in around");
    expect(screen.getByText("ring outline, approximate size — 5.25 in around")).toBeInTheDocument();
    const circle = ring().querySelector("circle") as SVGElement;
    const r = Number(circle.getAttribute("r"));
    expect(2 * r + 1.5).toBeCloseTo(Number(ring().getAttribute("width")), 9);
    expect(screen.getByText("Drawn as a closed circle, Ø ≈ 42 mm. Band width not stated on the listing.")).toBeInTheDocument();

    rerender(<SizeOutlines spec={spec("TNZ-1056")} factor={5} calibrated />);
    expect(screen.getByText("ring outline at true size — 5.25 in around")).toBeInTheDocument();
    expect(ring()).toHaveAttribute("aria-label", "ring outline at true size — 5.25 in around");
  });

  it("TOB-1009 bangle: 39.6 mm across, caption by mode", () => {
    const { rerender } = render(<SizeOutlines spec={spec("TOB-1009")} factor={4} calibrated={false} />);
    expect(Number(screen.getByTestId("size-ring-bangle").getAttribute("width"))).toBeCloseTo(158.4, 9);
    expect(screen.getByText("bangle outline, approximate size — 39.6 mm across")).toBeInTheDocument();
    rerender(<SizeOutlines spec={spec("TOB-1009")} factor={4} calibrated />);
    expect(screen.getByText("bangle outline at true size — 39.6 mm across")).toBeInTheDocument();
  });

  it("TPN-1206 set: two boxes at the same factor, no photo", () => {
    render(<SizeOutlines spec={spec("TPN-1206")} factor={5} calibrated={false} />);
    const pendant = screen.getByTestId("size-box-pendant");
    const earring = screen.getByTestId("size-box-earring");
    expect(pendant.style.width).toBe("22.75px");
    expect(pendant.style.height).toBe("57.5px");
    expect(earring.style.width).toBe("19.5px");
    expect(earring.style.height).toBe("26.75px");
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("one earring, 5.35 mm tall")).toBeInTheDocument();
  });

  it("draws the ID-1 reference card at the same factor, with its label below", () => {
    render(<SizeOutlines spec={spec("TPN-1149")} factor={5} calibrated={false} />);
    const card = screen.getByTestId("reference-card");
    const c = cardPx(5);
    expect(px(card, "width")).toBeCloseTo(c.long, 2);
    expect(px(card, "height")).toBeCloseTo(c.short, 2);
    expect(screen.getByText("Credit-card size, for reference — 85.60 × 53.98 mm")).toBeInTheDocument();
  });

  it("stands the reference card upright when it would overflow", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    render(<SizeOutlines spec={spec("TPN-1149")} factor={5} calibrated={false} />);
    const card = screen.getByTestId("reference-card");
    expect(px(card, "height")).toBeCloseTo(cardPx(5).long, 2);
    expect(px(card, "width")).toBeCloseTo(cardPx(5).short, 2);
    spy.mockRestore();
  });

  it("missing and line items: text only, or a height line, never a 0 drawing", () => {
    const base = product("TPN-1149");
    const missing = buildSizeSpec({ ...base, dims: { kind: "item", height_mm: null, width_mm: 1.9 } });
    const { unmount } = render(<SizeOutlines spec={missing} factor={5} calibrated={false} />);
    expect(screen.getByText("Size not stated on the listing.")).toBeInTheDocument();
    expect(screen.queryByTestId("size-box-piece")).toBeNull();
    unmount();
    const line = buildSizeSpec({ ...base, dims: { kind: "item", height_mm: 14.4, width_mm: null } });
    render(<SizeOutlines spec={line} factor={5} calibrated={false} />);
    expect(screen.getByTestId("size-line")).toHaveAttribute("height", "72");
    expect(screen.getByText("Listed: 14.4 mm tall. Width not stated on the listing.")).toBeInTheDocument();
  });

  it("puts no element over a photo: the figure's only image is inside the box", () => {
    render(<SizeOutlines spec={spec("TBZ-1013")} factor={5} calibrated />);
    const fig = screen.getByTestId("size-item-piece");
    expect(within(fig).getAllByRole("img")).toHaveLength(1);
    const box = screen.getByTestId("size-box-piece");
    expect(box.nextElementSibling?.tagName).toBe("FIGCAPTION");
  });
});

/* ---------- SizeRuler ---------- */

describe("SizeRuler", () => {
  const items = spec("TPN-1206").items;

  it("draws a tick per millimetre at mmToPx, 100 mm when there is room", () => {
    render(<SizeRuler factor={4} calibrated={false} items={items} />);
    const ruler = screen.getByTestId("screen-ruler");
    expect(ruler).toHaveAttribute("aria-hidden", "true");
    const lines = ruler.querySelectorAll("line");
    expect(lines).toHaveLength(101);
    expect(Number(lines[10].getAttribute("x1"))).toBe(mmToPx(10, 4));
    expect(Number(lines[100].getAttribute("x1"))).toBe(mmToPx(100, 4));
    expect(Number(lines[10].getAttribute("y2"))).toBeGreaterThan(Number(lines[5].getAttribute("y2")));
    expect(Number(lines[5].getAttribute("y2"))).toBeGreaterThan(Number(lines[1].getAttribute("y2")));
    expect(Array.from(ruler.querySelectorAll("text")).map((t) => t.textContent)).toEqual([
      "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "cm",
    ]);
  });

  it("shortens to whole centimetres when the width is short", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    render(<SizeRuler factor={4} calibrated={false} items={items} />);
    expect(screen.getByTestId("screen-ruler").querySelectorAll("line")).toHaveLength(71);
    spy.mockRestore();
  });

  it("labels the ruler by mode", () => {
    const { rerender } = render(<SizeRuler factor={4} calibrated={false} items={items} />);
    expect(screen.getByText("Approximate ruler")).toBeInTheDocument();
    expect(screen.queryByText("Check the size against a real ruler")).toBeNull();
    rerender(<SizeRuler factor={4} calibrated items={items} />);
    expect(screen.getByText("Check the size against a real ruler")).toBeInTheDocument();
    expect(screen.queryByText("Approximate ruler")).toBeNull();
  });

  it("the print button calls window.print", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<SizeRuler factor={4} calibrated={false} items={items} />);
    fireEvent.click(screen.getByRole("button", { name: "Print a 1:1 paper ruler" }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("the print sheet is print-only, in mm units, with the ruler, card and outlines", () => {
    render(<SizeRuler factor={4} calibrated={false} items={items} />);
    const sheet = screen.getByTestId("print-sheet");
    expect(sheet.className).toContain("hidden");
    expect(sheet.className).toContain("print:block");
    expect(sheet).toHaveTextContent(
      "Print at 100% scale — turn off 'Fit to page' — then check the ruler against a real one.",
    );
    const svg = sheet.querySelector("svg") as SVGElement;
    expect(svg.getAttribute("width")).toMatch(/^\d+(\.\d+)?mm$/);
    expect(svg.getAttribute("height")).toMatch(/^\d+(\.\d+)?mm$/);
    const rects = Array.from(svg.querySelectorAll("rect")).map((r) => [
      Number(r.getAttribute("width")),
      Number(r.getAttribute("height")),
    ]);
    expect(rects).toEqual([
      [85.6, 53.98],
      [4.55, 11.5],
      [3.9, 5.35],
    ]);
    // ruler: 101 ticks + the 100 mm baseline
    expect(svg.querySelectorAll("line").length).toBeGreaterThanOrEqual(101);
  });

  it("the print sheet draws rings and height lines at their listed millimetres", () => {
    const { unmount } = render(<SizeRuler factor={4} calibrated={false} items={spec("TNZ-1056").items} />);
    const circle = screen.getByTestId("print-sheet").querySelector("circle") as SVGElement;
    expect(Number(circle.getAttribute("r")) * 2).toBeCloseTo(133.4 / Math.PI, 9);
    unmount();
    const base = product("TPN-1149");
    const line = buildSizeSpec({ ...base, dims: { kind: "item", height_mm: 14.4, width_mm: null } });
    render(<SizeRuler factor={4} calibrated={false} items={line.items} />);
    expect(screen.getByTestId("print-sheet")).toHaveTextContent("14.4 mm tall");
  });

  it("wraps shapes onto a new row when the sheet width is used up", () => {
    // the card (85.6) + a bracelet ring (42.5) + a bangle would overflow 180 mm only with 3+ wide shapes
    const wide = [...spec("TNZ-1056").items, ...spec("TOB-1009").items, ...spec("TPN-1459").items];
    render(<SizeRuler factor={4} calibrated={false} items={wide} />);
    const svg = screen.getByTestId("print-sheet").querySelector("svg") as SVGElement;
    const heights = svg.getAttribute("viewBox")?.split(" ").map(Number) ?? [];
    expect(heights[3]).toBeGreaterThan(14 + 8 + 53.98 + 6); // more than one row
  });
});

/* ---------- TrueSizeViewer ---------- */

const LABEL = "Approximate size — calibrate with a card for true size.";
const STALE = "Your browser zoom or screen changed since you calibrated, so sizes are approximate again. Calibrate again to restore them.";
const TRUE_SIZE = /true[- ]size/i;

const calibrateTo = (value: string) => {
  fireEvent.click(screen.getByRole("button", { name: "Calibrate with a card" }));
  fireEvent.change(screen.getByRole("slider", { name: "Card outline width" }), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "This matches" }));
};
const storeCalibration = (pxPerMm: number, dpr = 1) =>
  window.localStorage.setItem(STORAGE_KEY, serializeCalibration({ pxPerMm, dpr }));

/** Every text-bearing attribute on the page, for the wording rule. */
const attributeText = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("*")).flatMap((el) =>
    ["aria-label", "title", "alt"].map((a) => el.getAttribute(a) ?? ""),
  );

describe("TrueSizeViewer: approximate mode", () => {
  it("shows the exact label once, and no other 'true size' text", () => {
    render(<TrueSizeViewer spec={spec("TPN-1459")} />);
    expect(screen.getByText(LABEL)).toBeInTheDocument();
    const hits = screen.getAllByText(TRUE_SIZE);
    expect(hits).toHaveLength(1);
    expect(hits[0].textContent).toBe(LABEL);
    for (const a of attributeText(screen.getByTestId("size-viewer"))) expect(a).not.toMatch(TRUE_SIZE);
  });

  it("is a labelled region with the heading 'Size on your screen' and the calibrate button", () => {
    render(<TrueSizeViewer spec={spec("TPN-1459")} />);
    const region = screen.getByTestId("size-viewer");
    expect(region).toHaveAttribute("aria-labelledby", "size-title");
    const h = screen.getByRole("heading", { level: 2, name: "Size on your screen" });
    expect(h.id).toBe("size-title");
    expect(h.textContent).not.toMatch(TRUE_SIZE);
    expect(screen.getByRole("button", { name: "Calibrate with a card" })).toBeInTheDocument();
    expect(screen.getByText("Approximate ruler")).toBeInTheDocument();
    expect(screen.queryByText("Calibrated to your screen")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset calibration" })).toBeNull();
  });

  it("draws at the CSS millimetre and uses the approximate ring caption", () => {
    render(<TrueSizeViewer spec={spec("TNZ-1056")} />);
    expect(screen.getByText("ring outline, approximate size — 5.25 in around")).toBeInTheDocument();
    expect(Number(screen.getByTestId("size-ring-bracelet").getAttribute("width"))).toBeCloseTo(
      mmToPx(133.4 / Math.PI, CSS_PX_PER_MM),
      9,
    );
  });

  it("calibration is three interactions: open, move the slider, confirm", () => {
    render(<TrueSizeViewer spec={spec("TPN-1459")} />);
    expect(screen.queryByRole("slider")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Calibrate with a card" })); // 1
    expect(screen.getByRole("slider", { name: "Card outline width" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Calibrate with a card" })).toBeNull();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "360" } }); // 2
    fireEvent.click(screen.getByRole("button", { name: "This matches" })); // 3
    expect(screen.getByText("Calibrated to your screen")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("Cancel closes the slider and stores nothing", () => {
    render(<TrueSizeViewer spec={spec("TPN-1459")} />);
    fireEvent.click(screen.getByRole("button", { name: "Calibrate with a card" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.getByText(LABEL)).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("TrueSizeViewer: calibrating and resetting", () => {
  it("switches to calibrated, rewrites sizes by the new factor, and shows the calibrated texts", () => {
    render(<TrueSizeViewer spec={spec("TPN-1459")} />);
    const box = () => screen.getByTestId("size-box-piece");
    expect(parseFloat(box().style.width)).toBeCloseTo(mmToPx(18.6, CSS_PX_PER_MM), 2);
    calibrateTo("360");
    const f = 360 / 85.6;
    expect(parseFloat(box().style.width)).toBeCloseTo(mmToPx(18.6, f), 2);
    expect(parseFloat(box().style.height)).toBeCloseTo(mmToPx(26, f), 2);
    const card = screen.getByTestId("reference-card");
    expect(parseFloat(card.style.width)).toBeCloseTo(360, 2);
    expect(screen.getByText("Calibrated to your screen")).toBeInTheDocument();
    expect(screen.queryByText(LABEL)).toBeNull();
    expect(screen.queryByText("Approximate ruler")).toBeNull();
    expect(screen.getByText("Check the size against a real ruler")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset calibration" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Calibrate with a card" })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string)).toMatchObject({ v: 1, pxPerMm: f });
  });

  it("the calibrated ring caption may say 'true size'", () => {
    render(<TrueSizeViewer spec={spec("TNZ-1056")} />);
    calibrateTo("360");
    expect(screen.getByText("ring outline at true size — 5.25 in around")).toBeInTheDocument();
    expect(Number(screen.getByTestId("size-ring-bracelet").getAttribute("width"))).toBeCloseTo(
      mmToPx(133.4 / Math.PI, 360 / 85.6),
      9,
    );
  });

  it("Reset calibration returns to the approximate label in the same render and clears the key", () => {
    render(<TrueSizeViewer spec={spec("TPN-1459")} />);
    calibrateTo("360");
    fireEvent.click(screen.getByRole("button", { name: "Reset calibration" }));
    expect(screen.getByText(LABEL)).toBeInTheDocument();
    expect(screen.getAllByText(TRUE_SIZE)).toHaveLength(1);
    expect(screen.queryByText("Calibrated to your screen")).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(parseFloat(screen.getByTestId("size-box-piece").style.width)).toBeCloseTo(
      mmToPx(18.6, CSS_PX_PER_MM),
      2,
    );
  });

  it("applies a stored calibration after mount", () => {
    storeCalibration(4.5);
    render(<TrueSizeViewer spec={spec("TPN-1459")} />);
    expect(screen.getByText("Calibrated to your screen")).toBeInTheDocument();
    expect(parseFloat(screen.getByTestId("size-box-piece").style.width)).toBeCloseTo(mmToPx(18.6, 4.5), 2);
  });

  it("still calibrates when localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    render(<TrueSizeViewer spec={spec("TPN-1459")} />);
    calibrateTo("360");
    expect(screen.getByText("Calibrated to your screen")).toBeInTheDocument();
  });
});

describe("TrueSizeViewer: stale calibration", () => {
  it("shows the stale note and the approximate label, keeps the stored value", () => {
    storeCalibration(4.5, 2);
    render(<TrueSizeViewer spec={spec("TNZ-1056")} />);
    expect(screen.getByText(STALE)).toBeInTheDocument();
    expect(screen.getByText(LABEL)).toBeInTheDocument();
    expect(screen.getAllByText(TRUE_SIZE)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Calibrate with a card" })).toBeInTheDocument();
    expect(screen.getByText("ring outline, approximate size — 5.25 in around")).toBeInTheDocument();
    expect(screen.queryByText("Calibrated to your screen")).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(serializeCalibration({ pxPerMm: 4.5, dpr: 2 }));
    for (const a of attributeText(screen.getByTestId("size-viewer"))) expect(a).not.toMatch(TRUE_SIZE);
  });

  it("calibrating again replaces the stale value and clears the note", () => {
    storeCalibration(4.5, 2);
    render(<TrueSizeViewer spec={spec("TPN-1459")} />);
    calibrateTo("360");
    expect(screen.queryByText(STALE)).toBeNull();
    expect(screen.getByText("Calibrated to your screen")).toBeInTheDocument();
  });
});

describe("P-TS-11: the wording rule over all 22 products", () => {
  const skus = catalogSkus();

  it("approximate mode: 'true size' appears once, inside the exact label", () => {
    expect(skus).toHaveLength(22);
    for (const sku of skus) {
      const { unmount } = render(<TrueSizeViewer spec={spec(sku)} />);
      const root = screen.getByTestId("size-viewer");
      const hits = within(root).getAllByText(TRUE_SIZE);
      expect(hits, sku).toHaveLength(1);
      expect(hits[0].textContent, sku).toBe(LABEL);
      expect(within(root).getByText(LABEL), sku).toBeInTheDocument();
      expect(root.textContent?.match(/true[- ]size/gi), sku).toHaveLength(1);
      for (const a of attributeText(root)) expect(a, sku).not.toMatch(TRUE_SIZE);
      unmount();
    }
  });

  it("stale mode: the same rule", () => {
    storeCalibration(4.5, 2);
    for (const sku of skus) {
      const { unmount } = render(<TrueSizeViewer spec={spec(sku)} />);
      const root = screen.getByTestId("size-viewer");
      expect(root.textContent?.match(/true[- ]size/gi), sku).toHaveLength(1);
      expect(within(root).getByText(LABEL), sku).toBeInTheDocument();
      unmount();
    }
  });

  it("calibrated mode: the label is gone and 'Calibrated to your screen' is present", () => {
    storeCalibration(4.5);
    for (const sku of skus) {
      const { unmount } = render(<TrueSizeViewer spec={spec(sku)} />);
      const root = screen.getByTestId("size-viewer");
      expect(within(root).queryByText(LABEL), sku).toBeNull();
      expect(within(root).getByText("Calibrated to your screen"), sku).toBeInTheDocument();
      expect(within(root).getByText("Check the size against a real ruler"), sku).toBeInTheDocument();
      unmount();
    }
  });
});
