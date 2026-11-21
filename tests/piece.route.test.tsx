// P-GP-9 and the route behaviour of /piece/[sku] (gift-presentation design §9). Node environment:
// the async server page is called as a function and its element is rendered to static markup.
import fc from "fast-check";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PiecePage, { generateStaticParams } from "../app/piece/[sku]/page";
import { catalog } from "../lib/catalog-store";
import { FIT_CHECK_LINE } from "../lib/safety";
import { encodeModelParam } from "../lib/model-param";
import { toModel } from "../lib/conversation";
import { AGE_GROUP_LABEL } from "../lib/matching/templates";
import { AGE_LABEL } from "../lib/matching/age";
import { GOLDEN1_TAPS, run } from "./helpers/conversation-taps";
import { arbModel } from "./helpers/model-arbitrary";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

const APPROX = "Approximate size — calibrate with a card for true size.";
const NO_RECIPIENT = "No recipient selected — age fit shown against all listed age groups";

const g1 = toModel(run(GOLDEN1_TAPS).answers);
if (!g1.ok) throw new Error("golden 1 incomplete");
const G1_PARAM = encodeModelParam(g1.model);

const urlOf = (sku: string) => catalog.products.find((p) => p.sku === sku)!.url;

/** React escapes quotes and ampersands in text; undo that so exact phrases can be compared. */
const text = (html: string) => html.replaceAll("&#x27;", "'").replaceAll("&amp;", "&").replaceAll("&quot;", '"');

/** Visible text only: tags and attributes (such as the viewer's data-testid) are removed. */
const visible = (html: string) => html.replace(/<[^>]*>/g, " ");

async function render(sku: string, m?: string | string[]) {
  const el = await PiecePage({
    params: Promise.resolve({ sku }),
    searchParams: Promise.resolve(m === undefined ? {} : { m }),
  });
  return text(renderToStaticMarkup(el));
}
const count = (hay: string, needle: string | RegExp) =>
  needle instanceof RegExp ? (hay.match(new RegExp(needle, "gi")) ?? []).length : hay.split(needle).length - 1;

describe("generateStaticParams (REQ-GP-01)", () => {
  it("returns the 22 catalog SKUs", async () => {
    const params = await generateStaticParams();
    expect(params).toHaveLength(22);
    expect(params.map((p) => p.sku)).toEqual(catalog.products.map((p) => p.sku));
  });
});

