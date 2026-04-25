import { NextRequest, NextResponse } from "next/server";
import { getPropertiesByIds, getPropertyContext, getSearchSession } from "@/lib/server/listings";
import { generateNarrative } from "@/lib/server/ai";
import { BuyerPreferences } from "@/types/user";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  context: {
    searchSessionId?: string | null;
    selectedPropertyId?: string | null;
    savedPropertyIds?: string[];
    userPreferences?: Partial<BuyerPreferences>;
    userName?: string;
  };
}

function buildSystemPrompt(input: {
  userName?: string;
  userPreferences?: Partial<BuyerPreferences>;
  searchSummary: string;
  activeProperties: ReturnType<typeof getPropertiesByIds>;
  selectedContext: ReturnType<typeof getPropertyContext>;
  savedProperties: ReturnType<typeof getPropertiesByIds>;
}) {
  const propertyList = input.activeProperties
    .slice(0, 8)
    .map(
      (property) =>
        `- ${property.location.address}, ${property.location.neighborhood}: $${property.price.toLocaleString()} (${property.details.beds}bd/${property.details.baths}ba, ${property.details.sqft} sqft, Deal Score ${property.dealScore?.total ?? "N/A"}/100, DOM ${property.daysOnMarket})`
    )
    .join("\n");

  const savedList = input.savedProperties.length
    ? input.savedProperties
        .map(
          (property) =>
            `- ${property.location.address} (${property.location.neighborhood}) · Deal Score ${property.dealScore?.total ?? "N/A"}`
        )
        .join("\n")
    : "None saved yet";

  const prefs = input.userPreferences
    ? `Budget: $${input.userPreferences.minPrice?.toLocaleString() ?? "any"} - $${input.userPreferences.maxPrice?.toLocaleString() ?? "any"}, Beds: ${input.userPreferences.minBeds ?? "any"}+, Baths: ${input.userPreferences.minBaths ?? "any"}+, Locations: ${input.userPreferences.targetNeighborhoods?.join(", ") || "anywhere"}, Must-haves: ${input.userPreferences.mustHaves?.join(", ") || "none"}`
    : "No saved buyer preferences.";

  const selected = input.selectedContext
    ? `Focused property: ${input.selectedContext.property.location.address}\nNeighborhood: ${input.selectedContext.neighborhoodSummary}\nMarket position: ${input.selectedContext.marketPosition}`
    : "No focused property selected.";

  return `You are Helio AI, an expert real-estate search agent.

User: ${input.userName ?? "Buyer"}
Preferences: ${prefs}
Active search: ${input.searchSummary}

Active search results (${input.activeProperties.length}):
${propertyList || "No active listings."}

Saved shortlist:
${savedList}

${selected}

Rules:
- Ground every answer in the supplied search results and property context.
- Mention concrete addresses, numbers, risks, and neighborhood context when available.
- Be concise, direct, and useful.
- If asked for a recommendation, explain the trade-offs clearly.
- Do not invent facts beyond the provided context.`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatRequest;
  const { messages, context } = body;

  const searchSession = context.searchSessionId ? getSearchSession(context.searchSessionId) : null;
  const activeProperties = searchSession ? getPropertiesByIds(searchSession.propertyIds) : [];
  const savedProperties = getPropertiesByIds(context.savedPropertyIds ?? []);
  const selectedContext = context.selectedPropertyId ? getPropertyContext(context.selectedPropertyId) : null;

  const systemPrompt = buildSystemPrompt({
    userName: context.userName,
    userPreferences: context.userPreferences,
    searchSummary: searchSession?.summary ?? "Current property search",
    activeProperties,
    selectedContext,
    savedProperties,
  });

  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";

  const prompt = `${messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n")}

Respond to the latest user request: ${latestUserMessage}`;

  const fallback = activeProperties.length
    ? `Here are the strongest options in the current search:\n${activeProperties
        .slice(0, 3)
        .map(
          (property) =>
            `• ${property.location.address} — $${property.price.toLocaleString()} · Deal Score ${property.dealScore?.total ?? "N/A"} · ${property.location.neighborhood}`
        )
        .join("\n")}`
    : "I couldn't find active property context for that search yet. Try refreshing the search and ask again.";

  const message = await generateNarrative({
    systemPrompt,
    prompt,
    fallback,
  });

  return NextResponse.json({ message });
}
