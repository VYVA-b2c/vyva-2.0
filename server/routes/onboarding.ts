import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  communicationsLog,
  profiles,
  profileMemberships,
  onboardingState,
  consentLog,
  userChannelPreferences,
  userMedications,
  teamInvitations,
  users,
} from "../../shared/schema.js";
import { z } from "zod";
import { notifyElderOfProxySetup } from "../services/notifications.js";
import { dispatchCommunicationsByIds } from "../services/communicationDispatcher.js";
import { getActiveProfileContext, isMissingAccountProfileLinkColumnError, requireActiveProfileId } from "../lib/profileAccess.js";
import { premiumTrialEndsAt, premiumTrialProfilePatch } from "../lib/premiumTrial.js";
import {
  upsertProfileMembershipToleratingMissingColumns,
  upsertProfileToleratingMissingColumns,
} from "../lib/profileWriteCompatibility.js";

export const onboardingRouter = Router();

// ============================================================
// Stage ordering
// ============================================================

const STAGE_ORDER = [
  "stage_1_identity",
  "stage_2_preferences",
  "stage_3_health",
  "stage_4_care_team",
  "stage_5_consent",
  "complete",
] as const;

type OnboardingStage = typeof STAGE_ORDER[number];

function stageIndex(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage as OnboardingStage);
  return idx === -1 ? 0 : idx;
}

function friendlyStageName(stage: string): string {
  const map: Record<string, string> = {
    stage_1_identity:    "the basics step (name, phone, language)",
    stage_2_preferences: "the channel preferences step",
    stage_3_health:      "the health information step",
    stage_4_care_team:   "the care team step",
    stage_5_consent:     "the consent step",
    complete:            "onboarding",
  };
  return map[stage] ?? stage;
}

/**
 * Checks that the user's profile exists and their current_stage is at least
 * `minStage`. Returns the current stage string on success, or sends a 400
 * response and returns null on failure.
 */
async function requireStage(
  userId: string,
  minStage: OnboardingStage,
  res: Response
): Promise<string | null> {
  const rows = await db
    .select({ current_stage: profiles.current_stage })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!rows[0]) {
    res.status(400).json({
      error: "Onboarding not started",
      required_stage: "stage_1_identity",
      message: "Please complete the basics step first (POST /api/onboarding/basics).",
    });
    return null;
  }

  const current = rows[0].current_stage ?? "stage_1_identity";

  if (stageIndex(current) < stageIndex(minStage)) {
    res.status(400).json({
      error: "Stage prerequisite not met",
      current_stage: current,
      required_stage: minStage,
      message: `Please complete ${friendlyStageName(minStage)} before continuing.`,
    });
    return null;
  }

  return current;
}

// ============================================================
// Shared helpers
// ============================================================

