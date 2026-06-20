import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "@/lib/auth/guards";
import { parseEventRequestWithAI } from "@/lib/services/event-requests";
import { parseWithGemini } from "@/lib/ai/intake";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { requirePermission } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit/log";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

const body = z.object({ requestId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const parsed = body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "requestId (UUID) required" }, { status: 400 });

    const { requestId } = parsed.data;
    const actor = await requirePermission("requests.review");
    const orgId = await getOrgId();

    const request = await prisma.eventRequest.findFirst({ where: { id: requestId, orgId, deletedAt: null } });
    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    // Use Gemini (with deterministic fallback).
    const result = await parseWithGemini(request.rawText);

    // Persist extraction + ai_run + status update.
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.eventRequest.update({
        where: { id: requestId },
        data: {
          extractedJson: result.extraction as unknown as Prisma.InputJsonValue,
          confidence: result.extraction.confidence,
          missingFields: result.extraction.missingFields,
          status: "PARSED",
        },
      });
      await tx.aiRun.create({
        data: {
          orgId,
          eventRequestId: requestId,
          promptType: "event_intake",
          model: result.model,
          inputHash: createHash("sha256").update(request.rawText).digest("hex"),
          latencyMs: result.latencyMs,
          validationPassed: result.validationPassed,
          outputRef: result.extraction as unknown as Prisma.InputJsonValue,
        },
      });
      await createAuditLog({
        tx,
        actorProfileId: actor.id,
        action: "AI_RUN",
        entityType: "EventRequest",
        entityId: requestId,
          summary: `Parsed with ${result.model} (confidence ${Math.round(result.extraction.confidence * 100)}%)`,
        after: result.extraction as unknown as Prisma.InputJsonValue,
      });
      return u;
    });

    return NextResponse.json({ request: updated, intake: result.extraction, extraction: result.extraction, model: result.model });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[parse-request POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Convenience: also support the existing deterministic path directly.
export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("requestId");
  if (!requestId) return NextResponse.json({ error: "requestId required" }, { status: 400 });
  try {
    const result = await parseEventRequestWithAI(requestId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
