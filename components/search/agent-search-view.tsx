"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Bookmark, BookmarkCheck, ImageIcon, Loader2, Search, MoreHorizontal } from "lucide-react";
import { usePropertyStore, useUserStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Property } from "@/types/property";
import { formatPrice, formatSqft } from "@/lib/format";
import { inferSearchIntent, searchListings } from "@/lib/search-client";

type SidebarTab = "properties" | "watchlist";

type Agent = {
  id: "zillow" | "redfin" | "realtor";
  label: string;
  ringClass: string;
  textClass: string;
  bgClass: string;
};

const AGENTS: Agent[] = [
  {
    id: "zillow",
    label: "Zillow",
    ringClass: "ring-sky-500/40",
    textClass: "text-sky-400",
    bgClass: "bg-sky-500/10",
  },
  {
    id: "redfin",
    label: "Redfin",
    ringClass: "ring-rose-500/40",
    textClass: "text-rose-400",
    bgClass: "bg-rose-500/10",
  },
  {
    id: "realtor",
    label: "Realtor",
    ringClass: "ring-orange-500/40",
    textClass: "text-orange-400",
    bgClass: "bg-orange-500/10",
  },
];

const LISTING_TYPE_OPTIONS = [
  { value: "homes-for-sale", label: "homes for sale" },
  { value: "homes-for-rent", label: "homes for rent" },
  { value: "new-construction", label: "new construction" },
  { value: "open-houses", label: "open houses" },
] as const;

function priceLabel(property: Property): string {
  if (property.listingType === "for_rent") {
    return `${formatPrice(property.price)}/mo`;
  }
  return formatPrice(property.price);
}

function propertyTypeLabel(type: Property["details"]["propertyType"]): string {
  switch (type) {
    case "single_family":
      return "Single family";
    case "condo":
      return "Condo";
    case "townhouse":
      return "Townhouse";
    case "multi_family":
      return "Multi family";
    case "land":
      return "Land";
    default:
      return type;
  }
}

