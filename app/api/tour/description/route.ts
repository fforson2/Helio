import { NextRequest, NextResponse } from "next/server";
import { getPropertyById } from "@/lib/server/listings";
import { generateNarrative } from "@/lib/server/ai";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const propertyId = req.nextUrl.searchParams.get("propertyId");
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
  }

  const property = getPropertyById(propertyId);
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const features = [
    property.details.pool && "pool",
    property.details.garage && "garage",
    property.details.basement && "basement",
    property.details.stories && `${property.details.stories}-story`,
    property.details.parkingSpaces && `${property.details.parkingSpaces}-car parking`,
  ]
    .filter(Boolean)
    .join(", ");

  const context = [
    `Property: ${property.details.propertyType.replace(/_/g, " ")} at ${property.location.address}, ${property.location.city}, ${property.location.state} ${property.location.zip}`,
    `Neighborhood: ${property.location.neighborhood}`,
    `Price: $${property.price.toLocaleString()}${property.listingType === "for_rent" ? "/mo" : ""}`,
    `Size: ${property.details.beds} bed, ${property.details.baths} bath, ${property.details.sqft.toLocaleString()} sqft`,
    property.details.lotSqft ? `Lot: ${property.details.lotSqft.toLocaleString()} sqft` : null,
    `Year built: ${property.details.yearBuilt}`,
    features ? `Features: ${features}` : null,
    property.walkScore ? `Walk score: ${property.walkScore}` : null,
    property.schoolRating ? `School rating: ${property.schoolRating}/10` : null,
    property.tags.length ? `Tags: ${property.tags.join(", ")}` : null,
    `Days on market: ${property.daysOnMarket}`,
    property.dealScore?.summary ? `Deal summary: ${property.dealScore.summary}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const description = await generateNarrative({
    systemPrompt:
      "You write vivid, specific real estate property descriptions for virtual tour prompts. Be evocative and detailed about the architecture, spaces, and setting. 3–5 sentences. No marketing clichés.",
    prompt: `Write a rich virtual tour description for this property based on its listing data:\n\n${context}`,
    fallback: `${property.details.beds}-bedroom, ${property.details.baths}-bathroom ${property.details.propertyType.replace(/_/g, " ")} at ${property.location.address}, ${property.location.city}. Built in ${property.details.yearBuilt}, ${property.details.sqft.toLocaleString()} sqft.${features ? ` Features include ${features}.` : ""}`,
  });

  return NextResponse.json({ description });
}
