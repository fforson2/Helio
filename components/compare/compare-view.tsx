"use client";

import { resolvePropertiesById, usePropertyStore, useUIStore } from "@/lib/store";
import { Property } from "@/types/property";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  formatFullPrice,
  formatPrice,
  formatBeds,
  formatBaths,
  formatSqft,
  formatDaysOnMarket,
  getRiskLabel,
  getRiskColor,
} from "@/lib/format";
import { getDealScoreColor, getDealScoreBg } from "@/lib/deal-score";
import { X, Plus, Map, TrendingUp } from "lucide-react";
import { CldImage } from "next-cloudinary";

export function CompareView() {
  const { properties, propertyMap, comparisonIds, removeFromComparison } = usePropertyStore();
  const { setActiveTab } = useUIStore();

  const compared = resolvePropertiesById(comparisonIds, propertyMap, properties);

  if (compared.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">No properties to compare</h2>
          <p className="text-muted-foreground max-w-sm">
            Browse properties on the map and click Compare to add up to 3 side by side.
          </p>
        </div>
        <Button onClick={() => setActiveTab("map")} variant="outline" className="gap-2">
          <Map className="w-4 h-4" /> Browse map
        </Button>
      </div>
    );
  }

  const ROWS: { label: string; render: (p: Property) => React.ReactNode }[] = [
    {
      label: "Price",
      render: (p) => (
        <span className="font-bold text-base">{formatFullPrice(p.price)}</span>
      ),
    },
    {
      label: "Deal Score",
      render: (p) =>
        p.dealScore ? (
          <div className="flex items-center gap-2">
            <span className={cn("text-2xl font-black", getDealScoreColor(p.dealScore.total))}>
              {p.dealScore.total}
            </span>
            <Badge
              className={cn(
                "text-xs border",
                getDealScoreBg(p.dealScore.total),
                getDealScoreColor(p.dealScore.total)
              )}
              variant="outline"
            >
              {p.dealScore.label}
            </Badge>
          </div>
        ) : (
          "—"
        ),
    },
    {
      label: "Estimated Value",
      render: (p) =>
        p.estimatedValue ? (
          <span
            className={
              p.estimatedValue > p.price ? "text-emerald-400 font-medium" : "text-red-400 font-medium"
            }
          >
            {formatFullPrice(p.estimatedValue)}
          </span>
        ) : (
          "—"
        ),
    },
    { label: "Beds / Baths", render: (p) => `${formatBeds(p.details.beds)} · ${formatBaths(p.details.baths)}` },
    { label: "Square Footage", render: (p) => formatSqft(p.details.sqft) },
    { label: "Price / Sqft", render: (p) => p.pricePerSqft ? `$${Math.round(p.pricePerSqft)}/sqft` : `$${Math.round(p.price / p.details.sqft)}/sqft` },
    { label: "Year Built", render: (p) => String(p.details.yearBuilt) },
    { label: "Days on Market", render: (p) => formatDaysOnMarket(p.daysOnMarket) },
    { label: "Property Type", render: (p) => p.details.propertyType.replace("_", " ") },
    { label: "HOA Fee", render: (p) => p.hoaFee ? `${formatPrice(p.hoaFee)}/mo` : "None" },
    {
      label: "Walk Score",
      render: (p) =>
        p.walkScore !== undefined ? (
          <div className="flex items-center gap-2">
            <Progress value={p.walkScore} className="w-16 h-1.5" />
            <span>{p.walkScore}</span>
          </div>
        ) : (
          "—"
        ),
    },
    {
      label: "School Rating",
      render: (p) =>
        p.schoolRating !== undefined ? (
          <span className={p.schoolRating >= 8 ? "text-emerald-400 font-medium" : ""}>
            {p.schoolRating}/10
          </span>
        ) : (
          "—"
        ),
    },
    { label: "Fire Risk", render: (p) => <span className={getRiskColor(p.riskProfile.fireRisk)}>{getRiskLabel(p.riskProfile.fireRisk)}</span> },
    { label: "Flood Risk", render: (p) => <span className={getRiskColor(p.riskProfile.floodRisk)}>{getRiskLabel(p.riskProfile.floodRisk)}</span> },
    { label: "Est. Rental", render: (p) => p.rentalEstimate ? `${formatPrice(p.rentalEstimate)}/mo` : "—" },
    {
      label: "Market Trend",
      render: (p) => (
        <span className={p.neighborhoodStats.priceChangeYoY > 0 ? "text-emerald-400" : "text-red-400"}>
          {p.neighborhoodStats.priceChangeYoY > 0 ? "+" : ""}{p.neighborhoodStats.priceChangeYoY}% YoY
        </span>
      ),
    },
  ];

  const winner = compared.reduce((best, p) =>
    (p.dealScore?.total ?? 0) > (best.dealScore?.total ?? 0) ? p : best
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top: property headers */}
      <div className="border-b border-border">
        <div className="flex">
          {/* Row label column */}
          <div className="w-40 shrink-0 p-4 border-r border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Comparison
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              {compared.length} of 3 properties
            </p>
          </div>

          {/* Property columns */}
          {compared.map((property) => (
            <div
              key={property.id}
              className={cn(
                "flex-1 border-r border-border last:border-0 relative",
                property.id === winner.id && "bg-primary/5"
              )}
            >
              <div className="relative h-36 overflow-hidden">
                {property.photos[0] && (
                  <CldImage
                    src={property.photos[0]}
                    alt={property.location.address}
                    fill
                    className="object-cover"
                    sizes="300px"
                    deliveryType="fetch"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <button
                  onClick={() => removeFromComparison(property.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                {property.id === winner.id && (
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-primary text-primary-foreground text-[10px]">
                      Best match
                    </Badge>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="text-white font-bold">{formatFullPrice(property.price)}</div>
                  <div className="text-white/70 text-xs truncate">{property.location.address}</div>
                </div>
              </div>
            </div>
          ))}

          {/* Add more */}
          {compared.length < 3 && (
            <div className="flex-1 flex items-center justify-center border-r border-border last:border-0 min-h-36">
              <button
                onClick={() => setActiveTab("map")}
                className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-xs">Add property</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table body */}
      <ScrollArea className="flex-1">
        <div>
          {ROWS.map(({ label, render }, i) => (
            <div
              key={label}
              className={cn(
                "flex border-b border-border",
                i % 2 === 0 ? "" : "bg-secondary/20"
              )}
            >
              {/* Label */}
              <div className="w-40 shrink-0 p-3 border-r border-border flex items-center">
                <span className="text-xs text-muted-foreground font-medium">{label}</span>
              </div>

              {/* Values */}
              {compared.map((property) => (
                <div
                  key={property.id}
                  className={cn(
                    "flex-1 p-3 border-r border-border last:border-0 flex items-center",
                    property.id === winner.id && "bg-primary/5"
                  )}
                >
                  <span className="text-sm">{render(property)}</span>
                </div>
              ))}
              {compared.length < 3 && <div className="flex-1 p-3" />}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
