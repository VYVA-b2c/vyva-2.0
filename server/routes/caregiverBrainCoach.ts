import { Router, type Request, type Response } from "express";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { getActiveProfileContext, requireActiveProfileId } from "../lib/profileAccess.js";
import { buildBrainCoachCaregiverSummary } from "../lib/brainCoachCaregiverSummary.js";
import {
  auditBrainCoachCaregiverChange,
  BRAIN_COACH_CAREGIVER_PERMISSION_KEYS,
  effectiveBrainCoachPermissions,
  resolveBrainCoachAccess,
  withBrainCoachPermissions,
  type BrainCoachCaregiverPermissions,
} from "../lib/brainCoachCaregiverAccess.js";
import {
  mergeCaregiverSettingsIntoPreferences,
  normalizeBrainCoachCaregiverSettings,
} from "../lib/brainCoachCaregiverSettings.js";
import {
  computeBrainCoachNextRunAt,
  normalizeBrainCoachSchedule,
} from "../lib/brainCoachCaregiverSchedule.js";
import { buildBrainCoachDailyPlan, extractBrainCoachPreferences } from "../lib/brainCoachPlan.js";
import {
  cognitiveCaregiverSettings,
  cognitiveCaregiverNudges,
  cognitiveDailyPlanEvents,
  cognitiveDailyPlanItems,
  cognitiveDailyPlans,
  cognitiveSessionIndex,
  profileMemberships,
  profiles,
  scheduledInteractions,
  teamInvitations,
  users,
} from "../../shared/schema.js";

const router = Router();

const permissionsSchema = z.object({
  view_summary: z.boolean().optional(),
  manage_plan_preferences: z.boolean().optional(),
  manage_schedule: z.boolean().optional(),
  send_nudges: z.boolean().optional(),
  preview_plan: z.boolean().optional(),
}).strict();

const settingsSchema = z.object({
  preferredDomains: z.array(z.string()).optional(),
  excludedActivityTypes: z.array(z.string()).optional(),
  preferredTrainingTimes: z.array(z.string()).optional(),
  weeklyTargetDays: z.number().int().optional(),
  sessionLengthMinutes: z.number().int().optional(),
  paused: z.boolean().optional(),
}).strict();

const scheduleSchema = z.object({
  daysOfWeek: z.array(z.string()).optional(),
  timesOfDay: z.array(z.string()).optional(),
  timezone: z.string().optional(),
  paused: z.boolean().optional(),
}).strict();

const nudgeSchema = z.object({
  messageType: z.enum(["missed_yesterday", "lapsed_7_days", "preferred_time", "completed_today", "general"]).optional().default("general"),
  message: z.string().trim().max(240).optional(),
  metadata: z.record(z.unknown()).optional().default({}),
}).strict();

const DAY_MS = 24 * 60 * 60 * 1000;

