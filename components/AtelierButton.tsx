import Link from "next/link";
import type { ReactNode } from "react";

/* Atelier button — two variants only, token colours only. */
type AtelierButtonProps = {
  href: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
};

export default function AtelierButton({
  href,
  variant = "primary",
  children,
}: AtelierButtonProps) {
  const base =
    "flex h-12 items-center justify-center rounded-full px-8 text-base font-medium transition-colors";
  const styles =
    variant === "primary"
      ? "bg-plum text-pearl hover:bg-plum/85"
      : "border border-plum/30 text-plum hover:bg-blush";
  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}
