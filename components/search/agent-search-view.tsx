"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Bookmark, BookmarkCheck, ExternalLink, ImageIcon, Loader2, Search, MoreHorizontal } from "lucide-react";
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

type AgentSearchResult = {
  status: "searching" | "done" | "error";
  summary?: string;
  searchUrl?: string;
  listings?: AgentListing[];
  error?: string;
};

type AgentListing = {
  address: string;
  price: string;
  beds?: number;
  baths?: number;
  sqft?: string;
  url: string;
  description?: string;
};

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
  const [agentResults, setAgentResults] = useState<Record<string, AgentSearchResult>>({});

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

  const hasAgentResults = Object.keys(agentResults).length > 0;

  async function runAgentSearch(agentId: Agent["id"]) {
    const trimmed = location.trim();
    if (!trimmed) return;

    setAgentResults((prev) => ({
      ...prev,
      [agentId]: { status: "searching" },
    }));

    try {
      const res = await fetch("/api/agents/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: trimmed, agent: agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");

      setAgentResults((prev) => ({
        ...prev,
        [agentId]: {
          status: "done",
          summary: data.summary,
          searchUrl: data.searchUrl,
          listings: data.listings,
        },
      }));
    } catch (err) {
      setAgentResults((prev) => ({
        ...prev,
        [agentId]: {
          status: "error",
          error: err instanceof Error ? err.message : "Search failed",
        },
      }));
    }
  }

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
        <main
          className="flex-1 relative flex flex-col overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(rgba(56, 132, 255, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 132, 255, 0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        >
          <div className="flex-1 overflow-auto">
            <div
              className={cn(
                "p-8",
                !hasAgentResults && "flex flex-col items-center pt-16"
              )}
            >
              <div className="max-w-lg mx-auto text-center space-y-8">
                <div className="flex items-center justify-center gap-3">
                  {AGENTS.map((agent) => {
                    const searching = agentResults[agent.id]?.status === "searching";
                    const done = agentResults[agent.id]?.status === "done";
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => runAgentSearch(agent.id)}
                        disabled={!location.trim() || searching}
                        className={cn(
                          "px-4 py-1.5 rounded-md text-xs font-semibold border transition-all ring-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                          agent.bgClass,
                          agent.textClass,
                          agent.ringClass,
                          searching || done
                            ? "border-current scale-105"
                            : "border-transparent hover:scale-105",
                          searching && "animate-pulse"
                        )}
                      >
                        {searching && (
                          <Loader2 className="w-3 h-3 animate-spin inline mr-1.5" />
                        )}
                        {agent.label}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold tracking-tight">3 Agents, One Search</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Enter a location below and click an agent to search Zillow, Redfin, or
                    Realtor.com for listings.
                  </p>
                </div>
                <div className="flex items-center gap-2 max-w-md mx-auto">
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        for (const agent of AGENTS) runAgentSearch(agent.id);
                      }
                    }}
                    placeholder="Enter an address or city (e.g. Irvine, CA)"
                    className="h-10 flex-1"
                  />
                </div>
                {searchError && (
                  <p className="text-xs text-rose-400">{searchError}</p>
                )}
              </div>
            </div>

            {hasAgentResults && (
              <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                {AGENTS.map((agent) => {
                  const result = agentResults[agent.id];
                  if (!result) return null;
                  return (
                    <div
                      key={agent.id}
                      className={cn(
                        "rounded-xl border p-4 space-y-3 ring-1",
                        agent.bgClass,
                        agent.ringClass
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("text-sm font-semibold", agent.textClass)}>
                          {agent.label}
                        </span>
                        {result.status === "searching" && (
                          <Loader2 className={cn("w-4 h-4 animate-spin", agent.textClass)} />
                        )}
                        {result.status === "done" && (
                          <span className="text-[10px] uppercase tracking-wider text-emerald-400">
                            Done
                          </span>
                        )}
                      </div>

                      {result.status === "searching" && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground animate-pulse">
                            Searching {agent.label}...
                          </p>
                          <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full animate-pulse",
                                agent.id === "zillow"
                                  ? "bg-sky-500/50"
                                  : agent.id === "redfin"
                                    ? "bg-rose-500/50"
                                    : "bg-orange-500/50"
                              )}
                              style={{ width: "60%" }}
                            />
                          </div>
                        </div>
                      )}

                      {result.status === "done" && (
                        <>
                          {result.summary && (
                            <p className="text-xs text-muted-foreground">{result.summary}</p>
                          )}
                          <div className="space-y-1.5">
                            {result.listings?.slice(0, 5).map((listing, i) => (
                              <a
                                key={i}
                                href={listing.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-2.5 rounded-lg bg-background/60 hover:bg-background/80 border border-border/50 transition-colors group"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-xs font-medium truncate flex-1">
                                    {listing.address}
                                  </div>
                                  <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  {listing.price}
                                  {listing.beds != null && ` · ${listing.beds}bd`}
                                  {listing.baths != null && ` · ${listing.baths}ba`}
                                  {listing.sqft && ` · ${listing.sqft} sqft`}
                                </div>
                                {listing.description && (
                                  <div className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-1">
                                    {listing.description}
                                  </div>
                                )}
                              </a>
                            ))}
                          </div>
                          {result.searchUrl && (
                            <a
                              href={result.searchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center justify-center gap-1.5 text-xs py-2 rounded-md border border-current/20 transition-colors hover:bg-background/40",
                                agent.textClass
                              )}
                            >
                              View all on {agent.label}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </>
                      )}

                      {result.status === "error" && (
                        <p className="text-xs text-rose-400">{result.error}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <StatusBar feedCount={32} metroCount={Math.max(metroCount, 1)} />
    </div>
  );
}
