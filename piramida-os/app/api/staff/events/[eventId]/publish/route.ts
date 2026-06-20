import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "@/lib/auth/guards";
import { publishEvent } from "@/lib/services/publications";
import { getEvent } from "@/lib/services/events";

const body = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  publicTitle: z.string().min(1).max(200).optional(),
  registrationOpen: z.boolean().optional(),
}).optional();

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    const event = await getEvent(eventId);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const raw = await req.json().catch(() => ({}));
    const parsed = body.safeParse(raw);

    const slug = parsed.data?.slug ?? event.code.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const publicTitle = parsed.data?.publicTitle ?? event.title;

    const result = await publishEvent({
      eventId,
      slug,
      publicTitle,
      registrationOpen: parsed.data?.registrationOpen ?? true,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[publish POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
