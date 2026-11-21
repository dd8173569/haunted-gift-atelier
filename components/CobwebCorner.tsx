/* Cobweb corner (REQ-PD-14): a quarter web for the landing hero only. Decorative: aria-hidden,
   pointer-events-none, plum stroke at low opacity, not animated. Place it in the hero's padding,
   behind the text, never over a control. */
export default function CobwebCorner({ side = "left" }: { side?: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 96 96"
      fill="none"
      className={`pointer-events-none absolute top-0 h-24 w-24 stroke-plum opacity-20 ${
        side === "left" ? "left-0" : "right-0 -scale-x-100"
      }`}
      strokeWidth="1"
      strokeLinecap="round"
    >
      {/* spokes from the corner */}
      <path d="M0 0 L96 0 M0 0 L88 40 M0 0 L64 64 M0 0 L40 88 M0 0 L0 96" />
      {/* three arcs of silk between the spokes */}
      <path d="M72 0 Q64 24 66 49 Q50 50 30 72 Q22 62 0 72" />
      <path d="M48 0 Q42 16 44 33 Q33 34 20 48 Q14 42 0 48" />
      <path d="M24 0 Q20 8 22 17 Q16 17 10 24 Q7 21 0 24" />
    </svg>
  );
}
