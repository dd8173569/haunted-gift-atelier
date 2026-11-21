"use client";

/* A row of tappable chips. Each chip is a real button with aria-pressed
   (REQ-CV-50). Single-select groups and multi-select groups share the markup;
   the caller decides what a tap means. Tokens only. */
export type ChipOption = { value: string; label: string };

type ChipGroupProps = {
  /** Accessible name of the group, usually the question prompt. */
  label: string;
  options: readonly ChipOption[];
  selected: readonly string[];
  multi?: boolean;
  onToggle: (value: string) => void;
};

export default function ChipGroup({
  label,
  options,
  selected,
  multi = false,
  onToggle,
}: ChipGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-multi={multi ? "true" : undefined}
      className="flex flex-wrap justify-center gap-3"
    >
      {options.map((o) => {
        const pressed = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(o.value)}
            className={`min-h-11 min-w-11 rounded-full border px-5 py-2 text-base transition-colors ${
              pressed
                ? "border-plum bg-plum text-pearl"
                : "border-plum/30 text-plum hover:bg-blush"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
