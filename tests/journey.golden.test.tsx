// @vitest-environment jsdom
// Wave 5 acceptance (REQ-CV-08, 40, 41): the golden cases, the 8 personas and the 3 flow cases of
// design §12, each tapped through <Conversation>, then decoded from the "Reveal my picks" href
// and run through parseModelParam → match() → toPickViews → the /picks page. Expected values are
// pinned literals (from REQ-MC-33 to 35 and tests/matching.personas.test.ts); never loosen them.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import PicksPage from "../app/picks/page";
import Conversation from "../components/Conversation";
import { momSkipNote } from "../lib/conversation";
import { match } from "../lib/matching";
import { parseModelParam } from "../lib/model-param";
import { toPickViews } from "../lib/picks-view";
import { RELIGIOUS_SKUS, catalog, product } from "./helpers/matching-fixtures";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

const MOM_NOTE = momSkipNote(catalog);

type Taps = readonly string[];

/** Taps the chips, counting every tap. "Reveal my picks" is one more tap (a link, not clicked here). */
function tapThrough(taps: Taps) {
  let count = 0;
  render(<Conversation momNote={MOM_NOTE} />);
  for (const name of taps) {
    fireEvent.click(screen.getByRole("button", { name }));
    count++;
  }
  const reveal = screen.getByRole("link", { name: "Reveal my picks" });
  count++;
  const href = reveal.getAttribute("href") ?? "";
  return { count, href };
}

async function journey(taps: Taps) {
  const { count, href } = tapThrough(taps);
  expect(href.startsWith("/picks?m=")).toBe(true);
  const m = new URL(href, "http://localhost").searchParams.get("m") ?? "";
  const parsed = parseModelParam(m);
  if (parsed.status !== "ok") throw new Error(`href did not decode to a model: ${parsed.status}`);
  const result = match(parsed.model, catalog);
  const views = toPickViews(result, catalog);
  cleanup();
  render(await PicksPage({ searchParams: Promise.resolve({ m }) }));
  return { count, model: parsed.model, result, views };
}

const names = () => screen.queryAllByRole("article").map((a) => within(a).getByRole("heading", { level: 2 }).textContent);

const G1: Taps = ["Niece or nephew", "0–1", "Naming ceremony", "Under ₹2,500", "925 silver", "Any", "Surprise me"];
const G2: Taps = ["Mom", "Birthday", "₹25,000+", "18KT gold", "Any"];
const G3: Taps = [
  "Someone else", "12–19", "Festival", "₹15,000–₹25,000", "18KT gold", "Religious", "Ganesha", "Continue", "Surprise me",
];

const G3_DISCLOSURES = [
  "No pieces matched your ₹15,000–₹25,000 budget, so we widened it to the band just below — your picks are marked.",
  "Only 1 piece matched your Ganesha request, so we broadened it to other religious symbols — your picks are marked.",
];
const TPN_1141_SENTENCE =
  "Your Ganesha pendant sits just below your budget at ₹14,249, so we widened the search slightly.";

type Pinned = readonly (readonly [string, number])[];

function expectPicks(
  r: Awaited<ReturnType<typeof journey>>,
  pinned: Pinned,
) {
  expect(r.result.picks.map((p) => [p.sku, p.score])).toEqual(pinned);
  expect(r.views.map((v) => v.sku)).toEqual(pinned.map(([s]) => s));
  expect(names()).toEqual(pinned.map(([s]) => product(s).name));
}

