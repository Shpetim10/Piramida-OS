import { AuthError, requirePermission } from "@/lib/auth/guards";
import { updateAsset, deleteAsset } from "@/lib/services/inventory";

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
    const asset = await updateAsset(id, body);
    return Response.json(asset);
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
    const asset = await deleteAsset(id);
    return Response.json(asset);
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    const msg = e instanceof Error ? e.message : "Not found";
    return Response.json({ error: msg }, { status: 400 });
  }
}
