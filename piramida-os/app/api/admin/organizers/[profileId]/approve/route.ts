import { approveOrganizer } from "@/lib/services/organizers";
import { ok, handleApiError } from "@/lib/api/respond";

export async function POST(_req: Request, { params }: { params: Promise<{ profileId: string }> }) {
  try {
    const { profileId } = await params;
    const profile = await approveOrganizer(profileId);
    return ok(profile);
  } catch (err) {
    return handleApiError(err);
  }
}
