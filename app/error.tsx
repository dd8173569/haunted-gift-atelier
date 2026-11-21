"use client";

import { useEffect } from "react";
import ActionButton from "../components/ActionButton";
import AtelierButton from "../components/AtelierButton";
import SiteHeader from "../components/SiteHeader";

/* Segment boundary for every route under the root layout (REQ-REL-01 to 04).
   Fixed copy only: it imports no catalog, matching, or model module (REQ-REL-02), and it never
   renders error.message or error.stack (REQ-REL-04). Next.js 16.4.6 passes `error` and `retry`;
   `retry()` re-fetches and re-renders the segment, so `reset` is not used. */
type DigestError = Error & { digest?: string };

export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  /* `error` may be any thrown value; narrow before reading `digest`. */
  const digest =
    error instanceof Error && typeof (error as DigestError).digest === "string" && (error as DigestError).digest !== ""
      ? (error as DigestError).digest
      : undefined;

  useEffect(() => {
    console.error("[atelier] route error", digest ?? "no digest");
  }, [digest]);

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader links={[{ href: "/atelier", label: "Browse the atelier" }]} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-12 outline-none sm:px-10"
      >
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
          Something went wrong with that page.
        </h1>
        <p>You can try again, start a new search, or browse the atelier.</p>
        {digest ? <p className="text-sm text-plum/75">Reference: {digest}</p> : null}
        <div className="flex max-w-xs flex-col gap-3">
          <ActionButton variant="primary" size="lg" onClick={() => retry()}>
            Try again
          </ActionButton>
          <AtelierButton href="/find" variant="secondary">
            Find a gift
          </AtelierButton>
          <AtelierButton href="/atelier" variant="secondary">
            Browse the atelier
          </AtelierButton>
        </div>
      </main>
    </div>
  );
}
