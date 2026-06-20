import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";

// Append-only audit trail. Normal app flows only ever CREATE rows here — there
// is no update/delete path (CLAUDE.md security checklist). Every important state
// transition routes through createAuditLog so the timeline is reconstructable.

export interface AuditInput {
  actorProfileId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  summary?: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  /** Pass a transaction client so the audit row commits atomically with the change. */
  tx?: Prisma.TransactionClient;
}

export async function createAuditLog(input: AuditInput) {
  const db = input.tx ?? prisma;
  const orgId = await getOrgId();
  return db.auditLog.create({
    data: {
      orgId,
      actorProfileId: input.actorProfileId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      before: input.before === null ? Prisma.JsonNull : input.before,
      after: input.after === null ? Prisma.JsonNull : input.after,
    },
  });
}

/** Audit history for one event (rows whose entity is the event itself). */
export async function listAuditLogsByEvent(eventId: string) {
  const orgId = await getOrgId();
  return prisma.auditLog.findMany({
    where: { orgId, entityType: "Event", entityId: eventId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAuditLogsByEntity(entityType: string, entityId: string) {
  const orgId = await getOrgId();
  return prisma.auditLog.findMany({
    where: { orgId, entityType, entityId },
    orderBy: { createdAt: "desc" },
  });
}
