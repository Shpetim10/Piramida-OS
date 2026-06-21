import { ok, handleApiError } from "@/lib/api/respond";
import { getCurrentProfile } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return ok(null, 401);
    const full = await prisma.profile.findUnique({
      where: { id: profile.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        type: true,
        status: true,
        profileRoles: { select: { role: { select: { code: true, label: true } } } },
      },
    });
    return ok(full);
  } catch (err) {
    return handleApiError(err);
  }
}
