import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { isRelationSchemaUnavailableError } from "../lib/dbCompatibility.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import { selectProfileByDatabaseColumns } from "../lib/profileReadCompatibility.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  heroMessageEvents,
  heroMessages,
  onboardingState,
  userChannelPreferences,
  userHealthConditions,
  userMedications,
  userProviders,
} from "../../shared/schema.js";

const heroMessagesRouter = Router();
const heroEventSchema = z.object({
  message_id: z.string().min(1).max(128),
  surface: z.string().min(1).max(48),
  language: z.enum(["es", "en", "de", "fr", "it", "pt"]).default("es"),
  event_type: z.enum([
    "impression",
    "cta_click",
    "dismiss",
    "fallback",
    "shown",
    "opened",
    "deferred",
    "dismissed",
    "completed",
    "voice_engaged",
  ]),
  reason: z.enum(["safety", "scheduled_event", "continuation", "time_of_day", "evergreen"]),
  source: z.enum(["managed", "built_in", "fallback"]),
  route: z.string().max(256).optional().default(""),
}).strict();

function rowToDefinition(row: typeof heroMessages.$inferSelect) {
  return {
    id: row.message_id,
    surface: row.surface,
    reason: row.reason,
    priority: row.priority,
    cooldownHours: row.cooldown_hours,
    periods: row.periods ?? [],
    safetyLevels: row.safety_levels ?? [],
    eventTypes: row.event_types ?? [],
    activityTypes: row.activity_types ?? [],
    copy: row.copy ?? {},
  };
}

async function loadHomeHeroProfileSnapshot(profileId: string | null) {
  if (!profileId) {
    return {
      profile: null,
      onboardingState: null,
      channelPreferences: null,
      medications: [],
      providers: [],
      healthConditions: [],
    };
  }

  const [profile, stateRows, preferenceRows, medicationRows, providerRows, healthConditionRows] = await Promise.all([
    selectProfileByDatabaseColumns(profileId).catch(() => null),
    db.select().from(onboardingState).where(eq(onboardingState.user_id, profileId)).limit(1).catch((err) => {
      if (isRelationSchemaUnavailableError(err, "onboarding_state")) return [];
      throw err;
    }),
    db.select().from(userChannelPreferences).where(eq(userChannelPreferences.user_id, profileId)).limit(1).catch((err) => {
      if (isRelationSchemaUnavailableError(err, "user_channel_preferences")) return [];
      throw err;
    }),
    db.select().from(userMedications).where(eq(userMedications.user_id, profileId)).limit(25).catch((err) => {
      if (isRelationSchemaUnavailableError(err, "user_medications")) return [];
      throw err;
    }),
    db
      .select()
      .from(userProviders)
      .where(and(eq(userProviders.user_id, profileId), eq(userProviders.is_active, true)))
      .limit(25)
      .catch((err) => {
        if (isRelationSchemaUnavailableError(err, "user_providers")) return [];
        throw err;
      }),
    db
      .select()
      .from(userHealthConditions)
      .where(and(eq(userHealthConditions.user_id, profileId), eq(userHealthConditions.is_active, true)))
      .limit(25)
      .catch((err) => {
        if (isRelationSchemaUnavailableError(err, "user_health_conditions")) return [];
        throw err;
      }),
  ]);

  return {
    profile: profile as Record<string, unknown> | null,
    onboardingState: (stateRows[0] ?? null) as Record<string, unknown> | null,
    channelPreferences: (preferenceRows[0] ?? null) as Record<string, unknown> | null,
    medications: medicationRows,
    providers: providerRows,
    healthConditions: healthConditionRows,
  };
}

heroMessagesRouter.get("/home-state", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const context = await getActiveProfileContext(userId);
    const snapshot = await loadHomeHeroProfileSnapshot(context.profileId);
    return res.json({
      audience: "elder",
      profileId: context.profileId,
      snapshot,
    });
  } catch (error) {
    console.error("[hero-messages] home state failed", error);
    return res.status(500).json({ error: "Could not load Hero home state." });
  }
});

heroMessagesRouter.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(heroMessages)
      .where(eq(heroMessages.is_enabled, true))
      .orderBy(desc(heroMessages.priority));

    return res.json({ messages: rows.map(rowToDefinition), source: "admin" });
  } catch {
    return res.json({ messages: [], source: "built_in_fallback" });
  }
});

heroMessagesRouter.post("/events", async (req, res) => {
  const parsed = heroEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    await db.insert(heroMessageEvents).values(parsed.data);
    return res.status(204).send();
  } catch {
    return res.status(202).json({ recorded: false });
  }
});

export default heroMessagesRouter;
