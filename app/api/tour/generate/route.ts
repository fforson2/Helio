import { NextRequest, NextResponse } from "next/server";
import { getPropertyById } from "@/lib/server/listings";
import { generateNarrative } from "@/lib/server/ai";
import { Property } from "@/types/property";

export const runtime = "nodejs";
export const maxDuration = 300;

// veo-3.0-fast-generate-001 works with AI Studio keys, no billing required
const VEO_MODEL = "veo-3.0-fast-generate-001";
const VEO_BASE = "https://generativelanguage.googleapis.com/v1beta";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 54; // ~4.5 minutes

function buildBasePrompt(userPrompt: string, property: Property | null): string {
  if (!property) return userPrompt;

  const beds  = property.details.beds;
  const baths = property.details.baths;
  const sqft  = property.details.sqft;
  const year  = property.details.yearBuilt;
  const pType = property.details.propertyType.replace(/_/g, " ");
  const addr  = `${property.location.address}, ${property.location.city}, ${property.location.state}`;

  const rooms = [
    "front door",
    "entryway",
    "living room",
    beds >= 2 ? "dining area" : null,
    "kitchen",
    `${beds}-bedroom wing`,
    baths >= 2 ? "master bathroom" : "bathroom",
    property.details.garage ? "garage" : null,
    property.details.pool ? "backyard with pool" : "backyard",
  ].filter(Boolean).join(" → ");

  return [
    `First-person continuous walkthrough of a real ${beds}-bed ${baths}-bath ${pType} at ${addr}.`,
    sqft && year ? `Built in ${year}, ${sqft.toLocaleString()} sqft.` : null,
    `The camera moves smoothly through: ${rooms}.`,
    `${userPrompt}`,
  ]
    .filter(Boolean)
    .join(" ");
}

async function enhancePrompt(rawPrompt: string): Promise<string> {
  return generateNarrative({
    systemPrompt:
      "You write precise first-person walkthrough prompts for Veo (Google AI video generation). Output only the prompt — no quotes, no preamble, max 200 words.",
    prompt: `Rewrite this as a detailed Veo video prompt for a smooth first-person house walkthrough.

Rules:
- Camera starts outside the front door, walks in, and moves continuously from room to room
- Describe the camera path explicitly: approaching front door → opening door → walking through each room
- Photorealistic — looks like actual handheld real estate footage, not CGI or animation
- Natural lighting: sunlight through windows, warm interior lights
- Show details: flooring material, wall color, countertops, furniture style, ceiling height
- Smooth dolly/glide motion the whole time, never static
- End in the backyard or with an exterior shot

Input: "${rawPrompt}"`,
    fallback: rawPrompt,
  });
}

async function startVeoGeneration(prompt: string, apiKey: string): Promise<string> {
  // Retry up to 3 times on 429 (per-minute rate limits), with backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `${VEO_BASE}/models/${VEO_MODEL}:predictLongRunning?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            durationSeconds: 8,
            aspectRatio: "16:9",
            sampleCount: 1,
          },
        }),
      }
    );

    if (res.status === 429) {
      if (attempt < 2) {
        // Wait 20s before retry (per-minute quota resets)
        await new Promise((r) => setTimeout(r, 20_000 * (attempt + 1)));
        continue;
      }
      // Final attempt exhausted — surface a helpful message
      throw new Error(
        "Veo quota exhausted. The free tier allows only a few videos per day. " +
        "Wait until tomorrow for the quota to reset, or add billing at https://ai.google.dev/gemini-api/docs/rate-limits"
      );
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Veo error ${res.status}: ${text}`);
    }

    const data = await res.json();
    if (!data.name) throw new Error("Veo returned no operation name");
    return data.name as string;
  }

  throw new Error("Veo request failed after 3 attempts");
}

async function pollForVideo(operationName: string, apiKey: string): Promise<string> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${VEO_BASE}/${operationName}?key=${apiKey}`);
    if (!res.ok) throw new Error(`Poll error ${res.status}`);

    const data = await res.json();
    if (!data.done) continue;
    if (data.error) throw new Error(data.error.message ?? "Video generation failed");

    const samples: Array<{ video: { uri?: string; videoBytes?: string } }> =
      data.response?.generateVideoResponse?.generatedSamples ?? [];

    if (!samples.length) throw new Error("No video samples in response");

    const { uri, videoBytes } = samples[0].video;

    if (videoBytes) return `data:video/mp4;base64,${videoBytes}`;

    if (uri) {
      // Append API key if the URI is a Google API files endpoint
      const downloadUrl = uri.includes("generativelanguage.googleapis.com")
        ? `${uri}${uri.includes("?") ? "&" : "?"}key=${apiKey}`
        : uri;

      const videoRes = await fetch(downloadUrl);
      if (!videoRes.ok) throw new Error(`Failed to fetch video (${videoRes.status})`);
      const buf = await videoRes.arrayBuffer();
      return `data:video/mp4;base64,${Buffer.from(buf).toString("base64")}`;
    }

    throw new Error("Unexpected video format in Veo response");
  }

  throw new Error("Video generation timed out after 4.5 minutes");
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, propertyId } = (await req.json()) as {
      prompt: string;
      propertyId?: string;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const property = propertyId ? getPropertyById(propertyId) : null;
    const rawPrompt = buildBasePrompt(prompt.trim(), property);
    const veoPrompt = await enhancePrompt(rawPrompt);

    const operationName = await startVeoGeneration(veoPrompt, apiKey);
    const videoDataUrl = await pollForVideo(operationName, apiKey);

    return NextResponse.json({ videoDataUrl, veoPrompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[tour/generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
