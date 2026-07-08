import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import {
  DEFAULT_BREATHING_EXERCISES,
  breathingExerciseFromRow,
  buildBreathingPlan,
  recommendBreathingExercises,
  type BreathingIntent,
  type BreathingPlan,
  type BreathingPreferenceSnapshot,
} from "../lib/breathingCoach.js";
import {
  activityLogs,
} from "../../shared/schema.js";
import {
  breathingExercises,
  breathingSessionEvents,
  breathingSessions,
  breathingUserPreferences,
} from "../../shared/breathingSchema.js";

const router = Router();

const intentSchema = z.object({
  mood: z.string().trim().max(80).optional(),
  purpose: z.string().trim().max(80).optional(),
  difficulty: z.union([
    z.number().int().min(1).max(5),
    z.enum(["easy", "medium", "harder"]),
  ]).optional(),
  durationMinutes: z.number().int().min(1).max(20).optional(),
  mode: z.enum(["voice", "visual"]).optional(),
  safetyFlags: z.array(z.string().trim().max(80)).max(12).optional(),
  freeText: z.string().trim().max(800).optional(),
});

const sessionStatusSchema = z.enum(["planned", "active", "paused", "stopped", "completed"]);

const recommendBodySchema = z.object({
  intent: intentSchema.default({}),
  limit: z.number().int().min(1).max(5).optional(),
});

const createSessionBodySchema = z.object({
  exerciseSlug: z.string().trim().min(1),
  intent: intentSchema.default({}),
  plan: z.unknown().optional(),
  source: z.enum(["app", "voice", "caregiver"]).default("app"),
  voiceSessionId: z.string().trim().max(180).optional(),
  status: sessionStatusSchema.default("planned"),
});

const updateSessionBodySchema = z.object({
  status: sessionStatusSchema.optional(),
  moodAfter: z.string().trim().max(80).optional(),
  comfortRating: z.number().int().min(1).max(5).optional(),
  stoppedReason: z.string().trim().max(240).optional(),
  eventType: z.string().trim().max(80).optional(),
  eventPayload: z.record(z.unknown()).optional(),
});

const eventBodySchema = z.object({
  eventType: z.string().trim().min(1).max(80),
  payload: z.record(z.unknown()).default({}),
});

async function activeProfileId(req: Request, res: Response) {
  const accountUserId = req.user?.id;
  if (!accountUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }

  const profileContext = await getActiveProfileContext(accountUserId);
  if (!profileContext.profileId) {
    res.status(409).json({
      error: "Profile setup required before breathing sessions can be personalized.",
      needs_profile_setup: profileContext.needsProfileSetup,
      needs_profile_selection: profileContext.needsProfileSelection,
    });
    return null;
  }

  return profileContext.profileId;
}

async function loadExerciseCatalog() {
  try {
    const rows = await db
      .select()
      .from(breathingExercises)
      .where(eq(breathingExercises.is_active, true))
      .orderBy(breathingExercises.difficulty, breathingExercises.name);

    return rows.length > 0 ? rows.map(breathingExerciseFromRow) : DEFAULT_BREATHING_EXERCISES;
  } catch (err) {
    console.warn("[breathing] exercise catalog unavailable; using fallback catalog.", err);
    return DEFAULT_BREATHING_EXERCISES;
  }
}

async function loadPreferences(profileId: string): Promise<BreathingPreferenceSnapshot | null> {
  try {
    const [row] = await db
      .select()
      .from(breathingUserPreferences)
      .where(eq(breathingUserPreferences.user_id, profileId))
      .limit(1);
    return row ?? null;
  } catch (err) {
    console.warn("[breathing] preferences unavailable; continuing without saved preferences.", err);
    return null;
  }
}

async function loadRecentSessions(profileId: string) {
  try {
    return await db
      .select()
      .from(breathingSessions)
      .where(eq(breathingSessions.user_id, profileId))
      .orderBy(desc(breathingSessions.created_at))
      .limit(8);
  } catch (err) {
    console.warn("[breathing] recent sessions unavailable; continuing without history.", err);
    return [];
  }
}

