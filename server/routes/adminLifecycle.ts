import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../db.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import * as lifecycleService from "../services/lifecycle.js";
import { dispatchCommunicationsByIds, dispatchQueuedCommunications } from "../services/communicationDispatcher.js";
import {
  accessLinks,
  agentDifficulty,
  billingEvents,
  caregiverAlerts,
  companionConnections,
  companionProfiles,
  communicationsLog,
  conciergePending,
  conciergeRecommendationFeedback,
  conciergeReminders,
  conciergeSessions,
  consentAttempts,
  heroMessages,
  homePlanCards,
  homeScans,
  lifecycleEvents,
  medicationAdherence,
  onboardingState,
  profiles,
  profileMemberships,
  scamChecks,
  consentAuditLogs,
  interactionLogs,
  scheduledEventLogs,
  scheduledEvents,
  scheduledInteractions,
  sessionExchanges,
  sessionState,
  socialConnections,
  socialRoomVisits,
  socialUserInterests,
  teamInvitations,
  tierEntitlements,
  triageReports,
  userChannelIdentity,
  userChannelPreferences,
  users,
  userIntakes,
  userMedications,
  userProviders,
  utilityReviewRuns,
  vitalsReadings,
  voiceRecommendationFeedback,
  voiceTimelineEvents,
  woundScans,
} from "../../shared/schema.js";
import { syncProfileEntitlement, type EntitlementSyncResult } from "../lib/entitlementSync.js";
import { listPlans, normalizeSubscriptionTier, upsertPlanWithEntitlement } from "../lib/plans.js";
import { buildSignupInviteUrl, normalizeSignupInviteLanguage, signupInviteCopyFor } from "../lib/signupInviteLanguage.js";
import { premiumTrialEndsAt } from "../lib/premiumTrial.js";

export const adminLifecycleRouter = Router();

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.user || req.user.role !== "admin") {
    res.status(req.user ? 403 : 401).json({ error: req.user ? "Admin access required" : "Not authenticated" });
    return false;
  }
  return true;
}

function isSuperAdmin(req: Request): boolean {
  return typeof req.user?.email === "string" && req.user.email.toLowerCase() === SUPER_ADMIN_EMAIL;
}

function requireSuperAdmin(req: Request, res: Response): boolean {
  if (!requireAdmin(req, res)) return false;
  if (!isSuperAdmin(req)) {
    res.status(403).json({ error: "Only the super admin can manage admin access" });
    return false;
  }
  return true;
}

const entryPointSchema = z.enum(["form", "phone", "whatsapp", "admin"]);
const userTypeSchema = z.enum(["elder", "family", "admin"]);
const statusSchema = z.enum(["created", "link_sent", "consent_pending", "active", "dropped"]);
const consentStatusSchema = z.enum(["pending", "approved", "rejected", "no_answer", "failed"]);

const intakeSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(4),
  email: z.string().email().optional().or(z.literal("")),
  user_type: userTypeSchema.default("elder"),
  entry_point: entryPointSchema.default("form"),
  organization_id: z.string().uuid().optional().nullable(),
  tier: z.string().min(1).default("free"),
  source_payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  elder: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
  }).optional(),
});

const linkSchema = z.object({
  intake_id: z.string().uuid().optional().nullable(),
  user_id: z.string().optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  link_type: z.enum(["trial", "unlimited", "organization", "custom", "caregiver"]).default("trial"),
  tier: z.string().min(1).default("free"),
  destination: z.string().min(1).default("/onboarding"),
  target_role: z.string().min(1).default("elder"),
  expires_in_days: z.coerce.number().int().min(1).max(365).default(14),
  max_uses: z.coerce.number().int().min(1).max(100).default(1),
});

const orgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email().optional().nullable().or(z.literal("")),
  contact_phone: z.string().optional().nullable(),
  default_tier: z.string().min(1).default("free"),
});

const bulkRowSchema = z.object({
  first_name: z.string().optional().default(""),
  last_name: z.string().optional().default(""),
  name: z.string().optional().default(""),
  preferred_name: z.string().optional().default(""),
  date_of_birth: z.string().optional().default(""),
  gender: z.string().optional().default("prefer_not_to_say"),
  phone: z.string().optional().default(""),
  whatsapp: z.string().optional().default(""),
  email: z.string().optional().default(""),
  language: z.string().optional().default("es"),
  timezone: z.string().optional().default("Europe/Madrid"),
  user_type: userTypeSchema.optional().default("elder"),
  tier: z.string().optional().default(""),
});

const bulkPreviewSchema = z.object({
  rows: z.array(bulkRowSchema).min(1).max(500),
});

const bulkImportSchema = bulkPreviewSchema.extend({
  send_links: z.boolean().optional().default(false),
});

const tierSchema = z.object({
  tier: z.string().min(1),
  display_name: z.string().min(1),
  description: z.string().optional().nullable(),
  voice_assistant: z.boolean().default(false),
  medication_tracking: z.boolean().default(false),
  symptom_check: z.boolean().default(false),
  concierge: z.boolean().default(false),
  caregiver_dashboard: z.boolean().default(false),
  custom_features: z.record(z.unknown()).optional(),
});

const planAdminSchema = z.object({
  plan_id: z.string().trim().min(1).regex(/^[a-z0-9_-]+$/, "Plan ID must use lowercase letters, numbers, dashes or underscores"),
  name: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  price_eur: z.coerce.number().int().min(0).default(0),
  price_gbp: z.coerce.number().int().min(0).default(0),
  billing_interval: z.string().trim().min(1).default("month"),
  trial_days: z.coerce.number().int().min(0).max(365).default(0),
  stripe_price_id_eur: z.string().optional().nullable(),
  stripe_price_id_gbp: z.string().optional().nullable(),
  features: z.array(z.string()).optional().default([]),
  is_active: z.boolean().optional().default(true),
  is_public: z.boolean().optional().default(true),
  sort_order: z.coerce.number().int().optional().default(0),
  entitlement: z.object({
    display_name: z.string().optional(),
    description: z.string().optional().nullable(),
    voice_assistant: z.boolean().default(false),
    medication_tracking: z.boolean().default(false),
    symptom_check: z.boolean().default(false),
    concierge: z.boolean().default(false),
    caregiver_dashboard: z.boolean().default(false),
    custom_features: z.record(z.unknown()).optional(),
    is_active: z.boolean().optional().default(true),
  }).optional(),
});

const profileUpdateSchema = z.object({
  full_name: z.string().min(1).optional(),
  preferred_name: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone_number: z.string().optional().nullable(),
  whatsapp_number: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  caregiver_name: z.string().optional().nullable(),
  caregiver_contact: z.string().optional().nullable(),
  subscription_tier: z.string().optional(),
  organization_id: z.string().uuid().optional().nullable(),
  tier: z.string().optional(),
  sync_profile_ids: z.array(z.string().uuid()).optional().default([]),
});

const scheduledEventAdminSchema = z.object({
  event_type: z.string().min(1).default("custom"),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  channel: z.string().min(1).default("app"),
  agent_id: z.string().optional().nullable(),
  agent_slug: z.string().optional().nullable(),
  room_slug: z.string().optional().nullable(),
  scheduled_for: z.string().min(1),
  timezone: z.string().min(1).default("Europe/Madrid"),
  recurrence: z.string().min(1).default("none"),
  status: z.string().min(1).default("upcoming"),
  source: z.string().min(1).default("admin"),
  metadata: z.record(z.unknown()).optional().default({}),
});

const homePlanCardUpdateSchema = z.object({
  is_enabled: z.boolean().optional(),
  emoji: z.string().min(1).optional(),
  bg: z.string().min(1).optional(),
  badge_bg: z.string().min(1).optional(),
  badge_text: z.string().min(1).optional(),
  route: z.string().min(1).optional(),
  base_priority: z.coerce.number().int().min(0).max(200).optional(),
  condition_keywords: z.array(z.string()).optional(),
  hobby_keywords: z.array(z.string()).optional(),
  avoid_condition_keywords: z.array(z.string()).optional(),
  admin_notes: z.string().optional().nullable(),
});

const homePlanCardCreateSchema = homePlanCardUpdateSchema.extend({
  card_id: z.string().min(2),
});

const supportedHeroLanguageSchema = z.enum(["es", "en", "de", "fr", "it", "pt"]);
const heroCopySchema = z.object({
  sourceText: z.string().optional(),
  headline: z.string().min(1),
  headlineWithName: z.string().optional(),
  subtitle: z.string().optional(),
  ctaLabel: z.string().optional(),
  contextHint: z.string().optional(),
});

const heroMessageCreateSchema = z.object({
  message_id: z.string().min(2),
  surface: z.string().min(1),
  reason: z.string().min(1).default("evergreen"),
  priority: z.coerce.number().int().min(0).max(200).default(10),
  cooldown_hours: z.coerce.number().int().min(0).max(720).default(8),
  periods: z.array(z.string()).optional().default([]),
  safety_levels: z.array(z.string()).optional().default([]),
  event_types: z.array(z.string()).optional().default([]),
  activity_types: z.array(z.string()).optional().default([]),
  copy: z.record(supportedHeroLanguageSchema, heroCopySchema),
  is_enabled: z.boolean().optional().default(true),
  admin_notes: z.string().optional().nullable(),
});

const heroMessageUpdateSchema = heroMessageCreateSchema.omit({ message_id: true }).partial();
const adminRoleUpdateSchema = z.object({
  role: z.enum(["user", "admin"]),
});

const accountSubscriptionUpdateSchema = z.object({
  account_id: z.string().optional().nullable(),
  account_source: z.enum(["legacy", "supabase"]).optional().nullable(),
  account_email: z.string().email().optional().nullable().or(z.literal("")),
  subscription_tier: z.string().min(1).optional(),
  tier: z.string().min(1).optional(),
  subscription_status: z.string().min(1).optional().default("active"),
}).refine((value) => Boolean(value.subscription_tier || value.tier), {
  message: "Subscription tier is required",
});

const accountSubscriptionRepairSchema = z.object({
  account_id: z.string().optional().nullable(),
  account_source: z.enum(["legacy", "supabase"]).optional().nullable(),
  account_email: z.string().email().optional().nullable().or(z.literal("")),
  account_phone: z.string().optional().nullable(),
});