function requireUser(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

const HAS_FIELD_FEATURE_MAP: Record<string, Record<string, boolean>> = {
  has_medications:       { feature_medication_mgmt: true },
  has_health_conditions: { feature_health_research: true, feature_vital_scan: true },
  has_allergies:         { feature_health_research: true },
  has_gp_details:        { feature_health_research: true },
  has_caregiver:         { feature_caregiver_alerts: true, feature_safety_agent: true },
  has_family_member:     { feature_caregiver_alerts: true },
  has_doctor:            { feature_health_research: true },
  has_emergency_address: { feature_safety_agent: true, feature_fall_detection: true },
  has_location:          { feature_concierge: true },
};

async function ensureOnboardingState(userId: string) {
  const rows = await db
    .select()
    .from(onboardingState)
    .where(eq(onboardingState.user_id, userId))
    .limit(1);

  if (rows[0]) return rows[0];

  await db
    .insert(onboardingState)
    .values({ user_id: userId })
    .onConflictDoNothing();

  const created = await db
    .select()
    .from(onboardingState)
    .where(eq(onboardingState.user_id, userId))
    .limit(1);

  return created[0] ?? null;
}

async function markField(userId: string, field: string): Promise<void> {
  const validFields = [
    "has_preferred_name", "has_phone_number", "has_language",
    "has_date_of_birth", "has_emergency_address", "has_checkin_preference", "has_location",
    "has_health_conditions", "has_medications", "has_allergies", "has_gp_details",
    "has_caregiver", "has_family_member", "has_doctor",
  ];

  if (!validFields.includes(field)) {
    throw new Error(`Unknown field: ${field}`);
  }

  const featureUpdates = HAS_FIELD_FEATURE_MAP[field] ?? {};

  await db
    .update(onboardingState)
    .set({
      [field]: true,
      ...featureUpdates,
      updated_at: new Date(),
    })
    .where(eq(onboardingState.user_id, userId));
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function trimmedTextOrNull(value: unknown): string | null {
  return hasText(value) ? value.trim() : null;
}

function splitTimes(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const times = value.filter(hasText).map((time) => time.trim());
    return times.length > 0 ? times : undefined;
  }

  if (!hasText(value)) return undefined;

  const times = value
    .split(/[,\n;]+/)
    .map((time) => time.trim())
    .filter(Boolean);

  return times.length > 0 ? times : undefined;
}

// ============================================================
// POST /start-profile
// Creates the care-recipient profile for this login account.
// ============================================================

const startProfileSchema = z.object({
  setup_for: z.enum(["self", "someone_else"]),
  language: z.string().optional().default("es"),
});

onboardingRouter.post("/start-profile", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;

  const parsed = startProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  try {
    const [account] = await db
      .select({ email: users.email, phone_number: users.phone_number })
      .from(users)
      .where(eq(users.id, accountUserId))
      .limit(1);

    if (!account) {
      return res.status(401).json({ error: "Account not found" });
    }

    const isSelf = parsed.data.setup_for === "self";
    const profileId = isSelf ? accountUserId : crypto.randomUUID();
    const now = new Date();
    const trialEndsAt = premiumTrialEndsAt(now);

    await upsertProfileToleratingMissingColumns({
      id: profileId,
      email: isSelf ? account.email : null,
      phone_number: isSelf ? account.phone_number : null,
      language: parsed.data.language,
      subscription_status: "trial",
      subscription_tier: "premium",
      trial_ends_at: trialEndsAt,
      onboarding_channel: isSelf ? "web_form" : "proxy_web",
      current_stage: "stage_1_identity",
    }, {
      language: parsed.data.language,
      updated_at: now,
    }, "[onboarding/start-profile]");

    const membershipSaved = await upsertProfileMembershipToleratingMissingColumns({
      user_id: accountUserId,
      profile_id: profileId,
      role: isSelf ? "elder" : "caregiver",
      relationship: isSelf ? "self" : "setup_initiator",
      is_primary: true,
      status: "active",
      accepted_at: now,
    }, {
      role: isSelf ? "elder" : "caregiver",
      relationship: isSelf ? "self" : "setup_initiator",
      status: "active",
      is_primary: true,
      accepted_at: now,
      updated_at: now,
    }, "[onboarding/start-profile]");

    if (!membershipSaved && !isSelf) {
      throw new Error("profile_memberships table is required for proxy profile setup");
    }

    try {
      await db
        .update(users)
        .set({
          active_profile_id: profileId,
          onboarding_intent: parsed.data.setup_for,
        })
        .where(eq(users.id, accountUserId));
    } catch (err) {
      if (!isMissingAccountProfileLinkColumnError(err)) throw err;
      console.warn("[onboarding] users profile link columns are missing; continuing with profile_memberships fallback.");
    }

    await ensureOnboardingState(profileId);

    return res.json({
      ok: true,
      profileId,
      role: isSelf ? "elder" : "caregiver",
      nextRoute: isSelf ? "/onboarding/basics" : "/onboarding/proxy-setup",
    });
  } catch (e) {
    console.error("[onboarding] POST /start-profile error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// GET /state
// ============================================================

onboardingRouter.get("/state", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;

  try {
    const context = await getActiveProfileContext(accountUserId);
    if (!context.profileId) {
      return res.json({
        profile: null,
        onboardingState: null,
        account: {
          id: accountUserId,
          activeProfileId: null,
          activeProfileRole: null,
          role: null,
          profileCount: context.profileCount,
          needsProfileSetup: context.needsProfileSetup,
          needsProfileSelection: context.needsProfileSelection,
        },
      });
    }

    const [profileRows, stateRow, medicationRows] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, context.profileId)).limit(1),
      ensureOnboardingState(context.profileId),
      db.select()
        .from(userMedications)
        .where(and(
          eq(userMedications.user_id, context.profileId),
          eq(userMedications.active, true),
          eq(userMedications.added_by, "onboarding"),
        )),
    ]);

    const profile = profileRows[0];
    const consent = (profile?.data_sharing_consent ?? {}) as Record<string, unknown>;
    const conditionSection = (consent.conditions ?? {}) as {
      health_conditions?: string[];
      mobility_level?: string | null;
      living_situation?: string | null;
      no_known_conditions?: boolean;
    };
    const medicationSection = (consent.medications ?? {}) as {
      no_known_medications?: boolean;
    };
    const allergySection = (consent.allergies ?? {}) as {
      no_known_allergies?: boolean;
    };
    const emergencySection = (consent.emergency ?? {}) as {
      emergency_name?: string;
      emergency_phone?: string;
      emergency_role?: string;
      secondary_phone?: string;
      address?: string;
    };

    return res.json({
      profile: profile
        ? {
            ...profile,
            medications: medicationRows.map((med) => ({
              name: med.medication_name,
              dosage: med.dosage ?? "",
              frequency: med.frequency ?? "",
              times: med.scheduled_times?.join(", ") ?? "",
              with_food: "",
              prescribed_by: "",
            })),
            conditions: (conditionSection.health_conditions ?? []).map((name) => ({ name, category: "other" })),
            mobility_level: conditionSection.mobility_level ?? "",
            living_situation: conditionSection.living_situation ?? "",
            no_known_conditions: conditionSection.no_known_conditions === true,
            no_known_medications: medicationSection.no_known_medications === true,
            no_known_allergies: allergySection.no_known_allergies === true,
            emergency_contact: {
              name: emergencySection.emergency_name ?? "",
              relationship: emergencySection.emergency_role ?? "",
              primary_phone: emergencySection.emergency_phone ?? "",
              secondary_phone: emergencySection.secondary_phone ?? "",
              address: emergencySection.address ?? "",
            },
          }
        : null,
      onboardingState: stateRow,
      account: {
        id: accountUserId,
        activeProfileId: context.profileId,
        activeProfileRole: context.role,
        role: context.role,
        profileCount: context.profileCount,
        needsProfileSetup: context.needsProfileSetup,
        needsProfileSelection: context.needsProfileSelection,
      },
    });
  } catch (e) {
    console.error("[onboarding] GET /state error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// GET /careteam  — returns all team_invitations for the user
// ============================================================

onboardingRouter.get("/careteam", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  try {
    const members = await db
      .select({
        id:             teamInvitations.id,
        invitee_name:   teamInvitations.invitee_name,
        invitee_phone:  teamInvitations.invitee_phone,
        invitee_email:  teamInvitations.invitee_email,
        role:           teamInvitations.role,
        relationship:   teamInvitations.relationship,
        status:         teamInvitations.status,
        created_at:     teamInvitations.created_at,
        expires_at:     teamInvitations.expires_at,
        accepted_at:    teamInvitations.accepted_at,
        can_receive_daily_digest:      teamInvitations.can_receive_daily_digest,
        can_receive_safety_alerts:     teamInvitations.can_receive_safety_alerts,
        can_receive_health_alerts:     teamInvitations.can_receive_health_alerts,
        can_receive_mood_alerts:       teamInvitations.can_receive_mood_alerts,
        can_receive_medication_alerts: teamInvitations.can_receive_medication_alerts,
        can_view_dashboard:            teamInvitations.can_view_dashboard,
        can_view_health_reports:       teamInvitations.can_view_health_reports,
        can_view_vital_signs:          teamInvitations.can_view_vital_signs,
        can_view_journal_summaries:    teamInvitations.can_view_journal_summaries,
      })
      .from(teamInvitations)
      .where(eq(teamInvitations.senior_id, userId))
      .orderBy(teamInvitations.created_at);

    const inviteCommunications = await db
      .select({
        channel: communicationsLog.channel,
        status: communicationsLog.status,
        metadata: communicationsLog.metadata,
        sent_at: communicationsLog.sent_at,
        created_at: communicationsLog.created_at,
      })
      .from(communicationsLog)
      .where(and(
        eq(communicationsLog.user_id, userId),
        eq(communicationsLog.purpose, "care_team_invite"),
      ))
      .orderBy(desc(communicationsLog.created_at))
      .limit(200);

    const latestDeliveryByInvitationId = new Map<string, {
      channel: string;
      status: string;
      sent_at: Date | null;
      created_at: Date;
    }>();

    for (const communication of inviteCommunications) {
      const metadata = communication.metadata && typeof communication.metadata === "object"
        ? communication.metadata as Record<string, unknown>
        : {};
      const invitationId = typeof metadata.invitation_id === "string" ? metadata.invitation_id : null;
      if (invitationId && !latestDeliveryByInvitationId.has(invitationId)) {
        latestDeliveryByInvitationId.set(invitationId, {
          channel: communication.channel,
          status: communication.status,
          sent_at: communication.sent_at,
          created_at: communication.created_at,
        });
      }
    }

    return res.json({
      members: members.map((member) => {
        const latestDelivery = latestDeliveryByInvitationId.get(member.id);
        return {
          ...member,
          latest_delivery_status: latestDelivery?.status ?? null,
          latest_delivery_channel: latestDelivery?.channel ?? null,
          latest_delivery_at: latestDelivery?.sent_at ?? latestDelivery?.created_at ?? null,
        };
      }),
    });
  } catch (e) {
    console.error("[onboarding] GET /careteam error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// PATCH /careteam/:id  — revoke a pending or accepted invitation
// Body: { reason?: string }
// ============================================================

onboardingRouter.patch("/careteam/:id", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  const { id } = req.params;
  const reason = typeof req.body?.reason === "string" ? req.body.reason : "revoked_by_senior";

  try {
    const rows = await db
      .select({ id: teamInvitations.id, status: teamInvitations.status, senior_id: teamInvitations.senior_id })
      .from(teamInvitations)
      .where(eq(teamInvitations.id, id))
      .limit(1);

    if (!rows.length) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    const row = rows[0];

    if (row.senior_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Only pending and accepted invitations can be revoked
    if (row.status === "revoked") {
      return res.json({ ok: true, status: "revoked" }); // idempotent
    }
    if (row.status !== "pending" && row.status !== "accepted") {
      return res.status(400).json({ error: `Cannot revoke an invitation with status "${row.status}"` });
    }

    await db
      .update(teamInvitations)
      .set({ status: "revoked", revoked_at: new Date(), revoked_reason: reason, updated_at: new Date() })
      .where(eq(teamInvitations.id, id));

    return res.json({ ok: true, status: "revoked" });
  } catch (e) {
    console.error("[onboarding] PATCH /careteam/:id error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /careteam/:id/resend  — resend an expired invitation
// Creates a fresh team_invitations row; original expired row is kept
// for audit history.
// ============================================================

onboardingRouter.post("/careteam/:id/resend", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  const { id } = req.params;

  try {
    const rows = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, id))
      .limit(1);

    if (!rows.length) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    const orig = rows[0];

    if (orig.senior_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (orig.status !== "expired" && orig.status !== "pending") {
      return res.status(400).json({ error: "Only pending or expired invitations can be resent" });
    }

    if (!normalizeRecipient(orig.invitee_phone) || !normalizeRecipient(orig.invitee_email)) {
      return res.status(400).json({ error: "Caregiver phone and email are required to resend an invitation" });
    }

    const newToken = crypto.randomUUID();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [newRow] = orig.status === "pending"
      ? await db
          .update(teamInvitations)
          .set({ invite_token: newToken, expires_at: newExpiresAt, updated_at: new Date() })
          .where(eq(teamInvitations.id, orig.id))
          .returning()
      : await db
          .insert(teamInvitations)
          .values({
            senior_id:        orig.senior_id,
            invitee_name:     orig.invitee_name,
            invitee_phone:    orig.invitee_phone,
            invitee_email:    orig.invitee_email,
            invitee_whatsapp: orig.invitee_whatsapp,
            role:             orig.role,
            relationship:     orig.relationship,
            invite_token:     newToken,
            invite_channel:   orig.invite_channel,
            status:           "pending",
            expires_at:       newExpiresAt,
            can_receive_daily_digest:      orig.can_receive_daily_digest,
            can_receive_safety_alerts:     orig.can_receive_safety_alerts,
            can_receive_health_alerts:     orig.can_receive_health_alerts,
            can_receive_mood_alerts:       orig.can_receive_mood_alerts,
            can_receive_medication_alerts: orig.can_receive_medication_alerts,
            can_view_dashboard:            orig.can_view_dashboard,
            can_view_health_reports:       orig.can_view_health_reports,
            can_view_vital_signs:          orig.can_view_vital_signs,
            can_view_journal_summaries:    orig.can_view_journal_summaries,
          })
          .returning();

    const [senior] = await db
      .select({ full_name: profiles.full_name, preferred_name: profiles.preferred_name })
      .from(profiles)
      .where(eq(profiles.id, newRow.senior_id))
      .limit(1);
    const delivery = await queueAndDispatchCareTeamInvite({
      req,
      invitation: newRow,
      seniorName: senior?.preferred_name ?? senior?.full_name ?? null,
    });

    return res.json({
      ok: true,
      status: "pending",
      newId: newRow.id,
      delivery: careTeamDeliveryResponse(delivery),
      ...(process.env.NODE_ENV !== "production" ? { _devInviteUrl: delivery.inviteUrl } : {}),
    });
  } catch (e) {
    console.error("[onboarding] POST /careteam/:id/resend error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /basics  (Stage 1 → advances to stage_2_preferences)
// No stage prerequisite — this is the entry point.
// Stage regression guard: if the user is already past stage_1,
// we update the fields but do NOT roll the stage backwards.
// ============================================================

const CHANNEL_VALUES = ["email", "in-app", "whatsapp", "sms"] as const;
type ChannelValue = typeof CHANNEL_VALUES[number];

const basicsSchema = z.object({
  full_name:              z.string().min(1, "Name is required"),
  preferred_name:         z.string().nullish(),
  date_of_birth:          z.string().nullish(),
  phone_number:           z.string().optional(),
  language:               z.string().min(1).default("en"),
  email:                  z.string().email().nullish(),
  channel_reports:        z.enum(CHANNEL_VALUES).optional(),
  channel_chats:          z.enum(CHANNEL_VALUES).optional(),
  channel_notifications:  z.enum(CHANNEL_VALUES).optional(),
  hybrid_channel_mode:    z.boolean().optional(),
  facebook_url:           z.string().nullish(),
  instagram_url:          z.string().nullish(),
  whatsapp_number:        z.string().nullish(),
});

onboardingRouter.post("/basics", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  const parsed = basicsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const { full_name, preferred_name, date_of_birth, phone_number, language,
          email, channel_reports, channel_chats, channel_notifications, hybrid_channel_mode,
          facebook_url, instagram_url, whatsapp_number } = parsed.data;

  const trialPatch = premiumTrialProfilePatch();
  const trialEndsAt = trialPatch.trial_ends_at;

  try {
    // Fetch the current profile so we can preserve the stage if already advanced.
    const existing = await db
      .select({
        current_stage: profiles.current_stage,
        full_name: profiles.full_name,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    const currentStage = existing[0]?.current_stage ?? "stage_1_identity";
    const shouldInitializePremiumTrial = !hasText(existing[0]?.full_name);
    // Only advance to stage_2 if the user hasn't progressed further yet.
    const nextStage: OnboardingStage =
      stageIndex(currentStage) > stageIndex("stage_1_identity")
        ? (currentStage as OnboardingStage)
        : "stage_2_preferences";

    await db
      .insert(profiles)
      .values({
        id:             userId,
        full_name,
        preferred_name:  preferred_name ?? null,
        date_of_birth:   date_of_birth ?? null,
        ...(phone_number           ? { phone_number }           : {}),
        ...(email                  ? { email }                  : {}),
        ...(channel_reports        ? { channel_reports }        : {}),
        ...(channel_chats          ? { channel_chats }          : {}),
        ...(channel_notifications  ? { channel_notifications }  : {}),
        ...(hybrid_channel_mode    !== undefined && { hybrid_channel_mode }),
        ...(facebook_url           ? { facebook_url }           : {}),
        ...(instagram_url          ? { instagram_url }          : {}),
        ...(whatsapp_number        ? { whatsapp_number }        : {}),
        language,
        subscription_status: trialPatch.subscription_status,
        subscription_tier:   trialPatch.subscription_tier,
        trial_ends_at:       trialPatch.trial_ends_at,
        current_stage:       "stage_2_preferences",
        stage_1_completed_at: new Date(),
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          full_name,
          ...(preferred_name    !== undefined && { preferred_name }),
          ...(date_of_birth     !== undefined && { date_of_birth }),
          ...(phone_number          ? { phone_number }              : {}),
          ...(email                !== undefined && { email: email ?? null }),
          ...(channel_reports      !== undefined && { channel_reports:       channel_reports      ?? null }),
          ...(channel_chats        !== undefined && { channel_chats:         channel_chats        ?? null }),
          ...(channel_notifications !== undefined && { channel_notifications: channel_notifications ?? null }),
          ...(hybrid_channel_mode  !== undefined && { hybrid_channel_mode }),
          ...(facebook_url         !== undefined && { facebook_url:          facebook_url         ?? null }),
          ...(instagram_url        !== undefined && { instagram_url:         instagram_url        ?? null }),
          ...(whatsapp_number      !== undefined && { whatsapp_number:       whatsapp_number      ?? null }),
          language,
          ...(shouldInitializePremiumTrial ? trialPatch : {}),
          // Preserve stage if already past stage_1.
          current_stage:        nextStage,
          stage_1_completed_at: new Date(),
          updated_at:           new Date(),
        },
      });

    await ensureOnboardingState(userId);

    const fieldsToMark = [
      "has_preferred_name",
      "has_language",
      ...(phone_number ? ["has_phone_number"] : []),
    ];
    await Promise.all(fieldsToMark.map((f) => markField(userId, f)));

    return res.json({ ok: true, trial_ends_at: trialEndsAt });
  } catch (e) {
    console.error("[onboarding] POST /basics error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /channel  (Stage 2 → advances to stage_3_health)
// Prerequisite: basics must be complete (current_stage >= stage_2_preferences)
// ============================================================

const channelSchema = z.object({
  preferred_checkin_channel:      z.string().optional(),
  preferred_conversation_channel: z.string().optional(),
  preferred_reminder_channel:     z.string().optional(),
  preferred_alert_channel:        z.string().optional(),
  voice_available_from:           z.string().optional(),
  voice_available_until:          z.string().optional(),
  whatsapp_available_from:        z.string().optional(),
  whatsapp_available_until:       z.string().optional(),
  // Phone number provided when a voice/WhatsApp outbound channel is selected.
  contact_phone:                  z.string().optional(),
});

onboardingRouter.post("/channel", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  // Gate: basics must be complete (stage_2_preferences) before channel can be set.
  // BasicsStep calls /basics which advances stage to stage_2_preferences before
  // navigating to the channel step, so this gate is safe to enforce.
  const currentStage = await requireStage(userId, "stage_2_preferences", res);
  if (currentStage === null) return;

  const parsed = channelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  try {
    const { contact_phone, ...channelPrefs } = parsed.data;
    const nonEmpty = Object.fromEntries(
      Object.entries(channelPrefs as Record<string, string | undefined>).filter(([, v]) => v !== undefined)
    );

    await db
      .insert(userChannelPreferences)
      .values({ user_id: userId, ...nonEmpty })
      .onConflictDoUpdate({
        target: userChannelPreferences.user_id,
        set: { ...nonEmpty, updated_at: new Date() },
      });

    // Persist contact phone to the profile when provided (voice/WhatsApp outbound channels).
    const checkinChannel = channelPrefs.preferred_checkin_channel;
    if (contact_phone) {
      const profilePhoneFields: Record<string, string> = { phone_number: contact_phone };
      if (checkinChannel === "whatsapp_outbound" || checkinChannel === "whatsapp_text") {
        profilePhoneFields.whatsapp_number = contact_phone;
      }
      await db
        .update(profiles)
        .set({ ...profilePhoneFields, updated_at: new Date() })
        .where(eq(profiles.id, userId));
    }

    // Only advance stage if not already past stage_2.
    if (stageIndex(currentStage) <= stageIndex("stage_2_preferences")) {
      await db
        .update(profiles)
        .set({
          current_stage:        "stage_3_health",
          stage_2_completed_at: new Date(),
          updated_at:           new Date(),
        })
        .where(eq(profiles.id, userId));
    }

    await markField(userId, "has_checkin_preference");

    return res.json({ ok: true });
  } catch (e) {
    console.error("[onboarding] POST /channel error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /proxy  — records a proxy (carer) setting up on the elder's behalf
// ============================================================

const proxySchema = z.object({
  proxy_name: z.string().min(2, "Name must be at least 2 characters"),
});

onboardingRouter.post("/proxy", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  // Gate: user must have started onboarding (profile must exist with at least basics complete).
  const currentStageCheck = await requireStage(userId, "stage_1_identity", res);
  if (currentStageCheck === null) return;

  const parsed = proxySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  try {
    const currentStage = currentStageCheck;

    // NOTE: proxy_initiator_id stores a human-readable display string (e.g. "Maria García (Son / Daughter)")
    // rather than a user ID. This is intentional for the current MVP where the carer does not have
    // their own VYVA account. Future work should migrate to storing carer user ID + separate display fields.
    //
    // In the new signup flow, proxy setup can happen before the elder's basics
    // are entered. In the older channel-step flow, it still replaces channel
    // preferences and advances to the health/consent stage.
    const shouldAdvance =
      stageIndex(currentStage) >= stageIndex("stage_2_preferences") &&
      stageIndex(currentStage) <= stageIndex("stage_2_preferences");

    // Generate a one-time confirmation token stored on the profile.
    // This lets the elder confirm without needing to be logged in — they
    // just tap the link in the SMS.
    const confirmToken = crypto.randomUUID();

    await db
      .insert(profiles)
      .values({
        id:                  userId,
        proxy_initiator_id:  parsed.data.proxy_name,
        proxy_initiated_at:  new Date(),
        onboarding_channel:  "proxy_web",
        elder_confirm_token: confirmToken,
        current_stage:       shouldAdvance ? "stage_3_health" : currentStage,
        stage_2_completed_at: shouldAdvance ? new Date() : undefined,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          proxy_initiator_id:  parsed.data.proxy_name,
          proxy_initiated_at:  new Date(),
          onboarding_channel:  "proxy_web",
          elder_confirm_token: confirmToken,
          ...(shouldAdvance ? {
            current_stage:        "stage_3_health",
            stage_2_completed_at: new Date(),
          } : {}),
          updated_at: new Date(),
        },
      });

    await db
      .update(profileMemberships)
      .set({
        display_name: parsed.data.proxy_name,
        updated_at: new Date(),
      })
      .where(and(
        eq(profileMemberships.user_id, accountUserId),
        eq(profileMemberships.profile_id, userId),
      ));

    // Build the direct confirmation URL for the elder's SMS.
    // Priority: APP_BASE_URL env var, then local development fallback.
    const appBase =
      process.env.APP_BASE_URL ??
      `http://localhost:${process.env.PORT || "5000"}`;
    const confirmUrl = `${appBase}/confirm/${confirmToken}`;

    // Notify the elder that their account has been set up by a proxy.
    // We fetch the latest profile so we have whatever contact info was
    // collected during stage_1_identity (name, phone number).
    try {
      const [elderProfile] = await db
        .select({ full_name: profiles.full_name, phone_number: profiles.phone_number })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      await notifyElderOfProxySetup({
        elderId:    userId,
        elderName:  elderProfile?.full_name ?? null,
        elderPhone: elderProfile?.phone_number ?? null,
        // elderEmail is not yet stored in the profiles table — it lives in the
        // auth provider. Pass null until JWT/session auth exposes it here.
        elderEmail: null,
        proxyName:  parsed.data.proxy_name,
        confirmUrl,
      });
    } catch (notifyErr) {
      // Never block the main response for a notification failure.
      console.error("[onboarding] POST /proxy — notification error (non-fatal):", notifyErr);
    }

    return res.json({
      ok: true,
      confirmUrl,
      nextRoute: shouldAdvance ? "/onboarding/elder-confirm" : "/onboarding/basics",
    });
  } catch (e) {
    console.error("[onboarding] POST /proxy error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// GET /confirm/:token  — tokenized elder confirm (no JWT required)
//   Returns the proxy name and whether already confirmed so the
//   frontend can render the confirmation screen.
// ============================================================

onboardingRouter.get("/confirm/:token", async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const [row] = await db
      .select({
        id:                  profiles.id,
        full_name:           profiles.full_name,
        proxy_initiator_id:  profiles.proxy_initiator_id,
        elder_confirmed_at:  profiles.elder_confirmed_at,
      })
      .from(profiles)
      .where(eq(profiles.elder_confirm_token, token))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: "Invalid or expired confirmation link" });
    }

    return res.json({
      alreadyConfirmed: !!row.elder_confirmed_at,
      elderName:        row.full_name ?? null,
      proxyName:        row.proxy_initiator_id ?? null,
    });
  } catch (e) {
    console.error("[onboarding] GET /confirm/:token error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /confirm/:token  — tokenized elder confirm (no JWT required)
//   Sets elder_confirmed_at and clears the token (single-use).
// ============================================================

onboardingRouter.post("/confirm/:token", async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const [row] = await db
      .select({ id: profiles.id, elder_confirmed_at: profiles.elder_confirmed_at })
      .from(profiles)
      .where(eq(profiles.elder_confirm_token, token))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: "Invalid or expired confirmation link" });
    }

    if (row.elder_confirmed_at) {
      // Already confirmed — idempotent
      return res.json({ ok: true, alreadyConfirmed: true });
    }

    // Mark confirmed and clear the single-use token
    await db
      .update(profiles)
      .set({
        elder_confirmed_at:  new Date(),
        elder_confirm_token: null,
        updated_at:          new Date(),
      })
      .where(eq(profiles.id, row.id));

    return res.json({ ok: true, alreadyConfirmed: false });
  } catch (e) {
    console.error("[onboarding] POST /confirm/:token error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /elder-confirm  — elder confirms a proxy-initiated account
// ============================================================

onboardingRouter.post("/elder-confirm", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  try {
    // Guard: only allow elder confirmation on accounts that were actually set up by a proxy.
    const [existingProfile] = await db
      .select({ proxy_initiator_id: profiles.proxy_initiator_id })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!existingProfile?.proxy_initiator_id) {
      return res.status(400).json({
        error: "No proxy-initiated profile found",
        message: "Elder confirmation is only applicable to accounts set up by a carer.",
      });
    }

    await db
      .update(profiles)
      .set({ elder_confirmed_at: new Date(), updated_at: new Date() })
      .where(eq(profiles.id, userId));

    return res.json({ ok: true });
  } catch (e) {
    console.error("[onboarding] POST /elder-confirm error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /consent  (Stage 5 → advances to complete)
// Prerequisite: current_stage >= stage_3_health (channel step complete).
//
// NOTE on gating level: The full stage model includes stage_4_care_team
// and stage_5_consent between stage_3_health and complete, but no server
// routes currently advance the user through those intermediate stages —
// that work is tracked separately. Until explicit stage-4/5 advancement
// routes exist, gating at stage_3_health is the correct and intentional
// minimum: it prevents a user from skipping basics + channel entirely,
// while not blocking users who have completed health sections via the
// exempt /section/:sectionId routes. Tighten this gate once stage_4 and
// stage_5 advancement routes are in place.
// ============================================================

const consentEntrySchema = z.object({
  scope:               z.string(),
  action:              z.string(),
  channel:             z.string(),
  target_user_id:      z.string().optional(),
  target_name:         z.string().optional(),
  target_role:         z.string().optional(),
  confirmed_by_elder:  z.boolean().optional(),
  confirmation_method: z.string().optional(),
});

const consentSchema = z.object({
  entries:       z.array(consentEntrySchema).min(1),
  skip_advance:  z.boolean().optional(),
});

onboardingRouter.post("/consent", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  // Gate: channel preferences (stage_2) must be complete before submitting consent.
  const currentStage = await requireStage(userId, "stage_3_health", res);
  if (currentStage === null) return;

  // Gate: proxy-initiated accounts must be confirmed by the elder before consent can be recorded.
  const [userProfile] = await db
    .select({ proxy_initiator_id: profiles.proxy_initiator_id, elder_confirmed_at: profiles.elder_confirmed_at })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (userProfile?.proxy_initiator_id && !userProfile?.elder_confirmed_at) {
    return res.status(403).json({
      error: "Elder confirmation required",
      code: "ELDER_CONFIRMATION_REQUIRED",
      message: "This account was set up on someone's behalf. The account holder must confirm it before consenting.",
    });
  }

  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const { entries, skip_advance } = parsed.data;

  try {
    for (const entry of entries) {
      await db.insert(consentLog).values({
        user_id: userId,
        scope:   entry.scope as typeof consentLog.$inferInsert["scope"],
        action:  entry.action as typeof consentLog.$inferInsert["action"],
        channel: entry.channel as typeof consentLog.$inferInsert["channel"],
        target_user_id:      entry.target_user_id ?? null,
        target_name:         entry.target_name ?? null,
        target_role:         (entry.target_role ?? null) as typeof consentLog.$inferInsert["target_role"],
        confirmed_by_elder:  entry.confirmed_by_elder ?? true,
        confirmation_method: entry.confirmation_method ?? null,
      });
    }

    if (!skip_advance) {
      await db
        .update(profiles)
        .set({
          current_stage:        "complete",
          onboarding_complete:  true,
          stage_5_completed_at: new Date(),
          updated_at:           new Date(),
        })
        .where(eq(profiles.id, userId));
    }

    return res.json({ ok: true, inserted: entries.length });
  } catch (e) {
    console.error("[onboarding] POST /consent error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /field  (Exempt from stage checks — used mid-conversation)
// ============================================================

const fieldSchema = z.object({
  field: z.string(),
});

onboardingRouter.post("/field", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  const parsed = fieldSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const { field } = parsed.data;

  try {
    await ensureOnboardingState(userId);
    await markField(userId, field);
    return res.json({ ok: true, field });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Unknown field:")) {
      return res.status(400).json({ error: e.message });
    }
    console.error("[onboarding] POST /field error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /section/:sectionId  (Exempt — used mid-conversation)
// ============================================================

const sectionSchemas: Record<string, z.ZodTypeAny> = {
  medications: z.object({
    medications: z.array(z.object({
      medication_name: z.string().optional(),
      name:            z.string().optional(),
      dosage:          z.string().optional(),
      frequency:       z.string().optional(),
      scheduled_times: z.array(z.string()).optional(),
      times:           z.union([z.string(), z.array(z.string())]).optional(),
    })).optional(),
    known_allergies: z.array(z.string()).optional(),
    no_known_medications: z.boolean().optional(),
    no_known_allergies: z.boolean().optional(),
  }),
  conditions: z.object({
    health_conditions: z.array(z.string()).optional(),
    conditions: z.array(z.object({
      name:     z.string(),
      category: z.string().optional(),
    })).optional(),
    mobility_level:   z.string().nullable().optional(),
    living_situation: z.string().nullable().optional(),
    allergies:        z.array(z.string()).optional(),
    no_known_conditions: z.boolean().optional(),
  }),
  cognitive: z.object({
    cognitive_notes: z.string().optional(),
    memory_difficulties: z.string().optional(),
    cognitive_diagnosis: z.string().optional(),
    session_length_mins: z.number().int().min(5).max(20).optional(),
    training_time: z.string().optional(),
    pace: z.string().optional(),
    variety: z.string().optional(),
    communication_style: z.string().optional(),
  }),
  diet: z.object({
    dietary_notes:      z.string().optional(),
    dietary_preferences: z.array(z.string()).optional(),
  }),
  address: z.object({
    address_line_1: z.string().optional(),
    city:           z.string().optional(),
    region:         z.string().optional(),
    postcode:       z.string().optional(),
    country_code:   z.string().optional(),
    country:        z.string().optional(),
    timezone:       z.string().optional(),
  }),
  gp: z.object({
    gp_name:     z.string().optional(),
    gp_phone:    z.string().optional(),
    gp_email:    z.string().optional(),
    gp_address:  z.string().optional(),
    gp_maps_url: z.string().optional(),
    gp_place_id: z.string().optional(),
  }),
  devices: z.object({
    devices: z.array(z.string()).optional(),
  }),
  hobbies: z.object({
    hobbies: z.array(z.string()).optional(),
    followUps: z.record(z.string(), z.string()).optional(),
    personality: z.record(z.string(), z.string()).optional(),
  }),
  providers: z.object({
    providers: z.array(z.object({
      name:             z.string(),
      role:             z.string().optional(),
      phone:            z.string().optional(),
      google_maps_url:  z.string().optional(),
      google_place_id:  z.string().optional(),
      address:          z.string().optional(),
      lat:              z.number().optional(),
      lng:              z.number().optional(),
      website_uri:      z.string().optional(),
      opening_hours:    z.array(z.string()).optional(),
      contact_name:     z.string().optional(),
      contact_role:     z.string().optional(),
      contact_phone:    z.string().optional(),
      usual_order:      z.string().optional(),
      special_requests: z.string().optional(),
      online_order_url: z.string().optional(),
      menu_url:         z.string().optional(),
      notes:            z.string().optional(),
    })).optional(),
  }),
  emergency: z.object({
    emergency_name:  z.string().optional(),
    emergency_phone: z.string().optional(),
    emergency_role:  z.string().optional(),
    name:            z.string().optional(),
    relationship:    z.string().optional(),
    primary_phone:   z.string().optional(),
    secondary_phone: z.string().optional(),
    address:         z.string().optional(),
  }),
  careteam: z.object({
    role:           z.enum(["family", "carer", "doctor"]),
    person: z.object({
      name:         z.string(),
      relationship: z.string().optional(),
      phone:        z.string().trim().min(1, "Phone is required"),
      whatsapp:     z.string().optional(),
      email:        z.string().trim().email("Email is required"),
    }),
    consent: z.object({
      // Fields that map directly to team_invitations columns:
      daily_summary:       z.boolean().optional(), // → can_receive_daily_digest
      mood_updates:        z.boolean().optional(), // → can_receive_mood_alerts
      medication_alerts:   z.boolean().optional(), // → can_receive_medication_alerts
      health_reports:      z.boolean().optional(), // → can_receive_health_alerts + can_view_health_reports
      vital_signs:         z.boolean().optional(), // → can_view_vital_signs
      cognitive_results:   z.boolean().optional(), // → can_view_journal_summaries
      emergency_alerts:    z.boolean().optional(), // → can_receive_safety_alerts
      dashboard_access:    z.boolean().optional(), // → can_view_dashboard
      // NOTE: "appointments" and "inactivity_alerts" shown in the UI are not
      // yet persisted — team_invitations has no column for them. They are
      // silently dropped here until dedicated columns are added.
    }).optional(),
    // NOTE: "sms" is mapped to the nearest supported enum value "whatsapp_text"
    // (true SMS channel is not yet available). Logged here for future reference.
    invite_channel: z.enum(["whatsapp", "sms"]).optional(),
  }),
};

const SECTION_FIELD_MAP: Record<string, string[]> = {
  medications: ["has_medications"],
  conditions:  ["has_health_conditions"],
  cognitive:   [],
  diet:        [],
  address:     ["has_location"],
  gp:          ["has_gp_details"],
  devices:     [],
  hobbies:     [],
  providers:   [],
  emergency:   ["has_emergency_address"],
  careteam:    [],
};

const CARETEAM_ROLE_MAP: Record<string, "caregiver" | "family_member" | "friend" | "doctor" | "gp"> = {
  family: "family_member",
  carer:  "caregiver",
  doctor: "doctor",
};

const CARETEAM_ONBOARDING_FIELD: Record<string, string> = {
  family: "has_family_member",
  carer:  "has_caregiver",
  doctor: "has_doctor",
};

type CareTeamDeliveryResult = {
  communications: Array<typeof communicationsLog.$inferSelect>;
  dispatch: Awaited<ReturnType<typeof dispatchCommunicationsByIds>>;
  inviteUrl: string;
};

function appBaseUrl(req: Request) {
  const configured = process.env.APP_BASE_URL ?? process.env.APP_URL;
  if (configured?.trim()) return configured.trim().replace(/\/+$/, "");

  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.get("host")?.trim() || `localhost:${process.env.PORT || "5000"}`;
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || req.protocol || "http";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function careTeamInviteUrl(req: Request, token: string) {
  return `${appBaseUrl(req)}/care-team/invite/${encodeURIComponent(token)}`;
}

function displayNameOrFallback(value: string | null | undefined) {
  return value?.trim() || "someone you support";
}

function normalizeRecipient(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function requiredCareTeamRecipients(invitation: {
  invitee_phone: string | null;
  invitee_email: string | null;
}) {
  const smsRecipient = normalizeRecipient(invitation.invitee_phone);
  const emailRecipient = normalizeRecipient(invitation.invitee_email);

  if (!smsRecipient || !emailRecipient) {
    throw new Error("Caregiver phone and email are required to send a care-team invitation.");
  }

  return [
    { channel: "sms", recipient: smsRecipient },
    { channel: "email", recipient: emailRecipient },
  ];
}

function careTeamInviteBody(input: {
  seniorName: string | null;
  inviteeName: string;
  inviteUrl: string;
}) {
  const seniorName = displayNameOrFallback(input.seniorName);
  return `VYVA: ${seniorName} invited you to their care team. Review and accept securely: ${input.inviteUrl}`;
}

async function queueAndDispatchCareTeamInvite(input: {
  req: Request;
  invitation: typeof teamInvitations.$inferSelect;
  seniorName: string | null;
}): Promise<CareTeamDeliveryResult> {
  const inviteUrl = careTeamInviteUrl(input.req, input.invitation.invite_token);
  const body = careTeamInviteBody({
    seniorName: input.seniorName,
    inviteeName: input.invitation.invitee_name,
    inviteUrl,
  });
  const recipients = requiredCareTeamRecipients(input.invitation);

  const dedupedRecipients = Array.from(
    new Map(recipients.map((item) => [`${item.channel}:${item.recipient.toLowerCase()}`, item])).values(),
  );

  if (dedupedRecipients.length === 0) {
    return { inviteUrl, communications: [], dispatch: { processed: 0, results: [] } };
  }

  const communications = await db
    .insert(communicationsLog)
    .values(dedupedRecipients.map((target) => ({
      user_id: input.invitation.senior_id,
      channel: target.channel,
      recipient: target.recipient,
      purpose: "care_team_invite",
      status: "queued",
      body,
      metadata: {
        url: inviteUrl,
        subject: `${displayNameOrFallback(input.seniorName)} invited you to their VYVA care team`,
        invitation_id: input.invitation.id,
        senior_id: input.invitation.senior_id,
        senior_name: displayNameOrFallback(input.seniorName),
        invitee_name: input.invitation.invitee_name,
        recipient_name: input.invitation.invitee_name,
        target_role: input.invitation.role,
        relationship: input.invitation.relationship,
      },
    })))
    .returning();

  const dispatch = await dispatchCommunicationsByIds(communications.map((item) => item.id));
  return { inviteUrl, communications, dispatch };
}

function careTeamDeliveryResponse(delivery: CareTeamDeliveryResult) {
  const sent = delivery.dispatch.results.filter((item) => item.status === "sent").length;
  const failed = delivery.dispatch.results.filter((item) => item.status === "failed").length;
  return {
    queued: delivery.communications.length,
    sent,
    failed,
    results: delivery.dispatch.results.map((item) => ({
      id: item.id,
      channel: item.channel,
      recipient: item.recipient,
      status: item.status,
      ...(item.error ? { error: item.error } : {}),
    })),
  };
}

async function mergeSectionIntoConsent(
  userId: string,
  sectionKey: string,
  payload: Record<string, unknown>
): Promise<void> {
  const profileRows = await db
    .select({ data_sharing_consent: profiles.data_sharing_consent })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  const existing = (profileRows[0]?.data_sharing_consent as Record<string, unknown> | null) ?? {};
  const existingSection = (
    existing[sectionKey] && typeof existing[sectionKey] === "object" && !Array.isArray(existing[sectionKey])
      ? existing[sectionKey]
      : {}
  ) as Record<string, unknown>;
  const merged = { ...existing, [sectionKey]: { ...existingSection, ...payload } };

  await db
    .update(profiles)
    .set({ data_sharing_consent: merged, updated_at: new Date() })
    .where(eq(profiles.id, userId));
}

onboardingRouter.post("/section/:sectionId", async (req: Request, res: Response) => {
  const accountUserId = requireUser(req, res);
  if (!accountUserId) return;
  const userId = await requireActiveProfileId(accountUserId, res);
  if (!userId) return;

  const { sectionId } = req.params;

  if (!sectionSchemas[sectionId]) {
    return res.status(400).json({ error: `Unknown section: ${sectionId}` });
  }

  const parsed = sectionSchemas[sectionId].safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const data = parsed.data as Record<string, unknown>;

  try {
    await ensureOnboardingState(userId);

    if (sectionId === "medications") {
      if (Array.isArray(data.known_allergies)) {
        const allergies = (data.known_allergies as unknown[])
          .filter(hasText)
          .map((allergy) => allergy.trim());

        await db
          .update(profiles)
          .set({ known_allergies: allergies, updated_at: new Date() })
          .where(eq(profiles.id, userId));

        await mergeSectionIntoConsent(userId, "allergies", {
          no_known_allergies: allergies.length === 0 && data.no_known_allergies === true,
        });

        if (allergies.length > 0) {
          await markField(userId, "has_allergies");
        } else {
          await db
            .update(onboardingState)
            .set({ has_allergies: false, updated_at: new Date() })
            .where(eq(onboardingState.user_id, userId));
        }
      } else if (data.no_known_allergies !== undefined) {
        await db
          .update(profiles)
          .set({ known_allergies: [], updated_at: new Date() })
          .where(eq(profiles.id, userId));
        await mergeSectionIntoConsent(userId, "allergies", {
          no_known_allergies: data.no_known_allergies === true,
        });
        await db
          .update(onboardingState)
          .set({ has_allergies: false, updated_at: new Date() })
          .where(eq(onboardingState.user_id, userId));
      }

      const rawMeds = data.medications as Array<{
        medication_name?: string;
        name?: string;
        dosage?: string;
        frequency?: string;
        scheduled_times?: string[];
        times?: string | string[];
      }> | undefined;

      const hasMedicationPayload = Array.isArray(rawMeds);
      const meds = hasMedicationPayload
        ? rawMeds
            .map((m) => ({
              medication_name: (m.medication_name ?? m.name ?? "").trim(),
              dosage: hasText(m.dosage) ? m.dosage.trim() : null,
              frequency: hasText(m.frequency) ? m.frequency.trim() : null,
              scheduled_times: splitTimes(m.scheduled_times ?? m.times) ?? null,
            }))
            .filter((m) => m.medication_name.length > 0)
        : [];

      if (hasMedicationPayload || data.no_known_medications !== undefined) {
        const noKnownMedications = meds.length === 0 && data.no_known_medications === true;

        // The profile medication form is treated as the source of truth for
        // onboarding-entered medicines, so repeated autosaves update instead of duplicate.
        await db
          .delete(userMedications)
          .where(and(eq(userMedications.user_id, userId), eq(userMedications.added_by, "onboarding")));

        if (meds.length > 0) {
          await db.insert(userMedications).values(
            meds.map((m) => ({
              user_id:         userId,
              medication_name: m.medication_name,
              dosage:          m.dosage,
              frequency:       m.frequency,
              scheduled_times: m.scheduled_times,
              added_by:        "onboarding",
            }))
          );
        }

        await mergeSectionIntoConsent(userId, "medications", {
          no_known_medications: noKnownMedications,
        });

        await db
          .update(onboardingState)
          .set({
            has_medications: meds.length > 0,
            feature_medication_mgmt: meds.length > 0,
            updated_at: new Date(),
          })
          .where(eq(onboardingState.user_id, userId));
      }
    } else if (sectionId === "conditions") {
      const namedConditions = Array.isArray(data.conditions)
        ? (data.conditions as Array<{ name?: string }>)
            .map((condition) => condition.name)
            .filter(hasText)
            .map((name) => name.trim())
        : [];
      const healthConditions = Array.isArray(data.health_conditions)
        ? (data.health_conditions as unknown[]).filter(hasText).map((name) => name.trim())
        : namedConditions;
      const payload = {
        health_conditions: healthConditions,
        mobility_level: hasText(data.mobility_level) ? data.mobility_level.trim() : null,
        living_situation: hasText(data.living_situation) ? data.living_situation.trim() : null,
        no_known_conditions: healthConditions.length === 0 && data.no_known_conditions === true,
      };

      await mergeSectionIntoConsent(userId, "conditions", payload);

      if (
        payload.health_conditions.length > 0 ||
        payload.mobility_level ||
        payload.living_situation
      ) {
        await markField(userId, "has_health_conditions");
      } else {
        await db
          .update(onboardingState)
          .set({ has_health_conditions: false, updated_at: new Date() })
          .where(eq(onboardingState.user_id, userId));
      }
    } else if (sectionId === "address") {
      const profileUpdates: Record<string, unknown> = { updated_at: new Date() };
      const country = data.country_code ?? data.country;
      if (data.address_line_1 !== undefined) profileUpdates.address_line_1 = hasText(data.address_line_1) ? data.address_line_1.trim() : null;
      if (data.city           !== undefined) profileUpdates.city           = hasText(data.city) ? data.city.trim() : null;
      if (data.region         !== undefined) profileUpdates.region         = hasText(data.region) ? data.region.trim() : null;
      if (data.postcode       !== undefined) profileUpdates.postcode       = hasText(data.postcode) ? data.postcode.trim() : null;
      if (country             !== undefined) profileUpdates.country_code   = hasText(country) ? country.trim() : null;
      if (data.timezone       !== undefined) profileUpdates.timezone       = hasText(data.timezone) ? data.timezone.trim() : null;

      await db.update(profiles).set(profileUpdates).where(eq(profiles.id, userId));

      const fieldsToMark = SECTION_FIELD_MAP["address"];
      await Promise.all(fieldsToMark.map((f) => markField(userId, f)));
    } else if (sectionId === "gp") {
      const profileUpdates: Record<string, unknown> = { updated_at: new Date() };
      if (data.gp_name     !== undefined) profileUpdates.gp_name     = trimmedTextOrNull(data.gp_name);
      if (data.gp_phone    !== undefined) profileUpdates.gp_phone    = trimmedTextOrNull(data.gp_phone);
      if (data.gp_email    !== undefined) profileUpdates.gp_email    = trimmedTextOrNull(data.gp_email);
      if (data.gp_address  !== undefined) profileUpdates.gp_address  = trimmedTextOrNull(data.gp_address);
      if (data.gp_maps_url !== undefined) profileUpdates.gp_maps_url = trimmedTextOrNull(data.gp_maps_url);
      if (data.gp_place_id !== undefined) profileUpdates.gp_place_id = trimmedTextOrNull(data.gp_place_id);

      const [currentProfile] = await db
        .select({
          gp_name: profiles.gp_name,
          gp_phone: profiles.gp_phone,
          gp_email: profiles.gp_email,
          gp_address: profiles.gp_address,
        })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      const nextGpDetails = {
        gp_name: data.gp_name !== undefined ? profileUpdates.gp_name : currentProfile?.gp_name,
        gp_phone: data.gp_phone !== undefined ? profileUpdates.gp_phone : currentProfile?.gp_phone,
        gp_email: data.gp_email !== undefined ? profileUpdates.gp_email : currentProfile?.gp_email,
        gp_address: data.gp_address !== undefined ? profileUpdates.gp_address : currentProfile?.gp_address,
      };

      const hasGpDetails = Object.values(nextGpDetails).some(hasText);

      await db.update(profiles).set(profileUpdates).where(eq(profiles.id, userId));
      if (hasGpDetails) {
        await markField(userId, "has_gp_details");
      } else {
        await db
          .update(onboardingState)
          .set({ has_gp_details: false, updated_at: new Date() })
          .where(eq(onboardingState.user_id, userId));
      }
    } else if (sectionId === "careteam") {
      const ct = data as {
        role: "family" | "carer" | "doctor";
        person: { name: string; relationship?: string; phone: string; whatsapp?: string; email: string };
        consent?: Record<string, boolean>;
        invite_channel?: "whatsapp" | "sms";
      };

      const mappedRole = CARETEAM_ROLE_MAP[ct.role];
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const inviteToken = crypto.randomUUID();

      const inviteChannel = "whatsapp_text" as const;

      const consent = ct.consent ?? {};

      const [invitation] = await db.insert(teamInvitations).values({
        senior_id:        userId,
        invitee_name:     ct.person.name,
        invitee_phone:    ct.person.phone ?? null,
        invitee_email:    ct.person.email ?? null,
        invitee_whatsapp: ct.person.whatsapp ?? null,
        role:             mappedRole,
        relationship:     ct.person.relationship ?? null,
        invite_token:     inviteToken,
        invite_channel:   inviteChannel,
        status:           "pending",
        expires_at:       expiresAt,

        can_receive_daily_digest:      consent.daily_summary      ?? true,
        can_receive_safety_alerts:     consent.emergency_alerts   ?? true,
        can_receive_health_alerts:     consent.health_reports     ?? false,
        can_receive_mood_alerts:       consent.mood_updates       ?? false,
        can_receive_medication_alerts: consent.medication_alerts  ?? false,
        can_view_dashboard:            consent.dashboard_access   ?? false,
        can_view_health_reports:       consent.health_reports     ?? false,
        can_view_vital_signs:          consent.vital_signs        ?? false,
        can_view_journal_summaries:    consent.cognitive_results  ?? false,
      }).returning();

      const fieldToMark = CARETEAM_ONBOARDING_FIELD[ct.role];
      if (fieldToMark) await markField(userId, fieldToMark);

      const [senior] = await db
        .select({ full_name: profiles.full_name, preferred_name: profiles.preferred_name })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      const delivery = await queueAndDispatchCareTeamInvite({
        req,
        invitation,
        seniorName: senior?.preferred_name ?? senior?.full_name ?? null,
      });

      return res.json({
        ok: true,
        section: sectionId,
        invitation: {
          id: invitation.id,
          status: invitation.status,
          expires_at: invitation.expires_at,
        },
        delivery: careTeamDeliveryResponse(delivery),
        ...(process.env.NODE_ENV !== "production" ? { _devInviteUrl: delivery.inviteUrl } : {}),
      });
    } else if (sectionId === "emergency") {
      const payload = {
        emergency_name: hasText(data.emergency_name) ? data.emergency_name.trim() : hasText(data.name) ? data.name.trim() : "",
        emergency_phone: hasText(data.emergency_phone) ? data.emergency_phone.trim() : hasText(data.primary_phone) ? data.primary_phone.trim() : "",
        emergency_role: hasText(data.emergency_role) ? data.emergency_role.trim() : hasText(data.relationship) ? data.relationship.trim() : "",
        secondary_phone: hasText(data.secondary_phone) ? data.secondary_phone.trim() : "",
        address: hasText(data.address) ? data.address.trim() : "",
      };

      await mergeSectionIntoConsent(userId, "emergency", payload);

      if (payload.emergency_name && payload.emergency_phone) {
        await markField(userId, "has_emergency_address");
      }
    } else {
      await mergeSectionIntoConsent(userId, sectionId, data);

      const fieldsToMark = SECTION_FIELD_MAP[sectionId] ?? [];
      if (fieldsToMark.length > 0) {
        await Promise.all(fieldsToMark.map((f) => markField(userId, f)));
      }
    }

    return res.json({ ok: true, section: sectionId });
  } catch (e) {
    console.error(`[onboarding] POST /section/${sectionId} error:`, e);
    return res.status(500).json({ error: "Internal server error" });
  }
});
