import { Property } from "@/types/property";
import { BuyerPreferences } from "@/types/user";

export interface SearchFilters extends Partial<BuyerPreferences> {
  queryText?: string;
  keywords?: string[];
}

export interface SearchIntent {
  query: string;
  summary: string;
  filters: SearchFilters;
  clarifications: string[];
}

export interface SearchSession {
  id: string;
  query: string;
  summary: string;
  filters: SearchFilters;
  propertyIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListingsSearchResponse {
  session: SearchSession;
  properties: Property[];
}

export interface NeighborhoodAmenity {
  name: string;
  category: "school" | "park" | "grocery" | "transit" | "coffee";
  distanceMiles: number;
}

export interface PropertyContext {
  property: Property;
  neighborhoodSummary: string;
  marketPosition: string;
  nearbyAmenities: NeighborhoodAmenity[];
  nearbyComparables: Property[];
}