function targetUserIdForIntake(intake: typeof userIntakes.$inferSelect): string | null {
  return intake.elder_user_id ?? intake.user_id ?? intake.family_user_id ?? null;
}

function medicationEventsFromRows(rows: Array<typeof userMedications.$inferSelect>) {
  return rows.flatMap((med) => {
    const times = med.scheduled_times?.length ? med.scheduled_times : [];
    return times.map((time, index) => ({
      id: `medication:${med.id}:${index}`,
      user_id: med.user_id,
      event_type: "medication_reminder",
      title: med.medication_name,
      description: med.dosage ? `${med.dosage}${med.frequency ? ` - ${med.frequency}` : ""}` : med.frequency ?? "",
      channel: "app",
      agent_id: null,
      agent_slug: null,
      room_slug: null,
      scheduled_for: null,
      display_time: time,
      timezone: "profile",
      recurrence: med.frequency ?? "daily",
      status: med.active ? "recurring" : "paused",
      source: "medication_schedule",
      metadata: { medication_id: med.id, read_only: true },
      created_at: med.created_at,
      updated_at: med.created_at,
      read_only: true,
    }));
  });
}

async function scheduledItemsForUser(userId: string | null) {
  if (!userId) return [];
  try {
    const [events, medications] = await Promise.all([
      db.select().from(scheduledEvents).where(eq(scheduledEvents.user_id, userId)).orderBy(desc(scheduledEvents.scheduled_for)).limit(100),
      db.select().from(userMedications).where(eq(userMedications.user_id, userId)).limit(100),
    ]);
    return [...events, ...medicationEventsFromRows(medications)];
  } catch (error) {
    console.warn("[admin-lifecycle] optional scheduled items unavailable", error);
    return [];
  }
}

async function scheduledSupportForUser(userId: string | null) {
  if (!userId) return { schedules: [], logs: [], audit_logs: [] };
  try {
    const [schedules, logs, auditLogs] = await Promise.all([
      db.select().from(scheduledInteractions).where(eq(scheduledInteractions.user_id, userId)).orderBy(desc(scheduledInteractions.updated_at)).limit(100),
      db.select().from(interactionLogs).where(eq(interactionLogs.user_id, userId)).orderBy(desc(interactionLogs.created_at)).limit(50),
      db.select().from(consentAuditLogs).where(eq(consentAuditLogs.user_id, userId)).orderBy(desc(consentAuditLogs.created_at)).limit(50),
    ]);
    return { schedules, logs, audit_logs: auditLogs };
  } catch (error) {
    console.warn("[admin-lifecycle] optional scheduled support unavailable", error);
    return { schedules: [], logs: [], audit_logs: [] };
  }
}

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  return trimmed.replace(/\D/g, "");
}

function publicBaseUrl(req: Request): string {
  return process.env.APP_URL
    ?? `${req.protocol}://${req.get("host")}`;
}

function isMissingRelationError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string };
  return maybeError?.code === "42P01" || String(maybeError?.message ?? error).includes("does not exist");
}

async function optionalAdminRows<T>(query: Promise<T[]>): Promise<T[]> {
  try {
    return await query;
  } catch (error) {
    console.warn("[admin-lifecycle] optional detail rows unavailable", error);
    return [];
  }
}

type SupabaseAuthAccount = {
  id: string;
  email: string | null;
  phone_number: string | null;
  created_at: Date | null;
};

type AccountSource = "legacy" | "supabase";

type LoginMapping = {
  source: AccountSource;
  login_uid: string;
  login_email: string | null;
  login_phone: string | null;
  match_field: "email" | "phone" | null;
  active_profile_id: string | null;
  effective_profile_id: string | null;
  effective_profile_email: string | null;
  effective_profile_phone: string | null;
  effective_subscription_tier: string | null;
  effective_subscription_status: string | null;
  subscription_mismatch: boolean;
  subscription_warning: string | null;
  lifecycle_profile_id: string | null;
  lifecycle_profile_email: string | null;
  lifecycle_subscription_tier: string | null;
  lifecycle_subscription_status: string | null;
  latest_entitlement_repair_at: Date | null;
  latest_entitlement_repair_channel: string | null;
  latest_entitlement_repair_trigger: string | null;
  latest_entitlement_repair_summary: string | null;
  warnings: string[];
};

async function searchSupabaseAuthAccounts(query: string): Promise<SupabaseAuthAccount[]> {
  const like = `%${query}%`;
  try {
    const result = await pool.query<{
      id: string;
      email: string | null;
      phone_number: string | null;
      created_at: Date | null;
    }>(
      `select id::text, email::text, phone::text as phone_number, created_at
       from auth.users
       where lower(coalesce(email, '')) like $1
          or coalesce(phone, '') like $1
       order by created_at desc
       limit 50`,
      [like],
    );
    return result.rows;
  } catch (error) {
    const maybeError = error as { code?: string; message?: string };
    if (isMissingRelationError(error) || maybeError?.code === "42501") return [];
    throw error;
  }
}

function normalizedEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : null;
}

function normalizedPhoneOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizePhone(value);
  return normalized ? normalized : null;
}

function phoneDigits(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits ? digits : null;
}

async function searchSupabaseAuthAccountsExact(input: { email?: string | null; phone?: string | null }): Promise<SupabaseAuthAccount[]> {
  const email = normalizedEmail(input.email);
  const phone = normalizedPhoneOrNull(input.phone);
  const digits = phoneDigits(phone);
  if (!email && !phone) return [];

  try {
    const result = email
      ? await pool.query<{
          id: string;
          email: string | null;
          phone_number: string | null;
          created_at: Date | null;
        }>(
          `select id::text, email::text, phone::text as phone_number, created_at
           from auth.users
           where lower(coalesce(email, '')) = $1
           order by created_at desc
           limit 20`,
          [email],
        )
      : await pool.query<{
          id: string;
          email: string | null;
          phone_number: string | null;
          created_at: Date | null;
        }>(
          `select id::text, email::text, phone::text as phone_number, created_at
           from auth.users
           where regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g') = $1
              or regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = $2
           order by created_at desc
           limit 20`,
          [phone, digits],
        );
    return result.rows;
  } catch (error) {
    const maybeError = error as { code?: string; message?: string };
    if (isMissingRelationError(error) || maybeError?.code === "42501") return [];
    throw error;
  }
}

