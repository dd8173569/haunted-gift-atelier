"use client";

// The gift wrap, the message and the presentation card (gift-presentation design §5).
// A client island with plain-data props. The message lives in component state only: it is
// never sent anywhere, never stored, and never put in the URL. The buy link is the catalog
// url, verbatim, in every phase, so nobody has to play the animation to buy.
import { useEffect, useId, useRef, useState } from "react";
import { MESSAGE_MAX_LENGTH, WRAP_REVEAL_MS, type CardTone, type Presentation } from "../lib/gift-message";
import AtelierButton from "./AtelierButton";

type Phase = "idle" | "wrapping" | "revealed";
type CopyState = "idle" | "ok" | "fail";

export interface GiftWrapProps {
  /** Product name, verbatim. */
  name: string;
  /** Catalog url, verbatim. */
  url: string;
  /** The draft the template produced. */
  initialMessage: string;
  presentation: Presentation;
}

// Literal class names, because Tailwind reads them from the source.
const TONE_CLASS: Record<CardTone, string> = {
  blush: "bg-blush",
  champagne: "bg-champagne",
  sage: "bg-sage",
};

const primaryButton =
  "h-12 w-fit rounded-full bg-plum px-8 text-base font-medium text-pearl transition-colors hover:bg-plum/85";
const secondaryButton =
  "h-11 w-fit rounded-full border border-plum/30 px-6 text-sm font-medium text-plum transition-colors hover:bg-blush";

function GiftBox({ wrapping }: { wrapping: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-testid="gift-box"
      className={`relative mx-auto h-40 w-48 ${wrapping ? "wrap-box-out" : ""}`}
    >
      <div className="absolute inset-x-0 bottom-0 h-28 rounded-xl border border-plum/15 bg-blush" />
      <div className="absolute inset-x-0 bottom-0 flex h-28 justify-center">
        <div className={`h-full w-6 bg-gold/70 ${wrapping ? "wrap-ribbon" : ""}`} />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-28 items-center">
        <div className={`h-5 w-full bg-gold/70 ${wrapping ? "wrap-ribbon" : ""}`} />
      </div>
      <div
        className={`absolute inset-x-[-0.5rem] top-5 h-10 rounded-lg border border-plum/15 bg-champagne ${
          wrapping ? "wrap-lid" : ""
        }`}
      >
        <div className="mx-auto h-full w-6 bg-gold/70" />
      </div>
    </div>
  );
}

export default function GiftWrap({ name, url, initialMessage, presentation }: GiftWrapProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState(initialMessage);
  const [copy, setCopy] = useState<CopyState>("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const messageId = useId();
  const cardTitleId = useId();

  // The setState call sits in the timer callback, not in the effect body.
  useEffect(() => {
    if (phase !== "wrapping") return;
    const t = setTimeout(() => setPhase("revealed"), WRAP_REVEAL_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "revealed") headingRef.current?.focus();
  }, [phase]);

  function wrap() {
    // Read here, not during render: no hydration mismatch, and jsdom has no matchMedia.
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase(reduced ? "revealed" : "wrapping");
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopy("ok");
    } catch {
      setCopy("fail");
    }
  }

  return (
    <section
      aria-label="Gift this piece"
      aria-busy={phase === "wrapping"}
      data-phase={phase}
      className="flex flex-col gap-5 rounded-2xl bg-blush/50 p-6"
    >
      <h2 className="font-display text-2xl font-semibold">Gift this piece</h2>

      {phase !== "revealed" && <GiftBox wrapping={phase === "wrapping"} />}

      {phase === "idle" && (
        <button type="button" className={primaryButton} onClick={wrap}>
          Wrap this gift
        </button>
      )}

      {phase === "wrapping" && (
        <div className="flex flex-wrap items-center gap-4">
          <p role="status" className="text-sm font-medium">
            Wrapping your gift…
          </p>
          <button type="button" className={secondaryButton} onClick={() => setPhase("revealed")}>
            Skip
          </button>
        </div>
      )}

      {phase === "revealed" && (
        <>
          <p role="status" className="text-sm font-medium">
            Your gift is wrapped
          </p>

          <article
            aria-labelledby={cardTitleId}
            className={`wrap-card-in rounded-2xl border border-plum/15 p-6 ${TONE_CLASS[presentation.tone]}`}
          >
            <h3
              id={cardTitleId}
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-3xl font-semibold"
            >
              {presentation.heading}
            </h3>
            <p className="mt-1 text-sm text-plum/75">{presentation.subheading}</p>
            <p className="mt-4 whitespace-pre-line leading-relaxed">{message}</p>
            <p className="mt-4 text-sm font-medium">{`The gift: ${name}`}</p>
          </article>

          <div className="flex flex-col gap-3">
            <label htmlFor={messageId} className="text-sm font-semibold">
              Gift message — a draft you can edit
            </label>
            <textarea
              id={messageId}
              rows={6}
              maxLength={MESSAGE_MAX_LENGTH}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setCopy("idle");
              }}
              className="w-full rounded-xl border border-plum/30 bg-pearl p-3 text-base leading-relaxed text-plum"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  setMessage(initialMessage);
                  setCopy("idle");
                }}
              >
                Reset to draft
              </button>
              <button type="button" className={secondaryButton} onClick={copyMessage}>
                Copy message
              </button>
              <p role="status" className="text-sm">
                {copy === "ok" ? "Copied" : copy === "fail" ? "Select the text and copy it yourself." : ""}
              </p>
            </div>
            <p className="text-xs text-plum/60">
              Your message stays on this page. It is not sent to us or to the store.
            </p>
          </div>
        </>
      )}

      <div className="max-w-xs">
        <AtelierButton href={url} external variant={phase === "revealed" ? "primary" : "secondary"}>
          Buy on Tiny Tiaraa ↗
        </AtelierButton>
      </div>
    </section>
  );
}
