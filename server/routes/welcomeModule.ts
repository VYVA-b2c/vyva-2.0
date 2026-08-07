import { Router, type Request, type Response } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { isRelationSchemaUnavailableError } from "../lib/dbCompatibility.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import { selectProfileByDatabaseColumns } from "../lib/profileReadCompatibility.js";
import {
  onboardingState,
  userChannelPreferences,
  userHealthConditions,
  userMedications,
  userProviders,
  welcomeModuleEvents,
  welcomeModuleTemplates,
} from "../../shared/schema.js";
import {
  WELCOME_AUDIENCES,
  WELCOME_LANGUAGES,
  WELCOME_MODULE_TEMPLATES,
  WELCOME_MOMENT_TYPES,
  WELCOME_PERIODS,
  WELCOME_PROFILE_ACTIONS,
  getWelcomePeriod,
  isWelcomeProfileActionComplete,
  normalizeWelcomeAudience,
  normalizeWelcomeLanguage,
  renderWelcomeCopy,
  type WelcomeAudience,
  type WelcomeHomeSelection,
  type WelcomeLanguage,
  type WelcomeMomentType,
  type WelcomePeriod,
  type WelcomeProfileActionId,
  type WelcomeTemplateDefinition,
} from "../../shared/welcomeModule.js";

export const welcomeModuleRouter = Router();
export const adminWelcomeModuleRouter = Router();

const welcomeCopySchema = z.object({
  headline: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().min(1).max(160),
  ctaLabel: z.string().trim().max(40).optional(),
});

const welcomeTemplateInputSchema = z.object({
  templateId: z.string().trim().min(1).max(120),
  audience: z.enum(WELCOME_AUDIENCES as [WelcomeAudience, ...WelcomeAudience[]]),
  momentType: z.enum(WELCOME_MOMENT_TYPES as [WelcomeMomentType, ...WelcomeMomentType[]]),
  profileAction: z.enum(WELCOME_PROFILE_ACTIONS.map((action) => action.id) as [WelcomeProfileActionId, ...WelcomeProfileActionId[]]).nullable().optional(),
  priority: z.number().int().min(0).max(999),
  cooldownHours: z.number().int().min(0).max(24 * 365),
  periods: z.array(z.enum(WELCOME_PERIODS as [WelcomePeriod, ...WelcomePeriod[]])).max(4).optional().default([]),
  copy: z.record(z.enum(WELCOME_LANGUAGES as [WelcomeLanguage, ...WelcomeLanguage[]]), welcomeCopySchema).default({}),
  actionRoute: z.string().trim().max(240).nullable().optional(),
  isEnabled: z.boolean().optional().default(true),
  adminNotes: z.string().trim().max(1000).nullable().optional(),
});

const welcomeTemplatePatchSchema = welcomeTemplateInputSchema.partial().omit({ templateId: true });

const welcomeEventSchema = z.object({
  templateId: z.string().trim().min(1).max(120),
  audience: z.enum(WELCOME_AUDIENCES as [WelcomeAudience, ...WelcomeAudience[]]),
  momentType: z.enum(WELCOME_MOMENT_TYPES as [WelcomeMomentType, ...WelcomeMomentType[]]),
  profileAction: z.enum(WELCOME_PROFILE_ACTIONS.map((action) => action.id) as [WelcomeProfileActionId, ...WelcomeProfileActionId[]]).nullable().optional(),
  eventType: z.enum(["shown", "opened", "deferred", "dismissed", "completed", "voice_engaged"]),
  language: z.string().trim().max(12).optional(),
  route: z.string().trim().max(256).optional(),
  source: z.enum(["built_in", "managed"]).optional().default("built_in"),
}).strict();

type TemplateRow = typeof welcomeModuleTemplates.$inferSelect;
type WelcomeSurface = "home" | "caregiver_dashboard";

function normalizeWelcomeSurface(value: unknown): WelcomeSurface {
  return value === "caregiver_dashboard" ? "caregiver_dashboard" : "home";
}

