import { NextRequest, NextResponse } from "next/server";
import { getPropertyById } from "@/lib/server/listings";
import { generateOpenAIText } from "@/lib/server/ai";

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

  const fallback = `${property.location.address} is a ${property.details.beds}-bedroom, ${property.details.baths}-bathroom ${property.details.propertyType.replace(/_/g, " ")} in ${property.location.neighborhood}, ${property.location.city}. It offers ${property.details.sqft.toLocaleString()} square feet built in ${property.details.yearBuilt}.${features ? ` Notable features include ${features}.` : ""}`;

  const description =
    (await generateOpenAIText({
      systemPrompt:
        "You write concise, cinematic real-estate narration for a house voiceover. Describe the home itself as if giving behind-the-scenes context to a buyer during a walkthrough. Focus on the property, layout, finishes, light, setting, and practical buyer-relevant details. Do not mention 3D models, rendering, virtual tours, cameras, or that this is AI-generated. Avoid hype and marketing clichés. Keep it to 4-6 sentences.",
      prompt: `Write a behind-the-scenes house narration based only on these listing facts:\n\n${context}`,
    })) ?? fallback;

  return NextResponse.json({ description });
}
