"use client";

import { useEffect } from "react";
import ActionButton from "../components/ActionButton";

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
      {/* Minimal inline header: SiteHeader and next/link would add client JavaScript to every route (REQ-REL-45). */}
      <header className="flex items-center justify-between px-6 py-3 sm:px-10 print:hidden">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- deliberate plain anchor: keeps next/link out of the fallback's client JavaScript */}
        <a href="/" className="inline-flex min-h-11 items-center font-display text-2xl font-semibold tracking-wide">
          Tiny Tiaraa
        </a>
        <nav aria-label="Primary" className="flex items-center gap-2 text-sm">
          {/* Plain anchor on purpose (the lint rule only knows "/"): keeps next/link out of the fallback's client JavaScript. */}
          <a href="/atelier" className="inline-flex min-h-11 items-center px-3 hover:underline">
            Browse the atelier
          </a>
        </nav>
      </header>
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
          {/* Plain anchor on purpose (the lint rule only knows "/"): keeps next/link out of the fallback's client JavaScript. */}
          <a href="/find" className="flex h-12 items-center justify-center rounded-full px-8 text-base font-medium transition-colors border border-plum/60 text-plum hover:bg-blush">
            Find a gift
          </a>
          {/* Plain anchor on purpose (the lint rule only knows "/"): keeps next/link out of the fallback's client JavaScript. */}
          <a href="/atelier" className="flex h-12 items-center justify-center rounded-full px-8 text-base font-medium transition-colors border border-plum/60 text-plum hover:bg-blush">
            Browse the atelier
          </a>
        </div>
      </main>
    </div>
  );
}
