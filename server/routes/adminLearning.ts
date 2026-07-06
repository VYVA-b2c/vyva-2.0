import { Router, type Request, type Response } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";
import { db } from "../db.js";
import { learningCategories, learningLessonImages, learningLessons } from "../../shared/schema.js";
import { normalizeLearningLanguage } from "../lib/learningProgram.js";

const lessonStatusSchema = z.enum(["draft", "review", "published", "archived"]);
const lessonDifficultySchema = z.enum(["easy", "medium", "deep"]);

const lessonBodySchema = z.object({
  externalId: z.string().trim().min(1).max(140).nullable().optional(),
  categorySlug: z.string().trim().min(1).max(80),
  language: z.string().trim().min(2).max(12).optional().default("en"),
  title: z.string().trim().min(1).max(160),
  hook: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(5000),
  reflectionPrompt: z.string().trim().min(1).max(300),
  sourceNotes: z.string().trim().max(1000).nullable().optional(),
  imageUrl: z.string().trim().max(1200).nullable().optional(),
  imageAlt: z.string().trim().max(300).nullable().optional(),
  imagePrompt: z.string().trim().max(1200).nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(15).optional().default(3),
  difficulty: lessonDifficultySchema.optional().default("easy"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  status: lessonStatusSchema.optional().default("draft"),
  isActive: z.boolean().optional().default(true),
});

const lessonPatchSchema = lessonBodySchema.partial();
const bulkPublishBodySchema = z.object({
  lessonIds: z.array(z.string().trim().min(1)).max(500).optional(),
}).optional();
const generateImageBodySchema = z.object({
  imagePrompt: z.string().trim().max(1200).nullable().optional(),
  imageAlt: z.string().trim().max(300).nullable().optional(),
}).optional();

const categoryBodySchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/),
  label: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().default(""),
  color: z.string().trim().min(1).max(40).optional().default("#7C3AED"),
  icon: z.string().trim().min(1).max(80).optional().default("book-open"),
  sortOrder: z.number().int().min(0).max(1000).optional().default(100),
  isActive: z.boolean().optional().default(true),
});

const categoryPatchSchema = categoryBodySchema.partial().omit({ slug: true });

type LearningLessonRow = typeof learningLessons.$inferSelect;
type LearningCategoryRow = typeof learningCategories.$inferSelect;

const learningLessonBaseSelection = {
  id: learningLessons.id,
  externalId: learningLessons.externalId,
  categorySlug: learningLessons.categorySlug,
  language: learningLessons.language,
  title: learningLessons.title,
  hook: learningLessons.hook,
  body: learningLessons.body,
  reflectionPrompt: learningLessons.reflectionPrompt,
  sourceNotes: learningLessons.sourceNotes,
  estimatedMinutes: learningLessons.estimatedMinutes,
  difficulty: learningLessons.difficulty,
  tags: learningLessons.tags,
  status: learningLessons.status,
  isActive: learningLessons.isActive,
  reviewedAt: learningLessons.reviewedAt,
  reviewedBy: learningLessons.reviewedBy,
  publishedAt: learningLessons.publishedAt,
  publishedBy: learningLessons.publishedBy,
  archivedAt: learningLessons.archivedAt,
  archivedBy: learningLessons.archivedBy,
  createdAt: learningLessons.createdAt,
  updatedAt: learningLessons.updatedAt,
};

function actor(req: Request) {
  return String(req.user?.email ?? req.user?.id ?? "admin");
}

function lessonTags(value: unknown) {
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === "string") : [];
}

function errorText(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) {
    const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
    return `${error.message} ${errorText(cause)}`.trim();
  }
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.message, record.detail, record.where, errorText(record.cause)].filter(Boolean).join(" ");
  }
  return String(error);
}