async function searchLegacyAccountsExact(input: { email?: string | null; phone?: string | null }): Promise<Array<typeof users.$inferSelect>> {
  const email = normalizedEmail(input.email);
  const phone = normalizedPhoneOrNull(input.phone);
  const digits = phoneDigits(phone);
  if (!email && !phone) return [];

  try {
    return await db
      .select()
      .from(users)
      .where(email
        ? sql`lower(coalesce(${users.email}, '')) = ${email}`
        : sql`
            regexp_replace(coalesce(${users.phone_number}, ''), '[^0-9+]', '', 'g') = ${phone}
            or regexp_replace(coalesce(${users.phone_number}, ''), '[^0-9]', '', 'g') = ${digits}
          `)
      .limit(20);
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

async function profileById(profileId: string | null | undefined): Promise<typeof profiles.$inferSelect | null> {
  if (!profileId) return null;
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  return profile ?? null;
}

function buildMappingWarning(mapping: LoginMapping) {
  if (!mapping.effective_profile_id) return "This login does not yet have an app profile.";
  if (mapping.lifecycle_profile_id && mapping.lifecycle_profile_id !== mapping.effective_profile_id) {
    return "Admin is editing a lifecycle profile, but the app reads a different active login profile.";
  }
  return null;
}

function subscriptionAdminFields(sync: EntitlementSyncResult) {
  return {
    effective_subscription_tier: sync.effectiveTier,
    effective_subscription_status: sync.effectiveStatus,
    lifecycle_subscription_tier: sync.lifecycleSubscriptionTier,
    lifecycle_subscription_status: sync.lifecycleSubscriptionStatus,
    billing_subscription_tier: sync.billingSubscriptionTier,
    billing_subscription_status: sync.billingSubscriptionStatus,
    subscription_mismatch: sync.profileTierMismatch,
    subscription_warning: sync.warning,
    entitlement_repaired: sync.repaired,
    entitlement_repair_audit_id: sync.repairAuditEventId,
    latest_entitlement_repair_at: sync.latestRepairAt,
    latest_entitlement_repair_channel: sync.latestRepairChannel,
    latest_entitlement_repair_trigger: sync.latestRepairTrigger,
    latest_entitlement_repair_summary: sync.latestRepairSummary,
  };
}

async function resolveLoginMappings(input: {
  intake: typeof userIntakes.$inferSelect;
  lifecycleProfile: typeof profiles.$inferSelect | null;
  email?: string | null;
  phone?: string | null;
}): Promise<{ mappings: LoginMapping[]; warnings: string[]; match_field: "email" | "phone" | null }> {
  const lifecycleProfileId = targetUserIdForIntake(input.intake);
  const email = normalizedEmail(input.email)
    ?? normalizedEmail(input.lifecycleProfile?.email)
    ?? normalizedEmail(input.intake.email);
  const phone = normalizedPhoneOrNull(input.phone)
    ?? normalizedPhoneOrNull(input.lifecycleProfile?.phone_number)
    ?? normalizedPhoneOrNull(input.intake.phone);
  const matchField = email ? "email" : phone ? "phone" : null;

  const [legacyAccounts, supabaseAccounts] = await Promise.all([
    searchLegacyAccountsExact({ email, phone: email ? null : phone }),
    searchSupabaseAuthAccountsExact({ email, phone: email ? null : phone }),
  ]);

  const mappings: LoginMapping[] = [];

  for (const account of legacyAccounts) {
    const context = await getActiveProfileContext(account.id);
    const effectiveProfileId = context.profileId ?? account.active_profile_id ?? account.id;
    const effectiveProfile = await profileById(effectiveProfileId);
    const subscriptionSync = await syncProfileEntitlement({
      profile: effectiveProfile,
      profileId: effectiveProfileId,
      accountUserId: account.id,
      email,
      phone,
      repairProfile: false,
    });
    const mapping: LoginMapping = {
      source: "legacy",
      login_uid: account.id,
      login_email: account.email ?? null,
      login_phone: account.phone_number ?? null,
      match_field: matchField,
      active_profile_id: account.active_profile_id ?? context.profileId ?? null,
      effective_profile_id: effectiveProfileId,
      effective_profile_email: effectiveProfile?.email ?? null,
      effective_profile_phone: effectiveProfile?.phone_number ?? null,
      effective_subscription_tier: subscriptionSync.effectiveTier,
      effective_subscription_status: subscriptionSync.effectiveStatus,
      subscription_mismatch: subscriptionSync.profileTierMismatch,
      subscription_warning: subscriptionSync.warning,
      lifecycle_profile_id: lifecycleProfileId,
      lifecycle_profile_email: input.lifecycleProfile?.email ?? input.intake.email ?? null,
      lifecycle_subscription_tier: subscriptionSync.lifecycleSubscriptionTier ?? (input.lifecycleProfile ? normalizeSubscriptionTier(input.lifecycleProfile.subscription_tier) : input.intake.tier),
      lifecycle_subscription_status: subscriptionSync.lifecycleSubscriptionStatus ?? input.lifecycleProfile?.subscription_status ?? null,
      latest_entitlement_repair_at: subscriptionSync.latestRepairAt,
      latest_entitlement_repair_channel: subscriptionSync.latestRepairChannel,
      latest_entitlement_repair_trigger: subscriptionSync.latestRepairTrigger,
      latest_entitlement_repair_summary: subscriptionSync.latestRepairSummary,
      warnings: [],
    };
    const warning = buildMappingWarning(mapping);
    if (warning) mapping.warnings.push(warning);
    if (mapping.subscription_warning) mapping.warnings.push(mapping.subscription_warning);
    mappings.push(mapping);
  }

  for (const account of supabaseAccounts) {
    const context = await getActiveProfileContext(account.id);
    const effectiveProfileId = context.profileId ?? account.id;
    const effectiveProfile = await profileById(effectiveProfileId);
    const subscriptionSync = await syncProfileEntitlement({
      profile: effectiveProfile,
      profileId: effectiveProfileId,
      accountUserId: account.id,
      email,
      phone,
      repairProfile: false,
    });
    const mapping: LoginMapping = {
      source: "supabase",
      login_uid: account.id,
      login_email: account.email ?? null,
      login_phone: account.phone_number ?? null,
      match_field: matchField,
      active_profile_id: effectiveProfileId,
      effective_profile_id: effectiveProfileId,
      effective_profile_email: effectiveProfile?.email ?? account.email ?? null,
      effective_profile_phone: effectiveProfile?.phone_number ?? account.phone_number ?? null,
      effective_subscription_tier: subscriptionSync.effectiveTier,
      effective_subscription_status: subscriptionSync.effectiveStatus,
      subscription_mismatch: subscriptionSync.profileTierMismatch,
      subscription_warning: subscriptionSync.warning,
      lifecycle_profile_id: lifecycleProfileId,
      lifecycle_profile_email: input.lifecycleProfile?.email ?? input.intake.email ?? null,
      lifecycle_subscription_tier: subscriptionSync.lifecycleSubscriptionTier ?? (input.lifecycleProfile ? normalizeSubscriptionTier(input.lifecycleProfile.subscription_tier) : input.intake.tier),
      lifecycle_subscription_status: subscriptionSync.lifecycleSubscriptionStatus ?? input.lifecycleProfile?.subscription_status ?? null,
      latest_entitlement_repair_at: subscriptionSync.latestRepairAt,
      latest_entitlement_repair_channel: subscriptionSync.latestRepairChannel,
      latest_entitlement_repair_trigger: subscriptionSync.latestRepairTrigger,
      latest_entitlement_repair_summary: subscriptionSync.latestRepairSummary,
      warnings: [],
    };
    const warning = buildMappingWarning(mapping);
    if (warning) mapping.warnings.push(warning);
    if (mapping.subscription_warning) mapping.warnings.push(mapping.subscription_warning);
    mappings.push(mapping);
  }

  const warnings = Array.from(new Set(mappings.flatMap((mapping) => mapping.warnings)));
  if (!mappings.length) {
    warnings.push(matchField
      ? `No login account matched this ${matchField}.`
      : "No email or phone is available to match a login account.");
  }

  return { mappings, warnings, match_field: matchField };
}

async function syncSubscriptionForEmail(input: {
  email: string | null;
  seedProfileId: string;
  profilePatch: Partial<typeof profiles.$inferInsert>;
}) {
  const profileIds = new Set<string>([input.seedProfileId]);
  const email = normalizedEmail(input.email);
  if (!email) return Array.from(profileIds);

  const profileRows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(sql`lower(coalesce(${profiles.email}, '')) = ${email}`);

  let accountRows: Array<Pick<typeof users.$inferSelect, "id" | "active_profile_id">> = [];
  try {
    accountRows = await db
      .select({ id: users.id, active_profile_id: users.active_profile_id })
      .from(users)
      .where(sql`lower(coalesce(${users.email}, '')) = ${email}`);
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  const supabaseRows = await searchSupabaseAuthAccounts(email);

  for (const row of profileRows) profileIds.add(row.id);
  for (const row of accountRows) {
    profileIds.add(row.id);
    if (row.active_profile_id) profileIds.add(row.active_profile_id);
  }
  for (const row of supabaseRows) {
    if (normalizedEmail(row.email) === email) profileIds.add(row.id);
  }

  const accountIds = accountRows.map((account) => account.id);
  if (accountIds.length) {
    try {
      const membershipRows = await db
        .select({ profile_id: profileMemberships.profile_id })
        .from(profileMemberships)
        .where(and(
          inArray(profileMemberships.user_id, accountIds),
          eq(profileMemberships.status, "active"),
        ));
      for (const row of membershipRows) profileIds.add(row.profile_id);
    } catch (error) {
      if (!isMissingRelationError(error)) throw error;
    }
  }

  const ids = Array.from(profileIds);
  if (ids.length > 0) {
    await db
      .update(profiles)
      .set(input.profilePatch)
      .where(inArray(profiles.id, ids));

    const existingRows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(inArray(profiles.id, ids));
    const existingIds = new Set(existingRows.map((row) => row.id));
    const missingIds = ids.filter((id) => !existingIds.has(id));

    for (const id of missingIds) {
      await db
        .insert(profiles)
        .values({
          id,
          email,
          ...input.profilePatch,
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: input.profilePatch,
        });
    }
  }

  return ids;
}

async function syncSubscriptionForPhone(input: {
  phone: string | null;
  seedProfileId: string;
  profilePatch: Partial<typeof profiles.$inferInsert>;
}) {
  const profileIds = new Set<string>([input.seedProfileId]);
  const phone = normalizedPhoneOrNull(input.phone);
  const digits = phoneDigits(phone);
  if (!phone) return Array.from(profileIds);

  const profileRows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(sql`
      regexp_replace(coalesce(${profiles.phone_number}, ''), '[^0-9+]', '', 'g') = ${phone}
      or regexp_replace(coalesce(${profiles.phone_number}, ''), '[^0-9]', '', 'g') = ${digits}
      or regexp_replace(coalesce(${profiles.whatsapp_number}, ''), '[^0-9+]', '', 'g') = ${phone}
      or regexp_replace(coalesce(${profiles.whatsapp_number}, ''), '[^0-9]', '', 'g') = ${digits}
    `);

  const accountRows = await searchLegacyAccountsExact({ phone });
  const supabaseRows = await searchSupabaseAuthAccountsExact({ phone });

  for (const row of profileRows) profileIds.add(row.id);
  for (const row of accountRows) {
    profileIds.add(row.id);
    if (row.active_profile_id) profileIds.add(row.active_profile_id);
  }
  for (const row of supabaseRows) profileIds.add(row.id);

  const accountIds = accountRows.map((account) => account.id);
  if (accountIds.length) {
    try {
      const membershipRows = await db
        .select({ profile_id: profileMemberships.profile_id })
        .from(profileMemberships)
        .where(and(
          inArray(profileMemberships.user_id, accountIds),
          eq(profileMemberships.status, "active"),
        ));
      for (const row of membershipRows) profileIds.add(row.profile_id);
    } catch (error) {
      if (!isMissingRelationError(error)) throw error;
    }
  }

  const ids = Array.from(profileIds);
  if (ids.length > 0) {
    await db
      .update(profiles)
      .set(input.profilePatch)
      .where(inArray(profiles.id, ids));

    const existingRows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(inArray(profiles.id, ids));
    const existingIds = new Set(existingRows.map((row) => row.id));
    const missingIds = ids.filter((id) => !existingIds.has(id));

    for (const id of missingIds) {
      await db
        .insert(profiles)
        .values({
          id,
          phone_number: phone,
          ...input.profilePatch,
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: input.profilePatch,
        });
    }
  }

  return ids;
}

async function syncIntakeTiersForProfiles(profileIds: string[], email: string | null, subscriptionTier: string) {
  const uniqueProfileIds = Array.from(new Set(profileIds)).filter(Boolean);
  try {
    for (const profileId of uniqueProfileIds) {
      await db
        .update(userIntakes)
        .set({ tier: subscriptionTier, updated_at: new Date() })
        .where(sql`
          ${userIntakes.user_id} = ${profileId}
          or ${userIntakes.elder_user_id} = ${profileId}
          or ${userIntakes.family_user_id} = ${profileId}
        `);
    }

    const normalized = normalizedEmail(email);
    if (normalized) {
      await db
        .update(userIntakes)
        .set({ tier: subscriptionTier, updated_at: new Date() })
        .where(sql`lower(coalesce(${userIntakes.email}, '')) = ${normalized}`);
    }
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }
}

async function syncIntakeTiersForPhone(profileIds: string[], phone: string | null, subscriptionTier: string) {
  const uniqueProfileIds = Array.from(new Set(profileIds)).filter(Boolean);
  const normalized = normalizedPhoneOrNull(phone);
  const digits = phoneDigits(normalized);
  try {
    for (const profileId of uniqueProfileIds) {
      await db
        .update(userIntakes)
        .set({ tier: subscriptionTier, updated_at: new Date() })
        .where(sql`
          ${userIntakes.user_id} = ${profileId}
          or ${userIntakes.elder_user_id} = ${profileId}
          or ${userIntakes.family_user_id} = ${profileId}
        `);
    }

    if (normalized) {
      await db
        .update(userIntakes)
        .set({ tier: subscriptionTier, updated_at: new Date() })
        .where(sql`
          regexp_replace(coalesce(${userIntakes.phone}, ''), '[^0-9+]', '', 'g') = ${normalized}
          or regexp_replace(coalesce(${userIntakes.phone}, ''), '[^0-9]', '', 'g') = ${digits}
        `);
    }
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }
}

async function repairLegacyAccountWithoutActiveProfile(mapping: LoginMapping, profileId: string | null) {
  if (mapping.source !== "legacy" || !profileId) return;

  const [account] = await db
    .select({ active_profile_id: users.active_profile_id })
    .from(users)
    .where(eq(users.id, mapping.login_uid))
    .limit(1);

  if (!account || account.active_profile_id) return;

  await db
    .insert(profileMemberships)
    .values({
      user_id: mapping.login_uid,
      profile_id: profileId,
      role: "elder",
      relationship: "self",
      is_primary: true,
      accepted_at: new Date(),
    })
    .onConflictDoNothing();

  await db
    .update(users)
    .set({ active_profile_id: profileId })
    .where(eq(users.id, mapping.login_uid));
}

async function recordEvent(input: {
  intakeId?: string | null;
  userId?: string | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  channel?: string | null;
  metadata?: Record<string, unknown>;
}, database = db) {
  await database.insert(lifecycleEvents).values({
    intake_id: input.intakeId ?? null,
    user_id: input.userId ?? null,
    event_type: input.eventType,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    channel: input.channel ?? null,
    metadata: input.metadata ?? {},
  });
}

async function optionalAdminDelete(label: string, query: Promise<unknown>) {
  try {
    await query;
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
    console.warn(`[admin-lifecycle] optional delete skipped for ${label}`, error);
  }
}

adminLifecycleRouter.get("/summary", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  return res.json(await lifecycleService.getLifecycleSummary());
});

adminLifecycleRouter.get("/home-plan-cards", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const rows = await db.select().from(homePlanCards).orderBy(desc(homePlanCards.base_priority));
    return res.json({ cards: rows });
  } catch (error) {
    return res.status(503).json({
      error: "Home cards are not migrated yet. Run schema/home_plan_cards.sql.",
    });
  }
});

