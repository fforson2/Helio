export type UserRole = "buyer" | "renter" | "agent";
export type Timeline = "asap" | "1_3_months" | "3_6_months" | "6_12_months" | "just_browsing";
export type Financing = "pre_approved" | "getting_approved" | "cash" | "exploring";

export interface BuyerPreferences {
  minPrice: number;
  maxPrice: number;
  minBeds: number;
  minBaths: number;
  minSqft?: number;
  maxSqft?: number;
  propertyTypes: Array<"single_family" | "condo" | "townhouse" | "multi_family">;
  targetNeighborhoods: string[];
  mustHaves: string[];
  dealBreakers: string[];
  commuteToAddress?: string;
  maxCommuteMins?: number;
  listingType: "for_sale" | "for_rent";
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  preferences?: BuyerPreferences;
  timeline?: Timeline;
  financing?: Financing;
  agentId?: string;
  createdAt: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  brokerage: string;
  avatar?: string;
  bio?: string;
  specialties: string[];
  yearsExperience: number;
  activeClients: number;
}