describe("unknown SKU (REQ-GP-02)", () => {
  it.each(["NOPE-0000", "tnz-1056", "TNZ-1056 ", ""])("%j throws the not-found error", async (sku) => {
    await expect(
      PiecePage({ params: Promise.resolve({ sku }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });
});

describe("TNZ-1056 without a recipient", () => {
  it("shows the verdict, the fit-check line, the viewer label once, the wrap and the buy link", async () => {
    const html = await render("TNZ-1056");
    expect(count(html, FIT_CHECK_LINE)).toBe(1);
    expect(count(html, NO_RECIPIENT)).toBe(1);
    expect(count(html, APPROX)).toBe(1);
    expect(count(visible(html), /true[- ]size/)).toBe(1);
    expect(count(html, "Wrap this gift")).toBe(1);
    expect(count(html, `href="${urlOf("TNZ-1056")}"`)).toBe(1);
    expect(count(html, "Buy on Tiny Tiaraa")).toBe(1);
    expect(count(html, "Photo as listed — shown enlarged, not to scale.")).toBe(1);
    expect(count(html, "Back to the atelier")).toBe(1);
    expect(count(html, "Out of stock")).toBe(0);
    expect(count(html, "No certifications are stated on this product")).toBe(1);
  });

  it("shows the price with its footnote inside one price region, and no discount wording", async () => {
    const html = await render("TNZ-1056");
    expect(count(html, "data-price-region")).toBe(1);
    expect(html).toContain("Price as listed on tinytiaraa.com on 21 Nov 2026 — check the store for the current price.");
    expect(html).not.toMatch(/% off|save ₹|MRP|was ₹|line-through/i);
  });

  it("shows the facts, the rating, and not the design application number", async () => {
    const html = await render("TNZ-1056");
    expect(html).toContain('data-source="materials"');
    expect(html).toContain("4.7/5 (3 reviews)");
    expect(html).not.toContain("462592-001");
    expect(html).not.toContain('data-source="chain"');
  });

  it("an invalid m renders like no m, and a missing m too", async () => {
    const base = await render("TNZ-1056");
    expect(await render("TNZ-1056", "not json")).toBe(base);
    expect(await render("TNZ-1056", ["a", "b"])).toBe(base);
    expect(await render("TNZ-1056", "")).toBe(base);
  });
});

describe("with a recipient", () => {
  it("golden 1 feeds the age row and the back link", async () => {
    const html = await render("TBZ-1013", G1_PARAM);
    expect(count(html, "Listed by Tiny Tiaraa for infants 0–3 years")).toBe(1);
    expect(count(html, NO_RECIPIENT)).toBe(0);
    expect(count(html, "Back to your picks")).toBe(1);
    expect(html).toContain("/picks?m=");
  });

  it("feeds the gift draft through a wrapped card (relationship and occasion)", async () => {
    const html = await render("TBZ-1013", G1_PARAM);
    // The draft sits in the client component's props; the closed box is what renders on the server.
    expect(count(html, "Wrap this gift")).toBe(1);
    expect(count(html, "Your gift is wrapped")).toBe(0);
  });
});

describe("TNZ-1058, out of stock (REQ-GP-09)", () => {
  it("shows the badge, facts, verdict and viewer, and no buy control or wrap", async () => {
    const html = await render("TNZ-1058");
    expect(count(html, "Out of stock")).toBeGreaterThanOrEqual(1);
    expect(count(html, "This piece is out of stock on the listing.")).toBe(1);
    expect(count(html, "tinytiaraa.com/product")).toBe(0);
    expect(count(html, "Buy on Tiny Tiaraa")).toBe(0);
    expect(count(html, "Wrap this gift")).toBe(0);
    expect(count(html, FIT_CHECK_LINE)).toBe(1);
    expect(count(html, APPROX)).toBe(1);
    expect(html).toContain('href="/atelier"');
  });
});

describe("all 22 pieces", () => {
  it("render; in-stock ones carry exactly one buy link equal to the catalog url, the others none", async () => {
    for (const p of catalog.products) {
      const html = await render(p.sku);
      const buy = count(html, "Buy on Tiny Tiaraa");
      if (p.availability === "In Stock") {
        expect(buy, p.sku).toBe(1);
        expect(count(html, `href="${p.url}"`), p.sku).toBe(1);
        expect(count(html, "Wrap this gift"), p.sku).toBe(1);
      } else {
        expect(buy, p.sku).toBe(0);
        expect(count(html, "Wrap this gift"), p.sku).toBe(0);
      }
      expect(count(html, p.name), p.sku).toBeGreaterThanOrEqual(1);
      expect(count(html, APPROX), p.sku).toBe(1);
      expect(count(visible(html), /true[- ]size/), p.sku).toBe(1);
      expect(html, p.sku).not.toMatch(/\b(safe|unsafe)\b/i);
      expect(html, p.sku).toContain(`/catalog/${p.image_file}`);
    }
  });
});

describe("P-GP-9 band context", () => {
  it("a valid model sets the band, an invalid m is never an error", async () => {
    const arbInvalid = fc.oneof(
      fc.string({ maxLength: 60 }),
      fc.constant(undefined),
      fc.array(fc.string({ maxLength: 10 }), { maxLength: 3 }),
      arbModel.map((m) => JSON.stringify({ ...m, budgetBand: "cheap" })),
    );
    await fc.assert(
      fc.asyncProperty(arbModel, arbInvalid, async (model, bad) => {
        const html = await render("TBZ-1013", encodeModelParam(model));
        const listed = catalog.products.find((p) => p.sku === "TBZ-1013")!.age_groups;
        const label = AGE_GROUP_LABEL[AGE_LABEL[model.ageBand]];
        expect(count(html, NO_RECIPIENT)).toBe(0);
        if (listed.includes(AGE_LABEL[model.ageBand])) {
          expect(count(html, `Listed by Tiny Tiaraa for ${label}`)).toBe(1);
        } else {
          expect(count(html, `Not listed for ${label}.`)).toBe(1);
        }
        const none = await render("TBZ-1013", bad as string | string[] | undefined);
        expect(count(none, NO_RECIPIENT)).toBe(1);
      }),
      { seed: 20261124, numRuns: 200 },
    );
  }, 60_000); // 400 full-page renders: about 2.5 s alone, slower when 40 test files run in parallel
});
