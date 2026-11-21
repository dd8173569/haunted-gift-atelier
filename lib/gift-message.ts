// The gift message and the presentation card (gift-presentation design §3).
// Pure: no React, no I/O, no clock, no randomness, no LLM. Same input, same output.
import type { Occasion } from "../data/occasion-map";
import type { RecipientModel, Relationship } from "./matching/types";

export const WRAP_REVEAL_MS = 2400; // wrapping phase length
export const CARD_FADE_MS = 400; // fade-in of the revealed card
export const WRAP_REVEAL_MAX_MS = 3000; // WRAP_REVEAL_MS + CARD_FADE_MS = 2800 <= 3000
export const MESSAGE_MAX_LENGTH = 500;

export interface GiftContext {
  relationship: Relationship | null;
  occasion: Occasion | null;
}

export type CardTone = "blush" | "champagne" | "sage";

export interface Presentation {
  heading: string;
  subheading: string;
  tone: CardTone;
}

/** No recipient model gives no context. The model's own fields are never altered. */
export function giftContext(model: RecipientModel | null): GiftContext {
  return model
    ? { relationship: model.relationship, occasion: model.occasion }
    : { relationship: null, occasion: null };
}

const SALUTATION: Record<Relationship, string> = {
  "niece-nephew": "To my little niece or nephew,",
  grandchild: "To my dear grandchild,",
  "friends-baby": "To my friend's little one,",
  godchild: "To my dear godchild,",
  "own-child": "To my little one,",
  mom: "To Mom,",
  other: "To a little one I care about,",
};
const GENERIC_SALUTATION = "To someone special,";

const OCCASION_LINE: Record<Occasion, string> = {
  naming: "Welcome to the world, and congratulations on your naming ceremony.",
  birthday: "Happy birthday!",
  "first-birthday": "Happy first birthday!",
  "baby-shower": "Congratulations on the baby shower.",
  festival: "Wishing you a joyful festival.",
  rakhi: "Happy Rakhi!",
  "just-because": "Just because you are loved.",
  other: "Thinking of you.",
};
const GENERIC_OCCASION_LINE = "Thinking of you.";

/** Four lines joined by "\n". The name is verbatim, inside curly quotes. */
export function draftMessage(ctx: GiftContext, productName: string): string {
  const salutation = ctx.relationship ? SALUTATION[ctx.relationship] : GENERIC_SALUTATION;
  const occasionLine = ctx.occasion ? OCCASION_LINE[ctx.occasion] : GENERIC_OCCASION_LINE;
  return [salutation, occasionLine, `I chose \u201C${productName}\u201D for you.`, "With love,"].join("\n");
}

const PRESENTATION: Record<Occasion, Presentation> = {
  naming: { heading: "Welcome, little one", subheading: "A gift for a naming ceremony", tone: "blush" },
  birthday: { heading: "Happy birthday", subheading: "A birthday gift", tone: "champagne" },
  "first-birthday": {
    heading: "A first birthday",
    subheading: "A gift for a first birthday",
    tone: "champagne",
  },
  "baby-shower": { heading: "Congratulations", subheading: "A baby shower gift", tone: "sage" },
  festival: { heading: "With festival wishes", subheading: "A festival gift", tone: "sage" },
  rakhi: { heading: "Happy Rakhi", subheading: "A Rakhi gift", tone: "blush" },
  "just-because": { heading: "Just because", subheading: "A little gift, just because", tone: "sage" },
  other: { heading: "A little gift", subheading: "A gift to unwrap", tone: "champagne" },
};

/** A fresh object each call, so a caller cannot change the table. */
export function presentationFor(ctx: GiftContext): Presentation {
  return { ...PRESENTATION[ctx.occasion ?? "other"] };
}