adminLifecycleRouter.post("/home-plan-cards", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const parsed = homePlanCardCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const [card] = await db
      .insert(homePlanCards)
      .values({
        card_id: parsed.data.card_id,
        is_enabled: parsed.data.is_enabled ?? true,
        emoji: parsed.data.emoji ?? "*",
        bg: parsed.data.bg ?? "#F4F0FF",
        badge_bg: parsed.data.badge_bg ?? "#EDE9FE",
        badge_text: parsed.data.badge_text ?? "#6D28D9",
        route: parsed.data.route ?? "/",
        base_priority: parsed.data.base_priority ?? 50,
        condition_keywords: parsed.data.condition_keywords ?? [],
        hobby_keywords: parsed.data.hobby_keywords ?? [],
        avoid_condition_keywords: parsed.data.avoid_condition_keywords ?? [],
        admin_notes: parsed.data.admin_notes ?? "",
      })
      .returning();

    return res.status(201).json({ card });
  } catch (error) {
    return res.status(400).json({ error: "Could not create home card. Check that the card ID is unique and the migration has been run." });
  }
});

adminLifecycleRouter.patch("/home-plan-cards/:cardId", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const parsed = homePlanCardUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const [card] = await db
    .update(homePlanCards)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(homePlanCards.card_id, req.params.cardId))
    .returning();

  if (!card) {
    return res.status(404).json({ error: "Home card not found" });
  }

  return res.json({ card });
});

adminLifecycleRouter.get("/hero-messages", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const rows = await db.select().from(heroMessages).orderBy(desc(heroMessages.priority));
    return res.json({ messages: rows });
  } catch (error) {
    return res.status(503).json({
      error: "Hero messages are not migrated yet. Run schema/hero_messages.sql.",
    });
  }
});

adminLifecycleRouter.post("/hero-messages", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const parsed = heroMessageCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await db
    .select()
    .from(heroMessages)
    .where(eq(heroMessages.message_id, parsed.data.message_id))
    .limit(1);

  if (existing[0]) {
    const [message] = await db
      .update(heroMessages)
      .set({
        surface: parsed.data.surface,
        reason: parsed.data.reason,
        priority: parsed.data.priority,
        cooldown_hours: parsed.data.cooldown_hours,
        periods: parsed.data.periods,
        safety_levels: parsed.data.safety_levels,
        event_types: parsed.data.event_types,
        activity_types: parsed.data.activity_types,
        copy: parsed.data.copy,
        is_enabled: parsed.data.is_enabled,
        admin_notes: parsed.data.admin_notes ?? "",
        updated_at: new Date(),
      })
      .where(eq(heroMessages.message_id, parsed.data.message_id))
      .returning();
    return res.json({ message });
  }

  try {
    const [message] = await db
      .insert(heroMessages)
      .values({
        message_id: parsed.data.message_id,
        surface: parsed.data.surface,
        reason: parsed.data.reason,
        priority: parsed.data.priority,
        cooldown_hours: parsed.data.cooldown_hours,
        periods: parsed.data.periods,
        safety_levels: parsed.data.safety_levels,
        event_types: parsed.data.event_types,
        activity_types: parsed.data.activity_types,
        copy: parsed.data.copy,
        is_enabled: parsed.data.is_enabled,
        admin_notes: parsed.data.admin_notes ?? "",
      })
      .returning();
    return res.status(201).json({ message });
  } catch (error) {
    return res.status(400).json({ error: "Could not save hero message. Check the migration and message ID." });
  }
});

adminLifecycleRouter.patch("/hero-messages/:messageId", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const parsed = heroMessageUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const [message] = await db
    .update(heroMessages)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(heroMessages.message_id, req.params.messageId))
    .returning();

  if (!message) {
    return res.status(404).json({ error: "Hero message not found" });
  }

  return res.json({ message });
});

adminLifecycleRouter.get("/users", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  return res.json({
    users: await lifecycleService.listLifecycleUsers({
      entry_point: req.query.entry_point as "form" | "phone" | "whatsapp" | "admin" | undefined,
      user_type: req.query.user_type as "elder" | "family" | "admin" | undefined,
      status: req.query.status as "created" | "link_sent" | "consent_pending" | "active" | "dropped" | undefined,
      tier: req.query.tier ? String(req.query.tier) : undefined,
      query: req.query.query ? String(req.query.query) : undefined,
    }),
  });
});

