import { describe, expect, it } from "vitest";
import {
  AGE_GROUP_LABEL,
  BAND_LABEL,
  OCCASION_LABEL,
  disclosure,
  formatInr,
  markerSentence,
  reasonAge,
  reasonBudgetInside,
  reasonBudgetNoLimit,
  reasonBudgetRelaxed,
  reasonMetal,
  reasonOccasion,
  reasonRating,
  reasonSymbol,
  reasonSymbolBroadened,
  requestedSymbolLabel,
  shortfallNote,
} from "../lib/matching/templates";
import { GOLDEN3, model } from "./helpers/matching-fixtures";

describe("formatInr", () => {
  it.each([
    [0, "₹0"],
    [7, "₹7"],
    [999, "₹999"],
    [1000, "₹1,000"],
    [2324, "₹2,324"],
    [14249, "₹14,249"],
    [61599, "₹61,599"],
    [100000, "₹1,00,000"],
    [1234567, "₹12,34,567"],
    [-2324, "-₹2,324"],
  ])("%s -> %s", (n, s) => expect(formatInr(n)).toBe(s));
});

describe("labels", () => {
  it("age labels use an en dash in output", () => {
    expect(AGE_GROUP_LABEL["Infants 0-3 years"]).toBe("infants 0–3 years");
    expect(AGE_GROUP_LABEL.Mom).toBe("Mom");
  });
  it("band labels", () => {
    expect(BAND_LABEL["under-2500"]).toBe("under ₹2,500");
    expect(BAND_LABEL["25000-plus"]).toBe("₹25,000+");
  });
  it("occasion labels", () => {
    expect(OCCASION_LABEL.naming).toBe("a naming ceremony");
  });
});

describe("disclosure", () => {
  it("n = 1 singular, with the spec example", () => {
    expect(disclosure("broadenSymbol", 1, GOLDEN3)).toBe(
      "Only 1 piece matched your Ganesha request, so we broadened it to other religious symbols — your picks are marked.",
    );
  });
  it("n = 0 variant", () => {
    expect(disclosure("widenBelow", 0, GOLDEN3)).toBe(
      "No pieces matched your ₹15,000–₹25,000 budget, so we widened it to the band just below — your picks are marked.",
    );
  });
  it("n = 2 plural; metal and category steps", () => {
    expect(disclosure("widenAbove", 2, GOLDEN3)).toContain("Only 2 pieces matched");
    expect(disclosure("dropMetal", 2, model({ metal: "gold" }))).toBe(
      "Only 2 pieces matched your 18KT gold preference, so we set it aside — your picks are marked.",
    );
    expect(disclosure("dropCategory", 1, model({ category: "set" }))).toBe(
      "Only 1 piece matched your set choice, so we set it aside — your picks are marked.",
    );
  });
});

describe("requestedSymbolLabel", () => {
  it("names the request", () => {
    expect(requestedSymbolLabel(GOLDEN3)).toBe("Ganesha");
    expect(requestedSymbolLabel(model({ symbols: "religious", symbolList: ["om", "jain"] }))).toBe("Om / Jain");
    expect(requestedSymbolLabel(model({ symbols: "zodiac" }))).toBe("zodiac");
    expect(requestedSymbolLabel(model({ symbols: "evil-eye" }))).toBe("evil eye");
    expect(requestedSymbolLabel(model({ symbols: "religious" }))).toBe("religious symbol");
  });
});

describe("markerSentence", () => {
  it("matches the spec example", () => {
    expect(markerSentence("Ganesha", "Pendant", "below", 14249)).toBe(
      "Your Ganesha pendant sits just below your budget at ₹14,249, so we widened the search slightly.",
    );
  });
  it("works without a symbol", () => {
    expect(markerSentence(undefined, "Set", "above", 25249)).toBe(
      "Your set sits just above your budget at ₹25,249, so we widened the search slightly.",
    );
  });
});

describe("shortfallNote", () => {
  it("Mom spec string", () => {
    expect(shortfallNote(2, 2, "Mom")).toBe("Only 2 pieces in the atelier are listed for Mom");
  });
  it("singular and zero", () => {
    expect(shortfallNote(1, 1, "Mom")).toBe("Only 1 piece in the atelier is listed for Mom");
    expect(shortfallNote(0, 0, "Mom")).toBe("No pieces in the atelier are listed for Mom");
  });
  it("generic note when the age band has depth", () => {
    expect(shortfallNote(10, 1, "Kids 3-12 years")).toBe(
      "Only 1 piece fits this recipient even after widening — browse the full atelier.",
    );
    expect(shortfallNote(10, 2, "Kids 3-12 years")).toBe(
      "Only 2 pieces fit this recipient even after widening — browse the full atelier.",
    );
    expect(shortfallNote(10, 0, "Kids 3-12 years")).toBe(
      "No pieces fit this recipient even after widening — browse the full atelier.",
    );
  });
});

describe("reason templates", () => {
  it("render the spec strings", () => {
    expect(reasonAge("Infants 0-3 years")).toBe("Listed for infants 0–3 years");
    expect(reasonBudgetInside(2324, "under-2500")).toBe("₹2,324 — inside your under-₹2,500 budget");
    expect(reasonBudgetRelaxed(14249, "15000-25000", "below")).toBe("₹14,249 — just below your ₹15,000–₹25,000 budget");
    expect(reasonBudgetNoLimit(2324)).toBe("₹2,324 — no budget limit set");
    expect(reasonOccasion("naming")).toBe("Our atelier's pick for a naming ceremony");
    expect(reasonSymbol("Ganesha")).toBe("Carries the Ganesha you asked for");
    expect(reasonSymbolBroadened("Sikh", "Ganesha")).toBe("A Sikh piece, in the same family as the Ganesha you asked for");
    expect(reasonMetal("silver")).toBe("925 silver, as you preferred");
    expect(reasonRating("5.0/5")).toBe("Rated 5.0/5 by customers");
  });
});
