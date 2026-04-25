import { ListingsSearchResponse, SearchFilters, SearchIntent } from "@/types/search";
import { BuyerPreferences } from "@/types/user";

function ensureOk(res: Response) {
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res;
}

export async function inferSearchIntent(query: string, userPreferences?: Partial<BuyerPreferences>) {
  const res = await fetch("/api/search/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, userPreferences }),
  }).then(ensureOk);

  return (await res.json()) as SearchIntent;
}

export async function searchListings(input: {
  query?: string;
  summary?: string;
  filters: SearchFilters;
}) {
  const res = await fetch("/api/listings/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then(ensureOk);

  return (await res.json()) as ListingsSearchResponse;
}

export function preferencesToFilters(preferences?: Partial<BuyerPreferences>): SearchFilters {
  if (!preferences) return {};
  return {
    listingType: preferences.listingType,
    minPrice: preferences.minPrice,
    maxPrice: preferences.maxPrice,
    minBeds: preferences.minBeds,
    minBaths: preferences.minBaths,
    minSqft: preferences.minSqft,
    maxSqft: preferences.maxSqft,
    propertyTypes: preferences.propertyTypes,
    targetNeighborhoods: preferences.targetNeighborhoods,
    mustHaves: preferences.mustHaves,
  };
}
