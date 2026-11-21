"use client";

// Card-outline slider (true-size-viewer design §5.2). The slider always controls the outline's
// long edge; the outline stands upright when the long edge does not fit the space available.
import { useCallback, useState } from "react";
import {
  CARD_MM,
  CARD_PX_DEFAULT,
  CARD_PX_MAX,
  CARD_PX_MIN,
  cardOrientation,
} from "../lib/true-size";
import ActionButton from "./ActionButton";

interface CalibrationSliderProps {
  onConfirm(longEdgePx: number): void;
  onCancel(): void;
}

export default function CalibrationSlider({ onConfirm, onCancel }: CalibrationSliderProps) {
  const [longEdgePx, setLongEdgePx] = useState(CARD_PX_DEFAULT);
  const [availablePx, setAvailablePx] = useState(Number.POSITIVE_INFINITY);

  // Ref callback: reads the container width on mount and on window resize. A width of 0 means
  // there is no layout to measure, so the space is treated as unknown.
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const update = () => setAvailablePx(el.clientWidth > 0 ? el.clientWidth : Number.POSITIVE_INFINITY);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // "Calibrate with a card" unmounts when this panel opens, so focus moves to the slider as it
  // mounts (REQ-PD-23). A ref callback, because effect hooks are banned in this file.
  const focusOnMount = useCallback((el: HTMLInputElement | null) => {
    el?.focus();
  }, []);

  const shortEdgePx = (longEdgePx * CARD_MM.short) / CARD_MM.long;
  const portrait = cardOrientation(longEdgePx, availablePx) === "portrait";

  return (
    <div ref={measure} className="flex flex-col gap-4 rounded-2xl bg-blush p-4 print:hidden">
      <p id="cal-help" className="text-sm leading-relaxed text-plum">
        Hold a credit or debit card flat against the screen. Drag the slider until the outline
        matches the card&apos;s long edge.
      </p>
      <div className="overflow-x-auto">
        <div
          data-testid="card-outline"
          aria-hidden="true"
          className="box-border border border-plum/60 bg-champagne/40"
          style={{
            width: portrait ? shortEdgePx : longEdgePx,
            height: portrait ? longEdgePx : shortEdgePx,
          }}
        />
      </div>
      <input
        ref={focusOnMount}
        type="range"
        min={CARD_PX_MIN}
        max={CARD_PX_MAX}
        step={1}
        value={longEdgePx}
        aria-label="Card outline width"
        aria-describedby="cal-help"
        aria-valuetext={`Outline ${longEdgePx} pixels wide`}
        className="h-11 w-full accent-plum"
        onChange={(e) => setLongEdgePx(Number(e.target.value))}
      />
      <div className="flex flex-wrap gap-3">
        <ActionButton onClick={() => onConfirm(longEdgePx)}>This matches</ActionButton>
        <ActionButton variant="secondary" onClick={onCancel}>
          Cancel
        </ActionButton>
      </div>
    </div>
  );
}
