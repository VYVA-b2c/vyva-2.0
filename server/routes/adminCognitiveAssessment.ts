import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import {
  parseBulkUploadJson,
  validateBulkUploadItems,
  type BulkUploadContentType,
  type BulkUploadInsertRow,
  type BulkUploadInsertTable,
  type BulkUploadLanguage,
} from "../../shared/contentBulkUpload.js";

const bulkUploadBodySchema = z.object({
  contentType: z.enum([
    "cc_story_recall",
    "cc_similarities",
  ]),
  language: z.enum(["es", "de", "en", "fr", "pt"]),
  jsonText: z.string().min(1),
  skipAdminReview: z.boolean().optional().default(false),
});

const BULK_UPLOAD_COLUMNS: Record<BulkUploadInsertTable, readonly string[]> = {
  cc_item_bank: [
    "task_definition_id",
    "content",
    "language",
    "difficulty_tier",
    "item_family_id",
    "source",
    "reviewed_at",
    "reviewed_by",
    "rejected",
    "is_active",
  ],
};

function reviewerFor(req: Request) {
  return String(req.user?.email ?? req.user?.id ?? "admin");
}

function quoteBulkUploadIdentifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error("Invalid SQL identifier.");
  return `"${value}"`;
}

function redactPreviewRows(rows: ReturnType<typeof validateBulkUploadItems>) {
  return {
    totalItems: rows.totalItems,
    validCount: rows.validItems.length,
    invalidItems: rows.invalidItems,
  };
}

async function insertBulkUploadRows(table: BulkUploadInsertTable, rows: BulkUploadInsertRow[]) {
  if (rows.length === 0) return 0;

  const columns = BULK_UPLOAD_COLUMNS[table];
  const values: unknown[] = [];
  const rowPlaceholders = rows.map((row) => {
    const placeholders = columns.map((column) => {
      values.push(row[column] ?? null);
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });

  const sql = `
    insert into public.${quoteBulkUploadIdentifier(table)}
      (${columns.map(quoteBulkUploadIdentifier).join(", ")})
    values ${rowPlaceholders.join(", ")}
    returning id
  `;

  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(sql, values);
    await client.query("commit");
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

const adminCognitiveAssessmentRouter = Router();

adminCognitiveAssessmentRouter.post("/bulk-upload", async (req: Request, res: Response) => {
  const parsed = bulkUploadBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid bulk upload request.", details: parsed.error.flatten() });
  }

  let rawItems: unknown[];
  try {
    rawItems = parseBulkUploadJson(parsed.data.jsonText);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.",
    });
  }

  const preview = validateBulkUploadItems(
    parsed.data.contentType as BulkUploadContentType,
    parsed.data.language as BulkUploadLanguage,
    rawItems,
    {
      skipAdminReview: parsed.data.skipAdminReview,
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewerFor(req),
    },
  );

  if (preview.validItems.length === 0) {
    return res.status(400).json({ error: "No valid items to upload.", preview: redactPreviewRows(preview) });
  }

  const table = preview.validItems[0].table;
  if (!preview.validItems.every((item) => item.table === table)) {
    return res.status(400).json({ error: "Bulk uploads must target a single table.", preview: redactPreviewRows(preview) });
  }

  try {
    const insertedCount = await insertBulkUploadRows(table, preview.validItems.map((item) => item.row));
    return res.json({
      insertedCount,
      skippedCount: preview.invalidItems.length,
      preview: redactPreviewRows(preview),
    });
  } catch (error) {
    console.error("[admin] Cognitive assessment bulk upload failed:", error);
    return res.status(500).json({ error: "Bulk content upload failed." });
  }
});

export default adminCognitiveAssessmentRouter;
