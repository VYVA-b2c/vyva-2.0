import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedExpertCareDocument = {
  alg: "A256GCM";
  iv: string;
  tag: string;
  ciphertext: string;
};

function healthDataEncryptionKey(): Buffer {
  const configured = process.env.HEALTH_DATA_ENCRYPTION_KEY?.trim();
  if (!configured) throw new Error("HEALTH_DATA_ENCRYPTION_KEY is not configured");
  const key = /^[a-f0-9]{64}$/i.test(configured) ? Buffer.from(configured, "hex") : Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("HEALTH_DATA_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

export function expertCareDocumentAad(userId: string, caseId: string, documentId: string): Buffer {
  return Buffer.from(`expert-care-v1:${userId}:${caseId}:${documentId}`, "utf8");
}

export function encryptExpertCareDocument(value: unknown, aad: Buffer): EncryptedExpertCareDocument {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", healthDataEncryptionKey(), iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { alg: "A256GCM", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}

export function decryptExpertCareDocument(value: unknown, aad: Buffer): unknown {
  const payload = value as Partial<EncryptedExpertCareDocument> | null;
  if (!payload || payload.alg !== "A256GCM" || !payload.iv || !payload.tag || !payload.ciphertext) throw new Error("Invalid encrypted Expert Care document");
  const decipher = createDecipheriv("aes-256-gcm", healthDataEncryptionKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext) as unknown;
}