function isMissingLearningImageColumnError(error: unknown) {
  const text = errorText(error).toLowerCase();
  const code = typeof error === "object" && error ? String((error as Record<string, unknown>).code ?? "") : "";
  return (
    (code === "42703" || text.includes("does not exist")) &&
    (text.includes("image_url") || text.includes("image_alt") || text.includes("image_prompt"))
  );
}

async function selectLessonsForAdmin() {
  try {
    return await db
      .select()
      .from(learningLessons)
      .orderBy(desc(learningLessons.updatedAt), desc(learningLessons.createdAt))
      .limit(1000);
  } catch (error) {
    if (!isMissingLearningImageColumnError(error)) throw error;
    console.warn("[admin] learning image columns are missing; loading lessons without image metadata:", error);
    const rows = await db
      .select(learningLessonBaseSelection)
      .from(learningLessons)
      .orderBy(desc(learningLessons.updatedAt), desc(learningLessons.createdAt))
      .limit(1000);
    return rows.map((row) => ({
      ...row,
      imageUrl: null,
      imageAlt: null,
      imagePrompt: null,
    })) satisfies LearningLessonRow[];
  }
}

function serializeLesson(row: LearningLessonRow) {
  return {
    id: row.id,
    externalId: row.externalId,
    categorySlug: row.categorySlug,
    language: row.language,
    title: row.title,
    hook: row.hook,
    body: row.body,
    reflectionPrompt: row.reflectionPrompt,
    sourceNotes: row.sourceNotes,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    imagePrompt: row.imagePrompt,
    estimatedMinutes: row.estimatedMinutes,
    difficulty: row.difficulty,
    tags: lessonTags(row.tags),
    status: row.status,
    isActive: row.isActive,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishedBy: row.publishedBy,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    archivedBy: row.archivedBy,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeCategory(row: LearningCategoryRow) {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function lessonPatchForStatus(status: z.infer<typeof lessonStatusSchema> | undefined, reviewer: string) {
  const now = new Date();
  if (status === "published") {
    return {
      status,
      isActive: true,
      reviewedAt: now,
      reviewedBy: reviewer,
      publishedAt: now,
      publishedBy: reviewer,
      archivedAt: null,
      archivedBy: null,
    };
  }
  if (status === "archived") {
    return {
      status,
      isActive: false,
      archivedAt: now,
      archivedBy: reviewer,
    };
  }
  if (status === "draft") {
    return {
      status,
      isActive: false,
    };
  }
  if (status === "review") {
    return {
      status,
      isActive: false,
    };
  }
  return {};
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(row: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function numberValue(row: Record<string, unknown>, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function booleanValue(row: Record<string, unknown>, keys: string[], fallback: boolean) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "1", "active"].includes(normalized)) return true;
      if (["false", "no", "0", "inactive"].includes(normalized)) return false;
    }
  }
  return fallback;
}

function tagsValue(row: Record<string, unknown>) {
  const value = row.tags;
  if (Array.isArray(value)) {
    return value.map((tag) => typeof tag === "string" ? tag.trim() : "").filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

function normalizeImportStatus(value: string): z.infer<typeof lessonStatusSchema> {
  const normalized = value.trim().toLowerCase();
  if (normalized === "published") return "published";
  if (normalized === "archived") return "archived";
  if (normalized === "review" || normalized === "in_review" || normalized === "needs_review") return "review";
  return "draft";
}

function normalizeImportDifficulty(value: string): z.infer<typeof lessonDifficultySchema> {
  const normalized = value.trim().toLowerCase();
  if (normalized === "medium") return "medium";
  if (normalized === "deep" || normalized === "advanced") return "deep";
  return "easy";
}

function normalizeCategoryImport(raw: unknown) {
  const row = asObject(raw);
  return categoryBodySchema.safeParse({
    slug: stringValue(row, ["slug"]),
    label: stringValue(row, ["label"]),
    description: stringValue(row, ["description"], ""),
    color: stringValue(row, ["color"], "#7C3AED"),
    icon: stringValue(row, ["icon"], "book-open"),
    sortOrder: numberValue(row, ["sortOrder", "sort_order"], 100),
    isActive: booleanValue(row, ["isActive", "is_active"], true),
  });
}

function normalizeLessonImport(raw: unknown) {
  const row = asObject(raw);
  return lessonBodySchema.required({ externalId: true }).safeParse({
    externalId: stringValue(row, ["externalId", "external_id"]),
    categorySlug: stringValue(row, ["categorySlug", "category_slug"]),
    language: stringValue(row, ["language"], "en"),
    title: stringValue(row, ["title"]),
    hook: stringValue(row, ["hook"]),
    body: stringValue(row, ["body", "snippet"]),
    reflectionPrompt: stringValue(row, ["reflectionPrompt", "reflection_prompt"]),
    sourceNotes: stringValue(row, ["sourceNotes", "source_notes"], "") || null,
    imageUrl: stringValue(row, ["imageUrl", "image_url"], "") || null,
    imageAlt: stringValue(row, ["imageAlt", "image_alt"], "") || null,
    imagePrompt: stringValue(row, ["imagePrompt", "image_prompt"], "") || null,
    estimatedMinutes: numberValue(row, ["estimatedMinutes", "estimated_minutes"], 3),
    difficulty: normalizeImportDifficulty(stringValue(row, ["difficulty"], "easy")),
    tags: tagsValue(row),
    status: normalizeImportStatus(stringValue(row, ["status"], "draft")),
    isActive: booleanValue(row, ["isActive", "is_active"], false),
  });
}

function translationEntriesValue(row: Record<string, unknown>) {
  const translations = row.translations;
  if (Array.isArray(translations)) {
    return translations.map((translation, index) => ({
      label: `translation ${index + 1}`,
      language: stringValue(asObject(translation), ["language"]),
      row: asObject(translation),
    }));
  }
  if (translations && typeof translations === "object") {
    return Object.entries(translations as Record<string, unknown>).map(([language, translation]) => ({
      label: language,
      language,
      row: asObject(translation),
    }));
  }
  return [];
}

function expandLessonImportRows(raw: unknown, index: number, errors: string[]) {
  const row = asObject(raw);
  if (row.translations === undefined) return [raw];

  const translations = translationEntriesValue(row);
  if (translations.length === 0) {
    errors.push(`Lesson row ${index + 1} translations must be an object keyed by language or an array of translations.`);
    return [];
  }

  const baseExternalId = stringValue(row, ["externalIdBase", "external_id_base", "externalId", "external_id"]);
  if (!baseExternalId) {
    errors.push(`Lesson row ${index + 1} needs external_id_base when using translations.`);
    return [];
  }

  return translations.map((translation) => {
    const language = normalizeLearningLanguage(translation.language || stringValue(translation.row, ["language"], "en"));
    const externalId = stringValue(translation.row, ["externalId", "external_id"], `${baseExternalId}-${language}`);
    return {
      ...row,
      ...translation.row,
      externalId,
      language,
    };
  });
}

function nestedErrorField(error: unknown, field: string, seen = new Set<unknown>()): unknown {
  if (!error || typeof error !== "object" || seen.has(error)) return undefined;
  seen.add(error);
  const record = error as Record<string, unknown>;
  if (record[field] !== undefined) return record[field];
  return nestedErrorField(record.cause, field, seen);
}

function importDatabaseDetails(error: unknown) {
  if (!error || typeof error !== "object") return [];
  const code = nestedErrorField(error, "code");
  const hostname = nestedErrorField(error, "hostname");
  const message = error instanceof Error ? error.message : String(error);
  const nestedMessage = nestedErrorField(error, "message");
  const detail = nestedErrorField(error, "detail");
  const where = nestedErrorField(error, "where");
  const combinedMessage = [
    message,
    typeof nestedMessage === "string" ? nestedMessage : "",
    typeof detail === "string" ? detail : "",
    typeof where === "string" ? where : "",
  ].join(" ");
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || combinedMessage.includes("ENOTFOUND")) {
    const hostLabel = typeof hostname === "string" && hostname.trim() ? ` (${hostname})` : "";
    return [`The app database host${hostLabel} cannot be reached from this environment. Check DATABASE_URL or local network access, restart the API, and try again.`];
  }
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ECONNRESET") {
    return ["The app database connection was refused or timed out. Check that the database is running and reachable, restart the API, and try again."];
  }
  if (code === "42P01") {
    return ["The learning library database tables are missing. Run migrations/0045_learning_program.sql, then upload the pack again."];
  }
  if (code === "42P10") {
    return ["The learning library database needs its unique save rule repaired. Republish with the latest migration, then upload the pack again."];
  }
  if (code === "22P02" && combinedMessage.toLowerCase().includes("json")) {
    return ["The learning library database has drifted from the app schema: one or more lesson/category text fields are still JSON columns. Run migrations/0049_align_learning_text_columns.sql, then upload the pack again."];
  }
  if (code === "23505") {
    return ["The pack conflicts with existing learning content. Check for duplicate category slugs or lesson external IDs."];
  }
  if (code === "42703") {
    return ["The learning library database is missing a required column. Run the database audit and repair before uploading again."];
  }
  return [];
}

function learningImageUrl(imageId: string) {
  return `/api/learning/images/${imageId}`;
}

function generatedLessonImageAlt(lesson: LearningLessonRow, requestedAlt?: string | null) {
  const trimmed = requestedAlt?.trim();
  if (trimmed) return trimmed;
  const existing = lesson.imageAlt?.trim();
  if (existing) return existing;
  return `Illustration for ${lesson.title}`;
}

function generatedLessonImagePrompt(lesson: LearningLessonRow, requestedPrompt?: string | null) {
  const brief = requestedPrompt?.trim() || lesson.imagePrompt?.trim();
  const context = [
    `Lesson title: ${lesson.title}`,
    `Lesson category: ${lesson.categorySlug}`,
    `Lesson hook: ${lesson.hook}`,
    `Lesson body: ${lesson.body.slice(0, 700)}`,
  ].join("\n");

  return [
    "Create a custom lesson image for an older adult learning app.",
    "Use a warm, polished editorial illustration style with clear subject matter, natural colors, and gentle contrast.",
    "Make it specific to the lesson idea, not a generic category image.",
    "Do not include visible words, letters, labels, logos, UI, captions, charts, or brand marks.",
    "Avoid frightening, medical, political, religious, childish, or overly abstract imagery.",
    "Composition should work as a landscape lesson header image.",
    brief ? `Admin creative brief: ${brief}` : "Admin creative brief: infer the best image from the lesson content.",
    context,
  ].join("\n");
}

function generatedImageErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "Lesson image could not be generated.";
  const record = error as Record<string, unknown>;
  const status = typeof record.status === "number" ? record.status : undefined;
  if (status === 401) return "OpenAI image generation is not authorized. Check OPENAI_API_KEY.";
  if (status === 429) return "OpenAI image generation is rate limited. Try again in a moment.";
  if (status === 400) return "OpenAI could not generate from this prompt. Adjust the image prompt and try again.";
  return "Lesson image could not be generated.";
}

