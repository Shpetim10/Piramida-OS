import { NextRequest } from "next/server";
import {
  submitOrganizerEventRequest,
  listEventRequests,
} from "@/lib/services/event-requests";
import { getCurrentProfile } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile?.contactId) {
      return ok([]);
    }
    const orgId = await getOrgId();
    const requests = await prisma.eventRequest.findMany({
      where: {
        orgId,
        deletedAt: null,
        contactId: profile.contactId,
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(requests);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = await submitOrganizerEventRequest(body);
    return ok(request, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
