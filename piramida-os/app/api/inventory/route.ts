import { NextRequest } from "next/server";
import {
  listAssetCategories,
  listAssets,
  listAssetBatches,
  listAssetKits,
  createAssetCategory,
} from "@/lib/services/inventory";
import { ok, handleApiError } from "@/lib/api/respond";

/**
 * GET  /api/inventory          — returns { categories, assets, batches, kits }
 * POST /api/inventory          — creates a new asset category
 */
export async function GET(req: NextRequest) {
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
    const body = await req.json();
    const category = await createAssetCategory(body);
    return ok(category, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
