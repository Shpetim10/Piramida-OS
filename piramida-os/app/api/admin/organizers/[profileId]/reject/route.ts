import { rejectOrganizer } from "@/lib/services/organizers";
import { ok, handleApiError } from "@/lib/api/respond";

export async function POST(req: Request, { params }: { params: Promise<{ profileId: string }> }) {
  try {
    const { profileId } = await params;
    const body = await req.json();
    const reason: string = body.reason ?? "No reason provided";
    const profile = await rejectOrganizer(profileId, reason);
    return ok(profile);
  } catch (err) {
    return handleApiError(err);
  }
}
