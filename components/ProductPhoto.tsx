import Image from "next/image";

/* Exact catalog photo, displayed unaltered: object-contain on a pearl
   background, never cropped, never with text or a logo overlaid (PRD §2). */
type ProductPhotoProps = {
  src: string; // e.g. "/catalog/TPN-1149.png"
  alt: string; // product name, verbatim
  priority?: boolean;
};

export default function ProductPhoto({ src, alt, priority = false }: ProductPhotoProps) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-pearl">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-contain"
        priority={priority}
      />
    </div>
  );
}
