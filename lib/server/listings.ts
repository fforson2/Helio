import { DEMO_PROPERTIES } from "@/lib/demo-properties";
import { computeDealScore } from "@/lib/deal-score";
import { Property } from "@/types/property";
import {
  ListingsSearchResponse,
  NeighborhoodAmenity,
  PropertyContext,
  SearchFilters,
  SearchSession,
} from "@/types/search";
import { getDb } from "@/lib/server/db";

const DEFAULT_SEARCH_STATE = "CA";
const DEFAULT_SEARCH_SUMMARY = "Active homes for sale";
const RENTCAST_BASE_URL = "https://api.rentcast.io/v1";
const MAX_VISIBLE_LISTINGS = 30;
const MIN_VISIBLE_LISTINGS = 30;
const DEFAULT_RENTCAST_PAGE_SIZE = 30;
const TARGETED_RENTCAST_PAGE_SIZE = 40;
const DEFAULT_RENTCAST_PROPERTY_TYPES = ["Single Family", "Condo", "Townhouse", "Multi Family"];

type RentCastListing = {
  id: string;
  formattedAddress?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  county?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFootage?: number | null;
  lotSize?: number | null;
  yearBuilt?: number | null;
  hoa?: { fee?: number | null } | null;
  status?: string | null;
  price?: number | null;
  listingType?: string | null;
  listedDate?: string | null;
  removedDate?: string | null;
  createdDate?: string | null;
  lastSeenDate?: string | null;
  daysOnMarket?: number | null;
  mlsName?: string | null;
  mlsNumber?: string | null;
  history?: Record<
    string,
    {
      event?: string | null;
      price?: number | null;
      listedDate?: string | null;
      removedDate?: string | null;
      daysOnMarket?: number | null;
    }
  > | null;
};

type PropertyDraft = Omit<Property, "dealScore" | "neighborhoodStats">;

const neighborhoodAmenityCatalog: Record<string, NeighborhoodAmenity[]> = {
  Venice: [
    { name: "Abbot Kinney Blvd", category: "coffee", distanceMiles: 0.2 },
    { name: "Venice Canals", category: "park", distanceMiles: 0.5 },
    { name: "Whole Foods Market", category: "grocery", distanceMiles: 0.7 },
    { name: "Metro E Line", category: "transit", distanceMiles: 1.8 },
  ],
  "Beachwood Canyon": [
    { name: "Griffith Park Trailhead", category: "park", distanceMiles: 0.4 },
    { name: "Gelson's Market", category: "grocery", distanceMiles: 1.1 },
    { name: "Beachwood Cafe", category: "coffee", distanceMiles: 0.3 },
    { name: "Hollywood/Western Station", category: "transit", distanceMiles: 2.1 },
  ],
  "North of Montana": [
    { name: "Montana Ave shops", category: "coffee", distanceMiles: 0.3 },
    { name: "Palisades Park", category: "park", distanceMiles: 0.8 },
    { name: "Whole Foods Market", category: "grocery", distanceMiles: 0.9 },
    { name: "Downtown Santa Monica Station", category: "transit", distanceMiles: 1.9 },
  ],
};

function normalizeProperty(property: Property): Property {
  return {
    ...property,
    dealScore: property.dealScore ?? computeDealScore(property),
  };
}

function getRentCastApiKey() {
  const apiKey = process.env.RENTCAST_API_KEY?.trim();
  if (!apiKey || apiKey.includes("your_")) return null;
  return apiKey;
}

function getGoogleMapsApiKey() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.trim();
  if (!apiKey || apiKey.includes("your_")) return null;
  return apiKey;
}

