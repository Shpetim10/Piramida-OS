import { NextRequest } from "next/server";
import { publishEvent } from "@/lib/services/publications";
import { ok, handleApiError } from "@/lib/api/respond";

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const body = await req.json();
    const publication = await publishEvent({ eventId, ...body });
    return ok(publication);
  } catch (err) {
    return handleApiError(err);
  }
}
