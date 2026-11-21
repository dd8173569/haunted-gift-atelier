"use client";

import "./globals.css";
import ActionButton from "../components/ActionButton";

/* Root boundary for a failure of the layout itself (REQ-REL-05). It replaces the root layout, so it
   defines its own <html> and <body> and imports the global tokens. It imports no next/font (the
   font variables are not available here, so the heading uses the generic serif), no SiteHeader,
   no SkipLink, no wordmark, and no catalog module. `error` is never read: a root failure shows no detail. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      {/* metadata is not supported here; the React <title> component names the document (axe: document-title). */}
      <head>
        <title>The atelier couldn&apos;t open</title>
      </head>
      <body className="min-h-full flex flex-col bg-pearl text-plum font-sans">
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-12 outline-none sm:px-10"
        >
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
            The atelier couldn&apos;t open.
          </h1>
          <p>Please reload the page. If it keeps happening, come back in a little while.</p>
          <div className="flex max-w-xs flex-col gap-3">
            <ActionButton variant="primary" size="lg" onClick={() => retry()}>
              Reload
            </ActionButton>
            {/* A plain anchor on purpose: a full-document navigation discards all client state, which a
                root failure needs, and next/link would need the router the failed layout provides. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="flex h-12 items-center justify-center rounded-full border border-plum/60 px-8 text-base font-medium text-plum transition-colors hover:bg-champagne"
            >
              Back to the start
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
