"use client";

// Calibration store (true-size-viewer design §4). An external store read with
// useSyncExternalStore: the server snapshot is "nothing stored", so the server render and the
// first client render match, and the stored value applies on the next render. No setState in
// an effect. Falls back to memory when localStorage throws (private mode, quota).
import { useCallback, useSyncExternalStore } from "react";
import {
  CSS_PX_PER_MM,
  STORAGE_KEY,
  factorFromCardPx,
  isStale,
  parseCalibration,
  serializeCalibration,
} from "../lib/true-size";

const EVENT = "hga:calibration";
let memory: string | null = null;

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function write(raw: string | null): void {
  memory = raw;
  try {
    if (raw === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    /* keep the in-memory value; no error is shown */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("resize", onChange);
  };
}

const readDpr = () => window.devicePixelRatio;
const serverRaw = () => null;
const serverDpr = () => 1;

export type CalibrationMode = "approximate" | "calibrated" | "stale";

export interface UseCalibration {
  mode: CalibrationMode;
  /** CSS px per mm: the stored factor only when calibrated, otherwise the CSS millimetre. */
  factor: number;
  /** Stores the factor from the card's long edge in px. False when the value is rejected. */
  calibrate(longEdgePx: number): boolean;
  reset(): void;
}

export function useCalibration(): UseCalibration {
  const raw = useSyncExternalStore(subscribe, read, serverRaw);
  const dpr = useSyncExternalStore(subscribe, readDpr, serverDpr);
  const stored = parseCalibration(raw);

  const calibrate = useCallback((longEdgePx: number): boolean => {
    const r = factorFromCardPx(longEdgePx);
    if (!r.ok) return false;
    write(serializeCalibration({ pxPerMm: r.factor, dpr: window.devicePixelRatio }));
    return true;
  }, []);
  const reset = useCallback(() => write(null), []);

  if (stored === null) return { mode: "approximate", factor: CSS_PX_PER_MM, calibrate, reset };
  if (isStale(stored, dpr)) return { mode: "stale", factor: CSS_PX_PER_MM, calibrate, reset };
  return { mode: "calibrated", factor: stored.pxPerMm, calibrate, reset };
}