async function listCategoriesHandler(_req: Request, res: Response) {
  try {
    const rows = await db
      .select()
      .from(learningCategories)
      .orderBy(asc(learningCategories.sortOrder), asc(learningCategories.label));
    return res.json({ categories: rows.map(serializeCategory) });
  } catch (error) {
    console.error("[admin] learning categories load failed:", error);
    return res.status(500).json({ error: "Learning categories could not be loaded." });
  }
}

async function createCategoryHandler(req: Request, res: Response) {
  const parsed = categoryBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid learning category." });

  try {
    const [row] = await db
      .insert(learningCategories)
      .values(parsed.data)
      .onConflictDoUpdate({
        target: learningCategories.slug,
        set: {
          label: parsed.data.label,
          description: parsed.data.description,
          color: parsed.data.color,
          icon: parsed.data.icon,
          sortOrder: parsed.data.sortOrder,
          isActive: parsed.data.isActive,
          updatedAt: new Date(),
        },
      })
      .returning();
    return res.status(201).json({ category: serializeCategory(row) });
  } catch (error) {
    console.error("[admin] learning category save failed:", error);
    return res.status(500).json({ error: "Learning category could not be saved." });
  }
}

async function updateCategoryHandler(req: Request, res: Response) {
  const parsed = categoryPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid learning category update." });

  try {
    const [row] = await db
      .update(learningCategories)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(learningCategories.slug, req.params.slug))
      .returning();
    if (!row) return res.status(404).json({ error: "Learning category was not found." });
    return res.json({ category: serializeCategory(row) });
  } catch (error) {
    console.error("[admin] learning category update failed:", error);
    return res.status(500).json({ error: "Learning category could not be updated." });
  }
}

