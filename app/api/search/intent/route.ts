import { NextRequest, NextResponse } from "next/server";
import { generateSearchIntent } from "@/lib/server/ai";
import { BuyerPreferences } from "@/types/user";

export const runtime = "nodejs";

interface IntentRequest {
  query: string;
  userPreferences?: Partial<BuyerPreferences>;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as IntentRequest;
  if (!body.query?.trim()) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const intent = await generateSearchIntent(body.query.trim(), body.userPreferences);
  return NextResponse.json(intent);
}