adminLifecycleRouter.get("/account-subscriptions", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const query = String(req.query.query ?? "").trim().toLowerCase();
  if (query.length < 3) return res.json({ accounts: [] });

  const like = `%${query}%`;
  const directProfileRows = await db
    .select()
    .from(profiles)
    .where(sql`
      lower(coalesce(${profiles.email}, '')) like ${like}
      or lower(coalesce(${profiles.full_name}, '')) like ${like}
      or lower(coalesce(${profiles.preferred_name}, '')) like ${like}
      or coalesce(${profiles.phone_number}, '') like ${like}
      or coalesce(${profiles.whatsapp_number}, '') like ${like}
    `)
    .orderBy(desc(profiles.updated_at))
    .limit(50);

  let accountRows: Array<typeof users.$inferSelect> = [];
  try {
    accountRows = await db
      .select()
      .from(users)
      .where(sql`
        lower(coalesce(${users.email}, '')) like ${like}
        or coalesce(${users.phone_number}, '') like ${like}
      `)
      .orderBy(desc(users.created_at))
      .limit(50);
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  const supabaseAccountRows = await searchSupabaseAuthAccounts(query);
  const accountIds = accountRows.map((account) => account.id);
  let membershipRows: Array<typeof profileMemberships.$inferSelect> = [];
  if (accountIds.length) {
    try {
      membershipRows = await db
        .select()
        .from(profileMemberships)
        .where(and(
          inArray(profileMemberships.user_id, accountIds),
          eq(profileMemberships.status, "active"),
        ));
    } catch (error) {
      if (!isMissingRelationError(error)) throw error;
    }
  }

  const profileIds = Array.from(new Set([
    ...directProfileRows.map((profile) => profile.id),
    ...accountRows.map((account) => account.active_profile_id).filter(Boolean),
    ...accountRows.map((account) => account.id),
    ...supabaseAccountRows.map((account) => account.id),
    ...membershipRows.map((membership) => membership.profile_id),
  ])) as string[];

  const linkedProfiles = profileIds.length
    ? await db.select().from(profiles).where(inArray(profiles.id, profileIds))
    : [];
  const profileById = new Map(linkedProfiles.map((profile) => [profile.id, profile]));
  const membershipsByAccount = new Map<string, Array<typeof profileMemberships.$inferSelect>>();
  for (const membership of membershipRows) {
    const current = membershipsByAccount.get(membership.user_id) ?? [];
    current.push(membership);
    membershipsByAccount.set(membership.user_id, current);
  }

  const rows = new Map<string, Record<string, unknown>>();
  const upsertRow = (key: string, row: Record<string, unknown>) => {
    const existing = rows.get(key);
    if (existing && existing.source !== "profile_match") return;
    rows.set(key, row);
  };

  const addRow = (
    profile: typeof profiles.$inferSelect,
    account: typeof users.$inferSelect | null,
    source: string,
    membership: typeof profileMemberships.$inferSelect | null = null,
  ) => {
    const key = profile.id;
    upsertRow(key, {
      account_id: account?.id ?? null,
      account_source: account ? "legacy" : null,
      account_email: account?.email ?? null,
      account_phone: account?.phone_number ?? null,
      active_profile_id: account?.active_profile_id ?? null,
      profile_id: profile.id,
      profile_email: profile.email,
      full_name: profile.full_name,
      preferred_name: profile.preferred_name,
      phone_number: profile.phone_number,
      subscription_status: profile.subscription_status,
      subscription_tier: normalizeSubscriptionTier(profile.subscription_tier),
      stored_subscription_tier: profile.subscription_tier,
      trial_ends_at: profile.trial_ends_at,
      account_status: profile.account_status,
      profile_role: profile.role,
      membership_role: membership?.role ?? null,
      membership_relationship: membership?.relationship ?? null,
      is_active_profile: account?.active_profile_id === profile.id,
      source,
      updated_at: profile.updated_at,
    });
  };

  const addSupabaseRow = (account: SupabaseAuthAccount) => {
    const profile = profileById.get(account.id);
    const key = `supabase:${account.id}`;
    upsertRow(key, {
      account_id: account.id,
      account_source: "supabase",
      account_email: account.email,
      account_phone: account.phone_number,
      active_profile_id: account.id,
      profile_id: account.id,
      profile_email: profile?.email ?? account.email,
      full_name: profile?.full_name ?? null,
      preferred_name: profile?.preferred_name ?? null,
      phone_number: profile?.phone_number ?? account.phone_number,
      subscription_status: profile?.subscription_status ?? "trial",
      subscription_tier: normalizeSubscriptionTier(profile?.subscription_tier),
      stored_subscription_tier: profile?.subscription_tier ?? null,
      trial_ends_at: profile?.trial_ends_at ?? null,
      account_status: profile?.account_status ?? "enabled",
      profile_role: profile?.role ?? "user",
      membership_role: null,
      membership_relationship: null,
      is_active_profile: Boolean(profile),
      source: profile ? "supabase_auth_profile" : "supabase_auth_missing_profile",
      updated_at: profile?.updated_at ?? account.created_at,
    });
  };

  for (const profile of directProfileRows) {
    addRow(profile, null, "profile_match");
  }

  for (const account of accountRows) {
    const linkedProfileIds = new Set<string>();
    if (account.active_profile_id) linkedProfileIds.add(account.active_profile_id);
    linkedProfileIds.add(account.id);
    for (const membership of membershipsByAccount.get(account.id) ?? []) linkedProfileIds.add(membership.profile_id);

    for (const profileId of linkedProfileIds) {
      const profile = profileById.get(profileId);
      if (!profile) continue;
      const membership = (membershipsByAccount.get(account.id) ?? []).find((item) => item.profile_id === profile.id) ?? null;
      addRow(profile, account, account.active_profile_id === profile.id ? "active_account_profile" : "linked_account_profile", membership);
    }
  }

  for (const account of supabaseAccountRows) {
    addSupabaseRow(account);
  }

  const accounts = await Promise.all(Array.from(rows.values()).map(async (row) => {
    const profileId = typeof row.profile_id === "string" ? row.profile_id : null;
    const profile = profileId ? profileById.get(profileId) ?? null : null;
    const sync = await syncProfileEntitlement({
      profile,
      profileId,
      accountUserId: typeof row.account_id === "string" ? row.account_id : null,
      email: typeof row.profile_email === "string"
        ? row.profile_email
        : typeof row.account_email === "string" ? row.account_email : null,
      phone: typeof row.phone_number === "string"
        ? row.phone_number
        : typeof row.account_phone === "string" ? row.account_phone : null,
      repairProfile: false,
    });
    return {
      ...row,
      ...subscriptionAdminFields(sync),
    };
  }));

  return res.json({ accounts });
});

adminLifecycleRouter.post("/account-subscriptions/:profileId/repair-entitlement", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const parsed = accountSubscriptionRepairSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid repair request" });

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, req.params.profileId))
    .limit(1);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const subscriptionEmail = normalizedEmail(parsed.data.account_email) ?? normalizedEmail(profile.email);
  const repairSync = await syncProfileEntitlement({
    profile,
    profileId: profile.id,
    accountUserId: parsed.data.account_id ?? null,
    email: subscriptionEmail,
    phone: parsed.data.account_phone ?? profile.phone_number,
    whatsapp: profile.whatsapp_number,
    repairProfile: true,
    repairChannel: "admin",
    repairTrigger: "admin_repair_now",
    repairedBy: req.user?.id ?? null,
  });

  const [freshProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profile.id))
    .limit(1);
  const subscriptionSync = await syncProfileEntitlement({
    profile: freshProfile ?? profile,
    profileId: profile.id,
    accountUserId: parsed.data.account_id ?? null,
    email: subscriptionEmail,
    phone: parsed.data.account_phone ?? profile.phone_number,
    whatsapp: profile.whatsapp_number,
    repairProfile: false,
  });
  const adminFields = subscriptionAdminFields(subscriptionSync);

  return res.json({
    repaired: repairSync.repaired,
    account: {
      account_id: parsed.data.account_id ?? null,
      account_source: parsed.data.account_source ?? null,
      profile_id: profile.id,
      profile_email: freshProfile?.email ?? profile.email,
      full_name: freshProfile?.full_name ?? profile.full_name,
      preferred_name: freshProfile?.preferred_name ?? profile.preferred_name,
      phone_number: freshProfile?.phone_number ?? profile.phone_number,
      subscription_status: freshProfile?.subscription_status ?? profile.subscription_status,
      subscription_tier: normalizeSubscriptionTier(freshProfile?.subscription_tier ?? profile.subscription_tier),
      stored_subscription_tier: freshProfile?.subscription_tier ?? profile.subscription_tier,
      trial_ends_at: freshProfile?.trial_ends_at ?? profile.trial_ends_at,
      account_status: freshProfile?.account_status ?? profile.account_status,
      profile_role: freshProfile?.role ?? profile.role,
      updated_at: freshProfile?.updated_at ?? profile.updated_at,
      ...adminFields,
      entitlement_repaired: repairSync.repaired,
      entitlement_repair_audit_id: repairSync.repairAuditEventId ?? adminFields.entitlement_repair_audit_id,
    },
  });
});

adminLifecycleRouter.patch("/account-subscriptions/:profileId", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const parsed = accountSubscriptionUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid subscription update" });

  const subscriptionTier = normalizeSubscriptionTier(parsed.data.subscription_tier ?? parsed.data.tier);
  const [existingProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, req.params.profileId))
    .limit(1);
  let subscriptionStatus = parsed.data.subscription_status;
  let trialEndsAt: Date | null | undefined;
  if (subscriptionTier === "free") {
    subscriptionStatus = "active";
    trialEndsAt = null;
  } else if (subscriptionStatus === "trial") {
    const existingTrialEndsAt = existingProfile?.trial_ends_at ? new Date(existingProfile.trial_ends_at) : null;
    trialEndsAt = existingTrialEndsAt && existingTrialEndsAt.getTime() > Date.now()
      ? existingTrialEndsAt
      : premiumTrialEndsAt();
  } else {
    trialEndsAt = null;
  }
  const profilePatch: Partial<typeof profiles.$inferInsert> = {
    subscription_tier: subscriptionTier,
    subscription_status: subscriptionStatus,
    updated_at: new Date(),
  };
  if (trialEndsAt !== undefined) profilePatch.trial_ends_at = trialEndsAt;

  let [profile] = await db
    .update(profiles)
    .set(profilePatch)
    .where(eq(profiles.id, req.params.profileId))
    .returning();

  if (!profile && parsed.data.account_source === "supabase" && parsed.data.account_id === req.params.profileId) {
    const [createdProfile] = await db
      .insert(profiles)
      .values({
        id: req.params.profileId,
        email: parsed.data.account_email || undefined,
        ...profilePatch,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: profilePatch,
      })
      .returning();
    profile = createdProfile;
  }

  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const subscriptionEmail = normalizedEmail(parsed.data.account_email) ?? normalizedEmail(profile.email);
  const syncedProfileIds = await syncSubscriptionForEmail({
    email: subscriptionEmail,
    seedProfileId: profile.id,
    profilePatch,
  });

  let syncedAccountId: string | null = null;
  let syncedActiveProfileId: string | null = null;
  if (parsed.data.account_id) {
    if (parsed.data.account_source === "supabase") {
      if (parsed.data.account_id !== profile.id) {
        return res.status(400).json({ error: "Supabase login must be updated through its own profile row." });
      }
      syncedAccountId = parsed.data.account_id;
      syncedActiveProfileId = profile.id;
    } else {
    try {
      const [account] = await db
        .select()
        .from(users)
        .where(eq(users.id, parsed.data.account_id))
        .limit(1);

      if (!account) {
        return res.status(404).json({ error: "Login account not found" });
      }

      let isLinkedToAccount = account.id === profile.id || account.active_profile_id === profile.id;
      if (!isLinkedToAccount) {
        const [membership] = await db
          .select({ id: profileMemberships.id })
          .from(profileMemberships)
          .where(and(
            eq(profileMemberships.user_id, account.id),
            eq(profileMemberships.profile_id, profile.id),
            eq(profileMemberships.status, "active"),
          ))
          .limit(1);
        isLinkedToAccount = Boolean(membership);
      }

      if (!isLinkedToAccount) {
        return res.status(400).json({ error: "This profile is not linked to the selected login account." });
      }

      await db
        .insert(profileMemberships)
        .values({
          user_id: account.id,
          profile_id: profile.id,
          role: "elder",
          relationship: "self",
          is_primary: true,
          accepted_at: new Date(),
        })
        .onConflictDoNothing();
      if (!account.active_profile_id) {
        await db
          .update(users)
          .set({ active_profile_id: profile.id })
          .where(eq(users.id, account.id));
        syncedActiveProfileId = profile.id;
      } else {
        syncedActiveProfileId = account.active_profile_id;
      }
      syncedAccountId = account.id;
    } catch (error) {
      if (!isMissingRelationError(error)) throw error;
    }
    }
  }

  await syncIntakeTiersForProfiles(syncedProfileIds, subscriptionEmail, subscriptionTier);

  try {
    await recordEvent({
      intakeId: null,
      userId: profile.id,
      eventType: "admin_subscription_updated",
      channel: "admin",
      metadata: {
        subscription_tier: subscriptionTier,
        subscription_status: subscriptionStatus,
        account_email: subscriptionEmail,
        synced_profile_ids: syncedProfileIds,
      },
    });
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  const subscriptionSync = await syncProfileEntitlement({
    profile,
    profileId: profile.id,
    accountUserId: syncedAccountId,
    email: subscriptionEmail,
    phone: profile.phone_number,
    whatsapp: profile.whatsapp_number,
    repairProfile: false,
  });

  return res.json({
    account: {
      account_id: syncedAccountId,
      account_source: parsed.data.account_source ?? null,
      active_profile_id: syncedActiveProfileId,
      is_active_profile: syncedActiveProfileId === profile.id,
      profile_id: profile.id,
      profile_email: profile.email,
      full_name: profile.full_name,
      preferred_name: profile.preferred_name,
      subscription_status: profile.subscription_status,
      subscription_tier: normalizeSubscriptionTier(profile.subscription_tier),
      stored_subscription_tier: profile.subscription_tier,
      trial_ends_at: profile.trial_ends_at,
      account_status: profile.account_status,
      profile_role: profile.role,
      updated_at: profile.updated_at,
      synced_profile_ids: syncedProfileIds,
      ...subscriptionAdminFields(subscriptionSync),
    },
  });
});

