import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db.js";
import type { ExpertCareVaultAuditEvent, ExpertCareVaultDocument } from "../../shared/expertCareVault.js";
import { decryptExpertCareDocument, encryptExpertCareDocument, expertCareDocumentAad } from "../lib/expertCareVaultCrypto.js";
import {
  ExpertCareMalwareScannerUnavailableError,
  ocrExpertCareDocument,
  scanExpertCareDocument,
  type MalwareScanResult,
  type OcrResult,
} from "./expertCareDocumentProcessing.js";
import { addExpertCareDocumentToCase, getExpertCareCase, removeExpertCareDocumentFromCase } from "./expertCareCases.js";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export class ExpertCareVaultPermissionError extends Error {}
export class ExpertCareDocumentRejectedError extends Error {}
export class ExpertCareDocumentNotFoundError extends Error {}
export class ExpertCareDocumentDuplicateError extends Error {}

type VaultDocumentRow = {
  id: string;
  case_id: string;
  file_name: string;
  media_type: ExpertCareVaultDocument["mediaType"];
  byte_size: number;
  sha256: string;
  encrypted_payload: unknown;
  malware_status: "clean";
  ocr_status: ExpertCareVaultDocument["ocrStatus"];
  ocr_confidence: number | string | null;
  retention_consent_at: Date | string;
  created_at: Date | string;
  sharing_approved?: boolean | null;
};

type AuditRow = { id: string; document_id: string | null; event_type: ExpertCareVaultAuditEvent["eventType"]; created_at: Date | string };
type ProcessingDependencies = {
  scan: (input: { dataBase64: string; mediaType: string; sha256: string }) => Promise<MalwareScanResult>;
  ocr: (input: { dataBase64: string; mediaType: string }) => Promise<OcrResult>;
};

const defaults: ProcessingDependencies = { scan: scanExpertCareDocument, ocr: ocrExpertCareDocument };
const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;

function normalizeDocument(row: VaultDocumentRow): ExpertCareVaultDocument {
  const confidence = row.ocr_confidence === null ? null : Number(row.ocr_confidence);
  return {
    id: row.id,
    caseId: row.case_id,
    fileName: row.file_name,
    mediaType: row.media_type,
    byteSize: row.byte_size,
    sha256: row.sha256,
    malwareStatus: "clean",
    ocrStatus: row.ocr_status,
    ocrConfidence: Number.isFinite(confidence) ? confidence : null,
    retentionConsentAt: iso(row.retention_consent_at),
    sharingApproved: row.sharing_approved === true,
    createdAt: iso(row.created_at),
  };
}

function decodeDocument(dataBase64: string, mediaType: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64) || dataBase64.length % 4 !== 0) throw new ExpertCareDocumentRejectedError("Invalid base64 document");
  const bytes = Buffer.from(dataBase64, "base64");
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new ExpertCareDocumentRejectedError("Document size is not allowed");
  const validMagic = mediaType === "application/pdf"
    ? bytes.subarray(0, 5).toString("ascii") === "%PDF-"
    : mediaType === "image/png"
      ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!validMagic) throw new ExpertCareDocumentRejectedError("Document content does not match its media type");
  return bytes;
}

async function requireVaultPermission(caseId: string, userId: string) {
  const record = await getExpertCareCase(caseId, userId);
  if (record.state.context.person === "trusted_helper" && !record.state.context.authorityConfirmedAt) {
    throw new ExpertCareVaultPermissionError("Trusted helper permission is required");
  }
  return record;
}

async function audit(client: PoolClient, userId: string, caseId: string, documentId: string | null, eventType: ExpertCareVaultAuditEvent["eventType"], metadata: Record<string, unknown> = {}) {
  await client.query(
    "insert into expert_care_vault_audit (user_id, case_id, document_id, event_type, metadata) values ($1, $2::uuid, $3::uuid, $4, $5::jsonb)",
    [userId, caseId, documentId, eventType, JSON.stringify(metadata)],
  );
}

export async function uploadExpertCareDocument(input: {
  userId: string;
  caseId: string;
  fileName: string;
  mediaType: ExpertCareVaultDocument["mediaType"];
  dataBase64: string;
  dependencies?: Partial<ProcessingDependencies>;
}): Promise<ExpertCareVaultDocument> {
  await requireVaultPermission(input.caseId, input.userId);
  const bytes = decodeDocument(input.dataBase64, input.mediaType);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const processing = { ...defaults, ...input.dependencies };
  const scan = await processing.scan({ dataBase64: input.dataBase64, mediaType: input.mediaType, sha256 });
  if (scan.status !== "clean") throw new ExpertCareDocumentRejectedError(scan.status === "infected" ? "Malware detected" : "Malware scan unavailable");
  const ocr = await processing.ocr({ dataBase64: input.dataBase64, mediaType: input.mediaType });
  const documentId = randomUUID();
  const encrypted = encryptExpertCareDocument({ dataBase64: input.dataBase64, ocrText: ocr.text }, expertCareDocumentAad(input.userId, input.caseId, documentId));
  const client = await pool.connect();
  let saved: ExpertCareVaultDocument;
  try {
    await client.query("begin");
    const result = await client.query<VaultDocumentRow>(
      `insert into expert_care_documents
        (id, user_id, case_id, file_name, media_type, byte_size, sha256, encrypted_payload, malware_status, ocr_status, ocr_confidence, retention_consent_at)
       values ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8::jsonb, 'clean', $9, $10, now())
       returning *, false as sharing_approved`,
      [documentId, input.userId, input.caseId, input.fileName, input.mediaType, bytes.length, sha256, JSON.stringify(encrypted), ocr.status, ocr.confidence],
    );
    await audit(client, input.userId, input.caseId, documentId, "uploaded", { scanner: scan.engine, ocrStatus: ocr.status });
    await client.query("commit");
    saved = normalizeDocument(result.rows[0]!);
  } catch (error) {
    await client.query("rollback");
    if ((error as { code?: unknown } | null)?.code === "23505") throw new ExpertCareDocumentDuplicateError("This document is already in the case");
    throw error;
  } finally {
    client.release();
  }
  await addExpertCareDocumentToCase(input.caseId, input.userId, documentId);
  return saved;
}

