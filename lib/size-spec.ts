// Catalog dimensions → drawable items and captions (true-size-viewer design §3).
// Pure and serialisable: reads name, image_file, category and dims only.
import type { Product } from "./catalog";
import { formatInches, formatMm } from "./true-size";

export const PHOTO_BOX_MIN_SHORT_MM = 6;
export const PHOTO_BOX_MAX_ASPECT = 2.5;

/** The photo goes inside a box only when it can be read there (REQ-TS-17). */
export function photoFitsBox(heightMm: number, widthMm: number): boolean {
  const short = Math.min(heightMm, widthMm);
  const long = Math.max(heightMm, widthMm);
  return short >= PHOTO_BOX_MIN_SHORT_MM && long / short <= PHOTO_BOX_MAX_ASPECT;
}

/** Identical for boxes; they differ for rings. */
export interface SizeCaption {
  approximate: string;
  calibrated: string;
}

export type SizeItem =
  | {
      kind: "box";
      id: "piece" | "pendant" | "earring";
      heightMm: number;
      widthMm: number;
      photoInside: boolean;
      caption: SizeCaption;
      detail: string;
    }
  | {
      kind: "line";
      id: "piece";
      heightMm: number;
      caption: SizeCaption;
      detail: string;
    }
  | {
      kind: "ring";
      id: "bracelet" | "bangle";
      diameterMm: number;
      caption: SizeCaption;
      detail: string;
    }
  | { kind: "missing"; id: "piece"; message: string };

export interface SizeSpec {
  sku: string;
  name: string;
  imageSrc: string;
  items: SizeItem[];
}

export const SIZE_NOT_STATED = "Size not stated on the listing.";
const BAND_NOT_STATED = "Band width not stated on the listing.";

/** A drawable dimension: finite and above 0. Anything else is treated as not stated. */
const valid = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;

const same = (s: string): SizeCaption => ({ approximate: s, calibrated: s });

function boxCaption(part: "pendant" | "earring" | "tabeez" | "piece", h: number): string {
  const tall = `${formatMm(h)} mm tall`;
  switch (part) {
    case "pendant":
      return `pendant face, ${tall} — chain not shown to scale`;
    case "earring":
      return `one earring, ${tall}`;
    case "tabeez":
      return `tabeez, ${tall} — thread not shown to scale`;
    default:
      return `piece, ${tall}`;
  }
}

function partFor(category: Product["category"]): "pendant" | "earring" | "tabeez" | "piece" {
  if (category === "Pendant") return "pendant";
  if (category === "Earrings") return "earring";
  if (category === "Tabeez") return "tabeez";
  return "piece";
}

function box(
  id: "piece" | "pendant" | "earring",
  part: "pendant" | "earring" | "tabeez" | "piece",
  h: number,
  w: number,
  photoInside: boolean,
): SizeItem {
  return {
    kind: "box",
    id,
    heightMm: h,
    widthMm: w,
    photoInside,
    caption: same(boxCaption(part, h)),
    detail: `Listed: ${formatMm(h)} mm tall × ${formatMm(w)} mm wide.`,
  };
}

export function buildSizeSpec(product: Product): SizeSpec {
  const { dims } = product;
  const missing: SizeItem = { kind: "missing", id: "piece", message: SIZE_NOT_STATED };
  let items: SizeItem[];

  if (dims.kind === "item") {
    const part = partFor(product.category);
    if (!valid(dims.height_mm)) {
      items = [missing];
    } else if (!valid(dims.width_mm)) {
      items = [
        {
          kind: "line",
          id: "piece",
          heightMm: dims.height_mm,
          caption: same(boxCaption(part, dims.height_mm)),
          detail: `Listed: ${formatMm(dims.height_mm)} mm tall. Width not stated on the listing.`,
        },
      ];
    } else {
      items = [
        box("piece", part, dims.height_mm, dims.width_mm, photoFitsBox(dims.height_mm, dims.width_mm)),
      ];
    }
  } else if (dims.kind === "set") {
    const all = [
      dims.pendant_height_mm,
      dims.pendant_width_mm,
      dims.earring_height_mm,
      dims.earring_width_mm,
    ];
    items = all.every(valid)
      ? [
          box("pendant", "pendant", dims.pendant_height_mm, dims.pendant_width_mm, false),
          box("earring", "earring", dims.earring_height_mm, dims.earring_width_mm, false),
        ]
      : [missing];
  } else if (dims.kind === "string-bracelet") {
    if (!valid(dims.circumference_mm)) {
      items = [missing];
    } else {
      const d = dims.circumference_mm / Math.PI;
      const inches = formatInches(dims.circumference_mm);
      const band = valid(dims.width_mm)
        ? `Band width: ${formatMm(dims.width_mm)} mm.`
        : BAND_NOT_STATED;
      items = [
        {
          kind: "ring",
          id: "bracelet",
          diameterMm: d,
          caption: {
            calibrated: `ring outline at true size — ${inches} in around`,
            approximate: `ring outline, approximate size — ${inches} in around`,
          },
          detail: `Drawn as a closed circle, Ø ≈ ${Math.round(d)} mm. ${band}`,
        },
      ];
    }
  } else {
    if (!valid(dims.diameter_mm)) {
      items = [missing];
    } else {
      const d = formatMm(dims.diameter_mm);
      items = [
        {
          kind: "ring",
          id: "bangle",
          diameterMm: dims.diameter_mm,
          caption: {
            calibrated: `bangle outline at true size — ${d} mm across`,
            approximate: `bangle outline, approximate size — ${d} mm across`,
          },
          detail: valid(dims.width_mm) ? `Band width: ${formatMm(dims.width_mm)} mm.` : BAND_NOT_STATED,
        },
      ];
    }
  }

  return {
    sku: product.sku,
    name: product.name,
    imageSrc: `/catalog/${product.image_file}`,
    items,
  };
}
