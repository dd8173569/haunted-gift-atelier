// The fit-check card (safety-verdict design §6). Presentational and server-renderable:
// it renders a verdict object and never reads the catalog or computes a verdict.
import { SAFETY_RULES } from "../lib/safety-rules";
import type { SafetyVerdict as VerdictData, VerdictRow } from "../lib/safety";

const ruleIdForText = (text: string) => SAFETY_RULES.find((r) => r.text === text)?.id;

function GuidanceBlock({ row }: { row: VerdictRow }) {
  // The certifications row is grounded in the catalog field `claims`, so it carries no
  // "General guidance" label (REQ-SV-24); its rule note is shown as plain text.
  const labeled = row.check !== "certifications";
  return (
    <>
      {row.guidance.map((g) => {
        const id = ruleIdForText(g);
        return (
          <p key={g} className="mt-2 text-sm leading-relaxed">
            {labeled && (
              <span className="text-plum/60">
                General guidance{id ? ` (${id})` : ""}:{" "}
              </span>
            )}
            {g}
          </p>
        );
      })}
    </>
  );
}

function Row({ row }: { row: VerdictRow }) {
  const flagged = row.severity === "flag";
  const textIsGuidance = row.guidance.includes(row.text);
  return (
    <div
      data-row-id={row.id}
      data-severity={row.severity}
      data-sources={row.sources.join(" ")}
      className="grid gap-1 border-t border-plum/15 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6"
    >
      <dt className="text-sm font-semibold">
        {row.label}
        {flagged && <span className="mt-1 block font-semibold">Worth a look</span>}
      </dt>
      <dd>
        {!textIsGuidance && <p className="whitespace-pre-line text-sm leading-relaxed">{row.text}</p>}
        {row.asListed && (
          <p className="mt-2 text-sm leading-relaxed">{`As listed: ${row.asListed}`}</p>
        )}
        {row.segments && row.segments.length > 0 && (
          <p className="mt-2 text-sm leading-relaxed">
            {row.segments.map((s) => s.display).join(" · ")}
          </p>
        )}
        <GuidanceBlock row={row} />
        <p className="mt-2 text-xs text-plum/60">{`Source: ${row.sources.join(", ")}`}</p>
      </dd>
    </div>
  );
}

export default function SafetyVerdict({ verdict }: { verdict: VerdictData }) {
  const titleId = `fit-check-title-${verdict.sku}`;
  const good = verdict.verdict === "Good fit";
  const flaggedLabels = verdict.rows.filter((r) => r.severity === "flag").map((r) => r.label);
  return (
    <section
      role="region"
      aria-labelledby={titleId}
      data-verdict={verdict.verdict}
      className={`rounded-2xl border border-plum/15 p-6 text-plum ${good ? "bg-sage/60" : "bg-champagne"}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-plum/60">Fit check</p>
      <h2 id={titleId} className="mt-1 font-display text-3xl font-semibold">
        {verdict.verdict}
      </h2>
      {flaggedLabels.length > 0 && (
        <p className="mt-2 text-sm font-semibold">{`Worth a look: ${flaggedLabels.join(", ")}`}</p>
      )}
      <dl className="mt-4">
        {verdict.rows.map((row) => (
          <Row key={row.id} row={row} />
        ))}
      </dl>
      <p className="mt-4 border-t border-plum/15 pt-4 text-sm">{verdict.disclaimer}</p>
    </section>
  );
}
