import { NextRequest } from "next/server";
import { listTasks, createTask, generateDefaultEventTasks } from "@/lib/services/tasks";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const tasks = await listTasks(eventId);
    return ok(tasks);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const body = await req.json();

    // Convenience: POST with { generate: true } seeds the default run-of-show tasks.
    if (body.generate === true) {
      const tasks = await generateDefaultEventTasks(eventId);
      return ok(tasks, 201);
    }

    const task = await createTask({ ...body, eventId });
    return ok(task, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
