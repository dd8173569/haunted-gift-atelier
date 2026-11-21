import Link from "next/link";

/* /find — conversation + recipient card (PRD §1 steps 2–3).
   Milestone 1 shell: the conversation opens in Milestone 2. */
export default function FindPage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
        Haunted Gift Atelier
      </p>
      <h1 className="mt-4 font-display text-4xl font-semibold">
        The conversation opens in Milestone 2.
      </h1>
      <p className="mt-4 max-w-md text-plum/75">
        Six questions, all answerable by taps — who the gift is for, the
        occasion, the budget, gold or silver, symbols, and the kind of piece.
      </p>
      <Link href="/" className="mt-8 hover:underline">
        ← Back to the atelier
      </Link>
    </div>
  );
}
