import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { registerGuest } from "@/lib/services/publications";
import { AuthError } from "@/lib/auth/guards";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const orgId = await getOrgId();
    const pub = await prisma.eventPublication.findFirst({
      where: { slug, orgId, status: "PUBLISHED", deletedAt: null },
      select: { id: true },
    });
    if (!pub) return Response.json({ error: "Event not found" }, { status: 404 });

    const body = await req.json();
    const result = await registerGuest({ ...body, publicationId: pub.id });
    return Response.json(
      {
        status: result.registration.status,
        ticketToken: result.ticket?.token ?? null,
        emailSent: !!result.ticket,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    const msg = e instanceof Error ? e.message : "Invalid input";
    return Response.json({ error: msg }, { status: 400 });
  }
}
