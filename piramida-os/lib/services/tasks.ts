import { TaskStatus, TaskPriority, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import { requirePermission, AuthError } from "../auth/guards";
import { createTaskInput } from "../validation/schemas";
import { uuid } from "../validation/common";
import { assertTransition, TASK_TRANSITIONS } from "./state-machines";

// Operational tasks + dependencies. generateDefaultEventTasks seeds the standard
// run-of-show task groups for an event so staff start from a checklist instead
// of a blank page.

export async function listTasks(eventId: string) {
  await requirePermission("tasks.manage");
  uuid.parse(eventId);
  const orgId = await getOrgId();
  return prisma.task.findMany({
    where: { orgId, eventId, deletedAt: null },
    include: { dependencies: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

export async function createTask(input: unknown) {
  const actor = await requirePermission("tasks.manage");
  const data = createTaskInput.parse(input);
  const orgId = await getOrgId();
  const task = await prisma.task.create({ data: { orgId, ...data } });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "Task",
    entityId: task.id,
    summary: `Created task ${task.title}`,
  });
  return task;
}

export async function updateTask(id: string, input: unknown) {
  await requirePermission("tasks.manage");
  uuid.parse(id);
  const data = createTaskInput.partial().parse(input);
  return prisma.task.update({ where: { id }, data: data as Prisma.TaskUpdateInput });
}

export async function assignTask(taskId: string, profileId: string) {
  const actor = await requirePermission("tasks.manage");
  uuid.parse(taskId);
  uuid.parse(profileId);
  const task = await prisma.task.update({ where: { id: taskId }, data: { assignedToProfileId: profileId } });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "Task",
    entityId: taskId,
    summary: `Assigned task to ${profileId}`,
  });
  return task;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const actor = await requirePermission("tasks.manage");
  uuid.parse(taskId);
  const orgId = await getOrgId();
  const existing = await prisma.task.findFirst({ where: { id: taskId, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Task not found", 404);
  assertTransition("Task", TASK_TRANSITIONS, existing.status, status);
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      startedAt: status === TaskStatus.IN_PROGRESS && !existing.startedAt ? new Date() : existing.startedAt,
      completedAt: status === TaskStatus.DONE ? new Date() : null,
    },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "STATUS_CHANGE",
    entityType: "Task",
    entityId: taskId,
    summary: `Task ${existing.status} -> ${status}`,
  });
  return task;
}

export async function cancelTask(taskId: string) {
  return updateTaskStatus(taskId, TaskStatus.CANCELLED);
}

const taskDependencyInput = z.object({ taskId: uuid, dependsOnTaskId: uuid });

export async function addTaskDependency(input: unknown) {
  await requirePermission("tasks.manage");
  const data = taskDependencyInput.parse(input);
  if (data.taskId === data.dependsOnTaskId) throw new AuthError("A task cannot depend on itself", 403);
  const orgId = await getOrgId();
  return prisma.taskDependency.create({
    data: { orgId, taskId: data.taskId, dependsOnTaskId: data.dependsOnTaskId },
  });
}

export async function removeTaskDependency(id: string) {
  await requirePermission("tasks.manage");
  uuid.parse(id);
  return prisma.taskDependency.delete({ where: { id } });
}

const DEFAULT_TASK_GROUPS: Array<{ title: string; description: string; priority: TaskPriority }> = [
  { title: "Setup — room layout & furniture", description: "Lay out chairs, tables and stage per plan.", priority: TaskPriority.HIGH },
  { title: "AV — mics, screen, projector, speakers", description: "Install and sound-check AV equipment.", priority: TaskPriority.HIGH },
  { title: "Registration — desk & QR scanning", description: "Set up registration desk and check-in scanners.", priority: TaskPriority.MEDIUM },
  { title: "Cleaning — pre-event", description: "Clean and prepare all guest-facing spaces.", priority: TaskPriority.MEDIUM },
  { title: "Security — entrances & flow", description: "Brief security on guest flow and entrances.", priority: TaskPriority.MEDIUM },
  { title: "Teardown — strike the room", description: "Break down setup after the event ends.", priority: TaskPriority.MEDIUM },
  { title: "Return equipment to storage", description: "Return and inspect all reserved assets.", priority: TaskPriority.LOW },
];

/** Seed the standard run-of-show task groups for an event (idempotent by title). */
export async function generateDefaultEventTasks(eventId: string) {
  const actor = await requirePermission("tasks.manage");
  uuid.parse(eventId);
  const orgId = await getOrgId();
  const event = await prisma.event.findFirst({ where: { id: eventId, orgId, deletedAt: null } });
  if (!event) throw new AuthError("Event not found", 404);

  const existing = await prisma.task.findMany({
    where: { orgId, eventId, source: "default", deletedAt: null },
    select: { title: true },
  });
  const have = new Set(existing.map((t) => t.title));
  const toCreate = DEFAULT_TASK_GROUPS.filter((g) => !have.has(g.title));

  if (toCreate.length) {
    await prisma.task.createMany({
      data: toCreate.map((g) => ({
        orgId,
        eventId,
        title: g.title,
        description: g.description,
        priority: g.priority,
        source: "default",
      })),
    });
    await createAuditLog({
      actorProfileId: actor.id,
      action: "CREATE",
      entityType: "Event",
      entityId: eventId,
      summary: `Generated ${toCreate.length} default task(s)`,
    });
  }
  return listTasks(eventId);
}
