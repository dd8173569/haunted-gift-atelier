// Test helper: heading outline and keyboard order (REQ-PD-24, REQ-PD-18).

export type HeadingEntry = { level: number; text: string; id: string | null };

/** `h1` to `h6` in document order. Headings inside `aria-hidden` subtrees are skipped. */
export function headingOutline(container: Element): HeadingEntry[] {
  return Array.from(container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"))
    .filter((h) => !h.closest('[aria-hidden="true"]'))
    .map((h) => ({
      level: Number(h.tagName.slice(1)),
      text: (h.textContent ?? "").trim(),
      id: h.getAttribute("id"),
    }));
}

/** True when no heading is more than one level deeper than the one before it (and the first is an h1). */
export function outlineHasNoSkips(outline: HeadingEntry[]): boolean {
  let prev = 0;
  for (const h of outline) {
    if (h.level > prev + 1) return false;
    prev = h.level;
  }
  return true;
}

const TABBABLE =
  'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]';

/**
 * Elements a Tab key press can reach, in DOM order. `tabindex="-1"` is excluded. A positive
 * `tabindex` would reorder real browsers; tests assert none exists, so DOM order is the order.
 */
export function focusOrder(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE)).filter((el) => {
    const t = el.getAttribute("tabindex");
    return t === null || Number(t) >= 0;
  });
}
