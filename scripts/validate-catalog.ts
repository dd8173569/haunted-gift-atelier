// Catalog validator (design.md §4, checks 1–15). Read-only: never writes a file.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CatalogBuildError, parseCatalog, type RawCatalog } from "../lib/catalog";

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const AGE_GROUPS = ["Infants 0-3 years", "Kids 3-12 years", "Teens 12-19 years", "Mom"];
const CATEGORIES = ["Pendant", "Bracelet", "Earrings", "Set", "Tabeez"];
const REQUIRED = [
  "sku", "name", "price_inr", "url", "image_file", "materials",
  "weight", "dimensions", "availability", "category",
] as const;

export type ValidationResult = {
  ok: boolean;
  /** Each entry reads "[REQ-CD-xx] SKU field: message". */
  errors: string[];
  /** Each entry reads "SKU field: message". */
  warnings: string[];
  version: string | null;
  count: number;
};

function imageKind(file: string): "png" | "jpeg" | null {
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(8);
  try {
    fs.readSync(fd, buf, 0, 8, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  return null;
}

/** Product content = everything except the version field. */
function contentKey(data: Record<string, unknown>): string {
  const { version: _version, ...rest } = data;
  void _version;
  return JSON.stringify(rest);
}

export function validateCatalog(opts: { root?: string; base?: string } = {}): ValidationResult {
  const root = path.resolve(opts.root ?? SCRIPT_ROOT);
  const catalogPath = path.join(root, "data", "catalog.json");
  const changelogPath = path.join(root, "data", "catalog-changelog.md");
  const imageDir = path.join(root, "public", "catalog");

  const errors: string[] = [];
  const warnings: string[] = [];
  let version: string | null = null;
  let count = 0;
  let structural = 0; // errors from checks 1–9 and 11 block check 12
  const fail = (req: string, subject: string, message: string, blocks = true) => {
    errors.push(`[${req}] ${subject}: ${message}`);
    if (blocks) structural++;
  };
  const result = (): ValidationResult => ({
    ok: errors.length === 0,
    errors,
    warnings,
    version,
    count,
  });

  // 1. file reads and JSON parses
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  } catch (e) {
    fail("REQ-CD-09", "catalog", `data/catalog.json cannot be read or parsed: ${(e as Error).message}`);
    return result();
  }

  // 2. version semver, extracted date
  if (typeof data.version === "string") version = data.version;
  if (typeof data.version !== "string" || !/^\d+\.\d+\.\d+$/.test(data.version)) {
    fail("REQ-CD-22", "catalog version", `must be semver, got ${JSON.stringify(data.version)}`);
  }
  if (typeof data.extracted !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.extracted)) {
    fail("REQ-CD-22", "catalog extracted", `must be YYYY-MM-DD, got ${JSON.stringify(data.extracted)}`);
  }

  const products = data.products;
  if (!Array.isArray(products)) {
    fail("REQ-CD-09", "catalog products", "products must be an array");
    return result();
  }
  count = products.length;

  // 3. count
  if (data.count !== products.length) {
    fail("REQ-CD-09", "catalog count", `count (${String(data.count)}) does not equal products.length (${products.length})`);
  }

  const seen = new Set<string>();
  const referenced = new Set<string>();
  for (const [i, raw] of products.entries()) {
    const p = (raw ?? {}) as Record<string, unknown>;
    const id = typeof p.sku === "string" && p.sku ? p.sku : `#${i + 1}`;

    // 4. required string fields
    for (const f of REQUIRED) {
      const v = p[f];
      if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
        fail("REQ-CD-02", `${id} ${f}`, "missing or empty required field");
      }
    }

    // 5. SKU pattern and uniqueness
    if (typeof p.sku === "string" && p.sku) {
      if (!/^[A-Z]{3}-\d{4}$/.test(p.sku)) fail("REQ-CD-01", `${id} sku`, "does not match ^[A-Z]{3}-\\d{4}$");
      if (seen.has(p.sku)) fail("REQ-CD-01", `${id} sku`, "duplicate sku");
      seen.add(p.sku);
    }

    // 6. price positive integer, mrp null
    if (p.price_inr !== undefined && p.price_inr !== null &&
        !(Number.isInteger(p.price_inr) && (p.price_inr as number) > 0)) {
      fail("REQ-CD-03", `${id} price_inr`, "must be a positive integer");
    }
    if (p.mrp_inr !== null && p.mrp_inr !== undefined) {
      fail("REQ-CD-03", `${id} mrp_inr`, "must be null (no MRP exists)");
    }

    // 7. URL
    if (typeof p.url === "string" && p.url && !p.url.startsWith("https://www.tinytiaraa.com/product/")) {
      fail("REQ-CD-04", `${id} url`, "must match https://www.tinytiaraa.com/product/*");
    }

    // 8. age groups
    if (!Array.isArray(p.age_groups) || p.age_groups.length === 0) {
      fail("REQ-CD-06", `${id} age_groups`, "must be a non-empty array");
    } else {
      for (const a of p.age_groups) {
        if (!AGE_GROUPS.includes(a as string)) fail("REQ-CD-06", `${id} age_groups`, `invalid age group "${String(a)}"`);
      }
    }

    // 9. availability and category
    if (p.availability !== undefined && p.availability !== "In Stock" && p.availability !== "Out of Stock") {
      fail("REQ-CD-07", `${id} availability`, 'must be "In Stock" or "Out of Stock"');
    }
    if (p.category !== undefined && !CATEGORIES.includes(p.category as string)) {
      fail("REQ-CD-08", `${id} category`, `invalid category "${String(p.category)}"`);
    }

    // 10. image exists with PNG/JPEG magic bytes (bare filename only)
    if (typeof p.image_file === "string" && p.image_file) {
      const file = path.join(imageDir, p.image_file);
      if (path.dirname(file) !== imageDir || !fs.existsSync(file)) {
        fail("REQ-CD-05", `${id} image_file`, `"${p.image_file}" not found under public/catalog/`, false);
      } else if (imageKind(file) === null) {
        fail("REQ-CD-05", `${id} image_file`, `"${p.image_file}" is not a valid PNG or JPEG`, false);
      }
      referenced.add(p.image_file);
    }

    // 11. claims: missing defaults to []; present must be an array
    if (p.claims !== undefined && !Array.isArray(p.claims)) {
      fail("REQ-CD-13", `${id} claims`, "must be an array");
    }
  }

  // 12. parseCatalog: build errors fail, warnings collected
  if (structural === 0) {
    try {
      const parsed = parseCatalog(data as unknown as RawCatalog);
      for (const w of parsed.warnings) warnings.push(`${w.sku} ${w.field}: ${w.message}`);
    } catch (e) {
      if (e instanceof CatalogBuildError) {
        fail(e.req, `${e.sku || "catalog"} ${e.field}`, e.message, false);
      } else {
        fail("REQ-CD-12", "catalog parse", (e as Error).message, false);
      }
    }
  }

  // 13. changelog heading for this version
  const heading = version === null ? null : `## v${version}`;
  let changelog = "";
  try {
    changelog = fs.readFileSync(changelogPath, "utf8");
  } catch {
    fail("REQ-CD-23", "changelog", "data/catalog-changelog.md cannot be read", false);
  }
  const hasHeading = (v: string) =>
    new RegExp(`^## v${v.replace(/\./g, "\\.")}(\\s|$)`, "m").test(changelog);
  if (version !== null && changelog && !hasHeading(version)) {
    fail("REQ-CD-23", "changelog", `missing heading "${heading}" in data/catalog-changelog.md`, false);
  }

  // 14. version bump vs base (only with --base)
  if (opts.base !== undefined) {
    let baseData: Record<string, unknown> | null = null;
    try {
      const out = execFileSync("git", ["show", `${opts.base}:data/catalog.json`], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 16 * 1024 * 1024,
      });
      baseData = JSON.parse(out);
    } catch (e) {
      fail("REQ-CD-23", "base", `cannot read ${opts.base}:data/catalog.json: ${(e as Error).message.split("\n")[0]}`, false);
    }
    if (baseData && contentKey(baseData) !== contentKey(data)) {
      if (baseData.version === data.version) {
        fail("REQ-CD-23", "catalog version", `content changed since ${opts.base} but version is still ${String(data.version)}`, false);
      } else if (typeof data.version === "string" && !hasHeading(data.version)) {
        fail("REQ-CD-23", "changelog", `content changed since ${opts.base} but changelog has no "## v${data.version}" heading`, false);
      }
    }
  }

  // 15. no orphan photos
  if (fs.existsSync(imageDir)) {
    for (const f of fs.readdirSync(imageDir)) {
      if (!referenced.has(f)) fail("REQ-CD-05", f, "photo in public/catalog/ is not referenced by any product", false);
    }
  }

  return result();
}

function main(argv: string[]): void {
  const flag = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const base = flag("--base");
  if (base === undefined) console.log("NOTE: version-bump check skipped (no --base)");
  const r = validateCatalog({ root: flag("--root"), base });
  if (!r.ok) {
    for (const e of r.errors) console.error(`FAIL ${e}`);
    console.error(`CATALOG VALIDATION FAILED: ${r.errors.length} error(s)`);
    process.exit(1);
  }
  console.log(`CATALOG OK: ${r.count} products, version ${r.version}, ${r.warnings.length} warning(s)`);
  for (const w of r.warnings) console.log(`  warning: ${w}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