describe("golden cases through the UI (REQ-CV-40)", () => {
  it("golden 1: TBZ-1013, TNZ-1056, TBZ-1017 all 6, no disclosure, no shortfall", async () => {
    const r = await journey(G1);
    expectPicks(r, [["TBZ-1013", 6], ["TNZ-1056", 6], ["TBZ-1017", 6]]);
    expect(r.result.disclosures).toEqual([]);
    expect(r.result.shortfallNote).toBeUndefined();
    expect(r.views.every((v) => v.relaxationNote === undefined)).toBe(true);
    expect(screen.queryByText("How we widened the search")).toBeNull();
    expect(screen.getByText("₹2,324")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Buy on Tiny Tiaraa/ })).toHaveLength(3);
  });

  it("golden 2: THP-1001 (7), THP-1017 (6), shortfall note, browse link, no third card, no Q6", async () => {
    const { count, href } = tapThrough(G2);
    expect(count).toBe(G2.length + 1);
    expect(screen.queryByRole("heading", { name: "What kind of piece?" })).toBeNull();
    expect(screen.getByText(MOM_NOTE)).toBeInTheDocument(); // Mom note on the card
    cleanup();
    expect(href.startsWith("/picks?m=")).toBe(true);
    const r = await journey(G2);
    expectPicks(r, [["THP-1001", 7], ["THP-1017", 6]]);
    expect(r.result.shortfallNote).toBe("Only 2 pieces in the atelier are listed for Mom");
    expect(screen.getByText("Only 2 pieces in the atelier are listed for Mom")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse the full atelier" })).toHaveAttribute("href", "/atelier");
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(r.result.disclosures).toEqual([]);
  });

  it("golden 3: TPN-1141 (9), TPN-1147 (7), TPN-1143 (7), both disclosures, TPN-1141 sentence", async () => {
    const r = await journey(G3);
    expectPicks(r, [["TPN-1141", 9], ["TPN-1147", 7], ["TPN-1143", 7]]);
    expect(r.result.disclosures).toEqual(G3_DISCLOSURES);
    for (const s of G3_DISCLOSURES) expect(screen.getByText(s)).toBeInTheDocument();
    expect(r.views[0].relaxationNote).toBe(TPN_1141_SENTENCE);
    expect(screen.getByText(TPN_1141_SENTENCE)).toBeInTheDocument();
    expect(screen.getAllByText("Just below your budget").length).toBeGreaterThan(0);
    expect(screen.getAllByText("A related symbol").length).toBeGreaterThan(0);
    expect(r.result.shortfallNote).toBeUndefined();
  });
});

describe("tap budget (REQ-CV-08)", () => {
  it("golden 1 takes 8 taps including Reveal", () => {
    expect(tapThrough(G1).count).toBe(8);
  });
  it("golden 3 takes 8 + Ganesha + Continue = 10 taps including Reveal", () => {
    expect(tapThrough(G3).count).toBe(10);
  });
});

interface Persona {
  id: string;
  taps: Taps;
  picks: Pinned;
  disclosures?: readonly string[];
  shortfall?: string;
  relaxations?: readonly (readonly string[])[];
}

const PERSONAS: Persona[] = [
  { id: "1 Aunt, 6-month niece (golden 1)", taps: G1, picks: [["TBZ-1013", 6], ["TNZ-1056", 6], ["TBZ-1017", 6]], disclosures: [] },
  {
    id: "2 Grandmother, 5-year grandson",
    taps: ["Grandchild", "3–6", "Birthday", "₹15,000–₹25,000", "18KT gold", "Any", "Surprise me"],
    picks: [["TPN-1147", 6], ["TPN-1149", 6], ["TPN-1206", 4]],
    disclosures: [],
    relaxations: [[], [], []],
  },
  {
    id: "3 Friend, newborn",
    taps: ["A friend's baby", "0–1", "Baby shower", "Under ₹2,500", "No preference", "Any", "Surprise me"],
    picks: [["TNZ-1056", 4], ["TOB-1008", 4], ["TBZ-1013", 1]],
    disclosures: [],
  },
  { id: "4 Uncle, 14-year nephew (golden 3)", taps: G3, picks: [["TPN-1141", 9], ["TPN-1147", 7], ["TPN-1143", 7]], disclosures: G3_DISCLOSURES },
  {
    id: "5 Daughter, Mom (golden 2)",
    taps: G2,
    picks: [["THP-1001", 7], ["THP-1017", 6]],
    disclosures: [],
    shortfall: "Only 2 pieces in the atelier are listed for Mom",
  },
  {
    id: "6 Parent, 8-year daughter",
    taps: ["My own child", "6–12", "First birthday", "₹25,000+", "No preference", "Any", "Set"],
    picks: [["TPN-1199", 4], ["TPN-1206", 4], ["TOB-1009", 3]],
    relaxations: [[], ["budget-below"], ["category-dropped"]],
    disclosures: [
      "Only 1 piece matched your ₹25,000+ budget, so we widened it to the band just below — your picks are marked.",
      "Only 2 pieces matched your set choice, so we set it aside — your picks are marked.",
    ],
  },
  {
    id: "7 Godparent, 2-year-old",
    taps: ["Godchild", "1–3", "Rakhi", "₹2,500–₹15,000", "925 silver", "Evil eye / nazariya", "Surprise me"],
    picks: [["TNZ-1056", 9]],
    relaxations: [["budget-below"]],
    shortfall: "Only 1 piece fits this recipient even after widening — browse the full atelier.",
  },
  {
    id: "8 Buyer, 10-year-old",
    taps: ["Someone else", "6–12", "Just because", "No limit", "No preference", "No religious symbols", "Surprise me"],
    picks: [["TPN-1199", 1], ["TPN-1206", 1], ["THP-1001", 1]],
  },
];

