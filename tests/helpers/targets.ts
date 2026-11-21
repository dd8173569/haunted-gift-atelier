// Test helper: touch-target guard (REQ-PD-28, design §5.5).
// jsdom loads no Tailwind and has no layout, so computed sizes are unavailable. This parser reads the
// height and width utilities an author wrote. It guards intent; the manual pass checks glass.
// Only unprefixed utilities count: `hover:h-12` or `sm:min-h-11` do not apply at every width.

/** Tailwind spacing step N is N * 0.25rem; step 11 is 2.75rem = 44 px. */
export const MIN_TARGET_STEP = 11;
/** Horizontal padding step 4 is 16 px each side around a label. */
export const MIN_PADDING_STEP = 4;

export type TargetSize = {
  /** Largest `h-N` or `min-h-N` step found, or null. */
  heightStep: number | null;
  /** Largest `min-w-N` or `w-N` step found, or null. */
  widthStep: number | null;
  /** Largest `px-N` step found, or null. */
  paddingXStep: number | null;
  heightOk: boolean;
  widthOk: boolean;
  ok: boolean;
};

const STEP = String.raw`(\d+(?:\.\d+)?)`;
const maxStep = (classes: string[], re: RegExp): number | null => {
  let found: number | null = null;
  for (const c of classes) {
    const m = re.exec(c);
    if (m) found = Math.max(found ?? 0, Number(m[1]));
  }
  return found;
};

export function targetSize(el: Element): TargetSize {
  const classes = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
  const heightStep = maxStep(classes, new RegExp(`^(?:min-)?h-${STEP}$`));
  const widthStep = maxStep(classes, new RegExp(`^(?:min-)?w-${STEP}$`));
  const paddingXStep = maxStep(classes, new RegExp(`^px-${STEP}$`));
  const heightOk = heightStep !== null && heightStep >= MIN_TARGET_STEP;
  const widthOk =
    (widthStep !== null && widthStep >= MIN_TARGET_STEP) ||
    (paddingXStep !== null && paddingXStep >= MIN_PADDING_STEP);
  return { heightStep, widthStep, paddingXStep, heightOk, widthOk, ok: heightOk && widthOk };
}

const INTERACTIVE =
  'a[href], button, input:not([type="hidden"]), textarea, select, summary, [role="button"], [role="link"]';

/** Every interactive element in a container, in document order. */
export function interactive(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(INTERACTIVE));
}
