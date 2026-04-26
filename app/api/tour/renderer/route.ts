import { NextRequest, NextResponse } from "next/server";
import { getPropertyById } from "@/lib/server/listings";
import { chooseTourRenderer } from "@/lib/server/sketchfab";

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

  try {
    const renderer = await chooseTourRenderer(property);
    return NextResponse.json(renderer);
  } catch (error) {
    console.error("[tour/renderer]", error);
    return NextResponse.json(
      {
        mode: "threejs",
        archetype: "unmapped",
        reason: "Could not resolve a Sketchfab model for this property.",
        confidence: 0,
      },
      { status: 200 }
    );
  }
}