function toIsoDate(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toNumber(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function mapPropertyType(propertyType?: string | null): Property["details"]["propertyType"] {
  const value = propertyType?.toLowerCase() ?? "";
  if (value.includes("condo")) return "condo";
  if (value.includes("town")) return "townhouse";
  if (value.includes("multi")) return "multi_family";
  if (value.includes("land")) return "land";
  return "single_family";
}

function toRentCastPropertyType(propertyType: Property["details"]["propertyType"]) {
  switch (propertyType) {
    case "condo":
      return "Condo";
    case "townhouse":
      return "Townhouse";
    case "multi_family":
      return "Multi Family";
    case "land":
      return "Land";
    default:
      return "Single Family";
  }
}

function mapListingStatus(status?: string | null): Property["status"] {
  const value = status?.toLowerCase() ?? "active";
  if (value.includes("pending")) return "pending";
  if (value.includes("sold")) return "sold";
  if (value.includes("inactive") || value.includes("removed") || value.includes("off")) {
    return "off_market";
  }
  return "active";
}

function mapPriceEvent(event?: string | null): Property["priceHistory"][number]["event"] {
  const value = event?.toLowerCase() ?? "";
  if (value.includes("price")) return "price_change";
  if (value.includes("removed")) return "delisted";
  if (value.includes("sold")) return "sold";
  return "listed";
}

function buildPriceHistory(listing: RentCastListing): Property["priceHistory"] {
  const entries = Object.entries(listing.history ?? {})
    .map(([date, value]) => ({
      date,
      price: toNumber(value.price, toNumber(listing.price, 0)),
      event: mapPriceEvent(value.event),
    }))
    .filter((entry) => entry.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (entries.length > 0) return entries;

  return [
    {
      date: toIsoDate(listing.listedDate),
      price: toNumber(listing.price, 0),
      event: "listed",
    },
  ];
}

function buildTags(listing: RentCastListing) {
  const tags = new Set<string>();
  const propertyType = mapPropertyType(listing.propertyType).replace(/_/g, " ");
  tags.add(propertyType);

  if (toNumber(listing.daysOnMarket, 999) <= 7) tags.add("new listing");
  if (toNumber(listing.daysOnMarket, 999) > 45) tags.add("motivated seller");
  if (toNumber(listing.hoa?.fee, 0) > 0) tags.add("hoa");
  if ((listing.listingType ?? "").toLowerCase().includes("new")) tags.add("new construction");
  if ((listing.listingType ?? "").toLowerCase().includes("foreclosure")) tags.add("foreclosure");
  if ((listing.listingType ?? "").toLowerCase().includes("short")) tags.add("short sale");

  return Array.from(tags);
}

function buildDescription(listing: RentCastListing) {
  const parts = [
    listing.propertyType ? `${listing.propertyType} home` : "Home",
    listing.city ? `in ${listing.city}, ${listing.state ?? DEFAULT_SEARCH_STATE}` : undefined,
    listing.bedrooms ? `with ${listing.bedrooms} bedrooms` : undefined,
    listing.bathrooms ? `${listing.bathrooms} bathrooms` : undefined,
    listing.squareFootage ? `and ${Math.round(listing.squareFootage).toLocaleString()} sqft` : undefined,
  ].filter(Boolean);

  return `${parts.join(" ")}. Live listing imported from RentCast.`;
}

function buildPhotoUrls(listing: RentCastListing) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return [];

  const location = `${listing.latitude},${listing.longitude}`;
  const address = [
    listing.addressLine1,
    listing.city,
    listing.state,
    listing.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  const streetView = new URL("https://maps.googleapis.com/maps/api/streetview");
  streetView.searchParams.set("size", "1200x800");
  streetView.searchParams.set("location", address || location);
  streetView.searchParams.set("fov", "90");
  streetView.searchParams.set("pitch", "8");
  streetView.searchParams.set("source", "outdoor");
  streetView.searchParams.set("key", apiKey);

  const staticMap = new URL("https://maps.googleapis.com/maps/api/staticmap");
  staticMap.searchParams.set("size", "1200x800");
  staticMap.searchParams.set("center", location);
  staticMap.searchParams.set("zoom", "18");
  staticMap.searchParams.set("scale", "2");
  staticMap.searchParams.set("maptype", "satellite");
  staticMap.searchParams.set("markers", `color:red|${location}`);
  staticMap.searchParams.set("key", apiKey);

  return [streetView.toString(), staticMap.toString()];
}

function buildQueryRange(min?: number, max?: number) {
  if (min === undefined && max === undefined) return null;
  return `${min ?? "*"}:${max ?? "*"}`;
}

function isBroadSearch(filters: SearchFilters, query?: string) {
  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  const hasExplicitQuery =
    normalizedQuery.length > 0 &&
    normalizedQuery !== "homes for sale" &&
    normalizedQuery !== "active homes for sale";

  return !hasExplicitQuery &&
    !filters.minPrice &&
    !filters.maxPrice &&
    !filters.minBeds &&
    !filters.minBaths &&
    !filters.minSqft &&
    !filters.maxSqft &&
    !(filters.propertyTypes && filters.propertyTypes.length > 0) &&
    !(filters.targetNeighborhoods && filters.targetNeighborhoods.length > 0) &&
    !(filters.mustHaves && filters.mustHaves.length > 0) &&
    !(filters.keywords && filters.keywords.length > 0);
}

function extractRentCastLocation(filters: SearchFilters) {
  const target = filters.targetNeighborhoods?.[0]?.trim();
  if (!target) return null;

  const zipMatch = target.match(/\b\d{5}\b/);
  if (zipMatch) {
    return { zipCode: zipMatch[0] };
  }

  const [cityPart, statePart] = target.split(",").map((part) => part.trim()).filter(Boolean);
  if (cityPart && statePart) {
    return {
      city: cityPart,
      state: statePart.length <= 2 ? statePart.toUpperCase() : DEFAULT_SEARCH_STATE,
    };
  }

  return { city: target, state: DEFAULT_SEARCH_STATE };
}

function buildNeighborhoodStats(drafts: PropertyDraft[]) {
  const byArea = new Map<string, PropertyDraft[]>();
  for (const property of drafts) {
    const key = `${property.location.city}|${property.location.state}`;
    byArea.set(key, [...(byArea.get(key) ?? []), property]);
  }

  const stats = new Map<string, Property["neighborhoodStats"]>();
  for (const [key, items] of byArea.entries()) {
    const prices = items.map((item) => item.price).sort((a, b) => a - b);
    const pricePerSqft = items
      .map((item) => item.price / Math.max(item.details.sqft, 1))
      .sort((a, b) => a - b);
    const medianIndex = Math.floor(prices.length / 2);
    const avgDaysOnMarket = Math.round(
      items.reduce((total, item) => total + item.daysOnMarket, 0) / Math.max(items.length, 1)
    );

    stats.set(key, {
      medianPrice: prices[medianIndex] ?? 0,
      medianPricePerSqft: Math.round(pricePerSqft[medianIndex] ?? 0),
      avgDaysOnMarket,
      totalActiveListing: items.length,
      priceChangeYoY: 2.4,
    });
  }

  return stats;
}

function mapRentCastListing(listing: RentCastListing): PropertyDraft | null {
  const price = toNumber(listing.price, 0);
  const lat = toNumber(listing.latitude, NaN);
  const lng = toNumber(listing.longitude, NaN);
  if (!listing.id || !price || Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const address = listing.addressLine1?.trim() || listing.formattedAddress?.split(",")[0]?.trim() || "Unknown address";
  const city = listing.city?.trim() || "California";
  const state = listing.state?.trim() || DEFAULT_SEARCH_STATE;
  const neighborhood = city;
  const sqft = Math.max(1, Math.round(toNumber(listing.squareFootage, 1200)));
  const listedDate = toIsoDate(listing.listedDate ?? listing.createdDate);
  const updatedAt = listing.lastSeenDate ?? listing.createdDate ?? new Date().toISOString();

  return {
    id: listing.id,
    mlsId: listing.mlsNumber ?? undefined,
    status: mapListingStatus(listing.status),
    listingType: "for_sale",
    price,
    pricePerSqft: Math.round(price / sqft),
    daysOnMarket: Math.max(1, Math.round(toNumber(listing.daysOnMarket, 30))),
    listedDate,
    updatedAt,
    tags: buildTags(listing),
    location: {
      address,
      city,
      state,
      zip: listing.zipCode?.trim() || "00000",
      neighborhood,
      lat,
      lng,
    },
    details: {
      beds: toNumber(listing.bedrooms, 3),
      baths: toNumber(listing.bathrooms, 2),
      sqft,
      lotSqft: listing.lotSize ?? undefined,
      yearBuilt: Math.round(toNumber(listing.yearBuilt, 1995)),
      propertyType: mapPropertyType(listing.propertyType),
      parkingSpaces: undefined,
      stories: undefined,
      garage: undefined,
    },
    description: buildDescription(listing),
    photos: buildPhotoUrls(listing),
    priceHistory: buildPriceHistory(listing),
    schoolRating: 6,
    walkScore: 55,
    transitScore: 42,
    bikeScore: 48,
    riskProfile: {
      floodRisk: "low",
      fireRisk: "moderate",
      earthquakeRisk: "moderate",
      crimeScore: 35,
    },
    estimatedValue: Math.round(price * 1.02),
    rentalEstimate: Math.round(price * 0.0042),
    hoaFee: listing.hoa?.fee ?? undefined,
    taxRate: 1.1,
  };
}

function finalizeRentCastListings(listings: RentCastListing[]) {
  const drafts = listings.map(mapRentCastListing).filter((property): property is PropertyDraft => Boolean(property));
  const statsByArea = buildNeighborhoodStats(drafts);

  return drafts.map((draft) =>
    normalizeProperty({
      ...draft,
      neighborhoodStats:
        statsByArea.get(`${draft.location.city}|${draft.location.state}`) ?? {
          medianPrice: draft.price,
          medianPricePerSqft: Math.round(draft.price / Math.max(draft.details.sqft, 1)),
          avgDaysOnMarket: draft.daysOnMarket,
          totalActiveListing: 1,
          priceChangeYoY: 0,
        },
    })
  );
}

function cacheProperties(properties: Property[]) {
  if (properties.length === 0) return;
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO properties (
      id, city, state, neighborhood, listing_type, property_type, price, beds, baths, sqft,
      lat, lng, search_text, payload_json, updated_at
    ) VALUES (
      @id, @city, @state, @neighborhood, @listingType, @propertyType, @price, @beds, @baths, @sqft,
      @lat, @lng, @searchText, @payloadJson, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      city = excluded.city,
      state = excluded.state,
      neighborhood = excluded.neighborhood,
      listing_type = excluded.listing_type,
      property_type = excluded.property_type,
      price = excluded.price,
      beds = excluded.beds,
      baths = excluded.baths,
      sqft = excluded.sqft,
      lat = excluded.lat,
      lng = excluded.lng,
      search_text = excluded.search_text,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `);

  const tx = db.transaction((items: Property[]) => {
    for (const property of items) {
      const normalized = normalizeProperty(property);
      insert.run({
        id: normalized.id,
        city: normalized.location.city,
        state: normalized.location.state,
        neighborhood: normalized.location.neighborhood,
        listingType: normalized.listingType,
        propertyType: normalized.details.propertyType,
        price: normalized.price,
        beds: normalized.details.beds,
        baths: normalized.details.baths,
        sqft: normalized.details.sqft,
        lat: normalized.location.lat,
        lng: normalized.location.lng,
        searchText: buildSearchText(normalized),
        payloadJson: JSON.stringify(normalized),
        updatedAt: normalized.updatedAt,
      });
    }
  });

  tx(properties);
}

function dedupeProperties(properties: Property[]) {
  const seen = new Set<string>();
  return properties.filter((property) => {
    if (seen.has(property.id)) return false;
    seen.add(property.id);
    return true;
  });
}

function buildBackfillFilters(filters: SearchFilters) {
  const candidates: SearchFilters[] = [];
  const pushCandidate = (candidate: SearchFilters) => {
    if (Object.keys(candidate).length === 0) {
      if (!candidates.some((existing) => Object.keys(existing).length === 0)) {
        candidates.push(candidate);
      }
      return;
    }

    const signature = JSON.stringify(candidate);
    const hasMatch = candidates.some((existing) => JSON.stringify(existing) === signature);
    if (!hasMatch) candidates.push(candidate);
  };

  if (filters.targetNeighborhoods?.length || filters.propertyTypes?.length) {
    pushCandidate({
      ...(filters.targetNeighborhoods?.length ? { targetNeighborhoods: filters.targetNeighborhoods } : {}),
      ...(filters.propertyTypes?.length ? { propertyTypes: filters.propertyTypes } : {}),
    });
  }

  if (filters.targetNeighborhoods?.length) {
    pushCandidate({ targetNeighborhoods: filters.targetNeighborhoods });
  }

  if (filters.propertyTypes?.length) {
    pushCandidate({ propertyTypes: filters.propertyTypes });
  }

  pushCandidate({});

  return candidates;
}

function matchesBackfillFilters(
  property: Property,
  filters: SearchFilters,
  options?: { preserveLocation?: boolean }
) {
  if (filters.listingType && property.listingType !== filters.listingType) return false;

  const propertyTypes = (filters.propertyTypes ?? []) as string[];
  if (propertyTypes.length > 0 && !propertyTypes.includes(property.details.propertyType)) {
    return false;
  }

  const locations = parseTargetLocations(filters);
  if (options?.preserveLocation !== false && locations.length > 0) {
    const haystack = [
      property.location.neighborhood,
      property.location.city,
      property.location.state,
      property.location.address,
    ]
      .join(" ")
      .replace(/,/g, " ");
    const locationMatches = locations.some((entry) => includesNeedle(haystack, entry));
    if (!locationMatches) return false;
  }

  return true;
}

async function fetchRentCastListingsPage(
  filters: SearchFilters,
  query?: string,
  limitOverride?: number
): Promise<Property[] | null> {
  const apiKey = getRentCastApiKey();
  if (!apiKey) return null;
  const broadSearch = isBroadSearch(filters, query);
  const location = extractRentCastLocation(filters);

  const params = new URLSearchParams({
    status: "Active",
    limit: String(limitOverride ?? (broadSearch ? DEFAULT_RENTCAST_PAGE_SIZE : TARGETED_RENTCAST_PAGE_SIZE)),
    offset: "0",
  });

  if (location?.state) params.set("state", location.state);

  if (location?.city) params.set("city", location.city);
  if (location?.zipCode) {
    params.delete("state");
    params.set("zipCode", location.zipCode);
  }

  const priceRange = buildQueryRange(filters.minPrice, filters.maxPrice);
  if (priceRange) params.set("price", priceRange);

  params.set("bedrooms", buildQueryRange(filters.minBeds ?? 1, undefined) ?? "");

  params.set("bathrooms", buildQueryRange(filters.minBaths ?? 1, undefined) ?? "");
  params.set("squareFootage", buildQueryRange(filters.minSqft ?? 350, filters.maxSqft) ?? "");

  const propertyTypes = (filters.propertyTypes ?? [])
    .map((propertyType) => toRentCastPropertyType(propertyType))
    .join("|");
  params.set(
    "propertyType",
    propertyTypes || DEFAULT_RENTCAST_PROPERTY_TYPES.join("|")
  );

  try {
    const res = await fetch(`${RENTCAST_BASE_URL}/listings/sale?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("[rentcast] falling back to local inventory", res.status, await res.text());
      return null;
    }

    const payload = (await res.json()) as RentCastListing[];
    const properties = finalizeRentCastListings(payload);
    cacheProperties(properties);
    return properties;
  } catch (error) {
    console.warn("[rentcast] request failed, falling back to local inventory", error);
    return null;
  }
}

async function fetchRentCastListings(filters: SearchFilters, query?: string): Promise<Property[] | null> {
  const primary = await fetchRentCastListingsPage(filters, query);
  if (!primary || primary.length >= MIN_VISIBLE_LISTINGS) return primary;

  const initialSignature = JSON.stringify(filters);
  let combined = [...primary];

  for (const candidate of buildBackfillFilters(filters)) {
    if (JSON.stringify(candidate) === initialSignature) continue;
    const supplemental = await fetchRentCastListingsPage(candidate, query, TARGETED_RENTCAST_PAGE_SIZE);
    if (!supplemental?.length) continue;

    combined = dedupeProperties([...combined, ...supplemental]);
    if (combined.length >= MIN_VISIBLE_LISTINGS) break;
  }

  return combined;
}

function buildSearchText(property: Property) {
  return [
    property.location.address,
    property.location.city,
    property.location.state,
    property.location.neighborhood,
    property.description,
    property.tags.join(" "),
    property.details.propertyType.replace(/_/g, " "),
  ]
    .join(" ")
    .toLowerCase();
}

function seedPropertiesIfNeeded() {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as count FROM properties").get() as { count: number };
  if (count.count > 0) return;
  cacheProperties(DEMO_PROPERTIES);
}

function rowToProperty(row: { payload_json: string }) {
  return JSON.parse(row.payload_json) as Property;
}

function getAllProperties(): Property[] {
  seedPropertiesIfNeeded();
  const db = getDb();
  const rows = db
    .prepare("SELECT payload_json FROM properties ORDER BY price ASC")
    .all() as Array<{ payload_json: string }>;
  return rows.map(rowToProperty);
}

function includesNeedle(value: string, needle: string) {
  return normalizeText(value).includes(normalizeText(needle));
}

function looksLikeAddressQuery(query?: string) {
  const normalized = normalizeText(query ?? "");
  return /\b\d{1,6}\b/.test(normalized) && /\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|way|pl|place|cir|circle|trl|trail|pkwy|parkway|ter|terrace)\b/.test(normalized);
}

function extractAddressNeedle(query?: string) {
  const normalized = normalizeText(query ?? "");
  if (!normalized) return null;

  const stripped = normalized
    .replace(/^(homes?|houses?|properties|listings)\s+for\s+(sale|rent)\s+in\s+/, "")
    .replace(/^(homes?|houses?|properties|listings)\s+in\s+/, "")
    .trim();

  return looksLikeAddressQuery(stripped) ? stripped : null;
}

function matchesAddressQuery(property: Property, addressNeedle: string) {
  const searchable = [
    property.location.address,
    property.location.city,
    property.location.state,
    property.location.zip,
  ].join(" ");

  return includesNeedle(searchable, addressNeedle);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTargetLocations(filters: SearchFilters) {
  return (filters.targetNeighborhoods ?? [])
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
}

function scoreMatch(property: Property, filters: SearchFilters) {
  let score = property.dealScore?.total ?? 50;

  const locations = parseTargetLocations(filters);
  if (locations.length > 0) {
    const haystack = [
      property.location.neighborhood,
      property.location.city,
      property.location.state,
      property.location.address,
    ]
      .join(" ")
      .replace(/,/g, " ");

    const locationMatches = locations.some((entry) => includesNeedle(haystack, entry));
    score += locationMatches ? 20 : -10;
  }

  for (const keyword of filters.mustHaves ?? []) {
    if (buildSearchText(property).includes(keyword.toLowerCase())) score += 4;
  }

  for (const keyword of filters.keywords ?? []) {
    if (buildSearchText(property).includes(keyword.toLowerCase())) score += 6;
  }

  if (filters.maxPrice && property.price <= filters.maxPrice) score += 5;
  if (filters.minBeds && property.details.beds >= filters.minBeds) score += 5;
  if (filters.minBaths && property.details.baths >= filters.minBaths) score += 3;

  return score;
}

function matchesFilters(property: Property, filters: SearchFilters) {
  if (filters.listingType && property.listingType !== filters.listingType) return false;
  if (filters.minPrice && property.price < filters.minPrice) return false;
  if (filters.maxPrice && property.price > filters.maxPrice) return false;
  if (filters.minBeds && property.details.beds < filters.minBeds) return false;
  if (filters.minBaths && property.details.baths < filters.minBaths) return false;
  if (filters.minSqft && property.details.sqft < filters.minSqft) return false;
  if (filters.maxSqft && property.details.sqft > filters.maxSqft) return false;

  const propertyTypes = (filters.propertyTypes ?? []) as string[];
  if (propertyTypes.length > 0 && !propertyTypes.includes(property.details.propertyType)) {
    return false;
  }

  const locations = parseTargetLocations(filters);
  if (locations.length > 0) {
    const haystack = [
      property.location.neighborhood,
      property.location.city,
      property.location.state,
      property.location.address,
    ]
      .join(" ")
      .replace(/,/g, " ");
    const locationMatches = locations.some((entry) => includesNeedle(haystack, entry));
    if (!locationMatches) return false;
  }

  const mustHaves = filters.mustHaves ?? [];
  if (mustHaves.length > 0) {
    const text = buildSearchText(property);
    const mustHaveMatch = mustHaves.every((entry) => text.includes(entry.toLowerCase()));
    if (!mustHaveMatch) return false;
  }

  const keywords = filters.keywords ?? [];
  if (keywords.length > 0) {
    const text = buildSearchText(property);
    const keywordMatch = keywords.some((entry) => text.includes(entry.toLowerCase()));
    if (!keywordMatch) return false;
  }

  return true;
}

function deriveSearchSummary(filters: SearchFilters) {
  const segments: string[] = [];
  segments.push(filters.listingType === "for_rent" ? "Rentals" : "Homes for sale");
  if (filters.targetNeighborhoods?.length) {
    segments.push(`in ${filters.targetNeighborhoods.join(", ")}`);
  }
  if (filters.maxPrice) {
    segments.push(`under $${Math.round(filters.maxPrice).toLocaleString()}`);
  }
  if (filters.minBeds) {
    segments.push(`${filters.minBeds}+ beds`);
  }
  if (filters.mustHaves?.length) {
    segments.push(`with ${filters.mustHaves.slice(0, 2).join(" and ")}`);
  }
  return segments.join(" ");
}

export function getPropertyById(propertyId: string) {
  seedPropertiesIfNeeded();
  const db = getDb();
  const row = db.prepare("SELECT payload_json FROM properties WHERE id = ?").get(propertyId) as
    | { payload_json: string }
    | undefined;
  return row ? rowToProperty(row) : null;
}

export function getPropertiesByIds(propertyIds: string[]) {
  return propertyIds
    .map((propertyId) => getPropertyById(propertyId))
    .filter((property): property is Property => Boolean(property));
}

export function saveSearchSession(input: {
  query: string;
  summary: string;
  filters: SearchFilters;
  propertyIds: string[];
}) {
  seedPropertiesIfNeeded();
  const db = getDb();
  const now = new Date().toISOString();
  const session: SearchSession = {
    id: `search_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    query: input.query,
    summary: input.summary,
    filters: input.filters,
    propertyIds: input.propertyIds,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    `INSERT INTO search_sessions (id, query_text, summary, filters_json, property_ids_json, created_at, updated_at)
     VALUES (@id, @queryText, @summary, @filtersJson, @propertyIdsJson, @createdAt, @updatedAt)`
  ).run({
    id: session.id,
    queryText: session.query,
    summary: session.summary,
    filtersJson: JSON.stringify(session.filters),
    propertyIdsJson: JSON.stringify(session.propertyIds),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });

  return session;
}

export function getSearchSession(sessionId: string) {
  seedPropertiesIfNeeded();
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, query_text, summary, filters_json, property_ids_json, created_at, updated_at FROM search_sessions WHERE id = ?"
    )
    .get(sessionId) as
    | {
        id: string;
        query_text: string;
        summary: string;
        filters_json: string;
        property_ids_json: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    query: row.query_text,
    summary: row.summary,
    filters: JSON.parse(row.filters_json) as SearchFilters,
    propertyIds: JSON.parse(row.property_ids_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies SearchSession;
}

export async function searchListings(input: {
  query?: string;
  summary?: string;
  filters: SearchFilters;
}): Promise<ListingsSearchResponse> {
  const liveProperties = await fetchRentCastListings(input.filters, input.query);
  const sourceProperties = liveProperties ?? getAllProperties();
  const addressNeedle = extractAddressNeedle(input.query);
  const addressMatches = addressNeedle
    ? sourceProperties.filter((property) => matchesAddressQuery(property, addressNeedle))
    : [];
  const strictMatches = sourceProperties
    .filter((property) => matchesFilters(property, input.filters))
    .sort((a, b) => scoreMatch(b, input.filters) - scoreMatch(a, input.filters));
  const prioritizedStrictMatches = dedupeProperties([
    ...addressMatches.sort((a, b) => scoreMatch(b, input.filters) - scoreMatch(a, input.filters)),
    ...strictMatches,
  ]);
  const strictIds = new Set(prioritizedStrictMatches.map((property) => property.id));
  const remainingSlots = Math.max(MIN_VISIBLE_LISTINGS - prioritizedStrictMatches.length, 0);
  const contextualRelatedMatches =
    remainingSlots === 0
      ? []
      : sourceProperties
          .filter((property) => !strictIds.has(property.id))
          .filter((property) => matchesBackfillFilters(property, input.filters))
          .sort((a, b) => scoreMatch(b, input.filters) - scoreMatch(a, input.filters))
          .slice(0, remainingSlots);
  const contextualIds = new Set(contextualRelatedMatches.map((property) => property.id));
  const broadRelatedMatches =
    contextualRelatedMatches.length >= remainingSlots
      ? []
      : sourceProperties
          .filter((property) => !strictIds.has(property.id) && !contextualIds.has(property.id))
          .filter((property) =>
            matchesBackfillFilters(property, input.filters, { preserveLocation: false })
          )
          .sort((a, b) => scoreMatch(b, input.filters) - scoreMatch(a, input.filters))
          .slice(0, remainingSlots - contextualRelatedMatches.length);
  const relatedMatches = [...contextualRelatedMatches, ...broadRelatedMatches];
  const properties = [...prioritizedStrictMatches, ...relatedMatches].slice(0, MAX_VISIBLE_LISTINGS);

  const summary =
    input.summary?.trim() || deriveSearchSummary(input.filters) || DEFAULT_SEARCH_SUMMARY;
  const session = saveSearchSession({
    query: input.query?.trim() || summary,
    summary,
    filters: input.filters,
    propertyIds: properties.map((property) => property.id),
  });

  return { session, properties };
}

function buildNeighborhoodSummary(property: Property) {
  const walk = property.walkScore ?? 0;
  const school = property.schoolRating ?? 0;
  const neighborhood = property.location.neighborhood;
  const market = property.neighborhoodStats;
  return `${neighborhood} has a median price of $${market.medianPrice.toLocaleString()}, average market time of ${market.avgDaysOnMarket} days, walk score ${walk}/100, and school rating ${school}/10.`;
}

function buildMarketPosition(property: Property) {
  const avm = property.estimatedValue;
  if (!avm) {
    return `This listing is priced at $${property.price.toLocaleString()} with no AVM available, so the deal score (${property.dealScore?.total ?? "N/A"}) is the clearest value signal.`;
  }

  const delta = avm - property.price;
  const direction = delta >= 0 ? "below" : "above";
  return `This home is listed ${direction} its estimated value by about $${Math.abs(delta).toLocaleString()}, with a deal score of ${property.dealScore?.total ?? "N/A"}/100.`;
}

function distanceMiles(a: Property, b: Property) {
  const latDiff = a.location.lat - b.location.lat;
  const lngDiff = a.location.lng - b.location.lng;
  return Math.round(Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 69 * 10) / 10;
}

export function getPropertyContext(propertyId: string): PropertyContext | null {
  const property = getPropertyById(propertyId);
  if (!property) return null;

  const nearbyComparables = getAllProperties()
    .filter((candidate) => candidate.id !== propertyId)
    .filter((candidate) => candidate.location.neighborhood === property.location.neighborhood)
    .sort((a, b) => distanceMiles(property, a) - distanceMiles(property, b))
    .slice(0, 3);

  return {
    property,
    neighborhoodSummary: buildNeighborhoodSummary(property),
    marketPosition: buildMarketPosition(property),
    nearbyAmenities:
      neighborhoodAmenityCatalog[property.location.neighborhood] ?? [
        { name: "Neighborhood Park", category: "park", distanceMiles: 0.6 },
        { name: "Local Market", category: "grocery", distanceMiles: 0.9 },
        { name: "Transit stop", category: "transit", distanceMiles: 1.2 },
      ],
    nearbyComparables,
  };
}
