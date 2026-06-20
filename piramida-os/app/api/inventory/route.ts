import { NextRequest } from "next/server";
import { AuthError, requireStaff, requirePermission } from "@/lib/auth/guards";
import {
  listAssetCategories,
  listAssets,
  listAssetBatches,
  listAssetKits,
  createAssetCategory,
} from "@/lib/services/inventory";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET(req: NextRequest) {
  try {
    await requireStaff();
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const [categories, assets, batches, kits] = await Promise.all([
      listAssetCategories(),
      listAssets(categoryId ? { categoryId } : undefined),
      listAssetBatches(categoryId ? { categoryId } : undefined),
      listAssetKits(),
    ]);
    return ok({ categories, assets, batches, kits });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("inventory.manage");
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  try {
    const body = await req.json();
    const category = await createAssetCategory(body);
    return ok(category, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
