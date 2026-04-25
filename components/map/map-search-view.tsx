"use client";

import { useState, useEffect } from "react";
import { usePropertyStore } from "@/lib/store";
import { PropertyCard } from "@/components/property/property-card";
import { PropertyDetailPanel } from "@/components/property/property-detail-panel";
import { MapFilters } from "@/components/map/map-filters";
import { MapboxMap } from "@/components/map/mapbox-map";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, X } from "lucide-react";
import { filterProperties } from "@/lib/demo-properties";
import { cn } from "@/lib/utils";

interface MapSearchViewProps {
  listOnly?: boolean;
}

export function MapSearchView({ listOnly = false }: MapSearchViewProps) {
  const {
    properties,
    filteredIds,
    setFilteredIds,
    selectedPropertyId,
    selectProperty,
    filters,
    setFilters,
  } = usePropertyStore();

  const [showFilters, setShowFilters] = useState(false);

  const filteredProperties = properties.filter((p) =>
    filteredIds.includes(p.id)
  );
  const selectedProperty = properties.find(
    (p) => p.id === selectedPropertyId
  );

  useEffect(() => {
    const filtered = filterProperties(properties, {
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      minBeds: filters.minBeds,
      minBaths: filters.minBaths,
      propertyTypes: filters.propertyTypes,
      listingType: filters.listingType,
    });
    setFilteredIds(filtered.map((p) => p.id));
  }, [properties, filters, setFilteredIds]);

  const hasActiveFilters =
    filters.minPrice ||
    filters.maxPrice ||
    filters.minBeds ||
    (filters.propertyTypes && filters.propertyTypes.length > 0);

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Left sidebar: property list */}
      <div
        className={cn(
          "flex flex-col border-r border-border bg-card/30",
          listOnly ? "w-full" : "w-96 shrink-0"
        )}
      >
        {/* Toolbar */}
        <div className="p-3 border-b border-border flex items-center gap-2">
          <div className="flex-1">
            <span className="text-sm font-medium">
              {filteredProperties.length} properties
            </span>
            {hasActiveFilters && (
              <span className="ml-2 text-xs text-muted-foreground">
                · filtered
              </span>
            )}
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {hasActiveFilters && (
              <Badge className="w-4 h-4 p-0 flex items-center justify-center text-[10px] ml-0.5">
                !
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
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

        {/* Filters panel */}
        {showFilters && (
          <div className="border-b border-border">
            <MapFilters
              filters={filters}
              onChange={setFilters}
              onClose={() => setShowFilters(false)}
            />
          </div>
        )}

        {/* Property list */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {filteredProperties.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <p className="font-medium">No properties match your filters</p>
                <button
                  onClick={() => setFilters({})}
                  className="text-primary text-sm mt-2 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
            {filteredProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                isSelected={property.id === selectedPropertyId}
                onClick={() =>
                  selectProperty(
                    property.id === selectedPropertyId ? null : property.id
                  )
                }
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Map */}
      {!listOnly && (
        <div className="flex-1 relative">
          <MapboxMap
            properties={filteredProperties}
            selectedId={selectedPropertyId}
            onSelectProperty={selectProperty}
          />
        </div>
      )}

      {/* Property detail panel */}
      {selectedProperty && (
        <div
          className={cn(
            "w-96 shrink-0 border-l border-border bg-card/50 flex flex-col",
            listOnly && "absolute right-0 top-0 bottom-0 z-10 shadow-2xl"
          )}
        >
          <PropertyDetailPanel
            property={selectedProperty}
            onClose={() => selectProperty(null)}
          />
        </div>
      )}
    </div>
  );
}
