import { NextRequest, NextResponse } from "next/server";
import { getPropertyContext } from "@/lib/server/listings";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = getPropertyContext(id);
  if (!context) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  return NextResponse.json(context);
}
