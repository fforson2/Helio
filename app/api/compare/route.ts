import { NextRequest, NextResponse } from "next/server";
import { generateOpenAIJson } from "@/lib/server/ai";
import { Property } from "@/types/property";
import { BuyerPreferences } from "@/types/user";

export const runtime = "nodejs";

interface CompareRequest {
  properties: Property[];
  userPreferences?: Partial<BuyerPreferences>;
  userName?: string;
}

interface CompareResponse {
  winnerId: string;
  summary: string;
  reasons: string[];
  tradeoffs: string[];
}

function buildPropertySnapshot(property: Property) {
  const pricePerSqft =
    property.pricePerSqft ?? property.price / Math.max(property.details.sqft, 1);

  return {
    id: property.id,
    address: property.location.address,
    neighborhood: property.location.neighborhood,
    city: property.location.city,
    state: property.location.state,
    price: property.price,
    estimatedValue: property.estimatedValue ?? null,
    dealScore: property.dealScore?.total ?? null,
    dealLabel: property.dealScore?.label ?? null,
    pricePerSqft: Math.round(pricePerSqft),
    beds: property.details.beds,
    baths: property.details.baths,
    sqft: property.details.sqft,
    yearBuilt: property.details.yearBuilt,
    propertyType: property.details.propertyType,
    daysOnMarket: property.daysOnMarket,
    neighborhoodMedianPrice: property.neighborhoodStats.medianPrice,
    neighborhoodTrendYoY: property.neighborhoodStats.priceChangeYoY,
    walkScore: property.walkScore ?? null,
    transitScore: property.transitScore ?? null,
    schoolRating: property.schoolRating ?? null,
    rentalEstimate: property.rentalEstimate ?? null,
    hoaFee: property.hoaFee ?? null,
    taxRate: property.taxRate ?? null,
    fireRisk: property.riskProfile.fireRisk,
    floodRisk: property.riskProfile.floodRisk,
    earthquakeRisk: property.riskProfile.earthquakeRisk,
    crimeScore: property.riskProfile.crimeScore,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CompareRequest;
  const { properties, userPreferences, userName } = body;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is required for AI comparison." },
      { status: 500 }
    );
  }

  if (!Array.isArray(properties) || properties.length < 2) {
    return NextResponse.json(
      { error: "Select at least 2 properties to run an AI comparison." },
      { status: 400 }
    );
  }

  const comparisonSet = [...properties]
    .sort((a, b) => a.location.address.localeCompare(b.location.address))
    .map(buildPropertySnapshot);

  const systemPrompt = `You are Helio's senior real estate comparison analyst.

Your job is to compare 2-3 properties fairly and choose the single best option after making explicit trade-offs.

Rules:
- Never choose a winner because it appears first in the input.
- Evaluate every property independently before deciding.
- Weigh multiple factors: price, estimated value, deal score, price per sqft, neighborhood trend, days on market, school/walk/transit scores, rental upside, HOA/tax burden, and risk profile.
- Use buyer preferences when they matter.
- Prefer clear, concrete reasoning over generic praise.
- If a property is strongest overall but loses on one dimension, call that trade-off out.
- Return only valid JSON.`;

  const prompt = `Compare these properties for ${userName ?? "the buyer"}.

Buyer preferences:
${JSON.stringify(userPreferences ?? {}, null, 2)}

Properties:
${JSON.stringify(comparisonSet, null, 2)}

Return JSON in exactly this shape:
{
  "winnerId": "property-id",
  "summary": "One concise paragraph explaining the winner and main trade-off.",
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "tradeoffs": ["tradeoff 1", "tradeoff 2"]
}

Requirements:
- "winnerId" must be one of the provided property ids.
- "reasons" should be 2-3 concise bullets grounded in the data.
- "tradeoffs" should mention at least one real downside or compromise.
- Keep all text concise and specific.`;

  const result = await generateOpenAIJson<CompareResponse>({
    systemPrompt,
    prompt,
  });

  if (!result?.winnerId || !comparisonSet.some((property) => property.id === result.winnerId)) {
    return NextResponse.json(
      { error: "AI comparison did not return a valid winner." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    winnerId: result.winnerId,
    summary: result.summary?.trim() ?? "",
    reasons: Array.isArray(result.reasons) ? result.reasons.slice(0, 3) : [],
    tradeoffs: Array.isArray(result.tradeoffs) ? result.tradeoffs.slice(0, 2) : [],
  });
}
