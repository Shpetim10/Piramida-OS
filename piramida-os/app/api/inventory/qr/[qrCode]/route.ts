import { AuthError, requirePermission } from "@/lib/auth/guards";
import { getAssetOrBatchByQr } from "@/lib/services/inventory";

// GET /api/inventory/qr/[qrCode] — resolve a QR code to asset or batch.
// Requires inventory.scan permission (technician / ops-manager / inventory-manager).
export async function GET(_request: Request, { params }: { params: Promise<{ qrCode: string }> }) {
  try {
    await requirePermission("inventory.scan");
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { qrCode } = await params;
  const result = await getAssetOrBatchByQr(decodeURIComponent(qrCode));
  if (!result) return Response.json({ error: "QR code not found" }, { status: 404 });
  return Response.json(result);
}