function permissionsPatch(body: unknown): Partial<BrainCoachCaregiverPermissions> | null {
  const parsed = permissionsSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

function utcDayStart(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function defaultSettings() {
  return normalizeBrainCoachCaregiverSettings(null);
}

function settingsResponse(row: typeof cognitiveCaregiverSettings.$inferSelect | null | undefined) {
  return row
    ? normalizeBrainCoachCaregiverSettings(row)
    : defaultSettings();
}

function scheduleResponse(row: typeof scheduledInteractions.$inferSelect | null | undefined) {
  if (!row) {
    return {
      id: null,
      daysOfWeek: ["MON", "WED", "FRI"],
      timesOfDay: ["11:00"],
      timezone: "Europe/Madrid",
      status: "ACTIVE",
      paused: false,
      nextRunAt: null,
      updatedAt: null,
    };
  }

  return {
    id: row.id,
    daysOfWeek: row.days_of_week,
    timesOfDay: row.times_of_day,
    timezone: row.timezone,
    status: row.status,
    paused: row.is_paused || row.status === "PAUSED",
    nextRunAt: row.next_run_at,
    updatedAt: row.updated_at,
  };
}

async function resolveProfileParam(req: Request, res: Response, value: string): Promise<string | null> {
  if (value === "me") return requireActiveProfileId(req.user!.id, res);
  return value;
}

async function loadSummary(profileId: string, now = new Date()) {
  const todayStart = utcDayStart(now);
  const planWindowStart = new Date(todayStart - 6 * DAY_MS).toISOString().slice(0, 10);
  const sessionWindowStart = new Date(todayStart - 29 * DAY_MS);

  const [sessions, plans, planItems] = await Promise.all([
    db
      .select()
      .from(cognitiveSessionIndex)
      .where(and(
        eq(cognitiveSessionIndex.userId, profileId),
        gte(cognitiveSessionIndex.playedAt, sessionWindowStart),
      ))
      .orderBy(desc(cognitiveSessionIndex.playedAt))
      .limit(100),
    db
      .select()
      .from(cognitiveDailyPlans)
      .where(and(
        eq(cognitiveDailyPlans.userId, profileId),
        gte(cognitiveDailyPlans.planDate, planWindowStart),
      ))
      .orderBy(desc(cognitiveDailyPlans.planDate))
      .limit(7),
    db
      .select()
      .from(cognitiveDailyPlanItems)
      .where(and(
        eq(cognitiveDailyPlanItems.userId, profileId),
        gte(cognitiveDailyPlanItems.planDate, planWindowStart),
      ))
      .orderBy(asc(cognitiveDailyPlanItems.planDate), asc(cognitiveDailyPlanItems.sortOrder)),
  ]);

  return buildBrainCoachCaregiverSummary({ sessions, plans, planItems, now });
}

async function loadPlanInputs(profileId: string) {
  const trendWindowStart = new Date(Date.now() - 30 * DAY_MS);
  const [sessions, events, [profile], [settings]] = await Promise.all([
    db
      .select()
      .from(cognitiveSessionIndex)
      .where(eq(cognitiveSessionIndex.userId, profileId))
      .orderBy(desc(cognitiveSessionIndex.playedAt))
      .limit(300),
    db
      .select()
      .from(cognitiveDailyPlanEvents)
      .where(and(
        eq(cognitiveDailyPlanEvents.userId, profileId),
        gte(cognitiveDailyPlanEvents.createdAt, trendWindowStart),
      ))
      .orderBy(desc(cognitiveDailyPlanEvents.createdAt))
      .limit(200),
    db
      .select({ dataSharingConsent: profiles.data_sharing_consent })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1),
    db
      .select()
      .from(cognitiveCaregiverSettings)
      .where(eq(cognitiveCaregiverSettings.userId, profileId))
      .limit(1),
  ]);

  const preferences = mergeCaregiverSettingsIntoPreferences(
    extractBrainCoachPreferences(profile?.dataSharingConsent),
    settings,
  );

  return { sessions, events, settings, preferences };
}

async function loadBrainCoachSchedule(profileId: string) {
  const [schedule] = await db
    .select()
    .from(scheduledInteractions)
    .where(and(
      eq(scheduledInteractions.user_id, profileId),
      eq(scheduledInteractions.interaction_type, "BRAIN_COACH"),
    ))
    .orderBy(desc(scheduledInteractions.updated_at))
    .limit(1);
  return schedule ?? null;
}

async function upsertBrainCoachSchedule(input: {
  profileId: string;
  actorUserId: string;
  existing: typeof scheduledInteractions.$inferSelect | null;
  schedule: ReturnType<typeof normalizeBrainCoachSchedule>;
}) {
  const now = new Date();
  const status = input.schedule.paused ? "PAUSED" : "ACTIVE";
  const nextRunAt = computeBrainCoachNextRunAt({ ...input.schedule, status }, now);
  const values = {
    user_id: input.profileId,
    interaction_type: "BRAIN_COACH",
    friendly_label: "Brain Coach",
    user_description: "Scheduled Brain Coach rhythm controlled by senior-approved settings.",
    frequency_type: "WEEKLY",
    frequency_value: {
      source: "brain_coach_caregiver",
      weekly_target_days: input.schedule.daysOfWeek.length,
    },
    days_of_week: input.schedule.daysOfWeek,
    times_of_day: input.schedule.timesOfDay,
    timezone: input.schedule.timezone,
    preferred_language: "en",
    status,
    is_paused: input.schedule.paused,
    pause_reason: input.schedule.paused ? "Paused from Brain Coach caregiver controls" : null,
    pause_until: null,
    next_run_at: nextRunAt,
    admin_edit_allowed: true,
    updated_by: input.actorUserId,
    updated_at: now,
  };

  if (input.existing) {
    const [updated] = await db
      .update(scheduledInteractions)
      .set(values)
      .where(eq(scheduledInteractions.id, input.existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(scheduledInteractions)
    .values({
      ...values,
      created_by: input.actorUserId,
      created_at: now,
    })
    .returning();
  return created;
}

function defaultNudgeMessage(type: string) {
  if (type === "missed_yesterday") return "A short Brain Coach session is ready whenever today feels like a good moment.";
  if (type === "lapsed_7_days") return "It has been a little while. A gentle 5-minute Brain Coach restart is ready.";
  if (type === "preferred_time") return "This is around the preferred Brain Coach time. Today's plan is waiting.";
  if (type === "completed_today") return "Nice work finishing today's Brain Coach plan.";
  return "A gentle Brain Coach reminder is available in the app.";
}

async function acceptedInvitationFor(userId: string, profileId: string) {
  const [invitation] = await db
    .select({
      can_view_dashboard: teamInvitations.can_view_dashboard,
      can_view_journal_summaries: teamInvitations.can_view_journal_summaries,
    })
    .from(teamInvitations)
    .where(and(
      eq(teamInvitations.accepted_user_id, userId),
      eq(teamInvitations.senior_id, profileId),
      eq(teamInvitations.status, "accepted"),
    ))
    .limit(1);
  return invitation ?? null;
}

router.get("/permissions", requireUser, async (req: Request, res: Response) => {
  const profileId = await requireActiveProfileId(req.user!.id, res);
  if (!profileId) return;

  try {
    const rows = await db
      .select({
        id: profileMemberships.id,
        userId: profileMemberships.user_id,
        profileId: profileMemberships.profile_id,
        role: profileMemberships.role,
        status: profileMemberships.status,
        relationship: profileMemberships.relationship,
        displayName: profileMemberships.display_name,
        permissions: profileMemberships.permissions,
      })
      .from(profileMemberships)
      .where(and(
        eq(profileMemberships.profile_id, profileId),
        inArray(profileMemberships.role, ["caregiver", "family"]),
      ));

    const members = await Promise.all(rows.map(async (member) => {
      const invitation = await acceptedInvitationFor(member.userId, profileId);
      return {
        ...member,
        brainCoachPermissions: effectiveBrainCoachPermissions({
          membershipPermissions: member.permissions,
          careTeamConsent: invitation,
        }),
      };
    }));

    return res.json({ members, permissionKeys: BRAIN_COACH_CAREGIVER_PERMISSION_KEYS });
  } catch (error) {
    console.error("[caregiver-brain-coach] permissions list failed:", error);
    return res.status(500).json({ error: "Brain Coach permissions could not be loaded." });
  }
});

router.patch("/permissions/:membershipId", requireUser, async (req: Request, res: Response) => {
  const profileId = await requireActiveProfileId(req.user!.id, res);
  if (!profileId) return;
  const patch = permissionsPatch(req.body);
  if (!patch) return res.status(400).json({ error: "Invalid Brain Coach permissions." });

  try {
    const [membership] = await db
      .select()
      .from(profileMemberships)
      .where(and(
        eq(profileMemberships.id, req.params.membershipId),
        eq(profileMemberships.profile_id, profileId),
        inArray(profileMemberships.role, ["caregiver", "family"]),
      ))
      .limit(1);

    if (!membership) return res.status(404).json({ error: "Care team member not found." });

    const previousPermissions = membership.permissions;
    const nextPermissions = withBrainCoachPermissions(previousPermissions, patch);
    const [updated] = await db
      .update(profileMemberships)
      .set({ permissions: nextPermissions, updated_at: new Date() })
      .where(eq(profileMemberships.id, membership.id))
      .returning();

    const [account] = await db
      .select({ active_profile_id: users.active_profile_id })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);
    const context = await getActiveProfileContext(req.user!.id);
    await auditBrainCoachCaregiverChange({
      access: {
        targetUserId: profileId,
        actorUserId: req.user!.id,
        actorRole: "elder",
        isOwnProfile: context.profileId === profileId || account?.active_profile_id === profileId,
        isAdmin: false,
        permissions: {
          view_summary: true,
          manage_plan_preferences: true,
          manage_schedule: true,
          send_nudges: true,
          preview_plan: true,
        },
      },
      previousValue: { membership_id: membership.id, permissions: previousPermissions },
      newValue: { membership_id: membership.id, permissions: nextPermissions },
      source: "brain_coach_permission_update",
    });

    return res.json({
      member: {
        id: updated.id,
        userId: updated.user_id,
        profileId: updated.profile_id,
        role: updated.role,
        status: updated.status,
        relationship: updated.relationship,
        displayName: updated.display_name,
        brainCoachPermissions: effectiveBrainCoachPermissions({ membershipPermissions: updated.permissions }),
      },
    });
  } catch (error) {
    console.error("[caregiver-brain-coach] permissions update failed:", error);
    return res.status(500).json({ error: "Brain Coach permissions could not be saved." });
  }
});

router.get("/:profileId/summary", requireUser, async (req: Request, res: Response) => {
  try {
    const profileId = await resolveProfileParam(req, res, req.params.profileId);
    if (!profileId) return;
    const access = await resolveBrainCoachAccess({
      actorUserId: req.user!.id,
      targetUserId: profileId,
      requiredPermission: "view_summary",
      actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
      actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
    });
    if (!access) return res.status(403).json({ error: "Brain Coach caregiver access is not enabled." });

    const summary = await loadSummary(profileId);
    return res.json({ summary, permissions: access.permissions });
  } catch (error) {
    console.error("[caregiver-brain-coach] summary failed:", error);
    return res.status(500).json({ error: "Brain Coach summary could not be loaded." });
  }
});

router.get("/:profileId/settings", requireUser, async (req: Request, res: Response) => {
  try {
    const profileId = await resolveProfileParam(req, res, req.params.profileId);
    if (!profileId) return;
    const access = await resolveBrainCoachAccess({
      actorUserId: req.user!.id,
      targetUserId: profileId,
      requiredPermission: "view_summary",
      actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
      actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
    });
    if (!access) return res.status(403).json({ error: "Brain Coach caregiver access is not enabled." });

    const [row] = await db
      .select()
      .from(cognitiveCaregiverSettings)
      .where(eq(cognitiveCaregiverSettings.userId, profileId))
      .limit(1);

    return res.json({
      settings: settingsResponse(row),
      permissions: access.permissions,
    });
  } catch (error) {
    console.error("[caregiver-brain-coach] settings load failed:", error);
    return res.status(500).json({ error: "Brain Coach settings could not be loaded." });
  }
});

router.patch("/:profileId/settings", requireUser, async (req: Request, res: Response) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid Brain Coach settings." });

  try {
    const profileId = await resolveProfileParam(req, res, req.params.profileId);
    if (!profileId) return;
    const access = await resolveBrainCoachAccess({
      actorUserId: req.user!.id,
      targetUserId: profileId,
      requiredPermission: "manage_plan_preferences",
      actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
      actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
    });
    if (!access) return res.status(403).json({ error: "Brain Coach settings need senior consent." });

    const [existing] = await db
      .select()
      .from(cognitiveCaregiverSettings)
      .where(eq(cognitiveCaregiverSettings.userId, profileId))
      .limit(1);
    const normalized = normalizeBrainCoachCaregiverSettings({
      ...settingsResponse(existing),
      ...parsed.data,
    });
    const timestamp = new Date();
    const values = {
      userId: profileId,
      preferredDomains: normalized.preferredDomains,
      excludedActivityTypes: normalized.excludedActivityTypes,
      preferredTrainingTimes: normalized.preferredTrainingTimes,
      weeklyTargetDays: normalized.weeklyTargetDays,
      sessionLengthMinutes: normalized.sessionLengthMinutes,
      paused: normalized.paused,
      updatedBy: req.user!.id,
      updatedAt: timestamp,
    };
    const [updated] = await db
      .insert(cognitiveCaregiverSettings)
      .values({ ...values, createdAt: timestamp })
      .onConflictDoUpdate({
        target: cognitiveCaregiverSettings.userId,
        set: values,
      })
      .returning();

    await auditBrainCoachCaregiverChange({
      access,
      previousValue: { settings: settingsResponse(existing) },
      newValue: { settings: settingsResponse(updated) },
      source: access.isOwnProfile ? "brain_coach_settings_self" : "brain_coach_settings_caregiver",
    });

    return res.json({ settings: settingsResponse(updated), permissions: access.permissions });
  } catch (error) {
    console.error("[caregiver-brain-coach] settings update failed:", error);
    return res.status(500).json({ error: "Brain Coach settings could not be saved." });
  }
});

router.post("/:profileId/plan-preview", requireUser, async (req: Request, res: Response) => {
  try {
    const profileId = await resolveProfileParam(req, res, req.params.profileId);
    if (!profileId) return;
    const access = await resolveBrainCoachAccess({
      actorUserId: req.user!.id,
      targetUserId: profileId,
      requiredPermission: "preview_plan",
      actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
      actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
    });
    if (!access) return res.status(403).json({ error: "Brain Coach plan preview needs senior consent." });

    const { sessions, events, preferences } = await loadPlanInputs(profileId);
    const previewDate = new Date(Date.now() + DAY_MS);
    const plan = buildBrainCoachDailyPlan({
      sessions,
      events,
      preferences,
      now: previewDate,
    });

    return res.json({ persisted: false, plan, permissions: access.permissions });
  } catch (error) {
    console.error("[caregiver-brain-coach] plan preview failed:", error);
    return res.status(500).json({ error: "Brain Coach plan preview could not be built." });
  }
});

router.get("/:profileId/schedule", requireUser, async (req: Request, res: Response) => {
  try {
    const profileId = await resolveProfileParam(req, res, req.params.profileId);
    if (!profileId) return;
    const access = await resolveBrainCoachAccess({
      actorUserId: req.user!.id,
      targetUserId: profileId,
      requiredPermission: "view_summary",
      actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
      actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
    });
    if (!access) return res.status(403).json({ error: "Brain Coach schedule visibility needs senior consent." });

    const schedule = await loadBrainCoachSchedule(profileId);
    return res.json({ schedule: scheduleResponse(schedule), permissions: access.permissions });
  } catch (error) {
    console.error("[caregiver-brain-coach] schedule load failed:", error);
    return res.status(500).json({ error: "Brain Coach schedule could not be loaded." });
  }
});

router.patch("/:profileId/schedule", requireUser, async (req: Request, res: Response) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid Brain Coach schedule." });

  try {
    const profileId = await resolveProfileParam(req, res, req.params.profileId);
    if (!profileId) return;
    const access = await resolveBrainCoachAccess({
      actorUserId: req.user!.id,
      targetUserId: profileId,
      requiredPermission: "manage_schedule",
      actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
      actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
    });
    if (!access) return res.status(403).json({ error: "Brain Coach schedule changes need senior consent." });

    const existing = await loadBrainCoachSchedule(profileId);
    const normalized = normalizeBrainCoachSchedule({
      daysOfWeek: parsed.data.daysOfWeek ?? existing?.days_of_week,
      timesOfDay: parsed.data.timesOfDay ?? existing?.times_of_day,
      timezone: parsed.data.timezone ?? existing?.timezone,
      paused: parsed.data.paused ?? existing?.is_paused,
    });
    const updated = await upsertBrainCoachSchedule({
      profileId,
      actorUserId: req.user!.id,
      existing,
      schedule: normalized,
    });

    await auditBrainCoachCaregiverChange({
      access,
      previousValue: { schedule: scheduleResponse(existing) },
      newValue: { schedule: scheduleResponse(updated) },
      source: access.isOwnProfile ? "brain_coach_schedule_self" : "brain_coach_schedule_caregiver",
    });

    return res.json({ schedule: scheduleResponse(updated), permissions: access.permissions });
  } catch (error) {
    console.error("[caregiver-brain-coach] schedule update failed:", error);
    return res.status(500).json({ error: "Brain Coach schedule could not be saved." });
  }
});

router.post("/:profileId/nudges", requireUser, async (req: Request, res: Response) => {
  const parsed = nudgeSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid Brain Coach nudge." });

  try {
    const profileId = await resolveProfileParam(req, res, req.params.profileId);
    if (!profileId) return;
    const access = await resolveBrainCoachAccess({
      actorUserId: req.user!.id,
      targetUserId: profileId,
      requiredPermission: "send_nudges",
      actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
      actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
    });
    if (!access) return res.status(403).json({ error: "Brain Coach nudges need senior consent." });

    const message = parsed.data.message?.trim() || defaultNudgeMessage(parsed.data.messageType);
    const [nudge] = await db
      .insert(cognitiveCaregiverNudges)
      .values({
        userId: profileId,
        caregiverUserId: req.user!.id,
        messageType: parsed.data.messageType,
        message,
        metadata: parsed.data.metadata,
      })
      .returning();

    await auditBrainCoachCaregiverChange({
      access,
      previousValue: {},
      newValue: { nudge_id: nudge.id, message_type: nudge.messageType },
      source: access.isOwnProfile ? "brain_coach_nudge_self" : "brain_coach_nudge_caregiver",
    });

    return res.status(201).json({ nudge, permissions: access.permissions });
  } catch (error) {
    console.error("[caregiver-brain-coach] nudge failed:", error);
    return res.status(500).json({ error: "Brain Coach nudge could not be sent." });
  }
});

export default router;
