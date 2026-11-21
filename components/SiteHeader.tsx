import Link from "next/link";

/* One header for every screen (REQ-PD-05): the "Tiny Tiaraa" text wordmark in the display serif
   (text only, never an image), a labelled nav, and the single "Opens in a new tab" hint that
   external links point to with aria-describedby="new-tab-hint" (REQ-PD-20). */
export type SiteHeaderLink = {
  href: string;
  label: string;
  /** Hide the link below the `sm` breakpoint (the landing "How it works" anchor). */
  hideBelowSm?: boolean;
};

export default function SiteHeader({ links }: { links: readonly SiteHeaderLink[] }) {
  return (
    <header className="flex items-center justify-between px-6 py-3 sm:px-10 print:hidden">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-display text-2xl font-semibold tracking-wide"
      >
        Tiny Tiaraa
      </Link>
      <nav aria-label="Primary" className="flex items-center gap-2 text-sm">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`inline-flex min-h-11 items-center px-3 hover:underline ${
              l.hideBelowSm ? "hidden sm:inline-flex" : ""
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <span id="new-tab-hint" className="sr-only">
        Opens in a new tab
      </span>
    </header>
  );
}
