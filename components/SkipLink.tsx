/* Skip link (REQ-PD-05): the first focusable element on every page, visible on focus, targeting
   every screen's <main id="main-content">. */
export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:h-11 focus:items-center focus:rounded-full focus:bg-plum focus:px-6 focus:text-pearl"
    >
      Skip to main content
    </a>
  );
}
