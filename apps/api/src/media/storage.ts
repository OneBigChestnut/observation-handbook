import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type StoredMedia = {
  id: string;
  originalPath: string;
  thumbnailPath: string;
  mimeType: string;
  width: number;
  height: number;
};

export async function storeChildImage(input: { mediaDirectory: string; mimeType: string; data: Buffer; id?: string }): Promise<StoredMedia> {
  const extension = EXTENSIONS[input.mimeType];
  if (!extension) throw new Error("MEDIA_IMAGE_REQUIRED");

  const id = input.id ?? randomUUID();
  const originalPath = `originals/${id}.${extension}`;
  const thumbnailPath = `thumbnails/${id}.jpg`;
  const image = sharp(input.data, { failOn: "error" }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("MEDIA_IMAGE_INVALID");

  await mkdir(join(input.mediaDirectory, "originals"), { recursive: true });
  await mkdir(join(input.mediaDirectory, "thumbnails"), { recursive: true });
  await writeFile(join(input.mediaDirectory, originalPath), input.data);
  await image.resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(join(input.mediaDirectory, thumbnailPath));

  return { id, originalPath, thumbnailPath, mimeType: input.mimeType, width: metadata.width, height: metadata.height };
}
