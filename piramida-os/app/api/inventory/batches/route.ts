import { AuthError, requireStaff, requirePermission } from "@/lib/auth/guards";
import { listAssetBatches, createAssetBatch } from "@/lib/services/inventory";

export async function GET(request: Request) {
  try {
    await requireStaff();
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const batches = await listAssetBatches({ categoryId });
  return Response.json(batches);
}

export async function POST(request: Request) {
  try {
    await requirePermission("inventory.manage");
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  try {
    const body = await request.json();
    const batch = await createAssetBatch(body);
    return Response.json(batch, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    const msg = e instanceof Error ? e.message : "Invalid input";
    return Response.json({ error: msg }, { status: 400 });
  }
}
