import { NextRequest } from "next/server";
import { getPublishedEventBySlug } from "@/lib/services/publications";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getPublishedEventBySlug(slug);
    return ok(event);
  } catch (err) {
    return handleApiError(err);
  }
}
