import { Router, type Request, type Response } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../db.js";
import { curiousMindsHooks, curiousMindsPrompts, scentMemoryPrompts } from "../../shared/schema.js";
import {
  parseBulkUploadJson,
  validateBulkUploadItems,
  type BulkUploadContentType,
  type BulkUploadInsertRow,
  type BulkUploadInsertTable,
  type BulkUploadLanguage,
} from "../../shared/contentBulkUpload.js";

const reviewQuerySchema = z.object({
  type: z.enum(["hooks", "prompts", "scent"]).default("hooks"),
});

const reviewPatchSchema = z.object({
  action: z.enum(["approve", "reject"]),
  values: z.record(z.string()).optional().default({}),
  reviewer: z.string().trim().min(1).max(160).optional(),
});

const bulkUploadBodySchema = z.object({
  contentType: z.enum([
    "cc_story_recall",
    "cc_similarities",
    "curious_minds_hooks",
    "curious_minds_prompts",
    "scent_memory_prompts",
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
  curious_minds_hooks: [
    "fact_prompt",
    "fact_answer",
    "category",
    "language",
    "source",
    "reviewed_at",
    "reviewed_by",
    "is_active",
  ],
  curious_minds_prompts: [
    "prompt_type",
    "prompt_text",
    "topic",
    "language",
    "source",
    "reviewed_at",
    "reviewed_by",
    "is_active",
  ],
  scent_memory_prompts: [
    "scent_name",
    "scent_description",
    "guiding_question",
    "category",
    "language",
    "source",
    "reviewed_at",
    "reviewed_by",
    "rejected",
    "is_active",
  ],
};

function reviewerFor(req: Request, requested?: string) {
  return requested ?? String(req.user?.email ?? req.user?.id ?? "admin");
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

function serializeHook(row: typeof curiousMindsHooks.$inferSelect) {
  return {
    id: row.id,
    fact_prompt: row.factPrompt,
    fact_answer: row.factAnswer,
    category: row.category,
    language: row.language,
    source: row.source,
    reviewed_at: row.reviewedAt?.toISOString() ?? null,
    reviewed_by: row.reviewedBy,
    is_active: row.isActive,
    created_at: row.createdAt?.toISOString() ?? null,
  };
}

function serializePrompt(row: typeof curiousMindsPrompts.$inferSelect) {
  return {
    id: row.id,
    prompt_type: row.promptType,
    prompt_text: row.promptText,
    topic: row.topic,
    language: row.language,
    source: row.source,
    reviewed_at: row.reviewedAt?.toISOString() ?? null,
    reviewed_by: row.reviewedBy,
    is_active: row.isActive,
    created_at: row.createdAt?.toISOString() ?? null,
  };
}

function serializeScentPrompt(row: typeof scentMemoryPrompts.$inferSelect) {
  return {
    id: row.id,
    scent_name: row.scentName,
    scent_description: row.scentDescription,
    guiding_question: row.guidingQuestion,
    category: row.category,
    language: row.language,
    source: row.source,
    reviewed_at: row.reviewedAt?.toISOString() ?? null,
    reviewed_by: row.reviewedBy,
    rejected: row.rejected,
    is_active: row.isActive,
    created_at: row.createdAt?.toISOString() ?? null,
  };
}

const router = Router();

router.post("/review/bulk-upload", async (req: Request, res: Response) => {
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
    console.error("[admin] Bulk content upload failed:", error);
    return res.status(500).json({ error: "Bulk content upload failed." });
  }
});

router.get("/review", async (req: Request, res: Response) => {
  const parsed = reviewQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid Curious Minds review request." });
  }

  try {
    if (parsed.data.type === "hooks") {
      const rows = await db
        .select()
        .from(curiousMindsHooks)
        .where(and(eq(curiousMindsHooks.isActive, false), isNull(curiousMindsHooks.reviewedAt)))
        .orderBy(asc(curiousMindsHooks.createdAt))
        .limit(200);
      return res.json({ items: rows.map(serializeHook) });
    }

    if (parsed.data.type === "prompts") {
      const rows = await db
        .select()
        .from(curiousMindsPrompts)
        .where(and(eq(curiousMindsPrompts.isActive, false), isNull(curiousMindsPrompts.reviewedAt)))
        .orderBy(asc(curiousMindsPrompts.createdAt))
        .limit(200);
      return res.json({ items: rows.map(serializePrompt) });
    }

    const rows = await db
      .select()
      .from(scentMemoryPrompts)
      .where(and(eq(scentMemoryPrompts.isActive, false), eq(scentMemoryPrompts.rejected, false), isNull(scentMemoryPrompts.reviewedAt)))
      .orderBy(asc(scentMemoryPrompts.createdAt))
      .limit(200);
    return res.json({ items: rows.map(serializeScentPrompt) });
  } catch (error) {
    console.error("[admin] Curious Minds review load failed:", error);
    return res.status(500).json({ error: "Curious Minds drafts could not be loaded." });
  }
});

router.patch("/review/:type/:id", async (req: Request, res: Response) => {
  const type = req.params.type;
  if (type !== "hooks" && type !== "prompts" && type !== "scent") {
    return res.status(400).json({ error: "Invalid Curious Minds content type." });
  }

  const parsed = reviewPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid Curious Minds review update." });
  }

  const now = new Date();
  const reviewer = reviewerFor(req, parsed.data.reviewer);

  try {
    if (type === "hooks") {
      const patch = parsed.data.action === "approve"
        ? {
            factPrompt: parsed.data.values.fact_prompt,
            factAnswer: parsed.data.values.fact_answer,
            isActive: true,
            reviewedAt: now,
            reviewedBy: reviewer,
          }
        : {
            isActive: false,
            reviewedAt: now,
            reviewedBy: `rejected:${reviewer}`,
          };

      const [row] = await db
        .update(curiousMindsHooks)
        .set(patch)
        .where(eq(curiousMindsHooks.id, req.params.id))
        .returning();
      if (!row) return res.status(404).json({ error: "Curious Minds hook was not found." });
      return res.json({ item: serializeHook(row) });
    }

    if (type === "prompts") {
      const patch = parsed.data.action === "approve"
        ? {
            promptText: parsed.data.values.prompt_text,
            topic: parsed.data.values.topic,
            isActive: true,
            reviewedAt: now,
            reviewedBy: reviewer,
          }
        : {
            isActive: false,
            reviewedAt: now,
            reviewedBy: `rejected:${reviewer}`,
          };

      const [row] = await db
        .update(curiousMindsPrompts)
        .set(patch)
        .where(eq(curiousMindsPrompts.id, req.params.id))
        .returning();
      if (!row) return res.status(404).json({ error: "Curious Minds prompt was not found." });
      return res.json({ item: serializePrompt(row) });
    }

    const patch = parsed.data.action === "approve"
      ? {
          scentName: parsed.data.values.scent_name,
          scentDescription: parsed.data.values.scent_description,
          guidingQuestion: parsed.data.values.guiding_question,
          isActive: true,
          rejected: false,
          reviewedAt: now,
          reviewedBy: reviewer,
        }
      : {
          isActive: false,
          rejected: true,
          reviewedAt: now,
          reviewedBy: `rejected:${reviewer}`,
        };

    const [row] = await db
      .update(scentMemoryPrompts)
      .set(patch)
      .where(eq(scentMemoryPrompts.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ error: "Scent Memory prompt was not found." });
    return res.json({ item: serializeScentPrompt(row) });
  } catch (error) {
    console.error("[admin] Curious Minds review update failed:", error);
    return res.status(500).json({ error: "Curious Minds draft could not be updated." });
  }
});

export default router;
