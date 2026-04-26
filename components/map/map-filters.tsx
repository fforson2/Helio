"use client";

import { BuyerPreferences } from "@/types/user";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { X } from "lucide-react";

interface MapFiltersProps {
  filters: Partial<BuyerPreferences>;
  onChange: (filters: Partial<BuyerPreferences>) => void;
  onClose: () => void;
}

const PROPERTY_TYPES = [
  { value: "single_family", label: "House" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
];

export function MapFilters({ filters, onChange, onClose }: MapFiltersProps) {
  const priceMin = filters.minPrice ?? 0;
  const priceMax = filters.maxPrice ?? 5_000_000;
  const beds = filters.minBeds ?? 0;
  const baths = filters.minBaths ?? 0;
  const types = filters.propertyTypes ?? [];

  function toggleType(type: string) {
    const t = type as BuyerPreferences["propertyTypes"][number];
    const current = (filters.propertyTypes ?? []) as BuyerPreferences["propertyTypes"];
    if (current.includes(t)) {
      onChange({ ...filters, propertyTypes: current.filter((x) => x !== t) });
    } else {
      onChange({ ...filters, propertyTypes: [...current, t] });
    }
  }

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Filters</span>
        <button onClick={onClose}>
          <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      {/* Price */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Price range</Label>
          <span className="text-xs font-mono text-muted-foreground">
            {formatPrice(priceMin)} – {formatPrice(priceMax)}
          </span>
        </div>
        <Slider
          min={0}
          max={5_000_000}
          step={50_000}
          value={[priceMin, priceMax]}
          onValueChange={(v) => {
            const vals = Array.isArray(v) ? v : [v as number];
            onChange({ ...filters, minPrice: vals[0], maxPrice: vals[1] });
          }}
        />
      </div>

      {/* Beds */}
      <div className="space-y-2">
        <Label className="text-xs">Min. bedrooms</Label>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onChange({ ...filters, minBeds: n === 0 ? undefined : n })}
              className={cn(
                "flex-1 py-1.5 rounded text-xs font-medium border transition-all",
                beds === n
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-border hover:border-primary/50"
              )}
            >
              {n === 0 ? "Any" : `${n}+`}
            </button>
          ))}
        </div>
      </div>

      {/* Baths */}
      <div className="space-y-2">
        <Label className="text-xs">Min. bathrooms</Label>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => onChange({ ...filters, minBaths: n === 0 ? undefined : n })}
              className={cn(
                "flex-1 py-1.5 rounded text-xs font-medium border transition-all",
                baths === n
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-border hover:border-primary/50"
              )}
            >
              {n === 0 ? "Any" : `${n}+`}
            </button>
          ))}
        </div>
      </div>

      {/* Property types */}
      <div className="space-y-2">
        <Label className="text-xs">Property type</Label>
        <div className="flex flex-wrap gap-1.5">
          {PROPERTY_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => toggleType(value)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium border transition-all",
                types.includes(value as BuyerPreferences["propertyTypes"][number])
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border hover:border-primary/40"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onChange({})}
      >
        Clear all filters
      </Button>
    </div>
  );
}
