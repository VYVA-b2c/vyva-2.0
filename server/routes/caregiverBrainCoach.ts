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
  isBrainCoachSelfAccess,
  resolveBrainCoachAccess,
  withBrainCoachPermissions,
  type BrainCoachCaregiverPermissions,
} from "../lib/brainCoachCaregiverAccess.js";
import {
  mergeCaregiverSettingsIntoPreferences,
  normalizeBrainCoachCaregiverSettings,
} from "../lib/brainCoachCaregiverSettings.js";
import { buildBrainCoachDailyPlan, extractBrainCoachPreferences } from "../lib/brainCoachPlan.js";
import { buildBrainCoachPlanRows } from "../lib/brainCoachPlanLifecycle.js";
import {
  brainCoachScheduleAuditSnapshot,
  syncBrainCoachScheduledInteraction,
} from "../lib/brainCoachScheduleSync.js";
import {
  cognitiveCaregiverSettings,
  cognitiveDailyPlanEvents,
  cognitiveDailyPlanItems,
  cognitiveDailyPlans,
  cognitiveSessionIndex,
  profileMemberships,
  profiles,
  teamInvitations,
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

const nudgeSchema = z.object({
  messageType: z.enum(["today_plan", "gentle_restart", "completed_today"]).optional().default("today_plan"),
}).strict();

const DAY_MS = 24 * 60 * 60 * 1000;
const PLAN_PREFERENCE_SETTING_KEYS = ["preferredDomains", "excludedActivityTypes", "weeklyTargetDays", "sessionLengthMinutes"] as const;
const SCHEDULE_SETTING_KEYS = ["preferredTrainingTimes", "paused"] as const;

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

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasAnySettingKey(value: object, keys: readonly string[]) {
  return keys.some((key) => hasOwn(value, key));
}

function caregiverNudgeCopy(messageType: z.infer<typeof nudgeSchema>["messageType"]) {
  if (messageType === "gentle_restart") {
    return {
      title: "A gentle Brain Coach restart",
      body: "Your caregiver suggested one short activity today. A few minutes is enough.",
    };
  }
  if (messageType === "completed_today") {
    return {
      title: "Nice work today",
      body: "Your caregiver noticed today's Brain Coach plan is complete.",
    };
  }
  return {
    title: "Your Brain Coach plan is ready",
    body: "Your caregiver suggested starting with one short recommended activity.",
  };
}

function todayPlanDate(now = new Date()) {
  return new Date(utcDayStart(now)).toISOString().slice(0, 10);
}

async function loadTodayPlan(profileId: string) {
  const [plan] = await db
    .select()
    .from(cognitiveDailyPlans)
    .where(and(
      eq(cognitiveDailyPlans.userId, profileId),
      eq(cognitiveDailyPlans.planDate, todayPlanDate()),
    ))
    .limit(1);
  return plan ?? null;
}

async function ensureTodayPlan(profileId: string) {
  const existing = await loadTodayPlan(profileId);
  if (existing) return existing;

  const { sessions, events, preferences } = await loadPlanInputs(profileId);
  const generatedPlan = buildBrainCoachDailyPlan({
    sessions,
    events,
    preferences,
  });
  const built = buildBrainCoachPlanRows({
    userId: profileId,
    generatedPlan,
    sourceContext: {
      source: "caregiver_nudge",
      total_sessions: sessions.length,
      completed_sessions: sessions.filter((session) => session.completed).length,
      training_time: preferences.trainingTime ?? null,
      session_length_mins: preferences.sessionLengthMins ?? null,
    },
  });

  const insertedPlans = await db
    .insert(cognitiveDailyPlans)
    .values(built.plan)
    .onConflictDoNothing()
    .returning();
  const plan = insertedPlans[0] ?? await loadTodayPlan(profileId);
  if (!plan) throw new Error("Brain Coach daily plan could not be created.");

  if (insertedPlans.length > 0 && built.items.length > 0) {
    await db.insert(cognitiveDailyPlanItems).values(
      built.items.map((item) => ({
        ...item,
        planId: plan.id,
      })),
    );
  }

  return plan;
}

async function resolveProfileParam(req: Request, res: Response, value: string): Promise<string | null> {
  if (value === "me") return requireActiveProfileId(req.user!.id, res);
  return value;
}

async function requireBrainCoachPermissionOwnerProfileId(req: Request, res: Response): Promise<string | null> {
  const context = await getActiveProfileContext(req.user!.id);
  if (!context.profileId) {
    res.status(409).json({
      error: "No care profile selected",
      nextRoute: "/onboarding/who-for",
    });
    return null;
  }

  const canManagePermissions = isBrainCoachSelfAccess({
    actorUserId: req.user!.id,
    targetUserId: context.profileId,
    activeProfileId: context.profileId,
    activeProfileRole: context.role,
  });
  if (!canManagePermissions) {
    res.status(403).json({ error: "Only the senior can manage Brain Coach caregiver permissions." });
    return null;
  }

  return context.profileId;
}

async function loadSummary(profileId: string, now = new Date()) {
  const todayStart = utcDayStart(now);
  const planWindowStart = new Date(todayStart - 13 * DAY_MS).toISOString().slice(0, 10);
  const sessionWindowStart = new Date(todayStart - 29 * DAY_MS);

  const [sessions, plans, planItems, planEvents] = await Promise.all([
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
    db
      .select()
      .from(cognitiveDailyPlanEvents)
      .where(and(
        eq(cognitiveDailyPlanEvents.userId, profileId),
        gte(cognitiveDailyPlanEvents.createdAt, sessionWindowStart),
      ))
      .orderBy(desc(cognitiveDailyPlanEvents.createdAt))
      .limit(100),
  ]);

  return buildBrainCoachCaregiverSummary({ sessions, plans, planItems, planEvents, now });
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
  const profileId = await requireBrainCoachPermissionOwnerProfileId(req, res);
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
        eq(profileMemberships.status, "active"),
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
  const profileId = await requireBrainCoachPermissionOwnerProfileId(req, res);
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
        eq(profileMemberships.status, "active"),
        inArray(profileMemberships.role, ["caregiver", "family"]),
      ))
      .limit(1);

    if (!membership) return res.status(404).json({ error: "Care team member not found." });

    const previousPermissions = membership.permissions;
    const invitation = await acceptedInvitationFor(membership.user_id, profileId);
    const currentEffectivePermissions = effectiveBrainCoachPermissions({
      membershipPermissions: previousPermissions,
      careTeamConsent: invitation,
    });
    const nextPermissions = withBrainCoachPermissions(previousPermissions, patch, currentEffectivePermissions);
    const [updated] = await db
      .update(profileMemberships)
      .set({ permissions: nextPermissions, updated_at: new Date() })
      .where(eq(profileMemberships.id, membership.id))
      .returning();

    const context = await getActiveProfileContext(req.user!.id);
    await auditBrainCoachCaregiverChange({
      access: {
        targetUserId: profileId,
        actorUserId: req.user!.id,
        actorRole: "elder",
        isOwnProfile: isBrainCoachSelfAccess({
          actorUserId: req.user!.id,
          targetUserId: profileId,
          activeProfileId: context.profileId,
          activeProfileRole: context.role,
        }),
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
  const touchesPlanPreferences = hasAnySettingKey(parsed.data, PLAN_PREFERENCE_SETTING_KEYS);
  const touchesSchedule = hasAnySettingKey(parsed.data, SCHEDULE_SETTING_KEYS);
  if (!touchesPlanPreferences && !touchesSchedule) return res.status(400).json({ error: "No Brain Coach settings were provided." });

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
    if (touchesPlanPreferences && !access.permissions.manage_plan_preferences) {
      return res.status(403).json({ error: "Brain Coach plan preferences need senior consent." });
    }
    if (touchesSchedule && !access.permissions.manage_schedule) {
      return res.status(403).json({ error: "Brain Coach schedule changes need senior consent." });
    }

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
    const scheduleSync = touchesSchedule
      ? await syncBrainCoachScheduledInteraction({
          userId: profileId,
          actorUserId: req.user!.id,
          preferredTrainingTimes: normalized.preferredTrainingTimes,
          paused: normalized.paused,
        })
      : null;

    await auditBrainCoachCaregiverChange({
      access,
      previousValue: {
        settings: settingsResponse(existing),
        schedule: brainCoachScheduleAuditSnapshot(scheduleSync?.previousSchedule),
      },
      newValue: {
        settings: settingsResponse(updated),
        schedule: brainCoachScheduleAuditSnapshot(scheduleSync?.schedule),
      },
      source: access.isOwnProfile ? "brain_coach_settings_self" : "brain_coach_settings_caregiver",
      scheduleId: scheduleSync?.schedule.id ?? null,
    });

    return res.json({ settings: settingsResponse(updated), permissions: access.permissions });
  } catch (error) {
    console.error("[caregiver-brain-coach] settings update failed:", error);
    return res.status(500).json({ error: "Brain Coach settings could not be saved." });
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

    const plan = await ensureTodayPlan(profileId);

    const copy = caregiverNudgeCopy(parsed.data.messageType);
    const sentAt = new Date();
    const metadata = {
      message_type: parsed.data.messageType,
      title: copy.title,
      body: copy.body,
      sent_by: req.user!.id,
      sent_at: sentAt.toISOString(),
      in_app_only: true,
    };

    const [event] = await db
      .insert(cognitiveDailyPlanEvents)
      .values({
        planId: plan.id,
        planItemId: null,
        userId: profileId,
        activityType: null,
        eventType: "caregiver_nudge",
        source: "caregiver_dashboard",
        metadata,
        createdAt: sentAt,
      })
      .returning();

    await auditBrainCoachCaregiverChange({
      access,
      previousValue: {},
      newValue: {
        nudge: {
          plan_id: plan.id,
          message_type: parsed.data.messageType,
          in_app_only: true,
        },
      },
      source: access.isOwnProfile ? "brain_coach_nudge_self" : "brain_coach_nudge_caregiver",
    });

    return res.status(201).json({
      nudge: {
        id: event.id,
        planId: plan.id,
        messageType: parsed.data.messageType,
        title: copy.title,
        body: copy.body,
        sentAt: sentAt.toISOString(),
        sentBy: req.user!.id,
      },
      permissions: access.permissions,
    });
  } catch (error) {
    console.error("[caregiver-brain-coach] nudge failed:", error);
    return res.status(500).json({ error: "Brain Coach nudge could not be saved." });
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

export default router;
