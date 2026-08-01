import { z } from "zod";
import { contractError } from "./errors";

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CONTENT_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/(?:[a-z0-9][a-z0-9!#$&^_.+-]*|\*)$/;
const CHECKSUM = /^(?:sha256:)?[A-Fa-f0-9]{64}$/;
const MAX_ASSET_BYTES = 5 * 1024 * 1024 * 1024;

const assetMetadataSchema = z.record(
  z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]),
).superRefine((metadata, context) => {
  const entries = Object.entries(metadata);
  if (entries.length > 20) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Too many metadata fields" });
  }
  for (const [key] of entries) {
    if (key.length === 0 || key.length > 64) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid metadata key" });
    }
  }
});

export const assetReferenceSchema = z.object({
  assetId: z.string().regex(OPAQUE_ID),
  uploadId: z.string().regex(OPAQUE_ID).optional(),
  contentType: z.string().max(127).regex(CONTENT_TYPE),
  fileName: z.string().min(1).max(255).refine(
    (value) => !/[\\/]/.test(value) && !value.includes(".."),
    "File name must not contain a path",
  ).optional(),
  sizeBytes: z.number().int().nonnegative().max(MAX_ASSET_BYTES).optional(),
  checksum: z.string().max(80).regex(CHECKSUM).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  metadata: assetMetadataSchema.optional(),
}).strict();

export type AssetReference = z.infer<typeof assetReferenceSchema>;

export function parseAssetReference(value: unknown): AssetReference {
  const result = assetReferenceSchema.safeParse(value);
  if (!result.success) contractError("INVALID_ASSET_REFERENCE");
  return result.data;
}

export function isAcceptedContentType(
  contentType: string,
  acceptedTypes: readonly string[],
): boolean {
  return acceptedTypes.some((accepted) => {
    if (accepted.endsWith("/*")) {
      return contentType.startsWith(accepted.slice(0, -1));
    }
    return contentType === accepted;
  });
}

export const acceptedImageMimeTypeSchema = z.string()
  .max(127)
  .regex(CONTENT_TYPE)
  .refine((value) => value === "image/*" || value.startsWith("image/"));

export const acceptedDocumentMimeTypeSchema = z.string()
  .max(127)
  .regex(CONTENT_TYPE)
  .refine((value) => (
    value === "application/*"
    || value === "text/*"
    || value.startsWith("application/")
    || value.startsWith("text/")
  ));

