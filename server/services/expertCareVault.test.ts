import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  connect: vi.fn(),
  getCase: vi.fn(),
  addDocument: vi.fn(),
  removeDocument: vi.fn(),
}));
vi.mock("../db.js", () => ({ pool: { query: mocks.poolQuery, connect: mocks.connect } }));
vi.mock("./expertCareCases.js", () => ({
  getExpertCareCase: mocks.getCase,
  addExpertCareDocumentToCase: mocks.addDocument,
  removeExpertCareDocumentFromCase: mocks.removeDocument,
}));

import {
  deleteExpertCareDocument,
  ExpertCareDocumentRejectedError,
  ExpertCareVaultPermissionError,
  uploadExpertCareDocument,
} from "./expertCareVault.js";

const previousKey = process.env.HEALTH_DATA_ENCRYPTION_KEY;
const caseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const documentIdPattern = /^[0-9a-f-]{36}$/i;
const pdfBase64 = Buffer.from("%PDF-1.4\nprivate health record", "utf8").toString("base64");

describe("Expert Care record vault", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HEALTH_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    mocks.getCase.mockResolvedValue({ state: { context: { person: "self", authorityConfirmedAt: null } } });
    mocks.addDocument.mockResolvedValue({});
    mocks.removeDocument.mockResolvedValue({});
  });
  afterEach(() => { process.env.HEALTH_DATA_ENCRYPTION_KEY = previousKey; });

  it("scans before storing and encrypts both the file and OCR text", async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    client.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("insert into expert_care_documents")) {
        return { rows: [{
          id: values![0], case_id: values![2], file_name: values![3], media_type: values![4], byte_size: values![5], sha256: values![6],
          encrypted_payload: JSON.parse(String(values![7])), malware_status: "clean", ocr_status: values![8], ocr_confidence: values![9],
          retention_consent_at: "2026-10-19T10:00:00.000Z", created_at: "2026-10-19T10:00:00.000Z", sharing_approved: false,
        }] };
      }
      return { rows: [] };
    });
    mocks.connect.mockResolvedValue(client);
    const scan = vi.fn().mockResolvedValue({ status: "clean", engine: "test-scanner" });
    const ocr = vi.fn().mockResolvedValue({ status: "needs_review", text: "sensitive OCR", confidence: 0.62 });

    const document = await uploadExpertCareDocument({ userId: "user-1", caseId, fileName: "report.pdf", mediaType: "application/pdf", dataBase64: pdfBase64, dependencies: { scan, ocr } });

    expect(scan).toHaveBeenCalledOnce();
    expect(document).toMatchObject({ fileName: "report.pdf", malwareStatus: "clean", ocrStatus: "needs_review", ocrConfidence: 0.62 });
    expect(document.id).toMatch(documentIdPattern);
    const encrypted = String(client.query.mock.calls.find(([sql]) => String(sql).includes("insert into expert_care_documents"))?.[1]?.[7]);
    expect(encrypted).not.toContain(pdfBase64);
    expect(encrypted).not.toContain("sensitive OCR");
    expect(mocks.addDocument).toHaveBeenCalledWith(caseId, "user-1", document.id);
  });

  it("fails closed when malware is detected", async () => {
    await expect(uploadExpertCareDocument({
      userId: "user-1", caseId, fileName: "report.pdf", mediaType: "application/pdf", dataBase64: pdfBase64,
      dependencies: { scan: vi.fn().mockResolvedValue({ status: "infected", engine: "test" }) },
    })).rejects.toBeInstanceOf(ExpertCareDocumentRejectedError);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("denies trusted-helper access without explicit case authority", async () => {
    mocks.getCase.mockResolvedValue({ state: { context: { person: "trusted_helper", authorityConfirmedAt: null } } });
    await expect(uploadExpertCareDocument({
      userId: "helper-1", caseId, fileName: "report.pdf", mediaType: "application/pdf", dataBase64: pdfBase64,
      dependencies: { scan: vi.fn() },
    })).rejects.toBeInstanceOf(ExpertCareVaultPermissionError);
  });

  it("cryptographically deletes the payload and revokes sharing", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", case_id: caseId, file_name: "report.pdf", media_type: "application/pdf", byte_size: 32,
      sha256: "hash", encrypted_payload: { alg: "A256GCM" }, malware_status: "clean", ocr_status: "complete", ocr_confidence: 0.9,
      retention_consent_at: "2026-10-19T10:00:00.000Z", created_at: "2026-10-19T10:00:00.000Z", sharing_approved: true,
    }] });
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    mocks.connect.mockResolvedValue(client);

    await deleteExpertCareDocument("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", caseId, "user-1");

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("encrypted_payload = null"), expect.any(Array));
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("approved = false"), expect.any(Array));
    expect(mocks.removeDocument).toHaveBeenCalledWith(caseId, "user-1", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });
});
