import { afterEach, describe, expect, it } from "vitest";
import { decryptExpertCareDocument, encryptExpertCareDocument, expertCareDocumentAad } from "./expertCareVaultCrypto.js";

describe("Expert Care document encryption", () => {
  const previous = process.env.HEALTH_DATA_ENCRYPTION_KEY;
  afterEach(() => { process.env.HEALTH_DATA_ENCRYPTION_KEY = previous; });

  it("encrypts with authenticated case-bound context", () => {
    process.env.HEALTH_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const aad = expertCareDocumentAad("user-1", "case-1", "document-1");
    const encrypted = encryptExpertCareDocument({ dataBase64: "cGRm", ocrText: "record" }, aad);
    expect(encrypted.ciphertext).not.toContain("record");
    expect(decryptExpertCareDocument(encrypted, aad)).toEqual({ dataBase64: "cGRm", ocrText: "record" });
    expect(() => decryptExpertCareDocument(encrypted, expertCareDocumentAad("user-1", "case-2", "document-1"))).toThrow();
  });
});