async function listLessonsHandler(req: Request, res: Response) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const category = typeof req.query.category === "string" ? req.query.category : "all";
    const language = typeof req.query.language === "string" ? req.query.language : "all";
    const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";

    const rows = await selectLessonsForAdmin();

    const filtered = rows.filter((lesson) => {
      if (status !== "all" && lesson.status !== status) return false;
      if (category !== "all" && lesson.categorySlug !== category) return false;
      if (language !== "all" && lesson.language !== language) return false;
      if (search) {
        const haystack = [
          lesson.title,
          lesson.hook,
          lesson.body,
          lesson.reflectionPrompt,
          lesson.categorySlug,
          ...lessonTags(lesson.tags),
        ].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    return res.json({ lessons: filtered.map(serializeLesson) });
  } catch (error) {
    console.error("[admin] learning lessons load failed:", error);
    return res.status(500).json({ error: "Learning lessons could not be loaded." });
  }
}

async function createLessonHandler(req: Request, res: Response) {
  const parsed = lessonBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid learning lesson." });

  const reviewer = actor(req);
  const values = {
    ...parsed.data,
    language: normalizeLearningLanguage(parsed.data.language),
    sourceNotes: parsed.data.sourceNotes ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
    imageAlt: parsed.data.imageAlt ?? null,
    imagePrompt: parsed.data.imagePrompt ?? null,
    tags: [...new Set(parsed.data.tags)],
    ...lessonPatchForStatus(parsed.data.status, reviewer),
  };

  try {
    const [row] = await db
      .insert(learningLessons)
      .values(values)
      .returning();
    return res.status(201).json({ lesson: serializeLesson(row) });
  } catch (error) {
    console.error("[admin] learning lesson create failed:", error);
    return res.status(500).json({ error: "Learning lesson could not be created." });
  }
}

async function updateLessonHandler(req: Request, res: Response) {
  const parsed = lessonPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid learning lesson update." });

  const reviewer = actor(req);
  const patch = {
    ...parsed.data,
    ...(parsed.data.language ? { language: normalizeLearningLanguage(parsed.data.language) } : {}),
    ...(parsed.data.sourceNotes === undefined ? {} : { sourceNotes: parsed.data.sourceNotes ?? null }),
    ...(parsed.data.imageUrl === undefined ? {} : { imageUrl: parsed.data.imageUrl ?? null }),
    ...(parsed.data.imageAlt === undefined ? {} : { imageAlt: parsed.data.imageAlt ?? null }),
    ...(parsed.data.imagePrompt === undefined ? {} : { imagePrompt: parsed.data.imagePrompt ?? null }),
    ...(parsed.data.tags ? { tags: [...new Set(parsed.data.tags)] } : {}),
    ...lessonPatchForStatus(parsed.data.status, reviewer),
    updatedAt: new Date(),
  };

  try {
    const [row] = await db
      .update(learningLessons)
      .set(patch)
      .where(eq(learningLessons.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ error: "Learning lesson was not found." });
    return res.json({ lesson: serializeLesson(row) });
  } catch (error) {
    console.error("[admin] learning lesson update failed:", error);
    return res.status(500).json({ error: "Learning lesson could not be updated." });
  }
}

async function generateLessonImageHandler(req: Request, res: Response) {
  const parsed = generateImageBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid image generation request." });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({ error: "OpenAI image generation is not configured. Add OPENAI_API_KEY, then try again." });
  }

  try {
    const [lesson] = await db
      .select()
      .from(learningLessons)
      .where(eq(learningLessons.id, req.params.id))
      .limit(1);
    if (!lesson) return res.status(404).json({ error: "Learning lesson was not found." });

    const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
    const outputFormat = "jpeg";
    const mimeType = "image/jpeg";
    const prompt = generatedLessonImagePrompt(lesson, parsed.data?.imagePrompt);
    const client = new OpenAI({ apiKey });
    const result = await client.images.generate({
      model,
      prompt,
      size: process.env.OPENAI_IMAGE_SIZE?.trim() || "1536x1024",
      quality: process.env.OPENAI_IMAGE_QUALITY?.trim() || "medium",
      output_format: outputFormat,
      output_compression: 82,
    });
    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64) {
      return res.status(502).json({ error: "OpenAI did not return image data. Try again." });
    }

    const [image] = await db
      .insert(learningLessonImages)
      .values({
        lessonId: lesson.id,
        mimeType,
        imageBytes: Buffer.from(imageBase64, "base64"),
        prompt,
        model,
        createdBy: actor(req),
      })
      .returning();

    const imageUrl = learningImageUrl(image.id);
    const imageAlt = generatedLessonImageAlt(lesson, parsed.data?.imageAlt);
    const [updated] = await db
      .update(learningLessons)
      .set({
        imageUrl,
        imageAlt,
        imagePrompt: parsed.data?.imagePrompt?.trim() || lesson.imagePrompt || prompt,
        updatedAt: new Date(),
      })
      .where(eq(learningLessons.id, lesson.id))
      .returning();

    return res.json({
      lesson: serializeLesson(updated ?? { ...lesson, imageUrl, imageAlt, imagePrompt: lesson.imagePrompt || prompt }),
      image: {
        id: image.id,
        url: imageUrl,
        mimeType,
        model,
      },
    });
  } catch (error) {
    console.error("[admin] learning lesson image generation failed:", error);
    return res.status(500).json({ error: generatedImageErrorMessage(error) });
  }
}