adminLifecycleRouter.get("/users/:id/details", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
    if (!intake) return res.status(404).json({ error: "User intake not found" });

    const userId = targetUserIdForIntake(intake);
    const [profile] = userId
      ? await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1)
      : [];
    const mapping = await resolveLoginMappings({
      intake,
      lifecycleProfile: profile ?? null,
    });
    const [communicationRows, lifecycleRows, consentRows, scheduledRows, support] = await Promise.all([
      optionalAdminRows(db.select().from(communicationsLog).where(eq(communicationsLog.intake_id, intake.id)).orderBy(desc(communicationsLog.created_at)).limit(100)),
      optionalAdminRows(db.select().from(lifecycleEvents).where(eq(lifecycleEvents.intake_id, intake.id)).orderBy(desc(lifecycleEvents.created_at)).limit(100)),
      optionalAdminRows(db.select().from(consentAttempts).where(eq(consentAttempts.intake_id, intake.id)).orderBy(desc(consentAttempts.created_at)).limit(50)),
      scheduledItemsForUser(userId),
      scheduledSupportForUser(userId),
    ]);

    return res.json({
      intake,
      profile: profile ?? null,
      account_mappings: mapping.mappings,
      account_mapping_warnings: mapping.warnings,
      account_match_field: mapping.match_field,
      communications: communicationRows,
      lifecycle_events: lifecycleRows,
      consent_attempts: consentRows,
      scheduled_events: scheduledRows,
      scheduled_support: support.schedules,
      interaction_logs: support.logs,
      consent_audit_logs: support.audit_logs,
    });
  } catch (error) {
    console.error("[admin-lifecycle] user details failed", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Could not load user details" });
  }
});

adminLifecycleRouter.patch("/users/:id/profile", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid profile update" });

  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });
  const userId = targetUserIdForIntake(intake);
  if (!userId) return res.status(400).json({ error: "This intake is not linked to a profile yet" });

  const data = parsed.data;
  const [existingProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!existingProfile) return res.status(404).json({ error: "Linked profile not found" });

  const nextEmail = data.email !== undefined
    ? data.email || null
    : existingProfile.email ?? intake.email ?? null;
  const nextPhone = data.phone_number !== undefined
    ? data.phone_number || null
    : existingProfile.phone_number ?? intake.phone;
  const profilePatch: Partial<typeof profiles.$inferInsert> = { updated_at: new Date() };
  if (data.full_name !== undefined) profilePatch.full_name = data.full_name;
  if (data.preferred_name !== undefined) profilePatch.preferred_name = data.preferred_name || null;
  if (data.date_of_birth !== undefined) profilePatch.date_of_birth = data.date_of_birth || null;
  if (data.email !== undefined) profilePatch.email = data.email || null;
  if (data.phone_number !== undefined) profilePatch.phone_number = data.phone_number || null;
  if (data.whatsapp_number !== undefined) profilePatch.whatsapp_number = data.whatsapp_number || null;
  if (data.language !== undefined) profilePatch.language = data.language || "es";
  if (data.timezone !== undefined) profilePatch.timezone = data.timezone || "Europe/Madrid";
  if (data.caregiver_name !== undefined) profilePatch.caregiver_name = data.caregiver_name || null;
  if (data.caregiver_contact !== undefined) profilePatch.caregiver_contact = data.caregiver_contact || null;
  if (data.subscription_tier !== undefined || data.tier !== undefined) {
    profilePatch.subscription_tier = normalizeSubscriptionTier(data.subscription_tier ?? data.tier);
    profilePatch.subscription_status = "active";
  }

  const [profile] = await db
    .update(profiles)
    .set(profilePatch)
    .where(eq(profiles.id, userId))
    .returning();

  const intakePatch: Partial<typeof userIntakes.$inferInsert> = { updated_at: new Date(), last_activity_at: new Date() };
  if (data.full_name !== undefined) intakePatch.name = data.full_name;
  if (data.phone_number !== undefined) intakePatch.phone = normalizePhone(data.phone_number ?? intake.phone);
  if (data.email !== undefined) intakePatch.email = data.email || null;
  if (data.tier !== undefined || data.subscription_tier !== undefined) intakePatch.tier = normalizeSubscriptionTier(data.tier ?? data.subscription_tier);
  if (data.organization_id !== undefined) intakePatch.organization_id = data.organization_id ?? null;

  const [updatedIntake] = await db.update(userIntakes).set(intakePatch).where(eq(userIntakes.id, intake.id)).returning();
  const mapping = await resolveLoginMappings({
    intake: updatedIntake,
    lifecycleProfile: profile ?? null,
    email: nextEmail,
    phone: nextPhone,
  });

  let syncedProfileIds: string[] = [userId];
  if (profilePatch.subscription_tier) {
    const subscriptionPatch: Partial<typeof profiles.$inferInsert> = {
      subscription_tier: profilePatch.subscription_tier,
      subscription_status: "active",
      updated_at: new Date(),
    };
    const profileIds = new Set<string>([userId]);
    for (const profileId of data.sync_profile_ids ?? []) {
      profileIds.add(profileId);
    }
    for (const accountMapping of mapping.mappings) {
      if (accountMapping.effective_profile_id) profileIds.add(accountMapping.effective_profile_id);
      await repairLegacyAccountWithoutActiveProfile(accountMapping, userId);
    }

    if (normalizedEmail(nextEmail)) {
      for (const profileId of await syncSubscriptionForEmail({
        email: nextEmail,
        seedProfileId: userId,
        profilePatch: subscriptionPatch,
      })) profileIds.add(profileId);
      await syncIntakeTiersForProfiles(Array.from(profileIds), nextEmail, profilePatch.subscription_tier);
    } else {
      for (const profileId of await syncSubscriptionForPhone({
        phone: nextPhone,
        seedProfileId: userId,
        profilePatch: subscriptionPatch,
      })) profileIds.add(profileId);
      await syncIntakeTiersForPhone(Array.from(profileIds), nextPhone, profilePatch.subscription_tier);
    }

    if (profileIds.size > 0) {
      await db
        .update(profiles)
        .set(subscriptionPatch)
        .where(inArray(profiles.id, Array.from(profileIds)));
    }
    syncedProfileIds = Array.from(profileIds);
  }

  const freshProfile = await profileById(userId);
  const freshMapping = await resolveLoginMappings({
    intake: updatedIntake,
    lifecycleProfile: freshProfile,
    email: nextEmail,
    phone: nextPhone,
  });

  await recordEvent({
    intakeId: intake.id,
    userId,
    eventType: "admin_profile_updated",
    channel: "admin",
    metadata: {
      synced_profile_ids: syncedProfileIds,
      account_mappings: freshMapping.mappings.map((item) => ({
        source: item.source,
        login_uid: item.login_uid,
        effective_profile_id: item.effective_profile_id,
      })),
    },
  });

  return res.json({
    intake: updatedIntake,
    profile: freshProfile ?? profile,
    account_mappings: freshMapping.mappings,
    account_mapping_warnings: freshMapping.warnings,
    account_match_field: freshMapping.match_field,
    synced_profile_ids: syncedProfileIds,
  });
});

adminLifecycleRouter.post("/users/:id/disable", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const reason = z.object({ reason: z.string().optional().default("") }).parse(req.body ?? {}).reason;
  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });
  const userId = targetUserIdForIntake(intake);
  if (!userId) return res.status(400).json({ error: "This intake is not linked to a profile yet" });

  const [profile] = await db.update(profiles).set({
    account_status: "disabled",
    disabled_at: new Date(),
    disabled_reason: reason || "Disabled by admin",
    disabled_by: "admin",
    updated_at: new Date(),
  }).where(eq(profiles.id, userId)).returning();

  await recordEvent({ intakeId: intake.id, userId, eventType: "user_disabled", channel: "admin", metadata: { reason } });
  return res.json({ profile });
});

adminLifecycleRouter.post("/users/:id/enable", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });
  const userId = targetUserIdForIntake(intake);
  if (!userId) return res.status(400).json({ error: "This intake is not linked to a profile yet" });

  const [profile] = await db.update(profiles).set({
    account_status: "enabled",
    disabled_at: null,
    disabled_reason: null,
    disabled_by: null,
    updated_at: new Date(),
  }).where(eq(profiles.id, userId)).returning();

  await recordEvent({ intakeId: intake.id, userId, eventType: "user_enabled", channel: "admin" });
  return res.json({ profile });
});

