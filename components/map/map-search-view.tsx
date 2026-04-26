"use client";

import { useEffect, useMemo, useState } from "react";
import { usePropertyStore, useUserStore } from "@/lib/store";
import { PropertyCard } from "@/components/property/property-card";
import { PropertyDetailPanel } from "@/components/property/property-detail-panel";
import { MapFilters } from "@/components/map/map-filters";
import { MapboxMap } from "@/components/map/mapbox-map";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { inferSearchIntent, searchListings } from "@/lib/search-client";
import { Loader2, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";

interface MapSearchViewProps {
  listOnly?: boolean;
}

const MAX_MAP_MARKERS = 50;

function hasActiveFilters(filters: ReturnType<typeof usePropertyStore.getState>["filters"]) {
  return Boolean(
    filters.minPrice ||
      filters.maxPrice ||
      filters.minBeds ||
      filters.minBaths ||
      (filters.propertyTypes && filters.propertyTypes.length > 0) ||
      (filters.targetNeighborhoods && filters.targetNeighborhoods.length > 0) ||
      (filters.mustHaves && filters.mustHaves.length > 0)
  );
}

export function MapSearchView({ listOnly = false }: MapSearchViewProps) {
  const { profile } = useUserStore();
  const {
    properties,
    propertyMap,
    selectedPropertyId,
    selectProperty,
    filters,
    setFilters,
    setSearchResults,
    searchQuery,
    searchSummary,
    setSearchQuery,
    isSearching,
    setSearching,
    searchError,
    setSearchError,
  } = usePropertyStore();

  const [showFilters, setShowFilters] = useState(false);
  const [prompt, setPrompt] = useState(searchQuery);

  const selectedProperty = selectedPropertyId ? propertyMap[selectedPropertyId] ?? null : null;
  const activeFilters = hasActiveFilters(filters);
  const mapProperties = useMemo(() => properties.slice(0, MAX_MAP_MARKERS), [properties]);

  useEffect(() => {
    setPrompt(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!searchQuery && properties.length === 0) return;

    const controller = new AbortController();
    setSearching(true);
    searchListings({
      query: searchQuery || searchSummary,
      summary: searchSummary || "Filtered homes",
      filters,
    })
      .then((response) => {
        if (controller.signal.aborted) return;
        setSearchResults({
          properties: response.properties,
          session: response.session,
          query: searchQuery || response.session.query,
          filters,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSearchError("Could not refresh listings for the selected filters.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });

    return () => {
      controller.abort();
    };
  }, [filters, properties.length, searchQuery, searchSummary, setSearchError, setSearchResults, setSearching]);

  async function runPromptSearch() {
    const query = prompt.trim();
    if (!query || isSearching) return;

    setSearching(true);
    setSearchError(null);
    try {
      const intent = await inferSearchIntent(query, profile?.preferences);
      const response = await searchListings({
        query,
        summary: intent.summary,
        filters: intent.filters,
      });

      setFilters(intent.filters);
      setSearchQuery(query);
      setSearchResults({
        properties: response.properties,
        session: response.session,
        query,
        filters: intent.filters,
        summary: intent.summary,
      });
    } catch {
      setSearchError("Could not run that search right now.");
    } finally {
      setSearching(false);
    }
  }

  const emptyMessage = useMemo(() => {
    if (isSearching) return "Searching homes...";
    if (searchError) return searchError;
    return "No properties match your current search.";
  }, [isSearching, searchError]);

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          "flex min-h-0 flex-col border-r border-border bg-card/30",
          listOnly ? "w-full" : "w-96 shrink-0"
        )}
      >
        <div className="space-y-3 border-b border-border p-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
              <span className="text-sm font-medium">{properties.length} properties</span>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {searchSummary || "Showing a small California starter set. Search a city, zip code, or home type to load more."}
              </div>
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilters && (
                <Badge className="w-4 h-4 p-0 flex items-center justify-center text-[10px] ml-0.5">
                  !
                </Badge>
              )}
            </Button>
            {activeFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({})}
                className="w-8 h-8 p-0"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runPromptSearch();
                }
              }}
              placeholder="Search California by city, zip code, neighborhood, or home type..."
              className="h-9"
            />
            <Button onClick={runPromptSearch} disabled={isSearching || !prompt.trim()} className="gap-2">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Search
            </Button>
          </div>

          {searchQuery && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Search className="w-3 h-3" />
              <span className="truncate">{searchQuery}</span>
            </div>
          )}
        </div>

        {showFilters && (
          <div className="border-b border-border">
            <MapFilters filters={filters} onChange={setFilters} onClose={() => setShowFilters(false)} />
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {properties.length === 0 && (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                {isSearching ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : null}
                <p className="font-medium">{emptyMessage}</p>
                {!isSearching && (
                  <button
                    onClick={() => setFilters({})}
                    className="text-primary text-sm mt-2 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                isSelected={property.id === selectedPropertyId}
                onClick={() => selectProperty(property.id === selectedPropertyId ? null : property.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {!listOnly && (
        <div className="relative min-h-0 flex-1">
          <MapboxMap
            properties={mapProperties}
            selectedId={selectedPropertyId}
            onSelectProperty={selectProperty}
          />
          {properties.length > mapProperties.length && (
            <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
              Map showing top {mapProperties.length} listings for performance
            </div>
          )}
        </div>
      )}

      {selectedProperty && (
        <div
          className={cn(
            "flex min-h-0 w-96 shrink-0 flex-col border-l border-border bg-card/50",
            listOnly && "absolute right-0 top-0 bottom-0 z-10 shadow-2xl"
          )}
        >
          <PropertyDetailPanel property={selectedProperty} onClose={() => selectProperty(null)} />
        </div>
      )}
    </div>
  );
}
