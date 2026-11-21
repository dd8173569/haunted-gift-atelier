import { describe, expect, it } from "vitest";
import type { Occasion } from "../data/occasion-map";
import {
  CARD_FADE_MS,
  MESSAGE_MAX_LENGTH,
  WRAP_REVEAL_MAX_MS,
  WRAP_REVEAL_MS,
  draftMessage,
  giftContext,
  presentationFor,
} from "../lib/gift-message";
import type { Relationship } from "../lib/matching/types";
import { toModel } from "../lib/conversation";
import { GOLDEN1_TAPS, run } from "./helpers/conversation-taps";

const SHIVA = "Third Eye Protection - Tabeez, blessed by Lord Shiva, a shield of divine protection.";

describe("constants", () => {
  it("the reveal fits inside 3 seconds", () => {
    expect(WRAP_REVEAL_MS).toBe(2400);
    expect(CARD_FADE_MS).toBe(400);
    expect(WRAP_REVEAL_MAX_MS).toBe(3000);
    expect(MESSAGE_MAX_LENGTH).toBe(500);
    expect(WRAP_REVEAL_MS + CARD_FADE_MS).toBeLessThanOrEqual(WRAP_REVEAL_MAX_MS);
    expect(WRAP_REVEAL_MAX_MS).toBeLessThanOrEqual(3000);
  });
});

describe("giftContext", () => {
  it("null model gives no context", () => {
    expect(giftContext(null)).toEqual({ relationship: null, occasion: null });
  });
  it("takes relationship and occasion from the model", () => {
    const r = toModel(run(GOLDEN1_TAPS).answers);
    if (!r.ok) throw new Error("incomplete");
    expect(giftContext(r.model)).toEqual({ relationship: "niece-nephew", occasion: "naming" });
  });
});

describe("draftMessage", () => {
  const SALUTATIONS: [Relationship, string][] = [
    ["niece-nephew", "To my little niece or nephew,"],
    ["grandchild", "To my dear grandchild,"],
    ["friends-baby", "To my friend's little one,"],
    ["godchild", "To my dear godchild,"],
    ["own-child", "To my little one,"],
    ["mom", "To Mom,"],
    ["other", "To a little one I care about,"],
  ];
  const LINES: [Occasion, string][] = [
    ["naming", "Welcome to the world, and congratulations on your naming ceremony."],
    ["birthday", "Happy birthday!"],
    ["first-birthday", "Happy first birthday!"],
    ["baby-shower", "Congratulations on the baby shower."],
    ["festival", "Wishing you a joyful festival."],
    ["rakhi", "Happy Rakhi!"],
    ["just-because", "Just because you are loved."],
    ["other", "Thinking of you."],
  ];

  it.each(SALUTATIONS)("salutation for %s", (relationship, line) => {
    expect(draftMessage({ relationship, occasion: null }, "X").split("\n")[0]).toBe(line);
  });
  it.each(LINES)("occasion line for %s", (occasion, line) => {
    expect(draftMessage({ relationship: null, occasion }, "X").split("\n")[1]).toBe(line);
  });

  it("has the exact four lines for niece-nephew, naming", () => {
    expect(draftMessage({ relationship: "niece-nephew", occasion: "naming" }, SHIVA)).toBe(
      [
        "To my little niece or nephew,",
        "Welcome to the world, and congratulations on your naming ceremony.",
        `I chose \u201C${SHIVA}\u201D for you.`,
        "With love,",
      ].join("\n"),
    );
  });
  it("uses the generic salutation and line without a recipient", () => {
    expect(draftMessage({ relationship: null, occasion: null }, "Gold with Diamond Om Pendant")).toBe(
      "To someone special,\nThinking of you.\nI chose \u201CGold with Diamond Om Pendant\u201D for you.\nWith love,",
    );
  });
  it("keeps a trailing full stop verbatim inside the curly quotes", () => {
    const d = draftMessage({ relationship: "godchild", occasion: "birthday" }, "Lucky Charms.");
    expect(d).toContain("\u201CLucky Charms.\u201D for you.");
  });
  it("is deterministic", () => {
    const ctx = { relationship: "mom", occasion: "rakhi" } as const;
    expect(draftMessage(ctx, "A")).toBe(draftMessage(ctx, "A"));
  });
});

describe("presentationFor", () => {
  const ROWS: [Occasion, string, string, string][] = [
    ["naming", "Welcome, little one", "A gift for a naming ceremony", "blush"],
    ["birthday", "Happy birthday", "A birthday gift", "champagne"],
    ["first-birthday", "A first birthday", "A gift for a first birthday", "champagne"],
    ["baby-shower", "Congratulations", "A baby shower gift", "sage"],
    ["festival", "With festival wishes", "A festival gift", "sage"],
    ["rakhi", "Happy Rakhi", "A Rakhi gift", "blush"],
    ["just-because", "Just because", "A little gift, just because", "sage"],
    ["other", "A little gift", "A gift to unwrap", "champagne"],
  ];
  it.each(ROWS)("%s", (occasion, heading, subheading, tone) => {
    expect(presentationFor({ relationship: null, occasion })).toEqual({ heading, subheading, tone });
  });
  it("no context gives the generic card", () => {
    expect(presentationFor({ relationship: null, occasion: null })).toEqual({
      heading: "A little gift",
      subheading: "A gift to unwrap",
      tone: "champagne",
    });
  });
  it("returns a copy, so a caller cannot change the table", () => {
    const a = presentationFor({ relationship: null, occasion: "naming" });
    a.heading = "changed";
    expect(presentationFor({ relationship: null, occasion: "naming" }).heading).toBe("Welcome, little one");
  });
});
