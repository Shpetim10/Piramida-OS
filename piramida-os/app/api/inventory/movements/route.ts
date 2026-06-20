import { AuthError, requirePermission } from "@/lib/auth/guards";
import { logMovement, listMovements } from "@/lib/services/movements";

// GET /api/inventory/movements?assetId=&batchId= — movement history
export async function GET(request: Request) {
  try {
    await requirePermission("inventory.scan");
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId") ?? undefined;
  const batchId = searchParams.get("batchId") ?? undefined;
  try {
    const movements = await listMovements({ assetId, batchId });
    return Response.json(movements);
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    const msg = e instanceof Error ? e.message : "Invalid request";
    return Response.json({ error: msg }, { status: 400 });
  }
}

// POST /api/inventory/movements — log a scan/pick/return event
export async function POST(request: Request) {
  try {
    await requirePermission("inventory.scan");
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  try {
    const body = await request.json();
    const movement = await logMovement(body);
    return Response.json(movement, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    const msg = e instanceof Error ? e.message : "Invalid input";
    return Response.json({ error: msg }, { status: 400 });
  }
}