adminLifecycleRouter.delete("/users/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = z.object({ confirm: z.literal("DELETE") }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Type DELETE to confirm permanent user deletion." });

  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });

  const userId = targetUserIdForIntake(intake);
  const deleted = {
    intake: false,
    profile: false,
    login: false,
  };

  await recordEvent({
    intakeId: intake.id,
    userId,
    eventType: "user_deleted",
    channel: "admin",
    metadata: {
      deleted_by: req.user?.email ?? req.user?.id ?? "admin",
      name: intake.name,
      email: intake.email,
      phone: intake.phone,
    },
  });

  await optionalAdminDelete("communications for intake", db.delete(communicationsLog).where(eq(communicationsLog.intake_id, intake.id)));
  await optionalAdminDelete("consent attempts for intake", db.delete(consentAttempts).where(eq(consentAttempts.intake_id, intake.id)));
  await optionalAdminDelete("access links for intake", db.delete(accessLinks).where(eq(accessLinks.intake_id, intake.id)));
  await optionalAdminDelete("lifecycle events for intake", db.delete(lifecycleEvents).where(eq(lifecycleEvents.intake_id, intake.id)));

  if (userId) {
    await optionalAdminDelete("session state", db.delete(sessionState).where(eq(sessionState.user_id, userId)));
    await optionalAdminDelete("session exchanges", db.delete(sessionExchanges).where(eq(sessionExchanges.user_id, userId)));
    await optionalAdminDelete("agent difficulty", db.delete(agentDifficulty).where(eq(agentDifficulty.user_id, userId)));
    await optionalAdminDelete("caregiver alerts", db.delete(caregiverAlerts).where(eq(caregiverAlerts.user_id, userId)));
    await optionalAdminDelete("medication adherence", db.delete(medicationAdherence).where(eq(medicationAdherence.user_id, userId)));
    await optionalAdminDelete("onboarding state", db.delete(onboardingState).where(eq(onboardingState.user_id, userId)));
    await optionalAdminDelete(
      "consent log",
      db.delete(consentLog).where(or(eq(consentLog.user_id, userId), eq(consentLog.target_user_id, userId))),
    );
    await optionalAdminDelete(
      "team invitations",
      db.delete(teamInvitations).where(or(eq(teamInvitations.senior_id, userId), eq(teamInvitations.accepted_user_id, userId))),
    );
    await optionalAdminDelete("user channel identity", db.delete(userChannelIdentity).where(eq(userChannelIdentity.user_id, userId)));
    await optionalAdminDelete("user channel preferences", db.delete(userChannelPreferences).where(eq(userChannelPreferences.user_id, userId)));
    await optionalAdminDelete("billing events", db.delete(billingEvents).where(eq(billingEvents.user_id, userId)));
    await optionalAdminDelete("scam checks", db.delete(scamChecks).where(eq(scamChecks.user_id, userId)));
    await optionalAdminDelete("home scans", db.delete(homeScans).where(eq(homeScans.user_id, userId)));
    await optionalAdminDelete("wound scans", db.delete(woundScans).where(eq(woundScans.user_id, userId)));
    await optionalAdminDelete("companion profile", db.delete(companionProfiles).where(eq(companionProfiles.user_id, userId)));
    await optionalAdminDelete(
      "companion connections",
      db.delete(companionConnections).where(or(eq(companionConnections.requester_id, userId), eq(companionConnections.recipient_id, userId))),
    );
    await optionalAdminDelete("social room visits", db.delete(socialRoomVisits).where(eq(socialRoomVisits.user_id, userId)));
    await optionalAdminDelete("social interests", db.delete(socialUserInterests).where(eq(socialUserInterests.user_id, userId)));
    await optionalAdminDelete(
      "social connections",
      db.delete(socialConnections).where(or(eq(socialConnections.user_id_a, userId), eq(socialConnections.user_id_b, userId))),
    );
    await optionalAdminDelete("triage reports", db.delete(triageReports).where(eq(triageReports.user_id, userId)));
    await optionalAdminDelete("vitals readings", db.delete(vitalsReadings).where(eq(vitalsReadings.user_id, userId)));
    await optionalAdminDelete("user providers", db.delete(userProviders).where(eq(userProviders.user_id, userId)));
    await optionalAdminDelete("concierge pending", db.delete(conciergePending).where(eq(conciergePending.user_id, userId)));
    await optionalAdminDelete("concierge sessions", db.delete(conciergeSessions).where(eq(conciergeSessions.user_id, userId)));
    await optionalAdminDelete("concierge reminders", db.delete(conciergeReminders).where(eq(conciergeReminders.user_id, userId)));
    await optionalAdminDelete("utility review runs", db.delete(utilityReviewRuns).where(eq(utilityReviewRuns.user_id, userId)));
    await optionalAdminDelete("concierge feedback", db.delete(conciergeRecommendationFeedback).where(eq(conciergeRecommendationFeedback.user_id, userId)));
    await optionalAdminDelete("voice recommendation feedback", db.delete(voiceRecommendationFeedback).where(eq(voiceRecommendationFeedback.user_id, userId)));
    await optionalAdminDelete("voice timeline events", db.delete(voiceTimelineEvents).where(eq(voiceTimelineEvents.user_id, userId)));
    await optionalAdminDelete("scheduled event logs", db.delete(scheduledEventLogs).where(eq(scheduledEventLogs.user_id, userId)));
    await optionalAdminDelete("scheduled events", db.delete(scheduledEvents).where(eq(scheduledEvents.user_id, userId)));
    await optionalAdminDelete("scheduled interactions", db.delete(scheduledInteractions).where(eq(scheduledInteractions.user_id, userId)));
    await optionalAdminDelete("interaction logs", db.delete(interactionLogs).where(eq(interactionLogs.user_id, userId)));
    await optionalAdminDelete("consent audit logs", db.delete(consentAuditLogs).where(eq(consentAuditLogs.user_id, userId)));
    await optionalAdminDelete("communications for user", db.delete(communicationsLog).where(eq(communicationsLog.user_id, userId)));
    await optionalAdminDelete("lifecycle events for user", db.delete(lifecycleEvents).where(eq(lifecycleEvents.user_id, userId)));
    await optionalAdminDelete(
      "consent attempts for user",
      db.delete(consentAttempts).where(or(eq(consentAttempts.elder_user_id, userId), eq(consentAttempts.family_user_id, userId))),
    );
    await optionalAdminDelete("user medications", db.delete(userMedications).where(eq(userMedications.user_id, userId)));
    await optionalAdminDelete(
      "profile memberships",
      db.delete(profileMemberships).where(or(eq(profileMemberships.profile_id, userId), eq(profileMemberships.user_id, userId))),
    );
    await optionalAdminDelete("legacy active profile links", db.update(users).set({ active_profile_id: null }).where(eq(users.active_profile_id, userId)));

    const deletedProfiles = await db.delete(profiles).where(eq(profiles.id, userId)).returning({ id: profiles.id });
    deleted.profile = deletedProfiles.length > 0;
    const deletedLogins = await optionalAdminRows(db.delete(users).where(eq(users.id, userId)).returning({ id: users.id }));
    deleted.login = deletedLogins.length > 0;
  }

  const deletedIntakes = await db.delete(userIntakes).where(eq(userIntakes.id, intake.id)).returning({ id: userIntakes.id });
  deleted.intake = deletedIntakes.length > 0;

  return res.json({
    deleted,
    user_id: userId,
    intake_id: intake.id,
  });
});

adminLifecycleRouter.post("/users/:id/scheduled-events", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = scheduledEventAdminSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid scheduled event" });
  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });
  const userId = targetUserIdForIntake(intake);
  if (!userId) return res.status(400).json({ error: "This intake is not linked to a profile yet" });
  const data = parsed.data;
  const [event] = await db.insert(scheduledEvents).values({
    user_id: userId,
    event_type: data.event_type,
    title: data.title,
    description: data.description ?? null,
    channel: data.channel,
    agent_id: data.agent_id ?? null,
    agent_slug: data.agent_slug ?? null,
    room_slug: data.room_slug ?? null,
    scheduled_for: new Date(data.scheduled_for),
    timezone: data.timezone,
    recurrence: data.recurrence,
    status: data.status,
    source: data.source,
    metadata: data.metadata,
    created_by: "admin",
  }).returning();
  await db.insert(scheduledEventLogs).values({ scheduled_event_id: event.id, user_id: userId, action: "created", status: event.status, created_by: "admin" });
  await recordEvent({ intakeId: intake.id, userId, eventType: "scheduled_event_created", channel: "admin", metadata: { event_id: event.id } });
  return res.status(201).json({ event });
});

adminLifecycleRouter.patch("/scheduled-events/:eventId", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = scheduledEventAdminSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid scheduled event update" });
  const data = parsed.data;
  const patch: Partial<typeof scheduledEvents.$inferInsert> = { updated_at: new Date(), updated_by: "admin" };
  if (data.event_type !== undefined) patch.event_type = data.event_type;
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description ?? null;
  if (data.channel !== undefined) patch.channel = data.channel;
  if (data.agent_id !== undefined) patch.agent_id = data.agent_id ?? null;
  if (data.agent_slug !== undefined) patch.agent_slug = data.agent_slug ?? null;
  if (data.room_slug !== undefined) patch.room_slug = data.room_slug ?? null;
  if (data.scheduled_for !== undefined) patch.scheduled_for = new Date(data.scheduled_for);
  if (data.timezone !== undefined) patch.timezone = data.timezone;
  if (data.recurrence !== undefined) patch.recurrence = data.recurrence;
  if (data.status !== undefined) patch.status = data.status;
  if (data.source !== undefined) patch.source = data.source;
  if (data.metadata !== undefined) patch.metadata = data.metadata;
  const [event] = await db.update(scheduledEvents).set(patch).where(eq(scheduledEvents.id, req.params.eventId)).returning();
  if (!event) return res.status(404).json({ error: "Scheduled event not found" });
  await db.insert(scheduledEventLogs).values({ scheduled_event_id: event.id, user_id: event.user_id, action: "updated", status: event.status, created_by: "admin" });
  return res.json({ event });
});

for (const [action, status] of [["pause", "paused"], ["resume", "upcoming"], ["cancel", "cancelled"]] as const) {
  adminLifecycleRouter.post(`/scheduled-events/:eventId/${action}`, async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const [event] = await db.update(scheduledEvents).set({ status, updated_at: new Date(), updated_by: "admin" }).where(eq(scheduledEvents.id, req.params.eventId)).returning();
    if (!event) return res.status(404).json({ error: "Scheduled event not found" });
    await db.insert(scheduledEventLogs).values({ scheduled_event_id: event.id, user_id: event.user_id, action, status, created_by: "admin" });
    return res.json({ event });
  });
}

