import { getPublishedEventBySlug } from "@/lib/services/publications";
import { AuthError } from "@/lib/auth/guards";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const event = await getPublishedEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(event);
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
