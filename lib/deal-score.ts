import { Property, DealScore } from "@/types/property";

function scoreValue(property: Property): number {
  const { price, estimatedValue, pricePerSqft, neighborhoodStats } = property;
  if (!estimatedValue) return 60;
  const discountPct = (estimatedValue - price) / estimatedValue;
  const ppsRatio = pricePerSqft && neighborhoodStats.medianPricePerSqft
    ? neighborhoodStats.medianPricePerSqft / pricePerSqft
    : 1;
  const base = 50 + discountPct * 200;
  const adjusted = base * (0.7 + ppsRatio * 0.3);
  return Math.min(100, Math.max(0, Math.round(adjusted)));
}

function scoreLocation(property: Property): number {
  const { walkScore = 50, transitScore = 50, bikeScore = 50, schoolRating = 5 } = property;
  const walkWeight = 0.35;
  const transitWeight = 0.25;
  const bikeWeight = 0.1;
  const schoolWeight = 0.3;
  const score =
    walkScore * walkWeight +
    transitScore * transitWeight +
    bikeScore * bikeWeight +
    (schoolRating / 10) * 100 * schoolWeight;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function scoreCondition(property: Property): number {
  const ageYears = new Date().getFullYear() - property.details.yearBuilt;
  let base = 100 - ageYears * 0.8;
  if (ageYears < 10) base = 95;
  if (ageYears > 60) base = Math.max(base, 55);
  if (property.tags.some((t) => t.includes("updated") || t.includes("renovated") || t.includes("new"))) {
    base = Math.min(100, base + 12);
  }
  if (property.tags.some((t) => t.includes("needs work") || t.includes("as-is"))) {
    base = Math.max(0, base - 20);
  }
  return Math.min(100, Math.max(0, Math.round(base)));
}

function scoreMomentum(property: Property): number {
  const { daysOnMarket, priceHistory, neighborhoodStats } = property;
  const avgDOM = neighborhoodStats.avgDaysOnMarket;
  const domRatio = avgDOM / Math.max(daysOnMarket, 1);
  const priceCuts = priceHistory.filter((p) => p.event === "price_change" && p.price < priceHistory[0].price).length;
  let base = Math.min(100, domRatio * 50 + neighborhoodStats.priceChangeYoY * 5);
  base -= priceCuts * 10;
  base = Math.max(0, base);
  return Math.min(100, Math.max(0, Math.round(base)));
}

function scoreRisk(property: Property): number {
  const { riskProfile } = property;
  const riskMap = { minimal: 0, low: 10, moderate: 25, high: 45 };
  const totalRisk =
    riskMap[riskProfile.floodRisk] +
    riskMap[riskProfile.fireRisk] +
    riskMap[riskProfile.earthquakeRisk] +
    riskProfile.crimeScore * 0.3;
  return Math.min(100, Math.max(0, Math.round(100 - totalRisk)));
}

function getLabel(total: number): DealScore["label"] {
  if (total >= 85) return "Hot Deal";
  if (total >= 70) return "Good Value";
  if (total >= 55) return "Fair Market";
  if (total >= 40) return "Overpriced";
  return "High Risk";
}

function generateSummary(property: Property, breakdown: DealScore["breakdown"], label: DealScore["label"]): string {
  const { price, estimatedValue, daysOnMarket, neighborhoodStats } = property;
  const parts: string[] = [];
  if (estimatedValue) {
    const diff = estimatedValue - price;
    const pct = Math.abs(diff / estimatedValue * 100).toFixed(0);
    parts.push(diff > 0
      ? `Listed ${pct}% below the estimated value of $${estimatedValue.toLocaleString()}.`
      : `Priced ${pct}% above AVM — room to negotiate.`);
  }
  if (daysOnMarket < neighborhoodStats.avgDaysOnMarket / 2) {
    parts.push(`Only ${daysOnMarket} days on market vs. ${neighborhoodStats.avgDaysOnMarket}-day neighborhood average — this is moving fast.`);
  } else if (daysOnMarket > neighborhoodStats.avgDaysOnMarket * 1.5) {
    parts.push(`${daysOnMarket} days on market suggests seller motivation.`);
  }
  if (property.schoolRating && property.schoolRating >= 8) {
    parts.push(`Strong ${property.schoolRating}/10 school rating supports long-term resale.`);
  }
  if (property.riskProfile.fireRisk === "high") {
    parts.push("High fire risk — budget for insurance and defensible space requirements.");
  }
  return parts.join(" ") || `${label} at current pricing.`;
}

export function computeDealScore(property: Property): DealScore {
  const breakdown = {
    valueScore: scoreValue(property),
    locationScore: scoreLocation(property),
    conditionScore: scoreCondition(property),
    marketMomentumScore: scoreMomentum(property),
    riskScore: scoreRisk(property),
  };
  const total = Math.round(
    breakdown.valueScore * 0.30 +
    breakdown.locationScore * 0.25 +
    breakdown.conditionScore * 0.20 +
    breakdown.marketMomentumScore * 0.15 +
    breakdown.riskScore * 0.10
  );
  const label = getLabel(total);
  const summary = generateSummary(property, breakdown, label);
  return { total, breakdown, label, summary };
}

export function getDealScoreColor(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-blue-400";
  if (score >= 55) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

export function getDealScoreBg(score: number): string {
  if (score >= 85) return "bg-emerald-500/10 border-emerald-500/30";
  if (score >= 70) return "bg-blue-500/10 border-blue-500/30";
  if (score >= 55) return "bg-amber-500/10 border-amber-500/30";
  if (score >= 40) return "bg-orange-500/10 border-orange-500/30";
  return "bg-red-500/10 border-red-500/30";
}
