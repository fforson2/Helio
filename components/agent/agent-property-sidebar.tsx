"use client";

import { useState } from "react";
import { usePropertyStore } from "@/lib/store";
import { Property } from "@/types/property";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatPrice, formatSqft, formatPercent } from "@/lib/format";
import { getDealScoreColor } from "@/lib/deal-score";
import { Bookmark, BookmarkCheck } from "lucide-react";
import Image from "next/image";

type SidebarTab = "properties" | "watchlist";

interface CompactPropertyCardProps {
  property: Property;
  isSelected: boolean;
  onSelect: () => void;
}

function CompactPropertyCard({ property, isSelected, onSelect }: CompactPropertyCardProps) {
  const { saveProperty, unsaveProperty, isPropertySaved } = usePropertyStore();
  const saved = isPropertySaved(property.id);
  const score = property.dealScore?.total;
  const yoyChange = property.neighborhoodStats.priceChangeYoY;

  function handleBookmark(e: React.MouseEvent) {
    e.stopPropagation();
    saved ? unsaveProperty(property.id) : saveProperty(property.id);
  }

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative rounded-lg border cursor-pointer overflow-hidden transition-all",
        isSelected
          ? "border-primary ring-1 ring-primary/40 bg-primary/5"
          : "border-border/50 bg-card/60 hover:border-primary/30 hover:bg-card/80"
      )}
    >
      <div className="relative h-28 overflow-hidden">
        <div className="flex h-full">
          {property.photos.slice(0, 2).map((photo, i) => (
            <div key={i} className={cn("relative h-full flex-1", i === 0 && "border-r border-background/30")}>
              <Image
                src={photo}
                alt={property.location.address}
                fill
                className="object-cover"
                sizes="160px"
              />
            </div>
          ))}
          {property.photos.length < 2 && (
            <div className="relative h-full flex-1 bg-muted" />
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {score !== undefined && (
          <div className={cn(
            "absolute top-2 left-2 w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-bold backdrop-blur-sm bg-black/40",
            score >= 70 ? "border-emerald-500/60" : score >= 55 ? "border-amber-500/60" : "border-red-500/60"
          )}>
            <span className={getDealScoreColor(score)}>{score}</span>
          </div>
        )}

        <button
          onClick={handleBookmark}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm bg-black/40 border border-white/10 hover:border-white/30 transition-colors"
        >
          {saved ? (
            <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Bookmark className="w-3.5 h-3.5 text-white/70" />
          )}
        </button>

        <div className="absolute bottom-2 left-2">
          <span className="text-white font-bold text-sm drop-shadow-lg">
            {formatPrice(property.price)}
            {property.listingType === "for_rent" && (
              <span className="text-white/70 font-normal text-xs">/mo</span>
            )}
          </span>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold truncate">{property.location.address}</h4>
          {yoyChange !== undefined && (
            <span className={cn(
              "text-[11px] font-medium shrink-0",
              yoyChange >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {formatPercent(yoyChange)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {property.location.city}, {property.location.state} {property.location.zip} · {formatSqft(property.details.sqft)} · {property.details.propertyType.replace(/_/g, " ")}
        </p>
      </div>
    </div>
  );
}

export function AgentPropertySidebar({
  onSelectProperty,
  selectedPropertyId,
}: {
  onSelectProperty: (id: string | null) => void;
  selectedPropertyId: string | null;
}) {
  const { properties, savedProperties, propertyMap } = usePropertyStore();
  const [activeTab, setActiveTab] = useState<SidebarTab>("properties");

  const savedProps = savedProperties
    .map((s) => propertyMap[s.propertyId])
    .filter((p): p is Property => Boolean(p));

  const featured = properties.slice(0, 3);
  const remaining = properties.slice(3);

  const displayList = activeTab === "watchlist" ? savedProps : properties;

  return (
    <div className="w-72 shrink-0 border-r border-border bg-card/30 flex flex-col">
      <div className="p-3 border-b border-border">
        <div className="flex rounded-lg bg-muted/50 p-0.5">
          {(["properties", "watchlist"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 text-xs font-medium py-1.5 px-3 rounded-md capitalize transition-all",
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {activeTab === "properties" ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Listings
                </span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center">
                  {properties.length}
                </span>
              </div>

              {featured.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                    Featured Spaces ({featured.length})
                  </span>
                  <div className="space-y-2.5">
                    {featured.map((p) => (
                      <CompactPropertyCard
                        key={p.id}
                        property={p}
                        isSelected={p.id === selectedPropertyId}
                        onSelect={() => onSelectProperty(p.id === selectedPropertyId ? null : p.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {remaining.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                    Portfolio Sample
                  </span>
                  <div className="space-y-2.5">
                    {remaining.map((p) => (
                      <CompactPropertyCard
                        key={p.id}
                        property={p}
                        isSelected={p.id === selectedPropertyId}
                        onSelect={() => onSelectProperty(p.id === selectedPropertyId ? null : p.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Watchlist
                </span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center">
                  {savedProps.length}
                </span>
              </div>

              {savedProps.length === 0 ? (
                <div className="py-10 text-center">
                  <Bookmark className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No saved properties yet</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Bookmark properties to add them here</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {savedProps.map((p) => (
                    <CompactPropertyCard
                      key={p.id}
                      property={p}
                      isSelected={p.id === selectedPropertyId}
                      onSelect={() => onSelectProperty(p.id === selectedPropertyId ? null : p.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
