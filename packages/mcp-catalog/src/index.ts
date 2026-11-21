// MCP server over the real Tiny Tiaraa catalog (architecture §7). stdio transport.
// Runs from TypeScript source via tsx so matching_explain executes the real lib/matching.ts.
// stdout carries only MCP protocol messages; diagnostics go to stderr.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OCCASION_MAP, type Occasion } from "../../../data/occasion-map.js";
import { parseCatalog, type ParsedCatalog, type Product, type RawCatalog } from "../../../lib/catalog.js";
import { match } from "../../../lib/matching.js";
import { eligible, initialConstraints, passes } from "../../../lib/matching/filters.js";
import type { AgeBand, CategoryPref, RecipientModel } from "../../../lib/matching/types.js";
import { validateCatalog } from "../../../scripts/validate-catalog.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CATALOG_PATH = path.join(REPO_ROOT, "data", "catalog.json");

const catalog: ParsedCatalog = parseCatalog(
  JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8")) as RawCatalog,
);
const byName = new Map(catalog.products.map((p) => [p.sku, p]));

const AGE_BANDS = ["infants", "kids", "teens", "mom"] as const;
const BUDGET_BANDS = ["under-2500", "2500-15000", "15000-25000", "25000-plus", "no-limit"] as const;
const CATEGORY_PREFS = ["pendant", "bracelet", "earrings", "set", "tabeez", "any"] as const;

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
const json = (value: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});
const fail = (message: string): ToolResult => ({ ...json({ error: message }), isError: true });

const server = new McpServer({ name: "haunted-gift-atelier-catalog", version: "0.1.0" });

server.registerTool(
  "catalog_search",
  {
    description:
      "Search the real catalog with the same hard filters matching uses. All inputs optional. " +
      "Without ageBand, products for any age band are searched. Without availability, only In Stock products are returned.",
    inputSchema: {
      ageBand: z.enum(AGE_BANDS).optional(),
      budgetBand: z.enum(BUDGET_BANDS).optional(),
      category: z.string().optional().describe("Pendant, Bracelet, Earrings, Set or Tabeez (case-insensitive)"),
      metal: z.enum(["gold", "silver", "any"]).optional(),
      symbol: z.string().optional().describe("A catalog tag, e.g. symbol:ganesha, symbol:zodiac, symbol:evil-eye"),
      availability: z.enum(["In Stock", "Out of Stock"]).optional(),
    },
  },
  async (args) => {
    const category = (args.category ?? "any").toLowerCase();
    if (!(CATEGORY_PREFS as readonly string[]).includes(category)) {
      return fail(`Unknown category "${args.category}". Use Pendant, Bracelet, Earrings, Set or Tabeez.`);
    }
    const wantOut = args.availability === "Out of Stock";
    const found = new Map<string, Product>();
    for (const ageBand of args.ageBand ? [args.ageBand] : AGE_BANDS) {
      const model: RecipientModel = {
        relationship: "other",
        ageBand,
        occasion: "just-because" satisfies Occasion,
        budgetBand: args.budgetBand ?? "no-limit",
        metal: args.metal ?? "any",
        symbols: "any",
        category: category as CategoryPref,
      };
      const c = initialConstraints(model);
      // eligible() returns In Stock only; for Out of Stock reuse passes() with availability neutralised.
      const rows = wantOut
        ? catalog.products
            .filter((p) => p.availability === "Out of Stock")
            .filter((p) => passes({ ...p, availability: "In Stock" }, c, model))
        : eligible(c, model, catalog);
      for (const p of rows) found.set(p.sku, p);
    }
    const results = [...found.values()]
      .filter((p) => args.symbol === undefined || p.tags.includes(args.symbol))
      .map((p) => ({
        sku: p.sku,
        name: p.name,
        price_inr: p.price_inr,
        materials: p.materials,
        availability: p.availability,
        category: p.category,
        age_groups: p.age_groups,
      }));
    return json({ count: results.length, results });
  },
);

server.registerTool(
  "catalog_get",
  {
    description: "Return the full parsed Product record for one SKU.",
    inputSchema: { sku: z.string() },
  },
  async ({ sku }) => {
    const p = byName.get(sku);
    return p ? json(p) : fail(`SKU not found: ${sku}`);
  },
);

server.registerTool(
  "catalog_validate",
  { description: "Run the catalog validator (scripts/validate-catalog.ts) and return { ok, errors, warnings }." },
  async () => {
    const r = validateCatalog();
    return json({ ok: r.ok, errors: r.errors, warnings: r.warnings });
  },
);

const occasionSchema = z
  .string()
  .refine((o) => Object.prototype.hasOwnProperty.call(OCCASION_MAP, o), {
    message: `occasion must be one of: ${Object.keys(OCCASION_MAP).join(", ")}`,
  });

server.registerTool(
  "matching_explain",
  {
    description:
      "Run lib/matching.ts match(model, catalog) on a RecipientModel and return picks, disclosures, shortfall note and ladder trace.",
    inputSchema: {
      model: z.object({
        relationship: z.enum(["niece-nephew", "grandchild", "friends-baby", "godchild", "own-child", "mom", "other"]),
        ageBand: z.enum(AGE_BANDS),
        ageYears: z.number().optional(),
        occasion: occasionSchema,
        budgetBand: z.enum(BUDGET_BANDS),
        metal: z.enum(["gold", "silver", "any"]),
        symbols: z.enum(["any", "none-religious", "zodiac", "evil-eye", "religious"]),
        symbolList: z.array(z.string()).optional(),
        category: z.enum(CATEGORY_PREFS),
      }),
    },
  },
  async ({ model }) => {
    const result = match(model as RecipientModel, catalog);
    return json({
      picks: result.picks.map((pick) => {
        const p = byName.get(pick.sku);
        return {
          sku: pick.sku,
          name: p?.name,
          price_inr: p?.price_inr,
          score: pick.score,
          breakdown: pick.breakdown,
          reasons: pick.reasons,
          relaxations: pick.relaxations,
          relaxationNote: pick.relaxationNote,
        };
      }),
      disclosures: result.disclosures,
      shortfallNote: result.shortfallNote ?? null,
      showBrowseLink: result.showBrowseLink,
      trace: result.trace,
    });
  },
);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error(`mcp-catalog ready: catalog v${catalog.version}, ${catalog.products.length} products`);
}

main().catch((e) => {
  console.error("mcp-catalog failed to start:", e);
  process.exit(1);
});
