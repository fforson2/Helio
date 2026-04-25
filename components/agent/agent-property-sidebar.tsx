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
        "group overflow-hidden rounded-xl border cursor-pointer transition-all",
        isSelected
          ? "border-primary ring-1 ring-primary/40 bg-primary/5"
          : "border-white/[0.08] bg-white/[0.035] hover:border-primary/30 hover:bg-white/[0.05]"
      )}
    >
      <div className="relative aspect-[1.45/1] overflow-hidden">
        <Image
          src={property.photos[0] ?? "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800"}
          alt={property.location.address}
          fill
          sizes="320px"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />

        <div className="absolute left-2.5 top-2.5 rounded-md bg-black/65 px-2 py-1 text-[11px] font-semibold text-white">
          {formatPrice(property.price)}
          {property.listingType === "for_rent" ? "/mo" : ""}
        </div>

        <button
          onClick={handleBookmark}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-md border border-white/10 bg-black/55 flex items-center justify-center text-white/70 hover:border-white/30 transition-colors"
        >
          {saved ? (
            <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Bookmark className="w-3.5 h-3.5" />
          )}
        </button>

        {score !== undefined && (
          <div className={cn(
            "absolute bottom-2.5 right-2.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-bold",
            getDealScoreColor(score)
          )}>
            +{score}
          </div>
        )}
      </div>

      <div className="px-3 py-2.5 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold truncate text-white">{property.location.address}</h4>
          {yoyChange !== undefined && (
            <span className={cn(
              "text-[11px] font-medium shrink-0",
              yoyChange >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {formatPercent(yoyChange)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-white/45 truncate">
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
