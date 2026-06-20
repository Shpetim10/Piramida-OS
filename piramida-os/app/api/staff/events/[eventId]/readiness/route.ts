import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/guards";
import { getLaunchReadiness } from "@/lib/services/launch-readiness";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    const result = await getLaunchReadiness(eventId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[readiness GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
