/* Root 404 for URLs that match no route (REQ-REL-06). The piece page keeps its own not-found. No dead end. Plain anchors and an inline header on purpose (see the header note). */
export default function NotFound() {
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
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">We couldn&apos;t find that page.</h1>
        <div className="flex max-w-xs flex-col gap-3">
          {/* Plain anchor on purpose (the lint rule only knows "/"): keeps next/link out of the fallback's client JavaScript. */}
          <a href="/atelier" className="flex h-12 items-center justify-center rounded-full px-8 text-base font-medium transition-colors bg-plum text-pearl hover:bg-plum/85">
            Browse the atelier
          </a>
          {/* Plain anchor on purpose (the lint rule only knows "/"): keeps next/link out of the fallback's client JavaScript. */}
          <a href="/find" className="flex h-12 items-center justify-center rounded-full px-8 text-base font-medium transition-colors border border-plum/60 text-plum hover:bg-blush">
            Find a gift
          </a>
        </div>
      </main>
    </div>
  );
}
