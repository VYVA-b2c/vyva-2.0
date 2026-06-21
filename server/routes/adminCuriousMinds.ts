import { Router, type Request, type Response } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { curiousMindsHooks, curiousMindsPrompts } from "../../shared/schema.js";

const reviewQuerySchema = z.object({
  type: z.enum(["hooks", "prompts"]).default("hooks"),
});

const reviewPatchSchema = z.object({
  action: z.enum(["approve", "reject"]),
  values: z.record(z.string()).optional().default({}),
  reviewer: z.string().trim().min(1).max(160).optional(),
});

function reviewerFor(req: Request, requested?: string) {
  return requested ?? String(req.user?.email ?? req.user?.id ?? "admin");
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

const router = Router();

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

    const rows = await db
      .select()
      .from(curiousMindsPrompts)
      .where(and(eq(curiousMindsPrompts.isActive, false), isNull(curiousMindsPrompts.reviewedAt)))
      .orderBy(asc(curiousMindsPrompts.createdAt))
      .limit(200);
    return res.json({ items: rows.map(serializePrompt) });
  } catch (error) {
    console.error("[admin] Curious Minds review load failed:", error);
    return res.status(500).json({ error: "Curious Minds drafts could not be loaded." });
  }
});

router.patch("/review/:type/:id", async (req: Request, res: Response) => {
  const type = req.params.type;
  if (type !== "hooks" && type !== "prompts") {
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
  } catch (error) {
    console.error("[admin] Curious Minds review update failed:", error);
    return res.status(500).json({ error: "Curious Minds draft could not be updated." });
  }
});

export default router;
