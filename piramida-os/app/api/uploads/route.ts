import { AttachmentOwnerType } from "@prisma/client";
import { AuthError, requireStaff } from "@/lib/auth/guards";
import { saveUpload, createAttachment, UploadError } from "@/lib/storage/uploads";

// POST /api/uploads — multipart upload (staff only). Optionally attaches the
// file to an owner record when ownerType + ownerId are supplied.
//
// Returns guest/internal-safe metadata only — never the absolute server path.
export async function POST(request: Request) {
  let profile;
  try {
    profile = await requireStaff();
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing 'file'" }, { status: 400 });
  }

  const ownerTypeRaw = form.get("ownerType");
  const ownerId = form.get("ownerId");
  const label = form.get("label");

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const saved = await saveUpload({
      orgId: profile.orgId,
      data,
      originalName: file.name,
      mimeType: file.type,
      uploadedById: profile.id,
    });

    if (typeof ownerTypeRaw === "string" && typeof ownerId === "string") {
      if (!(ownerTypeRaw in AttachmentOwnerType)) {
        return Response.json({ error: "Invalid ownerType" }, { status: 400 });
      }
      await createAttachment({
        orgId: profile.orgId,
        fileId: saved.id,
        ownerType: ownerTypeRaw as AttachmentOwnerType,
        ownerId,
        label: typeof label === "string" ? label : null,
      });
    }

    return Response.json(
      {
        id: saved.id,
        originalName: saved.originalName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        checksum: saved.checksum,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
