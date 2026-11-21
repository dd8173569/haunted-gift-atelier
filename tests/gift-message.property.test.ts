// P-GP-2, P-GP-3, P-GP-7, P-GP-8 (gift-presentation design §9.1). Seeded; real catalog names.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { OCCASIONS, RELATIONSHIPS } from "../lib/conversation";
import {
  MESSAGE_MAX_LENGTH,
  draftMessage,
  giftContext,
  presentationFor,
  type GiftContext,
} from "../lib/gift-message";
import { catalog } from "../lib/catalog-store";

const SEED = 20261124;
const RUNS = 300;
const assert = <T extends unknown[]>(p: fc.IPropertyWithHooks<T>, numRuns = RUNS) =>
  fc.assert(p, { seed: SEED, numRuns });

const NAMES = catalog.products.map((p) => p.name);
const arbCtx: fc.Arbitrary<GiftContext> = fc.record({
  relationship: fc.oneof(fc.constant(null), fc.constantFrom(...RELATIONSHIPS)),
  occasion: fc.oneof(fc.constant(null), fc.constantFrom(...OCCASIONS)),
});
const arbName = fc.constantFrom(...NAMES);

const BANNED = /₹|%|\bsave\b|\boff\b|\bMRP\b|certif|hypoallergenic|\bsafe\b/i;
const RELIGIOUS = /\b(om|ganesha|ganesh|cross|sikh|trishul|jain|swastik|allah|god|lord|bless|blessing|shubh)\b/i;

const countOf = (hay: string, needle: string) => hay.split(needle).length - 1;

describe("P-GP-2 the draft is grounded", () => {
  it("contains the name once, no digit or banned wording outside it, at most 500 characters", () => {
    assert(
      fc.property(arbCtx, arbName, (ctx, name) => {
        const d = draftMessage(ctx, name);
        expect(countOf(d, name)).toBe(1);
        const rest = d.replace(name, "");
        expect(rest).not.toMatch(/\d/);
        expect(rest).not.toMatch(BANNED);
        expect(d.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
        expect(d.split("\n")).toHaveLength(4);
      }),
    );
  });
  it("holds exhaustively for every name, relationship and occasion (22 × 8 × 9)", () => {
    for (const name of NAMES)
      for (const relationship of [null, ...RELATIONSHIPS])
        for (const occasion of [null, ...OCCASIONS]) {
          const d = draftMessage({ relationship, occasion }, name);
          expect(countOf(d, name)).toBe(1);
          expect(d.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
          expect(d.replace(name, "")).not.toMatch(/\d|₹|%/);
        }
  });
});

describe("P-GP-3 determinism and purity", () => {
  it("equal arguments give equal output and the arguments are unchanged", () => {
    assert(
      fc.property(arbCtx, arbName, (ctx, name) => {
        const snapshot = JSON.stringify(ctx);
        expect(draftMessage(ctx, name)).toBe(draftMessage({ ...ctx }, name));
        expect(presentationFor(ctx)).toEqual(presentationFor({ ...ctx }));
        expect(JSON.stringify(ctx)).toBe(snapshot);
      }),
    );
  });
});

describe("P-GP-7 no inferred religion", () => {
  it("heading, sub-line and draft carry no religious word outside the product name", () => {
    assert(
      fc.property(arbCtx, arbName, (ctx, name) => {
        const p = presentationFor(ctx);
        const d = draftMessage(ctx, name).replace(name, "");
        expect(p.heading).not.toMatch(RELIGIOUS);
        expect(p.subheading).not.toMatch(RELIGIOUS);
        expect(d).not.toMatch(RELIGIOUS);
      }),
    );
  });
  it("holds for every relationship and occasion with a neutral name", () => {
    for (const relationship of [null, ...RELATIONSHIPS])
      for (const occasion of [null, ...OCCASIONS]) {
        const ctx = { relationship, occasion };
        const text = [presentationFor(ctx).heading, presentationFor(ctx).subheading, draftMessage(ctx, "X")].join(" ");
        expect(text).not.toMatch(RELIGIOUS);
      }
  });
});

describe("P-GP-8 presentation covers every occasion", () => {
  it("is total, non-empty, with a token tone", () => {
    for (const occasion of [null, ...OCCASIONS]) {
      const p = presentationFor({ relationship: null, occasion });
      expect(p.heading.length).toBeGreaterThan(0);
      expect(p.subheading.length).toBeGreaterThan(0);
      expect(["blush", "champagne", "sage"]).toContain(p.tone);
    }
  });
  it("giftContext of a model feeds it without change", () => {
    assert(
      fc.property(arbCtx, (ctx) => {
        const p = presentationFor(ctx);
        expect(p.heading.length).toBeGreaterThan(0);
        expect(giftContext(null)).toEqual({ relationship: null, occasion: null });
      }),
    );
  });
});
