import type { ComponentPropsWithRef } from "react";

/* The one <button> primitive (REQ-PD-06). Three variants, two sizes, token colours only.
   Chips stay in ChipGroup. Heights are h-11 (44 px) or h-12 so every button meets the touch target. */
export type ActionButtonVariant = "primary" | "secondary" | "quiet";
export type ActionButtonSize = "md" | "lg";

type ActionButtonProps = Omit<ComponentPropsWithRef<"button">, "className"> & {
  variant?: ActionButtonVariant;
  /** `quiet` ignores size: it is a text button with a 44 px target. */
  size?: ActionButtonSize;
  className?: string;
};

const BASE = "inline-flex items-center justify-center rounded-full font-medium transition-colors";

export const ACTION_VARIANT_CLASSES: Record<ActionButtonVariant, string> = {
  primary: "bg-plum text-pearl hover:bg-plum/85",
  secondary: "border border-plum/60 text-plum hover:bg-champagne",
  quiet: "min-h-11 min-w-11 px-4 text-plum hover:underline",
};

export const ACTION_SIZE_CLASSES: Record<ActionButtonSize, string> = {
  md: "h-11 px-6 text-sm",
  lg: "h-12 px-8 text-base",
};

export default function ActionButton({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  ...rest
}: ActionButtonProps) {
  const classes = [BASE, ACTION_VARIANT_CLASSES[variant], variant === "quiet" ? "text-sm" : ACTION_SIZE_CLASSES[size], className]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...rest} />;
}
