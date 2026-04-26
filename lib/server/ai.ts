import { DEMO_PROPERTIES } from "@/lib/demo-properties";
import { SearchFilters, SearchIntent } from "@/types/search";
import { BuyerPreferences } from "@/types/user";

const KNOWN_LOCATIONS = Array.from(
  new Set(
    DEMO_PROPERTIES.flatMap((property) => [
      property.location.neighborhood,
      property.location.city,
      `${property.location.city}, ${property.location.state}`,
    ])
  )
);

const MUST_HAVE_HINTS = [
  "pool",
  "garage",
  "backyard",
  "updated kitchen",
  "home office",
  "ev charging",
  "solar",
  "adu",
  "guest suite",
  "mountain views",
  "ocean views",
  "no hoa",
  "walkable",
  "modern",
  "renovated",
  "new build",
  "views",
];

function parseBudget(text: string) {
  const underMatch = text.match(/(?:under|below|max(?:imum)? of?)\s*\$?([\d.,]+)\s*(m|k)?/i);
  if (underMatch) {
    return parseMoney(underMatch[1], underMatch[2]);
  }

  const betweenMatch = text.match(/\$?([\d.,]+)\s*(m|k)?\s*(?:to|-)\s*\$?([\d.,]+)\s*(m|k)?/i);
  if (betweenMatch) {
    return {
      minPrice: parseMoney(betweenMatch[1], betweenMatch[2]),
      maxPrice: parseMoney(betweenMatch[3], betweenMatch[4]),
    };
  }

  return null;
}

function parseMoney(value: string, suffix?: string) {
  const normalized = Number(value.replace(/,/g, ""));
  if (Number.isNaN(normalized)) return undefined;
  if (suffix?.toLowerCase() === "m") return Math.round(normalized * 1_000_000);
  if (suffix?.toLowerCase() === "k") return Math.round(normalized * 1_000);
  return Math.round(normalized);
}

function mergeDefined<T extends object>(base: T, extra: Partial<T>) {
  const merged = { ...base } as T;
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

function inferIntentFallback(query: string, userPreferences?: Partial<BuyerPreferences>): SearchIntent {
  const baseFilters: SearchFilters = {
    listingType: userPreferences?.listingType ?? "for_sale",
    minPrice: userPreferences?.minPrice,
    maxPrice: userPreferences?.maxPrice,
    minBeds: userPreferences?.minBeds,
    minBaths: userPreferences?.minBaths,
    propertyTypes: userPreferences?.propertyTypes,
    targetNeighborhoods: userPreferences?.targetNeighborhoods ?? [],
    mustHaves: userPreferences?.mustHaves ?? [],
    queryText: query,
    keywords: [],
  };

  const lower = query.toLowerCase();
  const budget = parseBudget(lower);
  if (budget && typeof budget === "number") {
    baseFilters.maxPrice = budget;
  } else if (budget && typeof budget === "object") {
    baseFilters.minPrice = budget.minPrice;
    baseFilters.maxPrice = budget.maxPrice;
  }

  const bedsMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:bed|bedroom|bd)/i);
  if (bedsMatch) baseFilters.minBeds = Math.floor(Number(bedsMatch[1]));

  const bathsMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:bath|bathroom|ba)/i);
  if (bathsMatch) baseFilters.minBaths = Number(bathsMatch[1]);

  if (/(rent|rental|lease)/i.test(lower)) baseFilters.listingType = "for_rent";
  if (/(buy|sale|house)/i.test(lower)) baseFilters.listingType = "for_sale";

  const propertyTypes: SearchFilters["propertyTypes"] = [];
  if (lower.includes("condo")) propertyTypes.push("condo");
  if (lower.includes("townhouse") || lower.includes("townhome")) propertyTypes.push("townhouse");
  if (lower.includes("multi-family") || lower.includes("duplex")) propertyTypes.push("multi_family");
  if (lower.includes("house") || lower.includes("single family")) propertyTypes.push("single_family");
  if (propertyTypes.length > 0) baseFilters.propertyTypes = propertyTypes;

  const matchedLocations = KNOWN_LOCATIONS.filter((location) => lower.includes(location.toLowerCase()));
  if (matchedLocations.length > 0) {
    baseFilters.targetNeighborhoods = matchedLocations;
  }

  const mustHaves = MUST_HAVE_HINTS.filter((hint) => lower.includes(hint));
  if (mustHaves.length > 0) {
    baseFilters.mustHaves = Array.from(new Set([...(baseFilters.mustHaves ?? []), ...mustHaves]));
  }

  const keywords = lower
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3)
    .filter((token) => !["under", "with", "near", "home", "homes", "sale", "rent"].includes(token));
  baseFilters.keywords = Array.from(new Set(keywords)).slice(0, 8);

  const summaryParts = [
    baseFilters.listingType === "for_rent" ? "Rentals" : "Homes for sale",
    baseFilters.targetNeighborhoods?.length ? `in ${baseFilters.targetNeighborhoods.join(", ")}` : undefined,
    baseFilters.maxPrice ? `under $${baseFilters.maxPrice.toLocaleString()}` : undefined,
    baseFilters.minBeds ? `${baseFilters.minBeds}+ beds` : undefined,
    baseFilters.mustHaves?.length ? `with ${baseFilters.mustHaves.slice(0, 2).join(" and ")}` : undefined,
  ].filter(Boolean);

  return {
    query,
    summary: summaryParts.join(" ") || "Homes matched to your criteria",
    filters: baseFilters,
    clarifications: [],
  };
}

