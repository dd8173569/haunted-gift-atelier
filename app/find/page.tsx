import type { Metadata } from "next";
import Conversation from "../../components/Conversation";
import SiteHeader from "../../components/SiteHeader";
import { momSkipNote } from "../../lib/conversation";
import { catalog } from "../../lib/catalog-store";
import { parseModelParam } from "../../lib/model-param";
import { ROUTE_TITLES } from "../../lib/page-meta";

export const metadata: Metadata = { title: ROUTE_TITLES.find };

/* Dev-only "instant" validation off for this page (polish-deploy design §8, decision (a), REQ-PD-47).
   The recipient model lives in the URL (`m`, `notice`), so the body depends on request data by design. The build is unaffected; the route still prerenders its shell and streams the body. */
export const instant = false;

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
      <SiteHeader links={[{ href: "/atelier", label: "Browse the atelier" }]} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 py-8 outline-none sm:px-10"
      >
        <Conversation
          initialModel={parsed.status === "ok" ? parsed.model : undefined}
          notice={notice}
          momNote={momSkipNote(catalog)}
        />
      </main>
    </div>
  );
}
