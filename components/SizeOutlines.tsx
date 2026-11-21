"use client";

// Boxes, ring, height line and the reference card (true-size-viewer design §5.3).
// Every drawn size is exactly mmToPx(mm, factor): no rounding, no transform, no zoom.
// Captions sit below the drawing, never over a photo.
import Image from "next/image";
import { useCallback, useState } from "react";
import type { SizeItem, SizeSpec } from "../lib/size-spec";
import { cardOrientation, cardPx, mmToPx } from "../lib/true-size";

interface SizeOutlinesProps {
  spec: SizeSpec;
  factor: number;
  calibrated: boolean;
}

const REFERENCE_CARD_LABEL = "Credit-card size, for reference — 85.60 × 53.98 mm";

const STROKE = 1.5;
const LINE_CAP_PX = 12;

function Drawing({
  item,
  spec,
  factor,
  caption,
}: {
  item: Exclude<SizeItem, { kind: "missing" }>;
  spec: SizeSpec;
  factor: number;
  caption: string;
}) {
  if (item.kind === "box") {
    const width = mmToPx(item.widthMm, factor);
    const height = mmToPx(item.heightMm, factor);
    return (
      <div
        data-testid={`size-box-${item.id}`}
        {...(item.photoInside ? {} : { role: "img", "aria-label": caption })}
        className="relative box-border border border-plum/60 bg-pearl"
        style={{ width, height }}
      >
        {item.photoInside ? (
          <Image
            src={spec.imageSrc}
            alt={spec.name}
            fill
            sizes={`${Math.ceil(width)}px`}
            className="object-contain"
          />
        ) : null}
      </div>
    );
  }
  if (item.kind === "line") {
    const height = mmToPx(item.heightMm, factor);
    const inset = STROKE / 2;
    return (
      <svg
        data-testid="size-line"
        role="img"
        aria-label={caption}
        width={LINE_CAP_PX}
        height={height}
        viewBox={`0 0 ${LINE_CAP_PX} ${height}`}
      >
        <g className="stroke-plum" strokeWidth={STROKE} fill="none">
          <line x1={LINE_CAP_PX / 2} y1={inset} x2={LINE_CAP_PX / 2} y2={height - inset} />
          <line x1={0} y1={inset} x2={LINE_CAP_PX} y2={inset} />
          <line x1={0} y1={height - inset} x2={LINE_CAP_PX} y2={height - inset} />
        </g>
      </svg>
    );
  }
  const d = mmToPx(item.diameterMm, factor);
  return (
    <svg
      data-testid={`size-ring-${item.id}`}
      role="img"
      aria-label={caption}
      width={d}
      height={d}
      viewBox={`0 0 ${d} ${d}`}
    >
      {/* Inset by half the stroke so the outer edge equals d. */}
      <circle cx={d / 2} cy={d / 2} r={d / 2 - STROKE / 2} className="fill-none stroke-plum" strokeWidth={STROKE} />
    </svg>
  );
}

export default function SizeOutlines({ spec, factor, calibrated }: SizeOutlinesProps) {
  const [availablePx, setAvailablePx] = useState(Number.POSITIVE_INFINITY);
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const update = () => setAvailablePx(el.clientWidth > 0 ? el.clientWidth : Number.POSITIVE_INFINITY);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const card = cardPx(factor);
  const upright = cardOrientation(card.long, availablePx) === "portrait";

  return (
    <div ref={measure} className="print:hidden">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-6 overflow-x-auto pb-2">
        {spec.items.map((item) => {
          if (item.kind === "missing") {
            return (
              <p key={item.id} data-testid="size-missing" className="text-sm text-plum">
                {item.message}
              </p>
            );
          }
          const caption = calibrated ? item.caption.calibrated : item.caption.approximate;
          return (
            <figure key={item.id} data-testid={`size-item-${item.id}`} className="m-0 flex max-w-xs flex-col gap-2">
              <Drawing item={item} spec={spec} factor={factor} caption={caption} />
              <figcaption className="flex flex-col gap-1">
                <p className="text-sm text-plum">{caption}</p>
                <p className="text-xs text-plum/70">{item.detail}</p>
              </figcaption>
            </figure>
          );
        })}
        <figure data-testid="size-reference-card" className="m-0 flex flex-col gap-2">
          <div
            data-testid="reference-card"
            aria-hidden="true"
            className="box-border border border-plum/40 bg-champagne/40"
            style={{
              width: upright ? card.short : card.long,
              height: upright ? card.long : card.short,
            }}
          />
          <figcaption className="text-xs text-plum/70">{REFERENCE_CARD_LABEL}</figcaption>
        </figure>
      </div>
    </div>
  );
}
