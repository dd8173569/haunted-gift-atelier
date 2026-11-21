import Link from "next/link";
import PriceFootnote from "../components/PriceFootnote";

/* Landing — Haunted Gift Atelier (PRD §1, step 1).
   Hero leads with the TRUST problem, not the quiz. Milestone 1 shell:
   the conversation (/find) and browse grid (/atelier) open in M2/M3. */

function CrescentMoon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
      className="text-gold"
    >
      <path
        d="M28.5 4.5A17 17 0 1 0 39.5 30.5 13.5 13.5 0 0 1 28.5 4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Motes() {
  const motes = [
    { left: "8%", top: "62%", delay: "0s", size: 5 },
    { left: "18%", top: "40%", delay: "2.5s", size: 4 },
    { left: "82%", top: "55%", delay: "1.2s", size: 6 },
    { left: "90%", top: "30%", delay: "4s", size: 4 },
    { left: "70%", top: "70%", delay: "5.5s", size: 5 },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {motes.map((m, i) => (
        <span
          key={i}
          className="mote absolute rounded-full bg-gold"
          style={{
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            animationDelay: m.delay,
          }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="font-display text-2xl font-semibold tracking-wide">
          Tiny Tiaraa
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="#how" className="hidden sm:inline hover:underline">
            How it works
          </Link>
          <Link href="/atelier" className="hover:underline">
            Browse the atelier
          </Link>
        </nav>
      </header>

      <main className="flex flex-col flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden px-6 pt-10 pb-16 sm:px-10 sm:pt-16">
          <Motes />
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="flex justify-center">
              <CrescentMoon />
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-gold">
              Haunted Gift Atelier
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-6xl">
              The right gift for someone else&rsquo;s little one.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-plum/80">
              Buying baby jewelry online? You can&rsquo;t tell how big it is —
              or if it&rsquo;s safe. Three taps, and the atelier finds the
              piece — then proves it.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/find"
                className="flex h-12 items-center justify-center rounded-full bg-plum px-8 text-base font-medium text-pearl transition-colors hover:bg-plum/85"
              >
                Find a gift
              </Link>
              <Link
                href="/atelier"
                className="flex h-12 items-center justify-center rounded-full border border-plum/30 px-8 text-base font-medium transition-colors hover:bg-blush"
              >
                Browse the atelier
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="bg-blush/60 px-6 py-14 sm:px-10">
          <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
            <div>
              <p className="font-display text-3xl font-semibold text-gold">1</p>
              <h2 className="mt-2 font-display text-xl font-semibold">
                Tell us who it&rsquo;s for
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-plum/75">
                A few taps — who they are, how old, what&rsquo;s the occasion,
                what you&rsquo;d like to spend.
              </p>
            </div>
            <div>
              <p className="font-display text-3xl font-semibold text-gold">2</p>
              <h2 className="mt-2 font-display text-xl font-semibold">
                Get three real picks
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-plum/75">
                Three pieces from the real Tiny Tiaraa catalog, each with its
                reason — never a guess, never a fake third.
              </p>
            </div>
            <div>
              <p className="font-display text-3xl font-semibold text-gold">3</p>
              <h2 className="mt-2 font-display text-xl font-semibold">
                Check it, see it, wrap it
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-plum/75">
                A plain-language safety check and a true-size view on every
                pick — then a gift wrap and a message.
              </p>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="px-6 py-12 sm:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-plum/60">
              Real catalog &middot; Real prices &middot; No discounts invented
            </p>
            <p className="mt-4 text-sm leading-relaxed text-plum/75">
              Every piece is a real Tiny Tiaraa product with its real photo,
              price, and materials. Out-of-stock pieces are never recommended.
              Safety notes are fit checks, not certifications.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-plum/10 px-6 py-6 sm:px-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 text-center">
          <p className="text-sm text-plum/70">
            Haunted Gift Atelier — built with Kiro &middot; Real catalog:
            Tiny Tiaraa &middot; Kiroween 2026
          </p>
          <PriceFootnote />
        </div>
      </footer>
    </div>
  );
}
