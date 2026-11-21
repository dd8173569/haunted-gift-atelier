import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RULE_IDS, SAFETY_RULES, SAFETY_RULES_VERSION, ruleById } from "../lib/safety-rules";

interface ParsedRule {
  id: string;
  check?: string;
  applies?: string;
  severity?: string;
  text?: string;
}

function parseRulesFile(md: string) {
  const version = /^version:\s*(\S+)\s*$/m.exec(md)?.[1];
  const body = md.split(/^## Changelog/m)[0];
  const rules: ParsedRule[] = [];
  let cur: ParsedRule | null = null;
  for (const line of body.split("\n")) {
    const h = /^### (\S+)\s*$/.exec(line);
    if (h) {
      cur = { id: h[1] };
      rules.push(cur);
      continue;
    }
    const f = /^- (check|applies|severity|text): (.*)$/.exec(line);
    if (f && cur) cur[f[1] as "check" | "applies" | "severity" | "text"] = f[2];
  }
  return { version, rules, hasChangelog: /^## Changelog/m.test(md) };
}

const file = parseRulesFile(readFileSync("data/safety-rules.md", "utf8"));
const CERT_TERMS = /\b(BIS|hallmark|hypoallergenic|nickel-free|certified|tested)\b/i;

describe("safety rules: data/safety-rules.md matches lib/safety-rules.ts", () => {
  it("has the same version", () => {
    expect(file.version).toBe(SAFETY_RULES_VERSION);
    expect(SAFETY_RULES_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("has a changelog section", () => {
    expect(file.hasChangelog).toBe(true);
  });

  it("has 15 rules and the same ID set, in the same order", () => {
    expect(SAFETY_RULES).toHaveLength(15);
    expect(file.rules.map((r) => r.id)).toEqual(SAFETY_RULES.map((r) => r.id));
    expect(RULE_IDS.size).toBe(15);
  });

  it.each(SAFETY_RULES.map((r) => [r.id, r] as const))("%s matches field by field", (id, rule) => {
    const parsed = file.rules.find((r) => r.id === id);
    expect(parsed).toBeDefined();
    expect(parsed!.check).toBe(rule.check);
    expect(parsed!.applies).toBe(rule.applies);
    expect(parsed!.severity).toBe(rule.severity);
    expect(parsed!.text).toBe(rule.text);
  });

  it("IDs are unique and well formed", () => {
    const ids = SAFETY_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^SR-[A-Z0-9]+(-[A-Z0-9]+)*$/);
  });

  it("severities are flag or note, and only the four wear rules flag", () => {
    for (const r of SAFETY_RULES) expect(["flag", "note"]).toContain(r.severity);
    expect(SAFETY_RULES.filter((r) => r.severity === "flag").map((r) => r.id)).toEqual([
      "SR-WEAR-TABEEZ",
      "SR-WEAR-BRACELET",
      "SR-WEAR-BANGLE",
      "SR-WEAR-SET-EARRINGS",
    ]);
  });

  it("no rule text contains safe/unsafe or a certification term", () => {
    for (const r of SAFETY_RULES) {
      expect(r.text, r.id).not.toMatch(/\b(un)?safe\b/i);
      expect(r.text, r.id).not.toMatch(CERT_TERMS);
    }
  });

  it("ruleById returns a rule and throws on an unknown id", () => {
    expect(ruleById("SR-CLAIMS-ONLY").check).toBe("certifications");
    expect(() => ruleById("SR-NOPE")).toThrow(/unknown safety rule/);
  });
});
