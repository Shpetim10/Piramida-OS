// Local-filesystem upload handling for Piramida / Pyramid OS.
//
// Provider is LOCAL initially; metadata lives in FileObject so we can migrate to
// Supabase Storage / S3 later with no business-model change (only saveUpload /
// resolveStoredPath change; FileObject.storageProvider + relativePath stay).
//
// Hard rules enforced here:
//   - Never trust the client file name as the stored name (random UUID name).
//   - Validate mime type + size (shared lists with lib/validation/schemas).
//   - Store a RELATIVE path, never an absolute server path.
//   - resolveStoredPath() refuses any path that escapes UPLOAD_ROOT.
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FileStorageProvider, type AttachmentOwnerType } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES } from "../validation/schemas";

export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 = 400,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * Resolve a stored relative path to an absolute path under UPLOAD_ROOT,
 * refusing traversal (`..`, absolute, symlink-style escapes).
 */
export function resolveStoredPath(relativePath: string): string {
  const abs = path.resolve(UPLOAD_ROOT, relativePath);
  const rel = path.relative(UPLOAD_ROOT, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new UploadError("Invalid file path");
  }
  return abs;
}

export interface SaveUploadArgs {
  orgId: string;
  data: Buffer;
  originalName: string;
  mimeType: string;
  uploadedById?: string | null;
  isPublic?: boolean; // sets a publicUrl only when explicitly marked public
}

export interface SavedFile {
  id: string;
  relativePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
}

/** Validate, write to disk under UPLOAD_ROOT, and create a FileObject row. */
export async function saveUpload(args: SaveUploadArgs): Promise<SavedFile> {
  const { orgId, data, originalName, mimeType, uploadedById, isPublic } = args;

  if (!(ALLOWED_UPLOAD_MIME as readonly string[]).includes(mimeType)) {
    throw new UploadError(`Unsupported file type: ${mimeType}`);
  }
  if (data.length === 0) throw new UploadError("Empty file");
  if (data.length > MAX_UPLOAD_BYTES) throw new UploadError("File too large", 413);

  const ext = EXT_BY_MIME[mimeType] ?? "";
  const storedName = `${randomUUID()}${ext}`;
  const now = new Date();
  const subdir = path.join(
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
  );
  const relativePath = path.join(subdir, storedName);

  const abs = resolveStoredPath(relativePath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data);

  const checksum = createHash("sha256").update(data).digest("hex");

  const file = await prisma.fileObject.create({
    data: {
      orgId,
      storageProvider: FileStorageProvider.LOCAL,
      relativePath, // relative, never absolute
      publicUrl: isPublic ? `/api/uploads/${file_public_segment(relativePath)}` : null,
      originalName,
      mimeType,
      sizeBytes: data.length,
      checksum,
      uploadedById: uploadedById ?? null,
    },
    select: { id: true, relativePath: true, mimeType: true, sizeBytes: true },
  });

  return { ...file, originalName, checksum };
}

// Public files are still served through an authenticated/marked route, not a
// static dir — so the "url" is an app route keyed by relative path segments.
function file_public_segment(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

/** Link an existing FileObject to an owner record. */
export async function createAttachment(args: {
  orgId: string;
  fileId: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  label?: string | null;
}) {
  return prisma.attachment.create({
    data: {
      orgId: args.orgId,
      fileId: args.fileId,
      ownerType: args.ownerType,
      ownerId: args.ownerId,
      label: args.label ?? null,
    },
  });
}

/**
 * Safe delete: soft-delete metadata only. The bytes are removed later by a
 * retention/cleanup job (soft_delete.retention_days), so an accidental delete
 * is recoverable and audit/ownership references stay intact.
 */
export async function softDeleteFile(fileId: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.attachment.updateMany({ where: { fileId, deletedAt: null }, data: { deletedAt: now } }),
    prisma.fileObject.update({ where: { id: fileId }, data: { deletedAt: now } }),
  ]);
}
