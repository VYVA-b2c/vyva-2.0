const DEFAULT_MAX_SIZE = 1024;
const DEFAULT_QUALITY = 0.75;

export async function compressImageFile(
  file: File,
  options: { maxSize?: number; quality?: number } = {},
): Promise<string> {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const quality = options.quality ?? DEFAULT_QUALITY;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not prepare image");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", quality);
}
