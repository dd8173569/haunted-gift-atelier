// The catalog facts of one piece (gift-presentation design §2). Presentational and
// server-renderable: it renders PieceView.facts and reads nothing else.
import type { Fact } from "../lib/piece-view";

export default function PieceFacts({ facts }: { facts: Fact[] }) {
  return (
    <section className="rounded-2xl bg-blush/50 p-6">
      <h2 className="sr-only">Catalog facts</h2>
      <dl>
        {facts.map((f, i) => (
          <div
            key={f.label}
            className={`grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-6 ${i > 0 ? "border-t border-plum/15" : ""}`}
          >
            <dt data-source={f.source} className="text-sm font-semibold">
              {f.label}
            </dt>
            <dd data-source={f.source} className="text-sm leading-relaxed">
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
