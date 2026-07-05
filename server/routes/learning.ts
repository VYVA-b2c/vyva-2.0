import { Router, type Request, type Response } from "express";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import {
  learningCategories,
  learningLessons,
  learningProgramEvents,
  learningProgramItems,
  learningPrograms,
  profiles,
  scheduledEvents,
} from "../../shared/schema.js";
import {
  LEARNING_PROGRAM_DAYS,
  addDays,
  isoDateKey,
  normalizeLearningLanguage,
  normalizeLearningPreferences,
  selectLessonsForLearningProgram,
  utcDateFromKey,
  type LearningLessonCandidate,
} from "../lib/learningProgram.js";

const programCreateSchema = z.object({
  interests: z.array(z.string()).optional().default(["general_knowledge"]),
  pace: z.enum(["gentle", "steady", "curious"]).optional().default("gentle"),
  dailyTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().default("09:00"),
  lessonLengthMinutes: z.number().int().min(1).max(8).optional().default(3),
});

const eventSchema = z.object({
  programId: z.string().uuid(),
  programItemId: z.string().uuid(),
  eventType: z.enum(["started", "completed", "saved", "skipped"]),
  source: z.string().trim().min(1).max(80).optional().default("learn_hub"),
  metadata: z.record(z.unknown()).optional().default({}),
});

type LearningCategoryRow = typeof learningCategories.$inferSelect;
type LearningLessonRow = typeof learningLessons.$inferSelect;
type LearningProgramRow = typeof learningPrograms.$inferSelect;
type LearningProgramItemRow = typeof learningProgramItems.$inferSelect;

type ProgramItemWithLesson = LearningProgramItemRow & {
  lesson: LearningLessonRow | null;
};

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
  };
}

function serializeLesson(row: LearningLessonRow | null) {
  if (!row) return null;
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
    tags: row.tags ?? [],
    status: row.status,
    isActive: row.isActive,
  };
}

function serializeProgramItem(row: ProgramItemWithLesson) {
  return {
    id: row.id,
    programId: row.programId,
    lessonId: row.lessonId,
    programDay: row.programDay,
    scheduledDate: row.scheduledDate,
    status: row.status,
    completedAt: row.completedAt?.toISOString() ?? null,
    savedAt: row.savedAt?.toISOString() ?? null,
    skippedAt: row.skippedAt?.toISOString() ?? null,
    lesson: serializeLesson(row.lesson),
  };
}

function serializeProgram(row: LearningProgramRow, items: ProgramItemWithLesson[]) {
  const sorted = [...items].sort((a, b) => a.programDay - b.programDay);
  const completedCount = sorted.filter((item) => item.status === "completed" || item.completedAt).length;
  return {
    id: row.id,
    status: row.status,
    interests: row.interests ?? [],
    pace: row.pace,
    dailyTime: row.dailyTime,
    lessonLengthMinutes: row.lessonLengthMinutes,
    language: row.language,
    startDate: row.startDate,
    endDate: row.endDate,
    completedAt: row.completedAt?.toISOString() ?? null,
    items: sorted.map(serializeProgramItem),
    progress: {
      completedCount,
      totalCount: sorted.length,
      allComplete: sorted.length > 0 && completedCount === sorted.length,
      currentDay: Math.min(sorted.length, Math.max(1, completedCount + 1)),
    },
  };
}

function todayItem(items: ProgramItemWithLesson[], now = new Date()) {
  const today = isoDateKey(now);
  const sorted = [...items].sort((a, b) => a.programDay - b.programDay);
  const dueOpen = sorted.find((item) => item.scheduledDate <= today && item.status !== "completed");
  const exact = sorted.find((item) => item.scheduledDate === today);
  return dueOpen ?? exact ?? sorted.at(-1) ?? null;
}

