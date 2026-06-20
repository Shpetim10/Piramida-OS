import { NextRequest } from "next/server";
import { updateTask, updateTaskStatus, assignTask } from "@/lib/services/tasks";
import { TaskStatus } from "@prisma/client";
import { ok, handleApiError } from "@/lib/api/respond";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string; taskId: string }> }) {
  try {
    const { taskId } = await params;
    const body = await req.json();

    // status transition shortcut
    if (body.status && Object.values(TaskStatus).includes(body.status)) {
      const task = await updateTaskStatus(taskId, body.status as TaskStatus);
      return ok(task);
    }

    // assign shortcut
    if (body.assignedToProfileId) {
      const task = await assignTask(taskId, body.assignedToProfileId);
      return ok(task);
    }

    // general field update
    const task = await updateTask(taskId, body);
    return ok(task);
  } catch (err) {
    return handleApiError(err);
  }
}
