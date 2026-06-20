import { NextRequest } from "next/server";
import { listEvents, createEvent } from "@/lib/services/events";
import { EventStatus } from "@prisma/client";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as EventStatus | null;
    const events = await listEvents(statusParam ? { status: statusParam } : undefined);
    return ok(events);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = await createEvent(body);
    return ok(event, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
