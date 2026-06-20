import { NextRequest } from "next/server";
import { listPublishedEvents } from "@/lib/services/publications";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const upcomingOnly = searchParams.get("upcoming") !== "false";
    const events = await listPublishedEvents({ upcomingOnly });
    return ok(events);
  } catch (err) {
    return handleApiError(err);
  }
}

export const dynamic = "force-dynamic";
