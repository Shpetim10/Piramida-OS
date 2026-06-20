import { AuthError, requirePermission } from "@/lib/auth/guards";
import { updateAssetBatch, deleteAssetBatch } from "@/lib/services/inventory";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("inventory.manage");
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const batch = await updateAssetBatch(id, body);
    return Response.json(batch);
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    const msg = e instanceof Error ? e.message : "Invalid input";
    return Response.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("inventory.manage");
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  try {
    const { id } = await params;
    const batch = await deleteAssetBatch(id);
    return Response.json(batch);
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    const msg = e instanceof Error ? e.message : "Not found";
    return Response.json({ error: msg }, { status: 400 });
  }
}
