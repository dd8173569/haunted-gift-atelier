"use client";

import { useRef, useState } from "react";
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
import ActionButton from "./ActionButton";
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

  const filtersRef = useRef<HTMLDivElement>(null);

  // "Clear filters" unmounts when the grid refills, so focus moves to the first chip (REQ-PD-23).
  // The chip is always mounted, so focusing it in the handler works.
  const clearFilters = () => {
    apply({ ...ALL_FILTERS });
    filtersRef.current?.querySelector<HTMLElement>("button")?.focus();
  };

  const visible = filterItems(items, filters);

  return (
    <div data-price-region className="flex flex-col gap-6">
      <div ref={filtersRef} className="flex flex-col gap-4">
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
      <div aria-live="polite" className="flex flex-col gap-2">
        <p className="text-sm text-plum/80">
          Showing {visible.length} {visible.length === 1 ? "piece" : "pieces"}
        </p>
        {visible.length === 0 && <p>No piece matches those filters.</p>}
      </div>
      <div className="flex flex-col gap-4">
        <PriceFootnote />
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <ActionButton variant="secondary" onClick={clearFilters}>
              Clear filters
            </ActionButton>
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
