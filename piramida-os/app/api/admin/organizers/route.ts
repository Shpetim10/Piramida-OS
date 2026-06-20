import { NextResponse } from "next/server";
import { listPendingOrganizers } from "@/lib/services/organizers";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET() {
  try {
    const organizers = await listPendingOrganizers();
    return ok(organizers);
  } catch (err) {
    return handleApiError(err);
  }
}