function serializeExercise(exercise: Awaited<ReturnType<typeof loadExerciseCatalog>>[number]) {
  return {
    slug: exercise.slug,
    name: exercise.name,
    description: exercise.description,
    purposes: exercise.purposes,
    moodTags: exercise.moodTags,
    difficulty: exercise.difficulty,
    durationOptions: exercise.durationOptions,
    defaultDurationMinutes: exercise.defaultDurationMinutes,
    pattern: exercise.pattern,
    safetyNotes: exercise.safetyNotes,
    contraindications: exercise.contraindications,
    voiceStyle: exercise.voiceStyle,
    phases: exercise.phases,
    progression: exercise.progression,
    language: exercise.language,
  };
}

function serializeSession(row: typeof breathingSessions.$inferSelect) {
  return {
    id: row.id,
    userId: row.user_id,
    source: row.source,
    voiceSessionId: row.voice_session_id,
    exerciseSlug: row.exercise_slug,
    status: row.status,
    purpose: row.purpose,
    moodBefore: row.mood_before,
    moodAfter: row.mood_after,
    intent: row.intent,
    plan: row.plan,
    difficulty: row.difficulty,
    durationMinutes: row.duration_minutes,
    comfortRating: row.comfort_rating,
    stoppedReason: row.stopped_reason,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function planFromUnknown(value: unknown): BreathingPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const maybePlan = value as Partial<BreathingPlan>;
  if (
    typeof maybePlan.exerciseSlug === "string" &&
    typeof maybePlan.title === "string" &&
    typeof maybePlan.durationMinutes === "number" &&
    Array.isArray(maybePlan.phases)
  ) {
    return maybePlan as BreathingPlan;
  }
  return null;
}

async function recordSessionEvent(profileId: string, sessionId: string, eventType: string, payload: Record<string, unknown> = {}) {
  await db.insert(breathingSessionEvents).values({
    user_id: profileId,
    session_id: sessionId,
    event_type: eventType,
    payload,
  });
}

router.get("/exercises", async (_req: Request, res: Response) => {
  const exercises = await loadExerciseCatalog();
  return res.json({ exercises: exercises.map(serializeExercise) });
});

router.get("/me", async (req: Request, res: Response) => {
  const profileId = await activeProfileId(req, res);
  if (!profileId) return;

  const [preferences, recentSessions] = await Promise.all([
    loadPreferences(profileId),
    loadRecentSessions(profileId),
  ]);

  return res.json({
    preferences,
    recentSessions: recentSessions.map(serializeSession),
  });
});

router.post("/recommend", async (req: Request, res: Response) => {
  const profileId = await activeProfileId(req, res);
  if (!profileId) return;

  const parsed = recommendBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const [exercises, preferences, recentSessions] = await Promise.all([
    loadExerciseCatalog(),
    loadPreferences(profileId),
    loadRecentSessions(profileId),
  ]);

  const recommendation = recommendBreathingExercises({
    intent: parsed.data.intent as BreathingIntent,
    preferences,
    recentSessions,
    exercises,
    limit: parsed.data.limit,
  });

  return res.json({
    ...recommendation,
    preferenceSnapshot: preferences ?? {},
  });
});

router.post("/sessions", async (req: Request, res: Response) => {
  const profileId = await activeProfileId(req, res);
  if (!profileId) return;

  const parsed = createSessionBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const [exercises, preferences] = await Promise.all([
    loadExerciseCatalog(),
    loadPreferences(profileId),
  ]);
  const exercise = exercises.find((item) => item.slug === parsed.data.exerciseSlug);
  if (!exercise) {
    return res.status(404).json({ error: "Breathing exercise not found" });
  }

  const plan = planFromUnknown(parsed.data.plan) ?? buildBreathingPlan(exercise, parsed.data.intent as BreathingIntent, preferences);
  const now = new Date();

  try {
    const [session] = await db
      .insert(breathingSessions)
      .values({
        user_id: profileId,
        source: parsed.data.source,
        voice_session_id: parsed.data.voiceSessionId,
        exercise_id: exercise.id,
        exercise_slug: exercise.slug,
        status: parsed.data.status,
        purpose: plan.purpose,
        mood_before: parsed.data.intent.mood,
        intent: parsed.data.intent,
        plan,
        preference_snapshot: preferences ?? {},
        difficulty: plan.difficulty,
        duration_minutes: plan.durationMinutes,
        started_at: parsed.data.status === "active" ? now : null,
      })
      .returning();

    await recordSessionEvent(profileId, session.id, "session_created", {
      status: parsed.data.status,
      exerciseSlug: exercise.slug,
      purpose: plan.purpose,
    });

    return res.status(201).json({ session: serializeSession(session), plan });
  } catch (err) {
    console.error("[breathing POST /sessions]", err);
    return res.status(500).json({ error: "Failed to save breathing session" });
  }
});

router.patch("/sessions/:id", async (req: Request, res: Response) => {
  const profileId = await activeProfileId(req, res);
  if (!profileId) return;

  const parsed = updateSessionBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const now = new Date();
  const updates: Partial<typeof breathingSessions.$inferInsert> = {
    updated_at: now,
  };

  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.moodAfter !== undefined) updates.mood_after = parsed.data.moodAfter;
  if (parsed.data.comfortRating !== undefined) updates.comfort_rating = parsed.data.comfortRating;
  if (parsed.data.stoppedReason !== undefined) updates.stopped_reason = parsed.data.stoppedReason;
  if (parsed.data.status === "active") updates.started_at = now;
  if (parsed.data.status === "completed") updates.completed_at = now;

  try {
    const [session] = await db
      .update(breathingSessions)
      .set(updates)
      .where(and(
        eq(breathingSessions.id, req.params.id),
        eq(breathingSessions.user_id, profileId),
      ))
      .returning();

    if (!session) {
      return res.status(404).json({ error: "Breathing session not found" });
    }

    const eventType = parsed.data.eventType ?? (parsed.data.status ? `session_${parsed.data.status}` : "session_updated");
    await recordSessionEvent(profileId, session.id, eventType, parsed.data.eventPayload ?? {});

    if (session.status === "completed") {
      await Promise.all([
        db.insert(breathingUserPreferences)
          .values({
            user_id: profileId,
            preferred_difficulty: session.difficulty,
            preferred_duration_minutes: session.duration_minutes,
            last_completed_exercise_slug: session.exercise_slug,
            last_mood: session.mood_after ?? session.mood_before,
          })
          .onConflictDoUpdate({
            target: breathingUserPreferences.user_id,
            set: {
              preferred_difficulty: session.difficulty,
              preferred_duration_minutes: session.duration_minutes,
              last_completed_exercise_slug: session.exercise_slug,
              last_mood: session.mood_after ?? session.mood_before,
              updated_at: sql`NOW()`,
            },
          }),
        db.insert(activityLogs).values({
          user_id: profileId,
          activity_type: "CalmBreathing",
          duration_minutes: session.duration_minutes,
          calories: Math.max(1, Math.round(session.duration_minutes * 2)),
        }),
      ]);
    }

    return res.json({ session: serializeSession(session) });
  } catch (err) {
    console.error("[breathing PATCH /sessions/:id]", err);
    return res.status(500).json({ error: "Failed to update breathing session" });
  }
});

router.post("/sessions/:id/events", async (req: Request, res: Response) => {
  const profileId = await activeProfileId(req, res);
  if (!profileId) return;

  const parsed = eventBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const [session] = await db
    .select({ id: breathingSessions.id })
    .from(breathingSessions)
    .where(and(
      eq(breathingSessions.id, req.params.id),
      eq(breathingSessions.user_id, profileId),
    ))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: "Breathing session not found" });
  }

  try {
    await recordSessionEvent(profileId, req.params.id, parsed.data.eventType, parsed.data.payload);
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("[breathing POST /sessions/:id/events]", err);
    return res.status(500).json({ error: "Failed to save breathing session event" });
  }
});

export default router;