async function publishLessonHandler(req: Request, res: Response) {
  try {
    const [row] = await db
      .update(learningLessons)
      .set({ ...lessonPatchForStatus("published", actor(req)), updatedAt: new Date() })
      .where(eq(learningLessons.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ error: "Learning lesson was not found." });
    return res.json({ lesson: serializeLesson(row) });
  } catch (error) {
    console.error("[admin] learning lesson publish failed:", error);
    return res.status(500).json({ error: "Learning lesson could not be published." });
  }
}

async function bulkPublishDraftLessonsHandler(req: Request, res: Response) {
  const parsed = bulkPublishBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Selected lessons are invalid." });

  const hasSelection = Array.isArray(parsed.data?.lessonIds);
  const lessonIds = [...new Set(parsed.data?.lessonIds ?? [])];
  if (hasSelection && lessonIds.length === 0) {
    return res.json({
      summary: {
        lessonsPublished: 0,
      },
      lessons: [],
    });
  }

  try {
    const publishableStatus = inArray(learningLessons.status, ["draft", "review"]);
    const whereClause = hasSelection
      ? and(inArray(learningLessons.id, lessonIds), publishableStatus)
      : publishableStatus;
    const rows = await db
      .update(learningLessons)
      .set({ ...lessonPatchForStatus("published", actor(req)), updatedAt: new Date() })
      .where(whereClause)
      .returning();

    return res.json({
      summary: {
        lessonsPublished: rows.length,
      },
      lessons: rows.map(serializeLesson),
    });
  } catch (error) {
    console.error("[admin] learning lessons bulk publish failed:", error);
    return res.status(500).json({ error: "Learning lessons could not be published." });
  }
}

