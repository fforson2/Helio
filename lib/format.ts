export function formatPrice(price: number): string {
  if (price >= 1_000_000) {
    return `$${(price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 2)}M`;
  }
  if (price >= 1_000) {
    return `$${(price / 1_000).toFixed(0)}K`;
  }
  return `$${price.toLocaleString()}`;
}

export function formatFullPrice(price: number): string {
  return `$${price.toLocaleString()}`;
}

export function formatPricePerSqft(pricePerSqft: number): string {
  return `$${Math.round(pricePerSqft).toLocaleString()}/sqft`;
}

export function formatSqft(sqft: number): string {
  return `${sqft.toLocaleString()} sqft`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}

export function formatAddress(address: string, city: string, state: string): string {
  return `${address}, ${city}, ${state}`;
}

export function formatBeds(beds: number): string {
  return beds === 1 ? "1 bed" : `${beds} beds`;
}

export function formatBaths(baths: number): string {
  return baths === 1 ? "1 bath" : `${baths} baths`;
}

export function formatDaysOnMarket(days: number): string {
  if (days === 0) return "Listed today";
  if (days === 1) return "1 day on market";
  return `${days} days on market`;
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export function getRiskLabel(risk: "minimal" | "low" | "moderate" | "high"): string {
  return { minimal: "Minimal", low: "Low", moderate: "Moderate", high: "High" }[risk];
}

export function getRiskColor(risk: "minimal" | "low" | "moderate" | "high"): string {
  return {
    minimal: "text-emerald-400",
    low: "text-blue-400",
    moderate: "text-amber-400",
    high: "text-red-400",
  }[risk];
}
