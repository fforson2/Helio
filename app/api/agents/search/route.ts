import { NextRequest, NextResponse } from "next/server";

type AgentId = "zillow" | "redfin" | "realtor";

const SITE_MAP: Record<AgentId, { name: string; domain: string }> = {
  zillow: { name: "Zillow", domain: "zillow.com" },
  redfin: { name: "Redfin", domain: "redfin.com" },
  realtor: { name: "Realtor.com", domain: "realtor.com" },
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { location, agent } = body as { location: string; agent: string };

  if (!location?.trim() || !SITE_MAP[agent as AgentId]) {
    return NextResponse.json(
      { error: "Provide a location and valid agent (zillow, redfin, realtor)." },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const site = SITE_MAP[agent as AgentId];

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        input: `You are a real estate search agent. Search ${site.domain} for real estate listings at or near "${location}".

Find current property listings on ${site.name}. For each listing, extract:
- address
- price
- bedrooms count
- bathrooms count
- square footage
- a one-line description
- the direct URL on ${site.domain}

Also provide the general ${site.name} search URL for this location.

Return ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "summary": "Brief summary of what was found",
  "searchUrl": "https://www.${site.domain}/...",
  "listings": [
    {
      "address": "Full address",
      "price": "$XXX,XXX",
      "beds": 3,
      "baths": 2,
      "sqft": "1,500",
      "url": "https://www.${site.domain}/...",
      "description": "Brief description"
    }
  ]
}

Return up to 5 listings. If you cannot find exact listings, provide the search URL and a helpful summary.`,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`OpenAI API error (${res.status}):`, errorText);
      return NextResponse.json({ error: "Failed to search. Please try again." }, { status: 502 });
    }

    const data = await res.json();

    let text = "";
    for (const item of data.output ?? []) {
      if (item.type === "message") {
        for (const content of item.content ?? []) {
          if (content.type === "output_text") {
            text += content.text;
          }
        }
      }
    }

    let result = parseAgentJson(text);

    return NextResponse.json({
      agent,
      summary: result?.summary ?? "Search complete.",
      searchUrl: result?.searchUrl ?? "",
      listings: Array.isArray(result?.listings) ? result.listings : [],
    });
  } catch (err) {
    console.error("Agent search error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function parseAgentJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch { /* fall through */ }
    }
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch { /* fall through */ }
    }
    return null;
  }
}
