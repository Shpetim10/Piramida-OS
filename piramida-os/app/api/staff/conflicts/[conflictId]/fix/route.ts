import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "@/lib/auth/guards";
import { applyConflictSuggestion } from "@/lib/services/conflicts";
import { explainConflict } from "@/lib/ai/explainer";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { getLaunchReadiness } from "@/lib/services/launch-readiness";

const body = z.object({ suggestionId: z.string().uuid() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ conflictId: string }> }) {
  const { conflictId } = await params;
  try {
    const parsed = body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "suggestionId (UUID) required" }, { status: 400 });

    const updated = await applyConflictSuggestion(conflictId, parsed.data.suggestionId);

    // Fetch conflict detail for AI explanation (non-blocking).
    const orgId = await getOrgId();
    const conflict = await prisma.conflict.findFirst({
      where: { id: conflictId, orgId },
      include: { suggestions: { where: { id: parsed.data.suggestionId } } },
    });
    const explanation = conflict
      ? await explainConflict({
          type: conflict.type,
          severity: conflict.severity,
          title: conflict.title,
          detail: (conflict.detail ?? {}) as Record<string, unknown>,
          suggestionLabel: conflict.suggestions[0]?.label,
        })
      : null;

    const readiness = await getLaunchReadiness(updated.eventId).catch(() => null);
    return NextResponse.json({ conflict: updated, explanation, readiness });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[conflict fix POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