function requireUserId(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

function rowToTemplate(row: TemplateRow): WelcomeTemplateDefinition {
  return {
    id: row.template_id,
    audience: row.audience as WelcomeAudience,
    momentType: row.moment_type as WelcomeMomentType,
    profileAction: row.profile_action as WelcomeProfileActionId | undefined,
    priority: row.priority,
    cooldownHours: row.cooldown_hours,
    periods: (row.periods ?? []) as WelcomePeriod[],
    copy: row.copy as WelcomeTemplateDefinition["copy"],
    actionRoute: row.action_route ?? undefined,
    isEnabled: row.is_enabled,
    adminNotes: row.admin_notes,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
    source: "managed",
  };
}

function mergeTemplates(rows: TemplateRow[] = []) {
  const merged = new Map<string, WelcomeTemplateDefinition>();
  for (const template of WELCOME_MODULE_TEMPLATES) {
    merged.set(template.id, { ...template, isEnabled: template.isEnabled ?? true, source: "built_in" });
  }
  for (const row of rows) {
    const template = rowToTemplate(row);
    merged.set(template.id, template);
  }
  return Array.from(merged.values());
}

async function listManagedTemplates() {
  try {
    return await db
      .select()
      .from(welcomeModuleTemplates)
      .orderBy(desc(welcomeModuleTemplates.priority));
  } catch (err) {
    if (isRelationSchemaUnavailableError(err, "welcome_module_templates")) return [];
    throw err;
  }
}

function firstNameFromProfile(profile: Record<string, unknown> | null | undefined) {
  const preferred = typeof profile?.preferred_name === "string" ? profile.preferred_name.trim() : "";
  if (preferred) return preferred.split(/\s+/)[0];
  const full = typeof profile?.full_name === "string" ? profile.full_name.trim() : "";
  if (full) return full.split(/\s+/)[0];
  return null;
}

async function loadWelcomeSnapshot(profileId: string | null) {
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

async function listWelcomeEvents(userId: string) {
  try {
    return await db
      .select()
      .from(welcomeModuleEvents)
      .where(eq(welcomeModuleEvents.user_id, userId))
      .orderBy(desc(welcomeModuleEvents.created_at))
      .limit(200);
  } catch (err) {
    if (isRelationSchemaUnavailableError(err, "welcome_module_events")) return [];
    throw err;
  }
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function selectTemplate(input: {
  templates: WelcomeTemplateDefinition[];
  audience: WelcomeAudience;
  momentType: WelcomeMomentType;
  period: WelcomePeriod;
  language: WelcomeLanguage;
  firstName: string | null;
  snapshot: Awaited<ReturnType<typeof loadWelcomeSnapshot>>;
}): WelcomeHomeSelection | null {
  const eligible = input.templates
    .filter((template) => template.isEnabled !== false)
    .filter((template) => template.audience === input.audience)
    .filter((template) => template.momentType === input.momentType)
    .filter((template) => !template.periods?.length || template.periods.includes(input.period))
    .filter((template) => {
      if (input.momentType !== "daily_profile_nudge") return true;
      return Boolean(
        template.profileAction &&
        !isWelcomeProfileActionComplete(template.profileAction, input.snapshot),
      );
    })
    .sort((left, right) => right.priority - left.priority);

  for (const template of eligible) {
    const copy = renderWelcomeCopy(template, input.language, input.firstName);
    if (!copy) continue;
    return {
      templateId: template.id,
      audience: template.audience,
      momentType: template.momentType,
      profileAction: template.profileAction,
      headline: copy.headline,
      subtitle: copy.subtitle,
      ctaLabel: copy.ctaLabel,
      actionRoute: template.actionRoute,
      priority: template.priority,
      source: template.source === "managed" ? "managed" : "built_in",
    };
  }

  return null;
}

welcomeModuleRouter.get("/home", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const language = normalizeWelcomeLanguage(typeof req.query.language === "string" ? req.query.language : req.language);
  const surface = normalizeWelcomeSurface(req.query.surface);
  const now = new Date();
  const period = getWelcomePeriod(now);
  const today = todayKey(now);

  try {
    const context = await getActiveProfileContext(userId);
    const audience = surface === "caregiver_dashboard" ? "caregiver" : normalizeWelcomeAudience(context.role);
    const snapshot = await loadWelcomeSnapshot(context.profileId);
    const firstName = firstNameFromProfile(snapshot.profile);
    const [templates, events] = await Promise.all([
      listManagedTemplates().then(mergeTemplates),
      listWelcomeEvents(userId),
    ]);
    const firstWelcomeShown = events.some((event) => (
      event.audience === audience &&
      event.moment_type === "first_login_welcome" &&
      ["shown", "opened", "dismissed", "completed"].includes(event.event_type)
    ));
    const dailyNudgeShownToday = events.some((event) => (
      event.audience === audience &&
      event.moment_type === "daily_profile_nudge" &&
      ["shown", "opened", "dismissed", "completed"].includes(event.event_type) &&
      String(event.event_date) === today
    ));

    const message = !firstWelcomeShown
      ? selectTemplate({ templates, audience, momentType: "first_login_welcome", period, language, firstName, snapshot })
      : dailyNudgeShownToday
        ? null
        : selectTemplate({ templates, audience, momentType: "daily_profile_nudge", period, language, firstName, snapshot });

    return res.json({
      message,
      state: {
        audience,
        surface,
        firstWelcomeShown,
        dailyNudgeShownToday,
        date: today,
      },
    });
  } catch (error) {
    console.error("[welcome-module] home selection failed", error);
    return res.status(500).json({ error: "Could not load Welcome module message." });
  }
});

welcomeModuleRouter.post("/events", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const parsed = welcomeEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const context = await getActiveProfileContext(userId);
    await db.insert(welcomeModuleEvents).values({
      user_id: userId,
      profile_id: context.profileId,
      template_id: parsed.data.templateId,
      audience: parsed.data.audience,
      moment_type: parsed.data.momentType,
      profile_action: parsed.data.profileAction ?? null,
      event_type: parsed.data.eventType,
      language: normalizeWelcomeLanguage(parsed.data.language),
      route: parsed.data.route ?? "",
      event_date: todayKey(),
      source: parsed.data.source,
    });
    return res.status(204).send();
  } catch (error) {
    if (isRelationSchemaUnavailableError(error, "welcome_module_events")) {
      return res.status(202).json({ recorded: false });
    }
    console.error("[welcome-module] event record failed", error);
    return res.status(202).json({ recorded: false });
  }
});

