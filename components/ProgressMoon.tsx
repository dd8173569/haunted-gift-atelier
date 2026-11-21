/* Crescent-moon progress marker with a text equivalent (REQ-CV-02, 50). */
type ProgressMoonProps = { current: 1 | 2 | 3 | 4 | 5 | 6 };

export default function ProgressMoon({ current }: ProgressMoonProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width="32"
        height="32"
        viewBox="0 0 44 44"
        fill="none"
        aria-hidden="true"
        className="text-gold"
      >
        <path
          d="M28.5 4.5A17 17 0 1 0 39.5 30.5 13.5 13.5 0 0 1 28.5 4.5Z"
          fill="currentColor"
        />
      </svg>
      <div aria-hidden="true" className="flex gap-2">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <span
            key={n}
            className={`h-1.5 w-6 rounded-full ${n <= current ? "bg-gold" : "bg-plum/15"}`}
          />
        ))}
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-plum/70">
        Question {current} of 6
      </p>
    </div>
  );
}
