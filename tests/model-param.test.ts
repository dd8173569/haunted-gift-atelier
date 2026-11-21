import { describe, expect, it } from "vitest";
import { MAX_PARAM_LENGTH, MODEL_PARAM, encodeModelParam, modelHref, parseModelParam } from "../lib/model-param";
import { toModel } from "../lib/conversation";
import { GOLDEN1_TAPS, GOLDEN2_TAPS, GOLDEN3_TAPS, run } from "./helpers/conversation-taps";

const build = (taps: Parameters<typeof run>[0]) => {
  const r = toModel(run(taps).answers);
  if (!r.ok) throw new Error("incomplete");
  return r.model;
};
const G1 = build(GOLDEN1_TAPS);
const G1_JSON =
  '{"relationship":"niece-nephew","ageBand":"infants","ageYears":0,"occasion":"naming","budgetBand":"under-2500","metal":"silver","symbols":"any","category":"any"}';

describe("model transport", () => {
  it("constants", () => {
    expect(MODEL_PARAM).toBe("m");
    expect(MAX_PARAM_LENGTH).toBe(1000);
  });
  it("golden 1 encodes to the design §3 example string", () => {
    expect(encodeModelParam(G1)).toBe(G1_JSON);
  });
  it("encoding is canonical even for a shuffled input object", () => {
    const shuffled = JSON.parse(G1_JSON, (_k, v) => v);
    const reordered = { category: shuffled.category, symbols: shuffled.symbols, ...shuffled };
    expect(encodeModelParam(reordered)).toBe(G1_JSON);
  });
  it("modelHref percent-encodes the JSON and round-trips through URLSearchParams", () => {
    const href = modelHref("/picks", G1);
    expect(href.startsWith("/picks?m=%7B%22relationship%22")).toBe(true);
    expect(href).not.toContain("{");
    const q = new URLSearchParams(href.split("?")[1]);
    expect(q.get("m")).toBe(G1_JSON);
    expect(modelHref("/find", G1).startsWith("/find?m=")).toBe(true);
  });
  it("round-trips the three golden models", () => {
    for (const taps of [GOLDEN1_TAPS, GOLDEN2_TAPS, GOLDEN3_TAPS]) {
      const m = build(taps);
      expect(parseModelParam(encodeModelParam(m))).toEqual({ status: "ok", model: m });
    }
  });
  it("undefined and '' are missing", () => {
    expect(parseModelParam(undefined)).toEqual({ status: "missing" });
    expect(parseModelParam("")).toEqual({ status: "missing" });
  });
  it("invalid inputs", () => {
    const inputs: (string | string[])[] = [
      [G1_JSON, G1_JSON],
      [],
      "x".repeat(MAX_PARAM_LENGTH + 1),
      "{",
      "null",
      "[]",
      '"x"',
      "42",
      G1_JSON.replace("}", ',"extra":1}'),
      G1_JSON.replace('"metal":"silver"', '"metal":"bronze"'),
      "   ",
    ];
    for (const i of inputs) {
      const r = parseModelParam(i);
      expect(r.status, JSON.stringify(i).slice(0, 40)).toBe("invalid");
      expect(r).toHaveProperty("reason");
    }
  });
  it("the length cap is inclusive at 1000 characters", () => {
    const padded = G1_JSON.slice(0, -1) + " ".repeat(MAX_PARAM_LENGTH - G1_JSON.length) + "}";
    expect(padded.length).toBe(MAX_PARAM_LENGTH);
    expect(parseModelParam(padded).status).toBe("ok");
    expect(parseModelParam(padded + " ").status).toBe("invalid");
  });
  it("never throws on a non-string value", () => {
    expect(parseModelParam(5 as never).status).toBe("invalid");
    expect(parseModelParam(null as never).status).toBe("invalid");
  });
});
