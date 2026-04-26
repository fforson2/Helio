import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { Property } from "@/types/property";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const runtime = "nodejs";
export const maxDuration = 60;

interface SchematicRequest {
  property: Property;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function buildSchematicPrompt(property: Property): string {
  const { details, location } = property;
  const features: string[] = [];
  if (details.garage) features.push("attached garage");
  if (details.pool) features.push("backyard pool");
  if (details.parkingSpaces) features.push(`${details.parkingSpaces}-car parking`);
  if (details.stories && details.stories > 1) {
    features.push(`${details.stories}-story layout (showing main floor)`);
  }

  return `A clean, modern architectural floor plan schematic — top-down view, black and white, technical line drawing style with subtle blue accents on key labels. Show a ${
    details.propertyType.replace(/_/g, " ")
  } with ${details.beds} bedrooms and ${details.baths} bathrooms across ${
    details.sqft.toLocaleString()
  } square feet${
    details.lotSqft
      ? ` on a ${details.lotSqft.toLocaleString()} sq ft lot`
      : ""
  }. Built in ${details.yearBuilt}.${
    features.length ? ` Include: ${features.join(", ")}.` : ""
  } Label each room: bedrooms, bathrooms, kitchen, living, dining. Add dimension hints in feet. Crisp, professional, blueprint-inspired. Header text: "${location.address}". No people, no furniture clutter, no perspective rendering — strictly 2D top-down schematic.`;
}

export async function POST(req: NextRequest) {
  let body: SchematicRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const { property } = body;
  if (!property) return jsonError("property is required");

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return jsonError(
      "Floor plan schematics require OPENAI_API_KEY in .env.local.",
      500
    );
  }

  const prompt = buildSchematicPrompt(property);
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";

  // Return existing floor plan from Cloudinary if already generated
  try {
    const existing = await cloudinary.api.resource(`helio/floor-plans/${property.id}`);
    if (existing?.secure_url) {
      return NextResponse.json({
        imageUrl: existing.secure_url,
        caption: `Schematic for ${property.location.address} — ${property.details.beds}bd/${property.details.baths}ba · ${property.details.sqft.toLocaleString()} sqft`,
        prompt,
      });
    }
  } catch {
    // Not found — fall through to generate
  }

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        size: "1024x1024",
        n: 1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return jsonError(
        `Image generation failed: ${errText.slice(0, 240)}`,
        res.status
      );
    }

    const data = await res.json();
    const item = data.data?.[0];
    const rawUrl: string | undefined = item?.url;
    const b64: string | undefined = item?.b64_json;

    if (!rawUrl && !b64) {
      return jsonError("No image returned from provider", 502);
    }

    const cloudinaryUrl = await new Promise<string>((resolve, reject) => {
      const opts = {
        folder: "helio/floor-plans",
        public_id: property.id,
        overwrite: true,
        resource_type: "image" as const,
      };

      if (b64) {
        const buffer = Buffer.from(b64, "base64");
        const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
          if (err || !result) return reject(err ?? new Error("No result from Cloudinary"));
          resolve(result.secure_url);
        });
        stream.end(buffer);
      } else {
        cloudinary.uploader.upload(rawUrl!, opts)
          .then((r) => resolve(r.secure_url))
          .catch(reject);
      }
    });

    let imageUrl: string = cloudinaryUrl;

    return NextResponse.json({
      imageUrl,
      caption: `Schematic for ${property.location.address} — ${property.details.beds}bd/${property.details.baths}ba · ${property.details.sqft.toLocaleString()} sqft`,
      prompt,
    });
  } catch (err) {
    return jsonError(
      `Image generation failed: ${err instanceof Error ? err.message : "unknown"}`,
      500
    );
  }
}
