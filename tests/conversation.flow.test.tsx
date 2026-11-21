// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "./helpers/dom";
import Conversation from "../components/Conversation";
import { momSkipNote } from "../lib/conversation";
import { parseModelParam } from "../lib/model-param";
import type { RecipientModel } from "../lib/matching/types";
import { catalog } from "./helpers/matching-fixtures";

const MOM_NOTE = momSkipNote(catalog);

const GOLDEN1: RecipientModel = {
  relationship: "niece-nephew",
  ageBand: "infants",
  ageYears: 0,
  occasion: "naming",
  budgetBand: "under-2500",
  metal: "silver",
  symbols: "any",
  category: "any",
};

const mount = (props: Partial<Parameters<typeof Conversation>[0]> = {}) =>
  render(<Conversation momNote={MOM_NOTE} {...props} />);
const tap = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const heading = () => screen.getByRole("heading", { level: 1 }).textContent;
const tapAll = (...names: string[]) => names.forEach(tap);

const GOLDEN1_TAPS = [
  "Niece or nephew",
  "0–1",
  "Naming ceremony",
  "Under ₹2,500",
  "925 silver",
  "Any",
  "Surprise me",
];

describe("the /find conversation by taps", () => {
  it("golden 1: card headline, 7 Edit buttons, Reveal link decodes to the golden-1 model", () => {
    mount();
    tapAll(...GOLDEN1_TAPS);
    expect(heading()).toBe("A naming gift for your niece or nephew, 0–1 years");
    expect(screen.getAllByRole("button", { name: /^Edit / })).toHaveLength(7);
    const href = screen.getByRole("link", { name: "Reveal my picks" }).getAttribute("href") ?? "";
    expect(href.startsWith("/picks?m=")).toBe(true);
    const m = new URL(href, "http://localhost").searchParams.get("m") ?? "";
    expect(JSON.parse(m)).toEqual(GOLDEN1);
    expect(parseModelParam(m)).toEqual({ status: "ok", model: GOLDEN1 });
  });

  it("the five conversational prompts match PRD §4 verbatim", () => {
    mount();
    const seen: (string | null)[] = [heading()];
    tapAll("Niece or nephew", "0–1"); // age question (new copy, Q9) sits between
    seen.push(heading());
    tap("Naming ceremony");
    seen.push(heading());
    tap("Under ₹2,500");
    seen.push(heading());
    tap("925 silver");
    seen.push(heading());
    expect(seen).toEqual([
      "Who are we finding a gift for?",
      "What's the occasion?",
      "What shall we spend?",
      "Gold or silver?",
      "Any symbols you'd love — or like to avoid?",
    ]);
  });

  it("shows the progress marker with a text equivalent", () => {
    mount();
    expect(screen.getByText("Question 1 of 6")).toBeInTheDocument();
    tapAll("Niece or nephew");
    expect(heading()).toBe("How old is the little one?");
    expect(screen.getByText("Question 1 of 6")).toBeInTheDocument();
    tap("0–1");
    expect(screen.getByText("Question 2 of 6")).toBeInTheDocument();
  });

  it("chips are buttons with aria-pressed", () => {
    mount();
    tap("Niece or nephew");
    tap("Back");
    expect(screen.getByRole("button", { name: "Niece or nephew" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Mom" })).toHaveAttribute("aria-pressed", "false");
  });

  it("religious sub-chips are absent until Religious is tapped and gone after Zodiac", () => {
    mount();
    tapAll("Niece or nephew", "0–1", "Naming ceremony", "Under ₹2,500", "925 silver");
    expect(screen.queryByRole("button", { name: "Ganesha" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    tap("Religious");
    expect(heading()).toBe("Any symbols you'd love — or like to avoid?");
    expect(screen.getByRole("button", { name: "Ganesha" })).toBeInTheDocument();
    tap("Ganesha");
    expect(screen.getByRole("button", { name: "Ganesha" })).toHaveAttribute("aria-pressed", "true");
    tap("Zodiac");
    tap("Back");
    expect(screen.getByRole("button", { name: "Zodiac" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Ganesha" })).toBeNull();
  });

  it("Religious + Ganesha + Continue continues to the piece question", () => {
    mount();
    tapAll("Someone else", "12–19", "Festival", "₹15,000–₹25,000", "18KT gold", "Religious");
    tapAll("Ganesha", "Continue");
    expect(heading()).toBe("What kind of piece?");
    tap("Surprise me");
    const href = screen.getByRole("link", { name: "Reveal my picks" }).getAttribute("href") ?? "";
    const m = JSON.parse(new URL(href, "http://localhost").searchParams.get("m") ?? "");
    expect(m).toMatchObject({ symbols: "religious", symbolList: ["ganesha"] });
  });

  it("Mom path never asks the age or piece question and shows the mom note", () => {
    mount();
    const prompts: (string | null)[] = [heading()];
    tap("Mom");
    prompts.push(heading());
    tap("Birthday");
    prompts.push(heading());
    tap("₹25,000+");
    prompts.push(heading());
    tap("18KT gold");
    prompts.push(heading());
    tap("Any");
    expect(prompts).not.toContain("How old is the little one?");
    expect(prompts).not.toContain("What kind of piece?");
    expect(heading()).toBe("A birthday gift for Mom");
    expect(screen.getByText(MOM_NOTE)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Edit / })).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Reveal my picks" })).toBeInTheDocument();
  });

  it("adult + No ends with the exact message, a link to /atelier and no Reveal", () => {
    mount();
    tapAll("Someone else", "An adult");
    expect(heading()).toBe("Is this for Mom?");
    tap("No");
    expect(heading()).toBe("This atelier specialises in babies, kids, and Mom.");
    expect(screen.getByRole("link", { name: "Browse the atelier" })).toHaveAttribute(
      "href",
      "/atelier",
    );
    expect(screen.queryByText("Reveal my picks")).toBeNull();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("adult + Yes, Mom continues as Mom", () => {
    mount();
    tapAll("Someone else", "An adult", "Yes, Mom");
    expect(heading()).toBe("What's the occasion?");
  });

  it("Back keeps the earlier chip pressed", () => {
    mount();
    tapAll("Niece or nephew", "0–1", "Naming ceremony", "Under ₹2,500");
    tap("Back");
    expect(screen.getByRole("button", { name: "Under ₹2,500" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    tap("Back");
    expect(screen.getByRole("button", { name: "Naming ceremony" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("Edit on the budget line returns to the card with the new value", () => {
    mount();
    tapAll(...GOLDEN1_TAPS);
    tap("Edit Budget");
    expect(heading()).toBe("What shall we spend?");
    tap("₹25,000+");
    expect(screen.getByText("₹25,000+")).toBeInTheDocument();
    expect(screen.queryByText("Under ₹2,500")).toBeNull();
    expect(screen.getByRole("link", { name: "Reveal my picks" })).toBeInTheDocument();
  });

  it("changing Mom to Grandchild from the card asks the age question first", () => {
    mount();
    tapAll("Mom", "Birthday", "₹25,000+", "18KT gold", "Any");
    tap("Edit Who");
    tap("Grandchild");
    expect(heading()).toBe("How old is the little one?");
    tap("3–6");
    expect(heading()).toBe("What kind of piece?");
    tap("Pendant");
    expect(heading()).toBe("A birthday gift for your grandchild, 3–6 years");
  });

  it("notice=incomplete shows the note", () => {
    mount({ notice: "incomplete" });
    expect(
      screen.getByText("That link did not carry a complete recipient, so let's start again."),
    ).toBeInTheDocument();
    expect(heading()).toBe("Who are we finding a gift for?");
  });

  it("an initial model resumes on the card with every line editable", () => {
    mount({ initialModel: GOLDEN1 });
    expect(heading()).toBe("A naming gift for your niece or nephew, 0–1 years");
    expect(screen.getAllByRole("button", { name: /^Edit / })).toHaveLength(7);
  });

  it("moves focus to the new prompt heading on a step change", () => {
    mount();
    tap("Niece or nephew");
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("offers no free-text input anywhere (REQ-CV-01, 44)", () => {
    const { container } = mount();
    const check = () => {
      expect(container.querySelector('input[type="text"]')).toBeNull();
      expect(container.querySelector("textarea")).toBeNull();
      expect(container.querySelector("input:not([type])")).toBeNull();
    };
    check();
    for (const name of GOLDEN1_TAPS) {
      tap(name);
      check();
    }
  });
});