async function archiveLessonHandler(req: Request, res: Response) {
  try {
    const [row] = await db
      .update(learningLessons)
      .set({ ...lessonPatchForStatus("archived", actor(req)), updatedAt: new Date() })
      .where(eq(learningLessons.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ error: "Learning lesson was not found." });
    return res.json({ lesson: serializeLesson(row) });
  } catch (error) {
    console.error("[admin] learning lesson archive failed:", error);
    return res.status(500).json({ error: "Learning lesson could not be archived." });
  }
}

async function importContentPackHandler(req: Request, res: Response) {
  const pack = asObject(req.body);
  const categoriesRaw = Array.isArray(pack.categories) ? pack.categories : [];
  const lessonsRaw = Array.isArray(pack.lessons) ? pack.lessons : [];

  if (categoriesRaw.length === 0 && lessonsRaw.length === 0) {
    return res.status(400).json({ error: "Upload a content pack with categories and/or lessons." });
  }

  const errors: string[] = [];
  const categories = categoriesRaw.map((category, index) => {
    const parsed = normalizeCategoryImport(category);
    if (!parsed.success) {
      errors.push(`Category row ${index + 1} is invalid.`);
      return null;
    }
    return parsed.data;
  }).filter((category): category is z.infer<typeof categoryBodySchema> => Boolean(category));

  const expandedLessonsRaw = lessonsRaw.flatMap((lesson, index) => expandLessonImportRows(lesson, index, errors));
  const lessons = expandedLessonsRaw.map((lesson, index) => {
    const parsed = normalizeLessonImport(lesson);
    if (!parsed.success) {
      errors.push(`Lesson row ${index + 1} is invalid.`);
      return null;
    }
    return {
      ...parsed.data,
      externalId: parsed.data.externalId!,
      language: normalizeLearningLanguage(parsed.data.language),
      tags: [...new Set(parsed.data.tags)],
      sourceNotes: parsed.data.sourceNotes ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      imageAlt: parsed.data.imageAlt ?? null,
      imagePrompt: parsed.data.imagePrompt ?? null,
    };
  }).filter((lesson): lesson is z.infer<typeof lessonBodySchema> & { externalId: string } => Boolean(lesson));

  const duplicateCategorySlugs = categories
    .map((category) => category.slug)
    .filter((slug, index, all) => all.indexOf(slug) !== index);
  const duplicateExternalIds = lessons
    .map((lesson) => lesson.externalId)
    .filter((externalId, index, all) => all.indexOf(externalId) !== index);

  if (duplicateCategorySlugs.length) {
    errors.push(`Duplicate category slug(s): ${[...new Set(duplicateCategorySlugs)].join(", ")}.`);
  }
  if (duplicateExternalIds.length) {
    errors.push(`Duplicate lesson external_id(s): ${[...new Set(duplicateExternalIds)].join(", ")}.`);
  }

  try {
    const [existingCategories, existingLessons] = await Promise.all([
      db.select({ slug: learningCategories.slug }).from(learningCategories).limit(5000),
      db.select({ externalId: learningLessons.externalId }).from(learningLessons).limit(10000),
    ]);
    const knownCategorySlugs = new Set([
      ...existingCategories.map((category) => category.slug),
      ...categories.map((category) => category.slug),
    ]);
    const missingCategorySlugs = lessons
      .map((lesson) => lesson.categorySlug)
      .filter((slug) => !knownCategorySlugs.has(slug));
    if (missingCategorySlugs.length) {
      errors.push(`Unknown category_slug(s): ${[...new Set(missingCategorySlugs)].join(", ")}. Add them to the categories section first.`);
    }

    if (errors.length) {
      return res.status(400).json({ error: "Learning content pack could not be imported.", details: errors });
    }

    const existingCategorySlugs = new Set(existingCategories.map((category) => category.slug));
    const existingExternalIds = new Set(existingLessons.map((lesson) => lesson.externalId).filter(Boolean));
    const reviewer = actor(req);
    const now = new Date();

    await db.transaction(async (tx) => {
      for (const category of categories) {
        const categoryPatch = {
          label: category.label,
          description: category.description,
          color: category.color,
          icon: category.icon,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          updatedAt: now,
        };
        const updated = await tx
          .update(learningCategories)
          .set(categoryPatch)
          .where(eq(learningCategories.slug, category.slug))
          .returning({ id: learningCategories.id });
        if (updated.length === 0) {
          await tx
            .insert(learningCategories)
            .values(category);
        }
      }

      for (const lesson of lessons) {
        const statusPatch = lessonPatchForStatus(lesson.status, reviewer);
        const lessonPatch = {
          categorySlug: lesson.categorySlug,
          language: lesson.language,
          title: lesson.title,
          hook: lesson.hook,
          body: lesson.body,
          reflectionPrompt: lesson.reflectionPrompt,
          sourceNotes: lesson.sourceNotes ?? null,
          imageUrl: lesson.imageUrl ?? null,
          imageAlt: lesson.imageAlt ?? null,
          imagePrompt: lesson.imagePrompt ?? null,
          estimatedMinutes: lesson.estimatedMinutes,
          difficulty: lesson.difficulty,
          tags: lesson.tags,
          ...statusPatch,
          updatedAt: now,
        };
        const updated = await tx
          .update(learningLessons)
          .set(lessonPatch)
          .where(eq(learningLessons.externalId, lesson.externalId))
          .returning({ id: learningLessons.id });
        if (updated.length === 0) {
          await tx
            .insert(learningLessons)
            .values({
              ...lesson,
              ...statusPatch,
            });
        }
      }
    });

    return res.json({
      summary: {
        categoriesCreated: categories.filter((category) => !existingCategorySlugs.has(category.slug)).length,
        categoriesUpdated: categories.filter((category) => existingCategorySlugs.has(category.slug)).length,
        lessonsCreated: lessons.filter((lesson) => !existingExternalIds.has(lesson.externalId)).length,
        lessonsUpdated: lessons.filter((lesson) => existingExternalIds.has(lesson.externalId)).length,
        lessonsPublished: lessons.filter((lesson) => lesson.status === "published").length,
        lessonsArchived: lessons.filter((lesson) => lesson.status === "archived").length,
      },
    });
  } catch (error) {
    console.error("[admin] learning import failed:", error);
    const details = importDatabaseDetails(error);
    return res.status(500).json({
      error: "Learning content pack could not be imported.",
      ...(details.length > 0 ? { details } : {}),
    });
  }
}

const router = Router();
router.get("/categories", listCategoriesHandler);
router.post("/categories", createCategoryHandler);
router.patch("/categories/:slug", updateCategoryHandler);
router.post("/import", importContentPackHandler);
router.get("/lessons", listLessonsHandler);
router.post("/lessons", createLessonHandler);
router.patch("/lessons/bulk-publish", bulkPublishDraftLessonsHandler);
router.patch("/lessons/:id", updateLessonHandler);
router.post("/lessons/:id/generate-image", generateLessonImageHandler);
router.patch("/lessons/:id/publish", publishLessonHandler);
router.patch("/lessons/:id/archive", archiveLessonHandler);

export default router;
