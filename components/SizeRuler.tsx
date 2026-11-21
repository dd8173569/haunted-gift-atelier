"use client";

// On-screen ruler and the print-only 1:1 sheet (true-size-viewer design §5.4).
// The sheet is drawn in physical millimetres, so it needs no calibration.
import { useCallback, useState, type ReactNode } from "react";
import type { SizeItem } from "../lib/size-spec";
import { CARD_MM, fitRulerMm, formatMm, mmToPx, rulerTicks } from "../lib/true-size";

interface SizeRulerProps {
  factor: number;
  calibrated: boolean;
  items: SizeItem[];
}

const TICK_PX = { mm: 5, half: 8, cm: 12 } as const;

const PRINT_INSTRUCTION =
  "Print at 100% scale — turn off 'Fit to page' — then check the ruler against a real one.";

/* ---- Print sheet layout (all numbers are millimetres) ---- */
const SHEET_W = 180;
const GAP = 8;
const LABEL_H = 6;
const STROKE_MM = 0.25;
const RULER_MM = 100;
const RULER_H = 14;

type Shape = { w: number; h: number; label: string; draw: (x: number, y: number) => ReactNode };

function shapesFor(items: SizeItem[]): Shape[] {
  const out: Shape[] = [
    {
      w: CARD_MM.long,
      h: CARD_MM.short,
      label: "Credit-card size, 85.60 × 53.98 mm",
      draw: (x, y) => <rect key="card" x={x} y={y} width={CARD_MM.long} height={CARD_MM.short} />,
    },
  ];
  for (const item of items) {
    if (item.kind === "box") {
      out.push({
        w: item.widthMm,
        h: item.heightMm,
        label: `${formatMm(item.heightMm)} × ${formatMm(item.widthMm)} mm`,
        draw: (x, y) => <rect key={item.id} x={x} y={y} width={item.widthMm} height={item.heightMm} />,
      });
    } else if (item.kind === "ring") {
      const d = item.diameterMm;
      out.push({
        w: d,
        h: d,
        label: `Ø ${formatMm(d)} mm`,
        draw: (x, y) => <circle key={item.id} cx={x + d / 2} cy={y + d / 2} r={d / 2} />,
      });
    } else if (item.kind === "line") {
      const cap = 3;
      out.push({
        w: cap,
        h: item.heightMm,
        label: `${formatMm(item.heightMm)} mm tall`,
        draw: (x, y) => (
          <g key={item.id}>
            <line x1={x + cap / 2} y1={y} x2={x + cap / 2} y2={y + item.heightMm} />
            <line x1={x} y1={y} x2={x + cap} y2={y} />
            <line x1={x} y1={y + item.heightMm} x2={x + cap} y2={y + item.heightMm} />
          </g>
        ),
      });
    }
  }
  return out;
}

function PrintSheet({ items }: { items: SizeItem[] }) {
  const placed: { shape: Shape; x: number; y: number }[] = [];
  let x = 0;
  let y = RULER_H + GAP;
  let rowH = 0;
  for (const shape of shapesFor(items)) {
    if (x > 0 && x + shape.w > SHEET_W) {
      x = 0;
      y += rowH + LABEL_H + GAP;
      rowH = 0;
    }
    placed.push({ shape, x, y });
    x += shape.w + GAP;
    rowH = Math.max(rowH, shape.h);
  }
  const height = y + rowH + LABEL_H;
  const ticks = rulerTicks(RULER_MM, 1); // millimetre units: factor 1 gives positions in mm

  return (
    <div data-testid="print-sheet" className="hidden print:block">
      <p className="mb-4 text-sm text-plum">{PRINT_INSTRUCTION}</p>
      <svg
        width={`${SHEET_W}mm`}
        height={`${height}mm`}
        viewBox={`0 0 ${SHEET_W} ${height}`}
        role="img"
        aria-label="Printable 1:1 sheet: a 100 mm ruler, a credit-card outline and the piece outlines"
        className="overflow-visible"
      >
        <g className="stroke-plum" strokeWidth={STROKE_MM} fill="none">
          <line x1={0} y1={0} x2={RULER_MM} y2={0} />
          {ticks.map((t) => (
            <line key={t.mm} x1={t.px} y1={0} x2={t.px} y2={t.kind === "cm" ? 5 : t.kind === "half" ? 3.5 : 2} />
          ))}
        </g>
        <g className="fill-plum" fontSize={3}>
          {ticks
            .filter((t) => t.label !== undefined)
            .map((t) => (
              <text key={t.mm} x={t.px} y={9} textAnchor="middle">
                {t.label}
              </text>
            ))}
          <text x={RULER_MM + 3} y={9}>
            cm
          </text>
        </g>
        <g className="stroke-plum" strokeWidth={STROKE_MM} fill="none">
          {placed.map(({ shape, x: px, y: py }) => shape.draw(px, py))}
        </g>
        <g className="fill-plum" fontSize={3}>
          {placed.map(({ shape, x: px, y: py }, i) => (
            <text key={i} x={px} y={py + shape.h + 4}>
              {shape.label}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

export default function SizeRuler({ factor, calibrated, items }: SizeRulerProps) {
  const [availablePx, setAvailablePx] = useState(Number.POSITIVE_INFINITY);
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const update = () => setAvailablePx(el.clientWidth > 0 ? el.clientWidth : Number.POSITIVE_INFINITY);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const lengthMm = fitRulerMm(availablePx, factor);
  const ticks = rulerTicks(lengthMm, factor);
  const width = mmToPx(lengthMm, factor);

  return (
    <div>
      <div ref={measure} className="flex flex-col gap-2 print:hidden">
        <p className="text-sm text-plum">
          {calibrated ? "Check the size against a real ruler" : "Approximate ruler"}
        </p>
        <div className="overflow-x-auto pb-1">
          <svg aria-hidden="true" data-testid="screen-ruler" width={width} height={30} className="overflow-visible">
            <g className="stroke-plum" strokeWidth={1}>
              {ticks.map((t) => (
                <line key={t.mm} x1={t.px} y1={0} x2={t.px} y2={TICK_PX[t.kind]} />
              ))}
            </g>
            <g className="fill-plum" fontSize={10}>
              {ticks
                .filter((t) => t.label !== undefined)
                .map((t) => (
                  <text key={t.mm} x={t.px} y={26} textAnchor="middle">
                    {t.label}
                  </text>
                ))}
              <text x={width + 6} y={26}>
                cm
              </text>
            </g>
          </svg>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="h-11 w-fit rounded-full border border-plum/30 px-6 text-sm font-medium text-plum transition-colors hover:bg-champagne"
        >
          Print a 1:1 paper ruler
        </button>
      </div>
      <PrintSheet items={items} />
    </div>
  );
}
