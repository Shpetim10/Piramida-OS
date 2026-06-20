import { NextRequest } from "next/server";
import {
  listEventRequests,
  submitOrganizerEventRequest,
  createStaffEventRequest,
} from "@/lib/services/event-requests";
import { getCurrentProfile } from "@/lib/auth/guards";
import { ok, handleApiError } from "@/lib/api/respond";
import { ProfileType } from "@prisma/client";

export async function GET() {
  try {
    const requests = await listEventRequests();
    return ok(requests);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profile = await getCurrentProfile();

    let request;
    if (profile?.type === ProfileType.ORGANIZER) {
      request = await submitOrganizerEventRequest(body);
    } else {
      request = await createStaffEventRequest(body);
    }
    return ok(request, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