async function parseJsonResponse<T>(value: string): Promise<T | null> {
  try {
    return JSON.parse(value) as T;
  } catch {
    const fenced = value.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? value;
    try {
      return JSON.parse(fenced) as T;
    } catch {
      return null;
    }
  }
}

async function callGeminiJson<T>(prompt: string): Promise<T | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? "gemini-2.0-flash"}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
    return parseJsonResponse<T>(text);
  } catch {
    return null;
  }
}

async function callOpenAIJson<T>(prompt: string): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseJsonResponse<T>(data.choices?.[0]?.message?.content ?? "");
  } catch {
    return null;
  }
}

export async function generateOpenAIJson<T>(input: {
  prompt: string;
  systemPrompt?: string;
}): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          ...(input.systemPrompt
            ? [{ role: "system", content: input.systemPrompt }]
            : []),
          { role: "user", content: input.prompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseJsonResponse<T>(data.choices?.[0]?.message?.content ?? "");
  } catch {
    return null;
  }
}

async function callGeminiText(prompt: string, systemPrompt?: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? "gemini-2.0-flash"}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? null;
  } catch {
    return null;
  }
}

async function callOpenAIText(prompt: string, systemPrompt?: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt },
        ],
        max_tokens: 700,
        temperature: 0.6,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export async function generateOpenAIText(input: {
  prompt: string;
  systemPrompt?: string;
}): Promise<string | null> {
  return callOpenAIText(input.prompt, input.systemPrompt);
}

export async function generateSearchIntent(query: string, userPreferences?: Partial<BuyerPreferences>): Promise<SearchIntent> {
  const fallback = inferIntentFallback(query, userPreferences);
  const prompt = `You convert home-search requests into structured JSON.
Return only JSON with this shape:
{
  "summary": string,
  "filters": {
    "listingType": "for_sale" | "for_rent",
    "minPrice": number | null,
    "maxPrice": number | null,
    "minBeds": number | null,
    "minBaths": number | null,
    "propertyTypes": string[],
    "targetNeighborhoods": string[],
    "mustHaves": string[],
    "keywords": string[]
  },
  "clarifications": string[]
}
Known neighborhoods/cities: ${KNOWN_LOCATIONS.join(", ")}
User preferences: ${JSON.stringify(userPreferences ?? {})}
Query: ${query}`;

  const parsed =
    (await callGeminiJson<{ summary?: string; filters?: SearchFilters; clarifications?: string[] }>(prompt)) ??
    (await callOpenAIJson<{ summary?: string; filters?: SearchFilters; clarifications?: string[] }>(prompt));

  if (!parsed?.filters) return fallback;

  return {
    query,
    summary: parsed.summary?.trim() || fallback.summary,
    filters: mergeDefined(fallback.filters, parsed.filters),
    clarifications: parsed.clarifications ?? [],
  };
}

export async function generateNarrative(input: {
  prompt: string;
  systemPrompt?: string;
  fallback: string;
}) {
  return (
    (await callGeminiText(input.prompt, input.systemPrompt)) ??
    (await callOpenAIText(input.prompt, input.systemPrompt)) ??
    input.fallback
  );
}
