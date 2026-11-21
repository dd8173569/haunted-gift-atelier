import AtelierButton from "./AtelierButton";
import type { CardView, QuestionId } from "../lib/conversation";

/* The recipient card (REQ-CV-14 to 17): a plain-words headline, one editable
   line per answer, and the single primary control "Reveal my picks". Every
   word comes from describeModel(); the card states no product fact. */
type RecipientCardProps = {
  view: CardView;
  href: string;
  onEdit: (question: QuestionId) => void;
  onBack: () => void;
};

export default function RecipientCard({ view, href, onEdit, onBack }: RecipientCardProps) {
  return (
    <section className="mx-auto w-full max-w-xl text-center">
      <h1
        data-step-heading
        tabIndex={-1}
        className="font-display text-3xl font-semibold leading-tight outline-none sm:text-4xl"
      >
        {view.headline}
      </h1>
      <ul className="mt-8 divide-y divide-plum/10 rounded-2xl border border-plum/15 bg-champagne text-left">
        {view.lines.map((line) => (
          <li key={line.question} className="flex items-center justify-between gap-4 px-5 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-plum/60">
                {line.label}
              </p>
              <p className="text-base">{line.value}</p>
            </div>
            <button
              type="button"
              aria-label={`Edit ${line.label}`}
              onClick={() => onEdit(line.question)}
              className="min-h-11 min-w-11 rounded-full border border-plum/30 px-4 text-sm hover:bg-blush"
            >
              Edit
            </button>
          </li>
        ))}
      </ul>
      {view.note ? <p className="mt-4 text-sm text-plum/75">{view.note}</p> : null}
      <div className="mt-8 flex flex-col items-center gap-4">
        <AtelierButton href={href}>Reveal my picks</AtelierButton>
        <button type="button" onClick={onBack} className="min-h-11 px-4 text-sm hover:underline">
          Back
        </button>
      </div>
    </section>
  );
}
