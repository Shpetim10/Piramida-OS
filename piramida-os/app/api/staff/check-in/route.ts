import { NextRequest } from "next/server";
import { checkInTicket } from "@/lib/services/publications";
import { getCurrentProfile } from "@/lib/auth/guards";
import { ok, handleApiError } from "@/lib/api/respond";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profile = await getCurrentProfile();
    const result = await checkInTicket(body.token, profile?.id ?? undefined);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
