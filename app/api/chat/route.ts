import { NextRequest, NextResponse } from "next/server";
import { Property } from "@/types/property";
import { BuyerPreferences } from "@/types/user";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  context: {
    properties: Property[];
    savedProperties: Property[];
    userPreferences?: Partial<BuyerPreferences>;
    userName?: string;
  };
}

function buildSystemPrompt(context: ChatRequest["context"]): string {
  const { properties, savedProperties, userPreferences, userName } = context;

  const propertyList = properties
    .map(
      (p) =>
        `- ${p.location.address}, ${p.location.neighborhood}: ${p.price.toLocaleString()} (${p.details.beds}bd/${p.details.baths}ba, ${p.details.sqft}sqft, ${p.daysOnMarket}d on market, Deal Score: ${p.dealScore?.total ?? "N/A"}/100 - ${p.dealScore?.label ?? "Unscored"})`
    )
    .join("\n");

  const savedList =
    savedProperties.length > 0
      ? savedProperties
          .map((p) => `- ${p.location.address}: Deal Score ${p.dealScore?.total ?? "N/A"} (${p.dealScore?.label ?? ""})`)
          .join("\n")
      : "None saved yet";

  const prefs = userPreferences
    ? `Budget: $${userPreferences.minPrice?.toLocaleString() ?? "any"} - $${userPreferences.maxPrice?.toLocaleString() ?? "any"}, Min beds: ${userPreferences.minBeds ?? "any"}, Locations: ${userPreferences.targetNeighborhoods?.join(", ") || "anywhere in the U.S."}, Must-haves: ${userPreferences.mustHaves?.join(", ") || "none specified"}`
    : "No preferences set";

  return `You are Helio AI, an expert real estate assistant covering the U.S. housing market. You have full context of the user's property search and preferences.

USER: ${userName ?? "Buyer"}
PREFERENCES: ${prefs}

PROPERTIES IN SEARCH (${properties.length} total):
${propertyList}

SAVED / SHORTLISTED:
${savedList}

Your role:
- Provide sharp, specific property insights based on actual data (price vs AVM, days on market, school ratings, risk factors)
- Give honest recommendations — if a property is overpriced or risky, say so clearly
- Reference specific addresses and numbers when answering
- Be concise and direct — no fluff, no generic advice
- Use the Deal Score breakdown to explain value: Value (30%), Location (25%), Condition (20%), Momentum (15%), Risk (10%)
- When comparing, surface the clearest differentiation signals
- Help the user think like a savvy buyer, not just a browser

Do not: make up data not in the context, give legal advice, promise specific returns, or be evasive.
Respond in a conversational but expert tone. Keep answers under 300 words unless detail is explicitly requested.`;
}

export async function POST(req: NextRequest) {
  const body: ChatRequest = await req.json();
  const { messages, context } = body;

  const systemPrompt = buildSystemPrompt(context);
  const formattedMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  // Try Groq first (faster, cheaper), fall back to OpenAI
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: formattedMessages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const message = data.choices[0]?.message?.content ?? "I couldn't generate a response.";
        return NextResponse.json({ message });
      }
    } catch {
      // Fall through to OpenAI
    }
  }

  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          messages: formattedMessages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const message = data.choices[0]?.message?.content ?? "I couldn't generate a response.";
        return NextResponse.json({ message });
      }
    } catch {
      // Fall through
    }
  }

  // No API keys — return a helpful demo response
  const demoResponses: Record<string, string> = {
    default: `Great question! To unlock AI-powered responses, add your GROQ_API_KEY or OPENAI_API_KEY to .env.local.

In the meantime, here's what I can see in your search:
${context.properties.slice(0, 3).map((p) => `• ${p.location.address} (${p.location.neighborhood}): $${p.price.toLocaleString()} · Deal Score ${p.dealScore?.total ?? "N/A"} — ${p.dealScore?.label ?? ""}`).join("\n")}

The highest Deal Score is **${Math.max(...context.properties.map((p) => p.dealScore?.total ?? 0))}** — that's your strongest candidate based on value, location, condition, market momentum, and risk.`,
  };

  return NextResponse.json({
    message: demoResponses.default,
  });
}
