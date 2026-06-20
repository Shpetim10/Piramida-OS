import { NextRequest } from "next/server";
import { listSpaces, createSpace } from "@/lib/services/spaces";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const publicOnly = searchParams.get("publicOnly") === "true";
    const spaces = await listSpaces(publicOnly ? { publicOnly: true } : undefined);
    return ok(spaces);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const space = await createSpace(body);
    return ok(space, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
