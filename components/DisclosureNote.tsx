/* "How we widened the search" — every relaxation sentence from match(), verbatim (REQ-CV-30). */
export default function DisclosureNote({ sentences }: { sentences: string[] }) {
  if (sentences.length === 0) return null;
  return (
    <section
      aria-labelledby="disclosure-heading"
      className="w-full rounded-2xl bg-champagne px-5 py-4 text-sm"
    >
      <h2 id="disclosure-heading" className="font-semibold">
        How we widened the search
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-plum/85">
        {sentences.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </section>
  );
}