function scheduledFor(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time}:00.000Z`);
}

async function loadCategories() {
  return db
    .select()
    .from(learningCategories)
    .where(eq(learningCategories.isActive, true))
    .orderBy(asc(learningCategories.sortOrder), asc(learningCategories.label));
}

async function loadProfile(userId: string) {
  const [profile] = await db
    .select({
      language: profiles.language,
      languagePreference: profiles.language_preference,
      timezone: profiles.timezone,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return {
    language: normalizeLearningLanguage(profile?.languagePreference ?? profile?.language),
    timezone: profile?.timezone ?? "Europe/Madrid",
  };
}

async function loadProgramItems(programId: string): Promise<ProgramItemWithLesson[]> {
  const rows = await db
    .select()
    .from(learningProgramItems)
    .where(eq(learningProgramItems.programId, programId))
    .orderBy(asc(learningProgramItems.programDay));
  if (rows.length === 0) return [];

  const lessonIds = rows.map((item) => item.lessonId);
  const lessons = await db
    .select()
    .from(learningLessons)
    .where(inArray(learningLessons.id, lessonIds));
  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  return rows.map((row) => ({ ...row, lesson: lessonsById.get(row.lessonId) ?? null }));
}

async function loadActiveProgram(userId: string) {
  const [program] = await db
    .select()
    .from(learningPrograms)
    .where(and(eq(learningPrograms.userId, userId), eq(learningPrograms.status, "active")))
    .orderBy(desc(learningPrograms.startDate))
    .limit(1);
  if (!program) return null;
  const items = await loadProgramItems(program.id);
  return { program, items };
}

async function loadVisibleProgram(userId: string) {
  const active = await loadActiveProgram(userId);
  if (active) return active;

  const [program] = await db
    .select()
    .from(learningPrograms)
    .where(eq(learningPrograms.userId, userId))
    .orderBy(desc(learningPrograms.startDate))
    .limit(1);
  if (!program) return null;
  const items = await loadProgramItems(program.id);
  return { program, items };
}

async function learningProfileHandler(req: Request, res: Response) {
  try {
    const [categories, active] = await Promise.all([
      loadCategories(),
      loadVisibleProgram(req.user!.id),
    ]);

    return res.json({
      categories: categories.map(serializeCategory),
      activeProgram: active ? serializeProgram(active.program, active.items) : null,
    });
  } catch (error) {
    console.error("[learning] profile load failed:", error);
    return res.status(500).json({ error: "Learning profile could not be loaded." });
  }
}

async function learningTodayHandler(req: Request, res: Response) {
  try {
    const [categories, visible] = await Promise.all([
      loadCategories(),
      loadVisibleProgram(req.user!.id),
    ]);

    if (!visible) {
      return res.json({
        onboardingRequired: true,
        categories: categories.map(serializeCategory),
        program: null,
        todayItem: null,
      });
    }

    return res.json({
      onboardingRequired: false,
      categories: categories.map(serializeCategory),
      program: serializeProgram(visible.program, visible.items),
      todayItem: visible.program.status === "completed"
        ? null
        : visible.items.length
          ? serializeProgramItem(todayItem(visible.items) ?? visible.items[0])
          : null,
    });
  } catch (error) {
    console.error("[learning] today load failed:", error);
    return res.status(500).json({ error: "Today's learning lesson could not be loaded." });
  }
}

async function createLearningProgramHandler(req: Request, res: Response) {
  const parsed = programCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid learning program preferences." });
  }

  try {
    const [profile, categories] = await Promise.all([
      loadProfile(req.user!.id),
      loadCategories(),
    ]);
    const activeCategorySlugs = categories.map((category) => category.slug);
    const preferences = normalizeLearningPreferences({
      ...parsed.data,
      language: profile.language,
    }, activeCategorySlugs);
    const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [lessonRows, recentRows] = await Promise.all([
      db
        .select()
        .from(learningLessons)
        .where(and(eq(learningLessons.status, "published"), eq(learningLessons.isActive, true)))
        .orderBy(asc(learningLessons.categorySlug), asc(learningLessons.title))
        .limit(500),
      db
        .select({ lessonId: learningProgramItems.lessonId })
        .from(learningProgramItems)
        .where(and(
          eq(learningProgramItems.userId, req.user!.id),
          gte(learningProgramItems.completedAt, recentCutoff),
        ))
        .limit(200),
    ]);

    const selectedLessons = selectLessonsForLearningProgram({
      lessons: lessonRows as LearningLessonCandidate[],
      interests: preferences.interests,
      allowedInterests: activeCategorySlugs,
      language: preferences.language,
      recentlyCompletedLessonIds: recentRows.map((row) => row.lessonId),
      days: LEARNING_PROGRAM_DAYS,
    });

    if (selectedLessons.length < LEARNING_PROGRAM_DAYS) {
      return res.status(409).json({ error: "At least seven published learning lessons are required to create a program." });
    }

    const start = new Date();
    const startDate = isoDateKey(start);
    const endDate = isoDateKey(addDays(utcDateFromKey(startDate), LEARNING_PROGRAM_DAYS - 1));

    const result = await db.transaction(async (tx) => {
      await tx
        .update(learningPrograms)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(learningPrograms.userId, req.user!.id), eq(learningPrograms.status, "active")));

      const [program] = await tx
        .insert(learningPrograms)
        .values({
          userId: req.user!.id,
          status: "active",
          interests: preferences.interests,
          pace: preferences.pace,
          dailyTime: preferences.dailyTime,
          lessonLengthMinutes: preferences.lessonLengthMinutes,
          language: preferences.language,
          startDate,
          endDate,
        })
        .returning();

      const itemRows = selectedLessons.map((lesson, index) => ({
        programId: program.id,
        userId: req.user!.id,
        lessonId: lesson.id,
        programDay: index + 1,
        scheduledDate: isoDateKey(addDays(utcDateFromKey(startDate), index)),
        status: "recommended",
      }));
      const items = await tx.insert(learningProgramItems).values(itemRows).returning();

      await tx.insert(scheduledEvents).values(items.map((item) => ({
        user_id: req.user!.id,
        event_type: "learning_snippet",
        title: `Learn Something New: Day ${item.programDay}`,
        description: "Open today's short learning snippet in VYVA.",
        channel: "app",
        scheduled_for: scheduledFor(item.scheduledDate, preferences.dailyTime),
        timezone: profile.timezone,
        recurrence: "none",
        status: "upcoming",
        source: "learning_program",
        metadata: {
          program_id: program.id,
          program_item_id: item.id,
          lesson_id: item.lessonId,
          program_day: item.programDay,
        },
        created_by: "learning_program",
        updated_by: "learning_program",
      })));

      return { program, items };
    });

    const itemsWithLessons = await loadProgramItems(result.program.id);
    return res.status(201).json({
      program: serializeProgram(result.program, itemsWithLessons),
      todayItem: itemsWithLessons.length ? serializeProgramItem(todayItem(itemsWithLessons) ?? itemsWithLessons[0]) : null,
    });
  } catch (error) {
    console.error("[learning] program create failed:", error);
    return res.status(500).json({ error: "Learning program could not be created." });
  }
}

async function learningEventHandler(req: Request, res: Response) {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid learning event." });
  }

  const data = parsed.data;
  try {
    const [program] = await db
      .select()
      .from(learningPrograms)
      .where(and(
        eq(learningPrograms.id, data.programId),
        eq(learningPrograms.userId, req.user!.id),
      ))
      .limit(1);
    if (!program) return res.status(404).json({ error: "Learning program was not found." });

    const [item] = await db
      .select()
      .from(learningProgramItems)
      .where(and(
        eq(learningProgramItems.id, data.programItemId),
        eq(learningProgramItems.programId, data.programId),
        eq(learningProgramItems.userId, req.user!.id),
      ))
      .limit(1);
    if (!item) return res.status(404).json({ error: "Learning program item was not found." });

    const now = new Date();
    const itemPatch: Partial<LearningProgramItemRow> = { updatedAt: now };
    if (data.eventType === "completed") {
      itemPatch.status = "completed";
      itemPatch.completedAt = item.completedAt ?? now;
    } else if (data.eventType === "saved") {
      itemPatch.status = item.status === "completed" ? "completed" : "saved";
      itemPatch.savedAt = item.savedAt ?? now;
    } else if (data.eventType === "skipped") {
      itemPatch.status = item.status === "completed" ? "completed" : "skipped";
      itemPatch.skippedAt = item.skippedAt ?? now;
    }

    await db.transaction(async (tx) => {
      if (data.eventType !== "started") {
        await tx
          .update(learningProgramItems)
          .set(itemPatch)
          .where(eq(learningProgramItems.id, item.id));
      }

      await tx.insert(learningProgramEvents).values({
        programId: program.id,
        programItemId: item.id,
        lessonId: item.lessonId,
        userId: req.user!.id,
        eventType: data.eventType,
        source: data.source,
        metadata: data.metadata,
      });

      if (data.eventType === "completed") {
        const items = await tx
          .select()
          .from(learningProgramItems)
          .where(eq(learningProgramItems.programId, program.id));
        const allComplete = items.length > 0 && items.every((candidate) => (
          candidate.id === item.id || candidate.status === "completed" || Boolean(candidate.completedAt)
        ));
        if (allComplete) {
          await tx
            .update(learningPrograms)
            .set({ status: "completed", completedAt: now, updatedAt: now })
            .where(eq(learningPrograms.id, program.id));
        }
      }
    });

    const active = await loadActiveProgram(req.user!.id);
    if (!active) {
      const completedItems = await loadProgramItems(program.id);
      return res.json({
        program: serializeProgram({ ...program, status: "completed", completedAt: now }, completedItems),
        todayItem: null,
      });
    }

    return res.json({
      program: serializeProgram(active.program, active.items),
      todayItem: active.items.length ? serializeProgramItem(todayItem(active.items) ?? active.items[0]) : null,
    });
  } catch (error) {
    console.error("[learning] event failed:", error);
    return res.status(500).json({ error: "Learning event could not be saved." });
  }
}

const router = Router();
router.get("/profile", learningProfileHandler);
router.get("/today", learningTodayHandler);
router.post("/programs", createLearningProgramHandler);
router.post("/events", learningEventHandler);

export default router;
