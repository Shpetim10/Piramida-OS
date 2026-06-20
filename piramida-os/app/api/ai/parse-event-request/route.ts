import { NextRequest, NextResponse } from "next/server";
import { EventRequestStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { createHash } from "node:crypto";
import { AuthError, requirePermission } from "@/lib/auth/guards";
import { getOrgId } from "@/lib/db/org";
import { prisma } from "@/lib/db/prisma";
import { parseWithGemini } from "@/lib/ai/intake";
import { createAuditLog } from "@/lib/audit/log";

const bodySchema = z
  .object({
    requestId: z.string().uuid().optional(),
    rawText: z.string().trim().min(1).max(20000).optional(),
  })
  .refine((data) => data.requestId || data.rawText, {
    message: "requestId or rawText required",
  });

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    const actor = await requirePermission("requests.review");
    const orgId = await getOrgId();
    const request = parsed.data.requestId
      ? await prisma.eventRequest.findFirst({
          where: { id: parsed.data.requestId, orgId, deletedAt: null },
        })
      : null;

    if (parsed.data.requestId && !request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const inputText = request?.rawText ?? parsed.data.rawText ?? "";
    const result = await parseWithGemini(inputText);

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const updated = request
        ? await tx.eventRequest.update({
            where: { id: request.id },
            data: {
              extractedJson: result.extraction as unknown as Prisma.InputJsonValue,
              confidence: result.extraction.confidence,
              missingFields: result.extraction.missingFields,
              status: request.status === EventRequestStatus.RECEIVED ? EventRequestStatus.PARSED : request.status,
            },
          })
        : null;

      await tx.aiRun.create({
        data: {
          orgId,
          eventRequestId: request?.id,
          promptType: "event_intake",
          model: result.model,
          inputHash: createHash("sha256").update(inputText).digest("hex"),
          latencyMs: result.latencyMs,
          validationPassed: result.validationPassed,
          outputRef: result.extraction as unknown as Prisma.InputJsonValue,
        },
      });

      if (request) {
        await createAuditLog({
          tx,
          actorProfileId: actor.id,
          action: "AI_RUN",
          entityType: "EventRequest",
          entityId: request.id,
          summary: `Parsed with ${result.model} (confidence ${Math.round(result.extraction.confidence * 100)}%)`,
          after: result.extraction as unknown as Prisma.InputJsonValue,
        });
      }

      return updated;
    });

    return NextResponse.json({
      intake: result.extraction,
      extraction: result.extraction,
      request: updatedRequest,
      model: result.model,
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[parse-event-request POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
