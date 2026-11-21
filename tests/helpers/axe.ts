// Test helper: run axe-core directly in jsdom (REQ-PD-37, 38). No matcher library.
import axe from "axe-core";

export type AxeViolation = {
  id: string;
  impact: string | null | undefined;
  help: string;
  nodes: string[];
};

/** Tags axe runs. `best-practice` adds the landmark and heading rules. */
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"];

/** Rules switched off in jsdom, each with its reason. They are replaced by REQ-PD-40 and REQ-PD-41. */
export const AXE_DISABLED_RULES: Record<string, { enabled: false }> = {
  // jsdom has no layout and does not load Tailwind, so rendered colours are unknown; tests/a11y.contrast.test.ts computes them from the tokens.
  "color-contrast": { enabled: false },
  // Needs real element geometry; tests/a11y.targets.test.tsx checks the height and width classes instead.
  "target-size": { enabled: false },
  // Needs real scroll geometry (scrollHeight, clientHeight); jsdom reports 0 for both, so the rule has nothing to judge.
  "scrollable-region-focusable": { enabled: false },
};

/** Runs axe over a container and returns the violations (empty array when clean). */
export async function runAxe(container: Element): Promise<AxeViolation[]> {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: AXE_TAGS },
    rules: AXE_DISABLED_RULES,
  });
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => `${n.target.join(" ")} :: ${n.html.slice(0, 120)}`),
  }));
}

/** One readable block for a failure message, or "" when there are no violations. */
export function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map((v) => `${v.id} (${v.impact ?? "n/a"}): ${v.help}\n  ${v.nodes.join("\n  ")}`)
    .join("\n");
}
