import { NextRequest } from "next/server";
import { registerGuest } from "@/lib/services/publications";
import { prisma } from "@/lib/db/prisma";
import { ok, handleApiError } from "@/lib/api/respond";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await req.json();

    const publication = await prisma.eventPublication.findFirst({
      where: { slug, status: "PUBLISHED", deletedAt: null },
      select: { id: true },
    });
    if (!publication) {
      return ok({ error: "Event not found" }, 404);
    }

    const result = await registerGuest({ ...body, publicationId: publication.id });
    return ok(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
