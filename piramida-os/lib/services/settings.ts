import { SettingValueType } from "@prisma/client";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import { requirePermission } from "../auth/guards";
import { updateAppSettingInput } from "../validation/schemas";

// Typed key/value app settings (venue, timezone, currency, reservation buffers,
// demo mode). Values are stored as strings tagged with a SettingValueType and
// parsed back on read.

function parseValue(value: string, type: SettingValueType): unknown {
  switch (type) {
    case "NUMBER":
      return Number(value);
    case "BOOLEAN":
      return value === "true";
    case "JSON":
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    default:
      return value;
  }
}

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const orgId = await getOrgId();
  const row = await prisma.appSetting.findUnique({ where: { orgId_key: { orgId, key } } });
  if (!row) return null;
  return parseValue(row.value, row.valueType) as T;
}

export async function listSettings(opts?: { publicOnly?: boolean }) {
  const orgId = await getOrgId();
  const rows = await prisma.appSetting.findMany({
    where: { orgId, ...(opts?.publicOnly ? { isPublic: true } : {}) },
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });
  // Never leak secret values to callers.
  return rows.map((r) => ({
    key: r.key,
    value: r.isSecret ? null : parseValue(r.value, r.valueType),
    valueType: r.valueType,
    group: r.group,
    label: r.label,
    isSecret: r.isSecret,
    isPublic: r.isPublic,
    isEditable: r.isEditable,
  }));
}

export async function setSetting(input: unknown) {
  const actor = await requirePermission("settings.manage");
  const data = updateAppSettingInput.parse(input);
  const orgId = await getOrgId();

  const before = await prisma.appSetting.findUnique({ where: { orgId_key: { orgId, key: data.key } } });
  if (before && before.isEditable === false) {
    throw new Error(`Setting ${data.key} is managed by code and not editable`);
  }

  const row = await prisma.appSetting.upsert({
    where: { orgId_key: { orgId, key: data.key } },
    update: {
      value: data.value,
      valueType: data.valueType ?? before?.valueType ?? SettingValueType.STRING,
      group: data.group,
      label: data.label,
      description: data.description,
      isSecret: data.isSecret,
      isPublic: data.isPublic,
      updatedById: actor.id,
    },
    create: {
      orgId,
      key: data.key,
      value: data.value,
      valueType: data.valueType ?? SettingValueType.STRING,
      group: data.group,
      label: data.label,
      description: data.description,
      isSecret: data.isSecret ?? false,
      isPublic: data.isPublic ?? false,
      updatedById: actor.id,
    },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "AppSetting",
    entityId: row.id,
    summary: `Set ${data.key}`,
    before: before ? { value: before.isSecret ? "***" : before.value } : null,
    after: { value: row.isSecret ? "***" : row.value },
  });
  return row;
}
