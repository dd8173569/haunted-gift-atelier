import Link from "next/link";
import Conversation from "../../components/Conversation";
import { momSkipNote } from "../../lib/conversation";
import { catalog } from "../../lib/catalog-store";
import { parseModelParam } from "../../lib/model-param";

/* /find — conversation + recipient card (PRD §1 steps 2–3).
   Reads `m` (resume on the card) and `notice` (REQ-CV-20, 22). No matching here. */
export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const parsed = parseModelParam(sp.m);
  const notice = sp.notice === "incomplete" || parsed.status === "invalid" ? "incomplete" : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="font-display text-2xl font-semibold tracking-wide">
          Tiny Tiaraa
        </Link>
        <Link href="/atelier" className="text-sm hover:underline">
          Browse the atelier
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center px-6 py-10 sm:px-10">
        <Conversation
          initialModel={parsed.status === "ok" ? parsed.model : undefined}
          notice={notice}
          momNote={momSkipNote(catalog)}
        />
      </main>
    </div>
  );
}
