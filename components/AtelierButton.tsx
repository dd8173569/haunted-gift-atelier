import Link from "next/link";
import type { ReactNode } from "react";

/* Atelier button — two variants only, token colours only. */
type AtelierButtonProps = {
  href: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
  /** Opens `href` in a new tab; `href` is passed through untouched. */
  external?: boolean;
  /** Id of the element that names the context (a card heading). Repeated links keep their visible
   *  text as the name and gain this as a description (REQ-PD-20). */
  describedBy?: string;
};

/** The hint element rendered once per screen by SiteHeader. */
export const NEW_TAB_HINT_ID = "new-tab-hint";

export default function AtelierButton({
  href,
  variant = "primary",
  children,
  external = false,
  describedBy,
}: AtelierButtonProps) {
  const base =
    "flex h-12 items-center justify-center rounded-full px-8 text-base font-medium transition-colors";
  const styles =
    variant === "primary"
      ? "bg-plum text-pearl hover:bg-plum/85"
      : "border border-plum/60 text-plum hover:bg-blush";
  const description = [describedBy, external ? NEW_TAB_HINT_ID : undefined].filter(Boolean).join(" ");
  return (
    <Link
      href={href}
      className={`${base} ${styles}`}
      {...(description ? { "aria-describedby": description } : {})}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}