function ListingCard({
  property,
  onClick,
  isSelected,
}: {
  property: Property;
  onClick: () => void;
  isSelected: boolean;
}) {
  const { saveProperty, unsaveProperty, isPropertySaved } = usePropertyStore();
  const saved = isPropertySaved(property.id);
  const score = property.dealScore?.total;

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (saved) unsaveProperty(property.id);
    else saveProperty(property.id);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group w-full text-left rounded-xl overflow-hidden border bg-card/60 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        isSelected
          ? "border-primary ring-1 ring-primary/40"
          : "border-border hover:border-primary/40"
      )}
    >
      <div className="relative h-32 w-full overflow-hidden bg-secondary">
        {property.photos[0] && (
          <Image
            src={property.photos[0]}
            alt={property.location.address}
            fill
            sizes="320px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Open menu"
          className="absolute top-2 left-2 w-7 h-7 rounded-md bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleSave}
          aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}
          className="absolute top-2 right-2 w-7 h-7 rounded-md bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white"
        >
          {saved ? <BookmarkCheck className="w-3.5 h-3.5 text-primary" /> : <Bookmark className="w-3.5 h-3.5" />}
        </button>

        <div className="absolute bottom-2 left-2 text-white text-base font-bold leading-none drop-shadow-sm">
          {priceLabel(property)}
        </div>
      </div>

      <div className="p-2.5 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold truncate">{property.location.address}</div>
          {score !== undefined && (
            <span
              className={cn(
                "text-[11px] font-semibold tabular-nums",
                score >= 80
                  ? "text-emerald-400"
                  : score >= 65
                    ? "text-sky-400"
                    : "text-muted-foreground"
              )}
            >
              +{score}
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
          {property.location.city}, {property.location.state} {property.location.zip} · {formatSqft(property.details.sqft)} · {propertyTypeLabel(property.details.propertyType)}
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  activeTab,
  onTabChange,
  featured,
  rest,
  watchlist,
  selectedPropertyId,
  onSelectProperty,
}: {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  featured: Property[];
  rest: Property[];
  watchlist: Property[];
  selectedPropertyId: string | null;
  onSelectProperty: (id: string | null) => void;
}) {
  const totalListings = featured.length + rest.length;
  const list = activeTab === "properties" ? rest : watchlist;

  return (
    <aside className="w-[320px] shrink-0 border-r border-border bg-card/40 flex flex-col">
      <div className="p-2 border-b border-border grid grid-cols-2 gap-1">
        {(["properties", "watchlist"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              "h-8 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors",
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {tab === "properties" ? "Properties" : "Watchlist"}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>{activeTab === "properties" ? "Listings" : "Watchlist"}</span>
            <span className="tabular-nums text-foreground/80">
              {activeTab === "properties" ? totalListings : watchlist.length}
            </span>
          </div>

          {activeTab === "properties" && featured.length > 0 && (
            <section className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                Featured listings ({featured.length})
              </div>
              <div className="space-y-2">
                {featured.map((property) => (
                  <ListingCard
                    key={property.id}
                    property={property}
                    isSelected={property.id === selectedPropertyId}
                    onClick={() =>
                      onSelectProperty(property.id === selectedPropertyId ? null : property.id)
                    }
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
              {activeTab === "properties" ? "Portfolio sample" : "Saved properties"}
            </div>

            {list.length === 0 && (
              <div className="text-xs text-muted-foreground py-6 text-center">
                {activeTab === "properties"
                  ? "Run a search to populate listings."
                  : "No saved properties yet. Tap the bookmark on any card to add it."}
              </div>
            )}

            <div className="space-y-2">
              {list.map((property) => (
                <ListingCard
                  key={property.id}
                  property={property}
                  isSelected={property.id === selectedPropertyId}
                  onClick={() =>
                    onSelectProperty(property.id === selectedPropertyId ? null : property.id)
                  }
                />
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}

function StatusBar({
  feedCount,
  metroCount,
}: {
  feedCount: number;
  metroCount: number;
}) {
  const [now, setNow] = useState<string>(() =>
    new Date().toLocaleTimeString("en-US", { hour12: true })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date().toLocaleTimeString("en-US", { hour12: true }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-7 border-t border-border bg-card/40 px-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Operational
        </span>
        <span>United States</span>
        <span>{metroCount} metros</span>
        <span>{feedCount} feeds</span>
      </div>
      <span className="tabular-nums text-foreground/80">{now}</span>
    </div>
  );
}

export function AgentSearchView() {
  const { profile } = useUserStore();
  const {
    properties,
    propertyMap,
    savedProperties,
    selectedPropertyId,
    selectProperty,
    setSearchResults,
    setFilters,
    setSearchQuery,
    setSearching,
    isSearching,
    setSearchError,
    searchError,
  } = usePropertyStore();

  const [activeTab, setActiveTab] = useState<SidebarTab>("properties");
  const [location, setLocation] = useState("");
  const [listingType, setListingType] = useState<(typeof LISTING_TYPE_OPTIONS)[number]["value"]>(
    "homes-for-sale"
  );
  const [activeAgent, setActiveAgent] = useState<Agent["id"] | null>(null);

  const featured = useMemo(() => {
    return [...properties]
      .sort((a, b) => (b.dealScore?.total ?? 0) - (a.dealScore?.total ?? 0))
      .slice(0, 3);
  }, [properties]);

  const rest = useMemo(() => {
    const featuredIds = new Set(featured.map((property) => property.id));
    return properties.filter((property) => !featuredIds.has(property.id));
  }, [properties, featured]);

  const watchlist = useMemo(
    () =>
      savedProperties
        .map((saved) => propertyMap[saved.propertyId])
        .filter((property): property is Property => Boolean(property)),
    [savedProperties, propertyMap]
  );

  const metroCount = useMemo(() => {
    const cities = new Set(properties.map((property) => property.location.city));
    return cities.size;
  }, [properties]);

  async function runSearch() {
    const trimmed = location.trim();
    if (!trimmed || isSearching) return;

    const typeLabel =
      LISTING_TYPE_OPTIONS.find((option) => option.value === listingType)?.label ??
      "homes for sale";
    const query = `${typeLabel} in ${trimmed}`;

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          featured={featured}
          rest={rest}
          watchlist={watchlist}
          selectedPropertyId={selectedPropertyId}
          onSelectProperty={selectProperty}
        />

        <main
          className="flex-1 relative flex flex-col overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(rgba(56, 132, 255, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 132, 255, 0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        >
          <div className="px-4 pt-4 pb-3 border-b border-border bg-background/60 backdrop-blur-sm space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearch();
                  }
                }}
                placeholder="Location (e.g. Irvine, CA)"
                className="h-9 flex-1"
              />
              <select
                value={listingType}
                onChange={(e) =>
                  setListingType(e.target.value as (typeof LISTING_TYPE_OPTIONS)[number]["value"])
                }
                className="h-9 w-44 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {LISTING_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                onClick={runSearch}
                disabled={isSearching || !location.trim()}
                className="h-9 gap-2"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </Button>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="uppercase tracking-wider">Try:</span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-card/60 text-foreground hover:border-primary/40 transition-colors"
              >
                <ImageIcon className="w-3 h-3" />
                Use image
              </button>
              {searchError && <span className="text-rose-400">{searchError}</span>}
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-6 max-w-md">
              <div className="flex items-center justify-center gap-3">
                {AGENTS.map((agent) => {
                  const active = activeAgent === agent.id || isSearching;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onMouseEnter={() => setActiveAgent(agent.id)}
                      onMouseLeave={() => setActiveAgent(null)}
                      className={cn(
                        "px-4 py-1.5 rounded-md text-xs font-semibold border transition-all ring-1",
                        agent.bgClass,
                        agent.textClass,
                        agent.ringClass,
                        active ? "border-current scale-105" : "border-transparent",
                        isSearching && "animate-pulse"
                      )}
                    >
                      {agent.label}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">3 Agents, One Search</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enter a location above to launch parallel agents searching Zillow, Redfin, and
                  Realtor.com simultaneously.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>

      <StatusBar feedCount={32} metroCount={Math.max(metroCount, 1)} />
    </div>
  );
}
