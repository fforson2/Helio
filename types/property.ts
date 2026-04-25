export interface PropertyLocation {
  address: string;
  city: string;
  state: string;
  zip: string;
  neighborhood: string;
  lat: number;
  lng: number;
}

export interface PropertyDetails {
  beds: number;
  baths: number;
  sqft: number;
  lotSqft?: number;
  yearBuilt: number;
  propertyType: "single_family" | "condo" | "townhouse" | "multi_family" | "land";
  parkingSpaces?: number;
  stories?: number;
  garage?: boolean;
  pool?: boolean;
  basement?: boolean;
}

export interface PricePoint {
  date: string;
  price: number;
  event: "listed" | "price_change" | "sold" | "delisted";
}

export interface NeighborhoodStats {
  medianPrice: number;
  medianPricePerSqft: number;
  avgDaysOnMarket: number;
  totalActiveListing: number;
  priceChangeYoY: number;
}

export interface RiskProfile {
  floodRisk: "minimal" | "low" | "moderate" | "high";
  fireRisk: "minimal" | "low" | "moderate" | "high";
  earthquakeRisk: "minimal" | "low" | "moderate" | "high";
  crimeScore: number;
}

export interface DealScore {
  total: number;
  breakdown: {
    valueScore: number;
    locationScore: number;
    conditionScore: number;
    marketMomentumScore: number;
    riskScore: number;
  };
  label: "Hot Deal" | "Good Value" | "Fair Market" | "Overpriced" | "High Risk";
  summary: string;
}

export interface Property {
  id: string;
  mlsId?: string;
  status: "active" | "pending" | "sold" | "off_market";
  listingType: "for_sale" | "for_rent";
  price: number;
  pricePerSqft?: number;
  daysOnMarket: number;
  location: PropertyLocation;
  details: PropertyDetails;
  description: string;
  photos: string[];
  priceHistory: PricePoint[];
  neighborhoodStats: NeighborhoodStats;
  schoolRating?: number;
  walkScore?: number;
  transitScore?: number;
  bikeScore?: number;
  riskProfile: RiskProfile;
  estimatedValue?: number;
  rentalEstimate?: number;
  hoaFee?: number;
  taxRate?: number;
  dealScore?: DealScore;
  tags: string[];
  listedDate: string;
  updatedAt: string;
}

export interface SavedProperty {
  propertyId: string;
  savedAt: string;
  notes?: string;
  tags?: string[];
}

export interface ComparisonSet {
  id: string;
  propertyIds: string[];
  createdAt: string;
}
