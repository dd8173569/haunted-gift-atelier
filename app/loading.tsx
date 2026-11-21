/* Text-only loading fallback (REQ-REL-10). No card, price, photo, pinned string, or animation; the page
   that replaces it supplies main#main-content. */
export default function Loading() {
  return (
    <p role="status" aria-busy="true" className="mx-auto w-full max-w-6xl px-6 py-8 text-plum/75 sm:px-10">
      Opening the atelier…
    </p>
  );
}
