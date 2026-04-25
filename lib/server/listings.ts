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

  const insert = db.prepare(`
    INSERT INTO properties (
      id, city, state, neighborhood, listing_type, property_type, price, beds, baths, sqft,
      lat, lng, search_text, payload_json, updated_at
    ) VALUES (
      @id, @city, @state, @neighborhood, @listingType, @propertyType, @price, @beds, @baths, @sqft,
      @lat, @lng, @searchText, @payloadJson, @updatedAt
    )
  `);

  const tx = db.transaction((properties: Property[]) => {
    for (const property of properties) {
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

  tx(DEMO_PROPERTIES);
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
  return value.toLowerCase().includes(needle.trim().toLowerCase());
}

function parseTargetLocations(filters: SearchFilters) {
  return (filters.targetNeighborhoods ?? [])
    .map((entry) => entry.trim().toLowerCase())
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
      .toLowerCase();

    const locationMatches = locations.some((entry) => haystack.includes(entry));
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
      .toLowerCase();
    const locationMatches = locations.some((entry) => haystack.includes(entry));
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
  if (filters.listingType === "for_rent") {
    segments.push("Rental homes");
  } else {
    segments.push("Homes for sale");
  }
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

export function searchListings(input: {
  query?: string;
  summary?: string;
  filters: SearchFilters;
}): ListingsSearchResponse {
  const properties = getAllProperties()
    .filter((property) => matchesFilters(property, input.filters))
    .sort((a, b) => scoreMatch(b, input.filters) - scoreMatch(a, input.filters));

  const summary = input.summary?.trim() || deriveSearchSummary(input.filters) || "All available homes";
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
