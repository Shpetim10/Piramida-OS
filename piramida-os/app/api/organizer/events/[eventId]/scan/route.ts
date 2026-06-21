import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handleApiError } from "@/lib/api/respond";
import { scanOrganizerTicket } from "@/lib/organizer/event-management";

const scanSchema = z.object({
  token: z.string().trim().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const body = await req.json();
    const { token } = scanSchema.parse(body);
    const result = await scanOrganizerTicket(eventId, token);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
