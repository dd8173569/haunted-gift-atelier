"use client";

// The true-size viewer (true-size-viewer design §5.1). A client island: it takes a serialisable
// SizeSpec as a prop and never imports the catalog. The server render and the first client
// render are both the approximate mode; a stored calibration applies after hydration.
//
// Wording rule (REQ-TS-12): before calibration, "true size" appears only inside the one label
// below. Nothing else in this file's output may contain it in the approximate or stale modes.
import { useCallback, useRef, useState } from "react";
import type { SizeSpec } from "../lib/size-spec";
import ActionButton from "./ActionButton";
import CalibrationSlider from "./CalibrationSlider";
import SizeOutlines from "./SizeOutlines";
import SizeRuler from "./SizeRuler";
import { useCalibration } from "./useCalibration";

const APPROXIMATE_LABEL = "Approximate size — calibrate with a card for true size.";
const STALE_NOTE =
  "Your browser zoom or screen changed since you calibrated, so sizes are approximate again. Calibrate again to restore them.";

export default function TrueSizeViewer({ spec }: { spec: SizeSpec }) {
  const { mode, factor, calibrate, reset } = useCalibration();
  const [calibrating, setCalibrating] = useState(false);
  const calibrated = mode === "calibrated";
  // Focus hand-off (REQ-PD-23): the button that had focus unmounts, so the handler names the
  // button that renders next, and that button's ref callback focuses it as it mounts. (No effect
  // hooks in this file: tests/true-size.static.test.ts forbids them.)
  const pendingFocus = useRef<"calibrate" | "reset" | null>(null);
  const focusIfPending = useCallback(
    (which: "calibrate" | "reset") => (el: HTMLButtonElement | null) => {
      if (el && pendingFocus.current === which) {
        pendingFocus.current = null;
        el.focus();
      }
    },
    [],
  );

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
        {/* One persistent live region: it exists before its text changes (REQ-PD-22). */}
        <div role="status" data-testid="size-status" className="flex flex-col gap-3">
          {mode === "stale" ? <p className="text-sm text-plum">{STALE_NOTE}</p> : null}
          {calibrated ? (
            <p className="text-sm font-medium text-plum">Calibrated to your screen</p>
          ) : (
            <p className="text-sm font-medium text-plum">{APPROXIMATE_LABEL}</p>
          )}
        </div>
        {calibrated ? (
          <ActionButton
            ref={focusIfPending("reset")}
            variant="secondary"
            className="w-fit"
            onClick={() => {
              pendingFocus.current = "calibrate";
              reset();
              setCalibrating(false);
            }}
          >
            Reset calibration
          </ActionButton>
        ) : calibrating ? null : (
          <ActionButton ref={focusIfPending("calibrate")} className="w-fit" onClick={() => setCalibrating(true)}>
            Calibrate with a card
          </ActionButton>
        )}
      </div>

      {calibrating ? (
        <CalibrationSlider
          onConfirm={(longEdgePx) => {
            if (calibrate(longEdgePx)) {
              pendingFocus.current = "reset";
              setCalibrating(false);
            }
          }}
          onCancel={() => {
            pendingFocus.current = "calibrate";
            setCalibrating(false);
          }}
        />
      ) : null}

      <SizeOutlines spec={spec} factor={factor} calibrated={calibrated} />
      <SizeRuler factor={factor} calibrated={calibrated} items={spec.items} />
    </section>
  );
}
