"use client";

// The true-size viewer (true-size-viewer design §5.1). A client island: it takes a serialisable
// SizeSpec as a prop and never imports the catalog. The server render and the first client
// render are both the approximate mode; a stored calibration applies after hydration.
//
// Wording rule (REQ-TS-12): before calibration, "true size" appears only inside the one label
// below. Nothing else in this file's output may contain it in the approximate or stale modes.
import { useState } from "react";
import type { SizeSpec } from "../lib/size-spec";
import CalibrationSlider from "./CalibrationSlider";
import SizeOutlines from "./SizeOutlines";
import SizeRuler from "./SizeRuler";
import { useCalibration } from "./useCalibration";

const APPROXIMATE_LABEL = "Approximate size — calibrate with a card for true size.";
const STALE_NOTE =
  "Your browser zoom or screen changed since you calibrated, so sizes are approximate again. Calibrate again to restore them.";

const buttonClass =
  "h-11 w-fit rounded-full border border-plum/30 px-6 text-sm font-medium text-plum transition-colors hover:bg-champagne";
const primaryButtonClass =
  "h-11 w-fit rounded-full bg-plum px-6 text-sm font-medium text-pearl transition-colors hover:bg-plum/85";

export default function TrueSizeViewer({ spec }: { spec: SizeSpec }) {
  const { mode, factor, calibrate, reset } = useCalibration();
  const [calibrating, setCalibrating] = useState(false);
  const calibrated = mode === "calibrated";

  return (
    <section
      aria-labelledby="size-title"
      data-testid="size-viewer"
      className="flex flex-col gap-5 rounded-2xl bg-pearl p-4"
    >
      <h2 id="size-title" className="font-display text-2xl text-plum print:hidden">
        Size on your screen
      </h2>

      <div className="flex flex-col gap-3 print:hidden">
        {mode === "stale" ? <p className="text-sm text-plum">{STALE_NOTE}</p> : null}
        {calibrated ? (
          <>
            <p className="text-sm font-medium text-plum">Calibrated to your screen</p>
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                reset();
                setCalibrating(false);
              }}
            >
              Reset calibration
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-plum">{APPROXIMATE_LABEL}</p>
            {calibrating ? null : (
              <button type="button" className={primaryButtonClass} onClick={() => setCalibrating(true)}>
                Calibrate with a card
              </button>
            )}
          </>
        )}
      </div>

      {calibrating ? (
        <CalibrationSlider
          onConfirm={(longEdgePx) => {
            if (calibrate(longEdgePx)) setCalibrating(false);
          }}
          onCancel={() => setCalibrating(false)}
        />
      ) : null}

      <SizeOutlines spec={spec} factor={factor} calibrated={calibrated} />
      <SizeRuler factor={factor} calibrated={calibrated} items={spec.items} />
    </section>
  );
}