describe("the 8 scripted personas by taps (REQ-CV-41)", () => {
  for (const p of PERSONAS) {
    it(`persona ${p.id}`, async () => {
      const r = await journey(p.taps);
      expectPicks(r, p.picks);
      if (p.disclosures) expect(r.result.disclosures).toEqual(p.disclosures);
      if (p.relaxations) expect(r.result.picks.map((x) => x.relaxations)).toEqual(p.relaxations);
      if (p.shortfall !== undefined) {
        expect(r.result.shortfallNote).toBe(p.shortfall);
        expect(screen.getByText(p.shortfall)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Browse the full atelier" })).toBeInTheDocument();
      }
      for (const s of r.result.disclosures) expect(screen.getByText(s)).toBeInTheDocument();
      // Out-of-stock item is never a pick, and no buy control points at it.
      expect(r.views.map((v) => v.sku)).not.toContain("TNZ-1058");
      expect(screen.getAllByRole("article")).toHaveLength(p.picks.length);
    });
  }

  it("persona 3: TNZ-1058 is absent from the page text", async () => {
    await journey(PERSONAS[2].taps);
    expect(document.body.textContent).not.toContain("TNZ-1058");
    expect(document.body.textContent).not.toContain(product("TNZ-1058").name);
  });

  it("persona 7: no religious piece", async () => {
    const r = await journey(PERSONAS[6].taps);
    expect(r.views.some((v) => RELIGIOUS_SKUS.includes(v.sku))).toBe(false);
  });

  it("persona 8: no religious piece", async () => {
    const r = await journey(PERSONAS[7].taps);
    expect(r.model.symbols).toBe("none-religious");
    expect(r.views.some((v) => RELIGIOUS_SKUS.includes(v.sku))).toBe(false);
  });
});

describe("flow cases 9 to 11 (design §12)", () => {
  const tap = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
  const heading = () => screen.getByRole("heading", { level: 1 }).textContent;

  it("9: Someone else · An adult · No → honest message, browse link, no /picks reachable", () => {
    render(<Conversation momNote={MOM_NOTE} />);
    ["Someone else", "An adult", "No"].forEach(tap);
    expect(heading()).toBe("This atelier specialises in babies, kids, and Mom.");
    expect(screen.getByRole("link", { name: "Browse the atelier" })).toHaveAttribute("href", "/atelier");
    expect(document.querySelector('a[href^="/picks"]')).toBeNull();
    expect(screen.queryByRole("link", { name: "Reveal my picks" })).toBeNull();
  });

  it("10: An adult · Yes, Mom → continues as Mom and reaches picks without Q6", async () => {
    const r = await journey(["Someone else", "An adult", "Yes, Mom", "Birthday", "₹25,000+", "18KT gold", "Any"]);
    expect(r.model.relationship).toBe("mom");
    expect(r.model.ageBand).toBe("mom");
    expectPicks(r, [["THP-1001", 7], ["THP-1017", 6]]);
  });

  it("11: Religious tapped, then Zodiac → sub-chips disappear and symbolList is cleared", () => {
    render(<Conversation momNote={MOM_NOTE} />);
    ["Niece or nephew", "0–1", "Naming ceremony", "Under ₹2,500", "925 silver", "Religious", "Ganesha"].forEach(tap);
    expect(screen.getByRole("button", { name: "Om" })).toBeInTheDocument();
    tap("Zodiac");
    expect(screen.queryByRole("button", { name: "Om" })).toBeNull();
    tap("Surprise me");
    const href = screen.getByRole("link", { name: "Reveal my picks" }).getAttribute("href") ?? "";
    const m = JSON.parse(new URL(href, "http://localhost").searchParams.get("m") ?? "");
    expect(m.symbols).toBe("zodiac");
    expect(m).not.toHaveProperty("symbolList");
  });
});
