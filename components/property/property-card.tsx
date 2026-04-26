"use client";

import { Property } from "@/types/property";
import { usePropertyStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatPrice,
  formatBeds,
  formatBaths,
  formatSqft,
  formatDaysOnMarket,
} from "@/lib/format";
import { getDealScoreColor, getDealScoreBg } from "@/lib/deal-score";
import { Bookmark, BookmarkCheck, GitCompare, Bed, Bath, Square } from "lucide-react";
import { CldImage } from "next-cloudinary";

interface PropertyCardProps {
  property: Property;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

export function PropertyCard({
  property,
  isSelected,
  onClick,
  compact,
}: PropertyCardProps) {
  const { saveProperty, unsaveProperty, isPropertySaved, addToComparison, comparisonIds } =
    usePropertyStore();
  const saved = isPropertySaved(property.id);
  const inComparison = comparisonIds.includes(property.id);
  const score = property.dealScore?.total;

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (saved) {
      unsaveProperty(property.id);
    } else {
      saveProperty(property.id);
    }
  }

  function handleCompare(e: React.MouseEvent) {
    e.stopPropagation();
    addToComparison(property.id);
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border transition-all cursor-pointer overflow-hidden",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card hover:border-primary/40 hover:bg-card/80"
      )}
    >
      {/* Image */}
      {!compact && property.photos[0] && (
        <div className="relative h-44 overflow-hidden">
          <CldImage
            src={property.photos[0]}
            alt={property.location.address}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="384px"
            deliveryType="fetch"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Score badge */}
          {score !== undefined && (
            <div
              className={cn(
                "absolute top-2 left-2 rounded-lg border px-2 py-1 text-xs font-bold backdrop-blur-sm",
                getDealScoreBg(score)
              )}
            >
              <span className={getDealScoreColor(score)}>{score}</span>
              <span className="text-muted-foreground ml-1">score</span>
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-2 right-2 flex gap-1">
            {property.daysOnMarket <= 7 && (
              <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5">
                New
              </Badge>
            )}
            {property.priceHistory.length > 1 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                Price ↓
              </Badge>
            )}
          </div>

          {/* Price overlay */}
          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
            <div>
              <div className="text-white font-bold text-lg leading-none">
                {formatPrice(property.price)}
              </div>
              <div className="text-white/70 text-xs mt-0.5">
                {property.location.neighborhood}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        {compact && (
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-semibold text-sm">
                {formatPrice(property.price)}
              </div>
              <div className="text-xs text-muted-foreground">
                {property.location.neighborhood}
              </div>
            </div>
            {score !== undefined && (
              <span className={cn("text-sm font-bold", getDealScoreColor(score))}>
                {score}
              </span>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground mb-2 truncate">
          {property.location.address}, {property.location.city}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Bed className="w-3 h-3" />
            {formatBeds(property.details.beds)}
          </span>
          <span className="flex items-center gap-1">
            <Bath className="w-3 h-3" />
            {formatBaths(property.details.baths)}
          </span>
          <span className="flex items-center gap-1">
            <Square className="w-3 h-3" />
            {formatSqft(property.details.sqft)}
          </span>
          <span className="ml-auto">
            {formatDaysOnMarket(property.daysOnMarket)}
          </span>
        </div>

        {/* Deal score label */}
        {property.dealScore && !compact && (
          <div className="mt-2 pt-2 border-t border-border">
            <span
              className={cn(
                "text-xs font-medium",
                getDealScoreColor(property.dealScore.total)
              )}
            >
              {property.dealScore.label}
            </span>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {property.dealScore.summary}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 gap-1.5 h-7 text-xs"
            onClick={handleSave}
          >
            {saved ? (
              <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
            {saved ? "Saved" : "Save"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-1 gap-1.5 h-7 text-xs",
              inComparison && "text-primary"
            )}
            onClick={handleCompare}
            disabled={!inComparison && comparisonIds.length >= 3}
          >
            <GitCompare className="w-3.5 h-3.5" />
            Compare
          </Button>
        </div>
      </div>
    </div>
  );
}
