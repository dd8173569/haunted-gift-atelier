"use client";

import { useState } from "react";
import {
  AGE_OPTIONS,
  ALL_FILTERS,
  BUDGET_OPTIONS,
  CATEGORY_OPTIONS,
  METAL_OPTIONS,
  filterItems,
  filtersToQuery,
  type BrowseFilters,
  type BrowseItem,
} from "../lib/browse";
import BrowseCard from "./BrowseCard";
import ChipGroup from "./ChipGroup";
import PriceFootnote from "./PriceFootnote";

/* The browse grid (REQ-CV-34 to 37, 39). Filters live in state, seeded from the
   server-parsed query, and are mirrored to the URL with history.replaceState
   (no useSearchParams, so no Suspense boundary). One price region (the budget chips show ₹ ranges, so it wraps the filters too), one footnote directly above the cards. */
type Props = { items: readonly BrowseItem[]; initialFilters: BrowseFilters };

export default function CatalogGrid({ items, initialFilters }: Props) {
  const [filters, setFilters] = useState<BrowseFilters>(initialFilters);

  const apply = (next: BrowseFilters) => {
    setFilters(next);
    const q = filtersToQuery(next);
    window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
  };

  const visible = filterItems(items, filters);

  return (
    <div data-price-region className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <ChipGroup
          label="Age"
          options={AGE_OPTIONS}
          selected={[filters.age]}
          onToggle={(v) => apply({ ...filters, age: v as BrowseFilters["age"] })}
        />
        <ChipGroup
          label="Category"
          options={CATEGORY_OPTIONS}
          selected={[filters.category]}
          onToggle={(v) => apply({ ...filters, category: v as BrowseFilters["category"] })}
        />
        <ChipGroup
          label="Metal"
          options={METAL_OPTIONS}
          selected={[filters.metal]}
          onToggle={(v) => apply({ ...filters, metal: v as BrowseFilters["metal"] })}
        />
        <ChipGroup
          label="Budget"
          options={BUDGET_OPTIONS}
          selected={[filters.budget]}
          onToggle={(v) => apply({ ...filters, budget: v as BrowseFilters["budget"] })}
        />
      </div>
      <p aria-live="polite" className="text-sm text-plum/80">
        Showing {visible.length} {visible.length === 1 ? "piece" : "pieces"}
      </p>
      <div className="flex flex-col gap-4">
        <PriceFootnote />
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p>No piece matches those filters.</p>
            <button
              type="button"
              onClick={() => apply({ ...ALL_FILTERS })}
              className="min-h-11 rounded-full border border-plum/30 px-6 py-2 text-base text-plum hover:bg-blush"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((i) => (
              <BrowseCard key={i.sku} item={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