export async function listExpertCareDocuments(caseId: string, userId: string): Promise<ExpertCareVaultDocument[]> {
  await requireVaultPermission(caseId, userId);
  const result = await pool.query<VaultDocumentRow>(
    `select d.*, coalesce(s.approved, false) as sharing_approved
       from expert_care_documents d
       left join expert_care_document_sharing s on s.document_id = d.id and s.user_id = d.user_id
      where d.case_id = $1::uuid and d.user_id = $2 and d.deleted_at is null
      order by d.created_at desc`,
    [caseId, userId],
  );
  await pool.query("insert into expert_care_vault_audit (user_id, case_id, document_id, event_type) values ($1, $2::uuid, null, 'listed')", [userId, caseId]);
  return result.rows.map(normalizeDocument);
}

async function documentForUser(documentId: string, caseId: string, userId: string): Promise<VaultDocumentRow> {
  const result = await pool.query<VaultDocumentRow>(
    `select d.*, coalesce(s.approved, false) as sharing_approved
       from expert_care_documents d
       left join expert_care_document_sharing s on s.document_id = d.id and s.user_id = d.user_id
      where d.id = $1::uuid and d.case_id = $2::uuid and d.user_id = $3 and d.deleted_at is null limit 1`,
    [documentId, caseId, userId],
  );
  if (!result.rows[0]) throw new ExpertCareDocumentNotFoundError("Document not found");
  return result.rows[0];
}

export async function downloadExpertCareDocument(documentId: string, caseId: string, userId: string): Promise<{ document: ExpertCareVaultDocument; dataBase64: string }> {
  await requireVaultPermission(caseId, userId);
  const row = await documentForUser(documentId, caseId, userId);
  const decrypted = decryptExpertCareDocument(row.encrypted_payload, expertCareDocumentAad(userId, caseId, documentId)) as { dataBase64?: unknown };
  if (typeof decrypted?.dataBase64 !== "string") throw new ExpertCareDocumentRejectedError("Stored document is unreadable");
  await pool.query("insert into expert_care_vault_audit (user_id, case_id, document_id, event_type) values ($1, $2::uuid, $3::uuid, 'viewed')", [userId, caseId, documentId]);
  return { document: normalizeDocument(row), dataBase64: decrypted.dataBase64 };
}

export async function setExpertCareDocumentSharing(input: { documentId: string; caseId: string; userId: string; approved: boolean }): Promise<ExpertCareVaultDocument> {
  await requireVaultPermission(input.caseId, input.userId);
  await documentForUser(input.documentId, input.caseId, input.userId);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into expert_care_document_sharing (document_id, user_id, case_id, approved, approved_at, revoked_at, updated_at)
       values ($1::uuid, $2, $3::uuid, $4, case when $4 then now() else null end, case when $4 then null else now() end, now())
       on conflict (document_id) do update set approved = excluded.approved, approved_at = excluded.approved_at, revoked_at = excluded.revoked_at, updated_at = now()`,
      [input.documentId, input.userId, input.caseId, input.approved],
    );
    await audit(client, input.userId, input.caseId, input.documentId, input.approved ? "sharing_approved" : "sharing_revoked");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return normalizeDocument({ ...(await documentForUser(input.documentId, input.caseId, input.userId)), sharing_approved: input.approved });
}

export async function deleteExpertCareDocument(documentId: string, caseId: string, userId: string): Promise<void> {
  await requireVaultPermission(caseId, userId);
  await documentForUser(documentId, caseId, userId);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("update expert_care_documents set encrypted_payload = null, deleted_at = now() where id = $1::uuid and case_id = $2::uuid and user_id = $3", [documentId, caseId, userId]);
    await client.query("update expert_care_document_sharing set approved = false, revoked_at = now(), updated_at = now() where document_id = $1::uuid and user_id = $2", [documentId, userId]);
    await audit(client, userId, caseId, documentId, "deleted");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  await removeExpertCareDocumentFromCase(caseId, userId, documentId);
}

export async function listExpertCareVaultAudit(caseId: string, userId: string): Promise<ExpertCareVaultAuditEvent[]> {
  await requireVaultPermission(caseId, userId);
  const result = await pool.query<AuditRow>(
    "select id, document_id, event_type, created_at from expert_care_vault_audit where case_id = $1::uuid and user_id = $2 order by created_at desc limit 200",
    [caseId, userId],
  );
  return result.rows.map((row) => ({ id: row.id, documentId: row.document_id, eventType: row.event_type, createdAt: iso(row.created_at) }));
}

export { ExpertCareMalwareScannerUnavailableError };