adminWelcomeModuleRouter.get("/templates", async (_req, res) => {
  try {
    const rows = await listManagedTemplates();
    return res.json({
      templates: mergeTemplates(rows).sort((left, right) => right.priority - left.priority),
      source: rows.length ? "database" : "built_in",
    });
  } catch (error) {
    console.error("[admin/welcome-module] template list failed", error);
    return res.status(503).json({ error: "Welcome module templates are not migrated yet. Run migrations/0079_welcome_module.sql." });
  }
});

adminWelcomeModuleRouter.post("/templates", async (req, res) => {
  const parsed = welcomeTemplateInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const values = {
      template_id: parsed.data.templateId,
      audience: parsed.data.audience,
      moment_type: parsed.data.momentType,
      profile_action: parsed.data.profileAction ?? null,
      priority: parsed.data.priority,
      cooldown_hours: parsed.data.cooldownHours,
      periods: parsed.data.periods,
      copy: parsed.data.copy,
      action_route: parsed.data.actionRoute ?? null,
      is_enabled: parsed.data.isEnabled,
      admin_notes: parsed.data.adminNotes ?? "",
      updated_at: new Date(),
    };

    const [template] = await db.insert(welcomeModuleTemplates)
      .values(values)
      .onConflictDoUpdate({
        target: welcomeModuleTemplates.template_id,
        set: values,
      })
      .returning();

    return res.status(201).json({ template: rowToTemplate(template) });
  } catch (error) {
    console.error("[admin/welcome-module] template save failed", error);
    return res.status(400).json({ error: "Could not save Welcome template. Check the migration and template ID." });
  }
});

adminWelcomeModuleRouter.patch("/templates/:templateId", async (req, res) => {
  const parsed = welcomeTemplatePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const patch: Partial<typeof welcomeModuleTemplates.$inferInsert> = {};
  if (parsed.data.audience !== undefined) patch.audience = parsed.data.audience;
  if (parsed.data.momentType !== undefined) patch.moment_type = parsed.data.momentType;
  if (parsed.data.profileAction !== undefined) patch.profile_action = parsed.data.profileAction ?? null;
  if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority;
  if (parsed.data.cooldownHours !== undefined) patch.cooldown_hours = parsed.data.cooldownHours;
  if (parsed.data.periods !== undefined) patch.periods = parsed.data.periods;
  if (parsed.data.copy !== undefined) patch.copy = parsed.data.copy;
  if (parsed.data.actionRoute !== undefined) patch.action_route = parsed.data.actionRoute ?? null;
  if (parsed.data.isEnabled !== undefined) patch.is_enabled = parsed.data.isEnabled;
  if (parsed.data.adminNotes !== undefined) patch.admin_notes = parsed.data.adminNotes ?? "";
  patch.updated_at = new Date();

  try {
    const [template] = await db.update(welcomeModuleTemplates)
      .set(patch)
      .where(eq(welcomeModuleTemplates.template_id, req.params.templateId))
      .returning();

    if (!template) return res.status(404).json({ error: "Welcome template not found" });
    return res.json({ template: rowToTemplate(template) });
  } catch (error) {
    console.error("[admin/welcome-module] template patch failed", error);
    return res.status(400).json({ error: "Could not update Welcome template." });
  }
});

adminWelcomeModuleRouter.get("/events", async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days ?? 14) || 14, 1), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const rows = await db
      .select()
      .from(welcomeModuleEvents)
      .where(gte(welcomeModuleEvents.created_at, since))
      .orderBy(desc(welcomeModuleEvents.created_at))
      .limit(500);
    return res.json({
      events: rows.filter((row) => ["shown", "opened", "dismissed", "completed", "deferred"].includes(row.event_type)),
      days,
    });
  } catch (error) {
    if (isRelationSchemaUnavailableError(error, "welcome_module_events")) {
      return res.json({ events: [], days, warning: "Welcome module events are not migrated yet." });
    }
    console.error("[admin/welcome-module] events list failed", error);
    return res.status(500).json({ error: "Could not load Welcome module events." });
  }
});
