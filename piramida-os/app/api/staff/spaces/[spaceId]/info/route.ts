import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/guards";
import { getSpaceInfo } from "@/lib/services/planning";

export async function GET(req: NextRequest, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
  try {
    return NextResponse.json(await getSpaceInfo({ eventId, spaceId }));
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[space info GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
