import { NextRequest, NextResponse } from "next/server";
import { searchListings } from "@/lib/server/listings";
import { SearchFilters } from "@/types/search";

export const runtime = "nodejs";

interface SearchRequest {
  query?: string;
  summary?: string;
  filters?: SearchFilters;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SearchRequest;
  const response = await searchListings({
    query: body.query,
    summary: body.summary,
    filters: body.filters ?? {},
  });
  return NextResponse.json(response);
}
