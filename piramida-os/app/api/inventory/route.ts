import { AuthError, requireStaff, requirePermission } from "@/lib/auth/guards";
import {
  listAssetCategories,
  listAssets,
  listAssetBatches,
  listAssetKits,
  createAssetCategory,
} from "@/lib/services/inventory";

// GET /api/inventory — full catalog snapshot (staff only)
export async function GET() {
  try {
    await requireStaff();
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const [categories, assets, batches, kits] = await Promise.all([
    listAssetCategories(),
    listAssets(),
    listAssetBatches(),
    listAssetKits(),
  ]);
  return Response.json({ categories, assets, batches, kits });
}

// POST /api/inventory — create a category (inventory.manage)
export async function POST(request: Request) {
  try {
    await requirePermission("inventory.manage");
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  try {
    const body = await request.json();
    const cat = await createAssetCategory(body);
    return Response.json(cat, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    const msg = e instanceof Error ? e.message : "Invalid input";
    return Response.json({ error: msg }, { status: 400 });
  }
}