adminLifecycleRouter.post("/intakes", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = intakeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid intake" });
  }

  const result = await lifecycleService.createLifecycleIntake(parsed.data);
  if ("error" in result) return res.status(400).json({ error: result.error });
  return res.status(201).json({ intake: result.intake });
});

adminLifecycleRouter.patch("/intakes/:id/status", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = z.object({
    status: statusSchema,
    journey_step: z.string().optional(),
    consent_status: z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status update" });

  const updated = await lifecycleService.updateLifecycleIntakeStatus({
    intakeId: req.params.id,
    status: parsed.data.status,
    journey_step: parsed.data.journey_step,
    consent_status: parsed.data.consent_status,
  });
  if (!updated) return res.status(404).json({ error: "Intake not found" });
  return res.json({ intake: updated });
});

adminLifecycleRouter.post("/access-links", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid link" });

  const result = await lifecycleService.createAccessLink(parsed.data, publicBaseUrl(req));
  return res.status(201).json(result);
});

adminLifecycleRouter.post("/intakes/:id/send-link", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const result = await lifecycleService.sendIntakeLink(req.params.id, publicBaseUrl(req));
  if (!result) return res.status(404).json({ error: "Intake not found" });
  return res.json(result);
});

adminLifecycleRouter.get("/consent", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  return res.json({ attempts: await lifecycleService.listConsentAttempts() });
});

adminLifecycleRouter.post("/consent/:intakeId/trigger", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const attempt = await lifecycleService.triggerConsentAttempt(req.params.intakeId);
  if (!attempt) return res.status(404).json({ error: "Intake not found" });
  return res.status(201).json({ attempt });
});

adminLifecycleRouter.post("/consent/:attemptId/result", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = z.object({
    status: consentStatusSchema,
    source_session_id: z.string().optional(),
    result_payload: z.record(z.unknown()).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid consent result" });

  const result = await lifecycleService.recordConsentResult({
    attemptId: req.params.attemptId,
    status: parsed.data.status,
    source_session_id: parsed.data.source_session_id,
    result_payload: parsed.data.result_payload,
    baseUrl: publicBaseUrl(req),
  });
  if (!result) return res.status(404).json({ error: "Attempt not found" });
  return res.json({ attempt: result.attempt, links: result.links });
});

adminLifecycleRouter.get("/organizations", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  return res.json({ organizations: await lifecycleService.listOrganizations() });
});

adminLifecycleRouter.post("/organizations", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = orgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid organization" });
  const org = await lifecycleService.createOrganization(parsed.data);
  return res.status(201).json({ organization: org });
});

adminLifecycleRouter.delete("/organizations/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const org = await lifecycleService.setOrganizationActive(req.params.id, false);
  if (!org) return res.status(404).json({ error: "Organization not found" });
  return res.json({ organization: org });
});

adminLifecycleRouter.post("/organizations/:id/restore", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const org = await lifecycleService.setOrganizationActive(req.params.id, true);
  if (!org) return res.status(404).json({ error: "Organization not found" });
  return res.json({ organization: org });
});

adminLifecycleRouter.post("/organizations/:id/bulk-intakes/preview", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = bulkPreviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid bulk rows" });

  const preview = await lifecycleService.buildBulkIntakePreview(req.params.id, parsed.data.rows);
  if ("error" in preview) return res.status(404).json({ error: preview.error });

  return res.json({
    organization: preview.organization,
    rows: preview.rows,
    summary: {
      total: preview.rows.length,
      valid: preview.rows.filter((row) => row.valid).length,
      invalid: preview.rows.filter((row) => !row.valid).length,
    },
  });
});

adminLifecycleRouter.post("/organizations/:id/bulk-intakes/import", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = bulkImportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid bulk rows" });

  const result = await lifecycleService.importBulkIntakes({
    organizationId: req.params.id,
    rows: parsed.data.rows,
    sendLinks: parsed.data.send_links,
    baseUrl: publicBaseUrl(req),
  });
  if ("error" in result) return res.status(404).json({ error: result.error });

  return res.status(201).json(result);
});

adminLifecycleRouter.get("/tiers", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const plans = await listPlans();
  return res.json({ tiers: plans.map((plan) => plan.entitlement).filter(Boolean) });
});

adminLifecycleRouter.post("/tiers", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = tierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid tier" });
  const data = parsed.data;
  const [tier] = await db.insert(tierEntitlements).values({
    ...data,
    description: data.description ?? null,
    custom_features: data.custom_features ?? {},
  }).onConflictDoUpdate({
    target: tierEntitlements.tier,
    set: {
      display_name: data.display_name,
      description: data.description ?? null,
      voice_assistant: data.voice_assistant,
      medication_tracking: data.medication_tracking,
      symptom_check: data.symptom_check,
      concierge: data.concierge,
      caregiver_dashboard: data.caregiver_dashboard,
      custom_features: data.custom_features ?? {},
      updated_at: new Date(),
    },
  }).returning();
  return res.json({ tier });
});

adminLifecycleRouter.get("/plans", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const plans = await listPlans();
  return res.json({ plans });
});

adminLifecycleRouter.post("/plans", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = planAdminSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid plan" });
  const plan = await upsertPlanWithEntitlement(parsed.data);
  return res.json({ plan });
});

adminLifecycleRouter.get("/communications", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const rows = await db.select().from(communicationsLog).orderBy(desc(communicationsLog.created_at)).limit(150);
  return res.json({ communications: rows });
});

adminLifecycleRouter.post("/signup-share", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = z.object({
    emails: z.array(z.string().trim().email()).optional().default([]),
    whatsapp_numbers: z.array(z.string().trim().min(3)).optional().default([]),
    message: z.string().trim().max(500).optional(),
    language: z.string().trim().optional(),
  }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid signup share request" });

  const language = normalizeSignupInviteLanguage(parsed.data.language);
  const copy = signupInviteCopyFor(language);
  const loginUrl = buildSignupInviteUrl(publicBaseUrl(req), language);
  const emailRecipients = Array.from(new Set(parsed.data.emails.map((email) => email.toLowerCase())));
  const whatsappRecipients = Array.from(new Set(parsed.data.whatsapp_numbers.map(normalizePhone).filter(Boolean)));
  if (emailRecipients.length + whatsappRecipients.length === 0) {
    return res.status(400).json({ error: "Add at least one email or WhatsApp number." });
  }

  const intro = parsed.data.message || copy.defaultIntro;
  const body = `${intro}\n\n${copy.startHere}: ${loginUrl}`;
  const rows = [
    ...emailRecipients.map((recipient) => ({
      user_id: req.user?.id ?? null,
      channel: "email",
      recipient,
      purpose: "share_signup_form",
      status: "queued",
      body,
      metadata: {
        url: loginUrl,
        language,
        intro,
        subject: copy.subject,
        shared_by: req.user?.email ?? req.user?.id ?? null,
      },
    })),
    ...whatsappRecipients.map((recipient) => ({
      user_id: req.user?.id ?? null,
      channel: "whatsapp",
      recipient,
      purpose: "share_signup_form",
      status: "queued",
      body,
      metadata: {
        url: loginUrl,
        language,
        shared_by: req.user?.email ?? req.user?.id ?? null,
      },
    })),
  ];

  const communications = await db.insert(communicationsLog).values(rows).returning();
  const dispatchResult = await dispatchCommunicationsByIds(communications.map((item) => item.id));
  const sent = dispatchResult.results.filter((item) => item.status === "sent").length;
  const failed = dispatchResult.results.filter((item) => item.status === "failed").length;

  return res.status(201).json({
    signup_url: loginUrl,
    queued: communications.length,
    sent,
    failed,
    results: dispatchResult.results.map((item) => ({
      id: item.id,
      channel: item.channel,
      recipient: item.recipient,
      status: item.status,
      ...(item.error ? { error: item.error } : {}),
    })),
    communications,
  });
});

adminLifecycleRouter.post("/communications/dispatch", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid dispatch request" });

  const result = await dispatchQueuedCommunications(parsed.data.limit);
  return res.json(result);
});

adminLifecycleRouter.get("/admin-users", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  const query = String(req.query.email ?? "").trim().toLowerCase();
  const admins = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      role: profiles.role,
      last_seen_at: sql<Date | null>`null`,
      created_at: profiles.created_at,
    })
    .from(profiles)
    .where(eq(profiles.role, "admin"))
    .orderBy(profiles.email)
    .limit(100);

  const matches = query.length >= 3
    ? await db
      .select({
        id: profiles.id,
        email: profiles.email,
        role: profiles.role,
        last_seen_at: sql<Date | null>`null`,
        created_at: profiles.created_at,
      })
      .from(profiles)
      .where(sql`lower(${profiles.email}) like ${`%${query}%`}`)
      .orderBy(profiles.email)
      .limit(25)
    : [];

  return res.json({ admins, matches });
});

adminLifecycleRouter.patch("/admin-users/:userId/role", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  const parsed = adminRoleUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid role" });

  const [existing] = await db
    .select({ id: profiles.id, email: profiles.email, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, req.params.userId))
    .limit(1);

  if (!existing) return res.status(404).json({ error: "User not found" });

  if ((existing.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL && parsed.data.role !== "admin") {
    return res.status(400).json({ error: "Cannot remove the super admin account" });
  }

  if (existing.role === "admin" && parsed.data.role !== "admin") {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles)
      .where(eq(profiles.role, "admin"));

    if ((count ?? 0) <= 1) {
      return res.status(400).json({ error: "Cannot remove the last admin account" });
    }
  }

  const [user] = await db
    .update(profiles)
    .set({ role: parsed.data.role })
    .where(eq(profiles.id, existing.id))
    .returning({
      id: profiles.id,
      email: profiles.email,
      role: profiles.role,
      last_seen_at: sql<Date | null>`null`,
      created_at: profiles.created_at,
    });

  await recordEvent({
    userId: existing.id,
    eventType: "admin_role_updated",
    channel: "admin",
    metadata: { from_role: existing.role, to_role: parsed.data.role, email: existing.email },
  });

  return res.json({ user });
});
