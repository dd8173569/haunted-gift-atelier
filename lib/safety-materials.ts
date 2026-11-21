// Check 2: the closed-template materials decoder (REQ-SV-11, REQ-SV-12). Pure.
// Numbers are copied from the match groups, never recomputed.

export interface DecodedSegment {
  raw: string;
  display: string;
  ruleId: string | null;
}

const GOLD18 = /^18KT Gold$/i;
const SILVER925 = /^925 Silver(\s*\(.*\))?$/i;
const DIAMOND = /^Diamond(?:\s+(\d+(?:\.\d+)?)\s*Cts?)?(?:,\s*Quality\s+([A-Z]{2}-[A-Z0-9]+))?$/i;
const CZ = /^CZ$/i;

function decodeSegment(raw: string): DecodedSegment {
  if (GOLD18.test(raw)) {
    return { raw, display: "18KT gold", ruleId: "SR-MAT-GOLD18" };
  }
  const silver = SILVER925.exec(raw);
  if (silver) {
    const paren = silver[1]?.trim();
    return {
      raw,
      display: paren ? `925 sterling silver ${paren}` : "925 sterling silver",
      ruleId: "SR-MAT-SILVER925",
    };
  }
  const diamond = DIAMOND.exec(raw);
  if (diamond) {
    const [, carat, grade] = diamond;
    return {
      raw,
      display: `Diamond${carat ? ` ${carat} ct` : ""}${grade ? `, ${grade}` : ""}`,
      ruleId: "SR-MAT-DIAMOND",
    };
  }
  if (/pearl/i.test(raw)) return { raw, display: raw, ruleId: "SR-MAT-PEARL" };
  if (CZ.test(raw)) return { raw, display: "CZ (cubic zirconia)", ruleId: "SR-MAT-CZ" };
  if (/black beads/i.test(raw)) return { raw, display: raw, ruleId: "SR-MAT-BEADS" };
  return { raw, display: raw, ruleId: null };
}

/** Splits on ";", trims, drops empties; the first matching pattern wins. */
export function decodeMaterials(materials: string): DecodedSegment[] {
  return materials
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(decodeSegment);
}
