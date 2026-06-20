import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/guards";
import { generateEventPlan, scoreSpaces, computeDNAScores } from "@/lib/services/planning";
import { getEvent } from "@/lib/services/events";
import { detectAssetShortages } from "@/lib/services/reservations";
import { listConflicts } from "@/lib/services/conflicts";

function authErrorResponse(err: AuthError) {
  return NextResponse.json({ error: err.message }, { status: err.status });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    const [event, spaceScores, conflicts, shortages] = await Promise.all([
      getEvent(eventId),
      scoreSpaces(eventId),
      listConflicts(eventId),
      detectAssetShortages(eventId),
    ]);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const dnaScores = await computeDNAScores(event.requirements);

    return NextResponse.json({
      event,
      spaceScores,
      conflicts,
      shortages,
      dnaScores,
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error("[plan GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    const result = await generateEventPlan(eventId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error("[plan POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
