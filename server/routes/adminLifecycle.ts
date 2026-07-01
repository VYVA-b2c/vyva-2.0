import { Router } from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { and, desc, eq, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../db.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import * as lifecycleService from "../services/lifecycle.js";
import { triggerCallbackOnboardingCall } from "../services/callbackOnboarding.js";
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
  consentLog,
  heroMessages,
  heroMessageEvents,
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
import { buildSignupInviteUrl, normalizeSignupInviteLanguage, signupInviteCopyFor, type SignupInvitePrefill } from "../lib/signupInviteLanguage.js";
import { mergeSignupInviteRecipients } from "../lib/signupInviteRecipients.js";
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

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email().optional().nullable().or(z.literal("")),
  contact_phone: z.string().optional().nullable(),
  default_tier: z.string().min(1).default("free"),
});

const orgUpdateSchema = orgSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "Organization update is empty",
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

const bulkUserActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["disable", "delete_hide", "restore", "assign_org", "change_tier", "resend_invite"]),
  organization_id: z.string().uuid().nullable().optional(),
  tier: z.string().trim().min(1).optional(),
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

const caregiverInviteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  role: z.enum(["caregiver", "family", "family_member", "doctor", "carer"]).optional().default("caregiver"),
  relationship: z.string().trim().max(120).optional().nullable().or(z.literal("")),
  permissions: z.object({
    daily_summary: z.boolean().optional(),
    safety_alerts: z.boolean().optional(),
    health_alerts: z.boolean().optional(),
    mood_updates: z.boolean().optional(),
    medication_alerts: z.boolean().optional(),
    dashboard_access: z.boolean().optional(),
    health_reports: z.boolean().optional(),
    vital_signs: z.boolean().optional(),
    journal_summaries: z.boolean().optional(),
  }).optional().default({}),
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
  account_phone: z.string().optional().nullable(),
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

type SignupShareRecipient = {
  recipient: string;
  name?: string;
};

type SignupInviteType = "elder" | "caregiver";

function inviteRecipientNameKey(name: string | null | undefined): string | null {
  const normalized = (name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return normalized || null;
}

function inviteRecipientMapByName(recipients: SignupShareRecipient[]) {
  const byName = new Map<string, SignupShareRecipient>();
  for (const recipient of recipients) {
    const key = inviteRecipientNameKey(recipient.name);
    if (key && !byName.has(key)) byName.set(key, recipient);
  }
  return byName;
}

function matchingInviteRecipient(
  recipient: SignupShareRecipient,
  candidates: SignupShareRecipient[],
  byName: Map<string, SignupShareRecipient>,
): SignupShareRecipient | undefined {
  const key = inviteRecipientNameKey(recipient.name);
  if (key) {
    const matched = byName.get(key);
    if (matched) return matched;
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

function looksLikeInviteContact(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && /^[+\d\s().-]+$/.test(trimmed);
}

function signupInviteDisplayName(name: string | null | undefined) {
  const normalized = (name ?? "").replace(/\s+/g, " ").trim();
  return normalized && !looksLikeInviteContact(normalized) ? normalized : "Invited user";
}

async function findSignupInviteIntake(input: { email?: string | null; phone?: string | null }) {
  const clauses: SQL[] = [];
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = normalizePhone(input.phone ?? "");
  const phoneDigits = phone.replace(/\D/g, "");

  if (email) clauses.push(sql`lower(coalesce(${userIntakes.email}, '')) = ${email}`);
  if (phone) clauses.push(sql`regexp_replace(coalesce(${userIntakes.phone}, ''), '[^0-9+]', '', 'g') = ${phone}`);
  if (phoneDigits) clauses.push(sql`regexp_replace(coalesce(${userIntakes.phone}, ''), '[^0-9]', '', 'g') = ${phoneDigits}`);
  if (!clauses.length) return null;

  const [intake] = await db
    .select()
    .from(userIntakes)
    .where(and(
      or(...clauses),
      sql`${userIntakes.journey_step} <> 'admin_deleted'`,
      sql`coalesce(${userIntakes.metadata}->>'hidden_from_lifecycle', 'false') <> 'true'`,
      sql`coalesce(${userIntakes.metadata}->>'deleted_from_lifecycle', 'false') <> 'true'`,
    ))
    .orderBy(desc(userIntakes.updated_at))
    .limit(1);

  return intake ?? null;
}

async function ensureSignupInviteIntake(input: {
  inviteId: string;
  inviteType: SignupInviteType;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  channel: string;
  language: string;
  sharedBy: string | null;
}) {
  const now = new Date();
  const email = (input.email ?? "").trim().toLowerCase() || null;
  const phone = normalizePhone(input.phone ?? "") || null;
  const userType = input.inviteType === "caregiver" ? "family" : "elder";
  const consentStatus = input.inviteType === "caregiver" ? "pending" : "not_required";
  const metadataPatch = {
    source: "admin_share_invite",
    invite_type: input.inviteType,
    latest_invite_id: input.inviteId,
    invite_language: input.language,
    invite_channel: input.channel,
    invited_email: email,
    invited_phone: phone,
    ...(input.name ? { recipient_name: input.name } : {}),
    shared_by: input.sharedBy,
  };
  const existing = await findSignupInviteIntake({ email, phone });

  if (existing) {
    const [updated] = await db
      .update(userIntakes)
      .set({
        name: existing.name === "Invited user" ? signupInviteDisplayName(input.name) : existing.name,
        email: existing.email ?? email,
        phone: existing.phone || phone || "",
        user_type: existing.status === "active" ? existing.user_type : userType,
        status: existing.status === "active" ? "active" : "link_sent",
        journey_step: existing.status === "active" ? existing.journey_step : "signup_invite_sent",
        consent_status: existing.status === "active" ? existing.consent_status : consentStatus,
        link_sent_at: now,
        last_activity_at: now,
        updated_at: now,
        metadata: { ...jsonRecord(existing.metadata), ...metadataPatch },
      })
      .where(eq(userIntakes.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(userIntakes)
    .values({
      name: signupInviteDisplayName(input.name),
      phone: phone ?? "",
      email,
      user_type: userType,
      entry_point: "admin",
      tier: "free",
      status: "link_sent",
      journey_step: "signup_invite_sent",
      consent_status: consentStatus,
      source_payload: { source: "admin_share_invite", channel: input.channel, invite_type: input.inviteType },
      metadata: metadataPatch,
      link_sent_at: now,
      last_activity_at: now,
    })
    .returning();

  return created;
}

function publicBaseUrl(req: Request): string {
  return process.env.APP_URL
    ?? `${req.protocol}://${req.get("host")}`;
}

function hasEnvValue(keys: string[]) {
  return keys.some((key) => Boolean(process.env[key]?.trim()));
}

function communicationMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function communicationError(row: typeof communicationsLog.$inferSelect | null) {
  if (!row) return null;
  const metadata = communicationMetadata(row.metadata);
  const error = [
    metadata.dispatch_error,
    metadata.provider_error_message,
    metadata.provider_status,
  ].find((value) => typeof value === "string" && value.trim());
  return typeof error === "string" ? error.trim() : null;
}

function communicationTime(row: typeof communicationsLog.$inferSelect | null) {
  if (!row) return null;
  return (row.sent_at ?? row.created_at)?.toISOString?.() ?? null;
}

type CommunicationsProviderChannel = "email" | "sms" | "whatsapp";

function communicationsProviderConfig(channel: CommunicationsProviderChannel) {
  if (channel === "email") {
    const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
    const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY?.trim());
    const hasSmtp = Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
    return {
      provider: hasResend ? "Resend" : hasSendGrid ? "SendGrid" : hasSmtp ? "SMTP" : "Email",
      configured: hasResend || hasSendGrid || hasSmtp,
      missing: hasResend || hasSendGrid || hasSmtp ? null : "Set RESEND_API_KEY, SENDGRID_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS.",
    };
  }

  const hasTwilioCredentials = hasEnvValue(["TWILIO_ACCOUNT_SID"]) && hasEnvValue(["TWILIO_AUTH_TOKEN"]);
  if (channel === "sms") {
    const hasSmsSender = hasEnvValue([
      "TWILIO_US_SMS_FROM_NUMBER",
      "TWILIO_SMS_US_FROM_NUMBER",
      "TWILIO_SMS_MESSAGING_SERVICE_SID",
    ]);
    const missing = [
      !hasTwilioCredentials ? "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN." : "",
      !hasSmsSender ? "Set TWILIO_US_SMS_FROM_NUMBER to the US SMS-capable Twilio number." : "",
    ].filter(Boolean).join(" ");

    return {
      provider: hasSmsSender ? "Twilio SMS" : "SMS",
      configured: hasTwilioCredentials && hasSmsSender,
      missing: missing || null,
    };
  }

  const hasWhatsappSender = hasEnvValue(["TWILIO_WHATSAPP_MESSAGING_SERVICE_SID", "TWILIO_WHATSAPP_FROM", "TWILIO_WHATSAPP_FROM_NUMBER"]);
  const missing = [
    !hasTwilioCredentials ? "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN." : "",
    !hasWhatsappSender ? "Set TWILIO_WHATSAPP_FROM or TWILIO_WHATSAPP_MESSAGING_SERVICE_SID." : "",
  ].filter(Boolean).join(" ");

  return {
    provider: hasWhatsappSender ? "Twilio WhatsApp" : "WhatsApp",
    configured: hasTwilioCredentials && hasWhatsappSender,
    missing: missing || null,
  };
}

async function communicationProviderStatus() {
  const rows = await db
    .select()
    .from(communicationsLog)
    .where(inArray(communicationsLog.channel, ["email", "sms", "whatsapp"]))
    .orderBy(desc(communicationsLog.created_at))
    .limit(500);

  return (["email", "sms", "whatsapp"] as const).map((channel) => {
    const config = communicationsProviderConfig(channel);
    const sent = rows.find((row) => row.channel === channel && ["sent", "delivered"].includes(row.status)) ?? null;
    const failed = rows.find((row) => row.channel === channel && row.status === "failed") ?? null;
    const sentTime = sent ? new Date(sent.sent_at ?? sent.created_at).getTime() : 0;
    const failedTime = failed ? new Date(failed.created_at).getTime() : 0;
    const failing = Boolean(config.configured && failed && failedTime >= sentTime);

    return {
      channel,
      label: channel === "email" ? "Email" : channel === "sms" ? "SMS" : "WhatsApp",
      provider: config.provider,
      configured: config.configured,
      status: !config.configured ? "not_configured" : failing ? "failing" : "configured",
      last_sent_at: communicationTime(sent),
      last_error_at: failed?.created_at?.toISOString?.() ?? null,
      last_error: communicationError(failed) ?? config.missing,
      missing_config: config.missing,
    };
  });
}

function signupPhoneInviteChannel(): "sms" | "whatsapp" {
  return communicationsProviderConfig("whatsapp").configured ? "whatsapp" : "sms";
}

type AdminCareTeamRole = "caregiver" | "family_member" | "doctor";

function normalizeCaregiverInviteRole(role: string): AdminCareTeamRole {
  if (role === "family" || role === "family_member") return "family_member";
  if (role === "doctor") return "doctor";
  return "caregiver";
}

function cleanOptionalContact(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function caregiverInviteDefaults(role: AdminCareTeamRole) {
  if (role === "doctor") {
    return {
      daily_summary: true,
      safety_alerts: true,
      health_alerts: true,
      mood_updates: false,
      medication_alerts: false,
      dashboard_access: true,
      health_reports: true,
      vital_signs: true,
      journal_summaries: false,
    };
  }

  if (role === "family_member") {
    return {
      daily_summary: true,
      safety_alerts: true,
      health_alerts: false,
      mood_updates: true,
      medication_alerts: false,
      dashboard_access: true,
      health_reports: false,
      vital_signs: false,
      journal_summaries: true,
    };
  }

  return {
    daily_summary: true,
    safety_alerts: true,
    health_alerts: true,
    mood_updates: true,
    medication_alerts: true,
    dashboard_access: true,
    health_reports: true,
    vital_signs: true,
    journal_summaries: true,
  };
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
  effective_account_status: string | null;
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
  if (value.includes("@") || value.includes(":")) return null;
  const normalized = normalizePhone(value);
  return normalized ? normalized : null;
}

function phoneDigits(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits ? digits : null;
}

function addIfPresent(target: Set<string>, value: string | null | undefined) {
  if (value) target.add(value);
}

function addNormalizedEmail(target: Set<string>, value: unknown) {
  const email = normalizedEmail(value);
  if (email) target.add(email);
}

function addNormalizedPhone(target: Set<string>, value: unknown) {
  const phone = normalizedPhoneOrNull(value);
  if (phone) target.add(phone);
}

const adminProfileSelect = {
  id: profiles.id,
  full_name: profiles.full_name,
  preferred_name: profiles.preferred_name,
  email: profiles.email,
  phone_number: profiles.phone_number,
  whatsapp_number: profiles.whatsapp_number,
  stripe_subscription_id: profiles.stripe_subscription_id,
  subscription_status: profiles.subscription_status,
  subscription_tier: profiles.subscription_tier,
  trial_ends_at: profiles.trial_ends_at,
  account_status: profiles.account_status,
  role: profiles.role,
  disabled_at: profiles.disabled_at,
  disabled_reason: profiles.disabled_reason,
  disabled_by: profiles.disabled_by,
  created_at: profiles.created_at,
  updated_at: profiles.updated_at,
};

const identityProfileSelect = {
  id: profiles.id,
  email: profiles.email,
  phone_number: profiles.phone_number,
  whatsapp_number: profiles.whatsapp_number,
};

function combineWhere(clauses: SQL[]): SQL | undefined {
  if (!clauses.length) return undefined;
  return clauses.length === 1 ? clauses[0] : or(...clauses);
}

function emailInClause(column: SQL, emails: string[]) {
  if (!emails.length) return undefined;
  return sql`${column} in (${sql.join(emails.map((email) => sql`${email}`), sql`, `)})`;
}

function phoneMatchClauses(column: SQL, phones: string[]) {
  return phones.flatMap((phone) => {
    const digits = phoneDigits(phone);
    return [
      sql`regexp_replace(coalesce(${column}, ''), '[^0-9+]', '', 'g') = ${phone}`,
      ...(digits ? [sql`regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g') = ${digits}`] : []),
    ];
  });
}

function profileIdentityWhere(input: { ids: string[]; emails: string[]; phones: string[] }) {
  const clauses: SQL[] = [];
  if (input.ids.length) clauses.push(inArray(profiles.id, input.ids));
  const emailClause = emailInClause(sql`lower(coalesce(${profiles.email}, ''))`, input.emails);
  if (emailClause) clauses.push(emailClause);
  clauses.push(...phoneMatchClauses(sql`${profiles.phone_number}`, input.phones));
  clauses.push(...phoneMatchClauses(sql`${profiles.whatsapp_number}`, input.phones));
  return combineWhere(clauses);
}

function legacyUserIdentityWhere(input: { ids: string[]; emails: string[]; phones: string[] }) {
  const clauses: SQL[] = [];
  if (input.ids.length) clauses.push(inArray(users.id, input.ids));
  const emailClause = emailInClause(sql`lower(coalesce(${users.email}, ''))`, input.emails);
  if (emailClause) clauses.push(emailClause);
  clauses.push(...phoneMatchClauses(sql`${users.phone_number}`, input.phones));
  return combineWhere(clauses);
}

function lifecycleIntakeIdentityWhere(input: {
  selectedIntakeId: string;
  ids: string[];
  emails: string[];
  phones: string[];
}) {
  const clauses: SQL[] = [eq(userIntakes.id, input.selectedIntakeId)];
  if (input.ids.length) {
    clauses.push(or(
      inArray(userIntakes.user_id, input.ids),
      inArray(userIntakes.elder_user_id, input.ids),
      inArray(userIntakes.family_user_id, input.ids),
    )!);
  }
  const emailClause = emailInClause(sql`lower(coalesce(${userIntakes.email}, ''))`, input.emails);
  if (emailClause) clauses.push(emailClause);
  clauses.push(...phoneMatchClauses(sql`${userIntakes.phone}`, input.phones));
  return combineWhere(clauses)!;
}

async function lifecycleIdentityScope(intake: typeof userIntakes.$inferSelect) {
  const ids = new Set<string>();
  const emails = new Set<string>();
  const phones = new Set<string>();
  const intakeIds = new Set<string>([intake.id]);

  addIfPresent(ids, intake.user_id);
  addIfPresent(ids, intake.elder_user_id);
  addIfPresent(ids, intake.family_user_id);
  addIfPresent(ids, targetUserIdForIntake(intake));
  addNormalizedEmail(emails, intake.email);
  addNormalizedEmail(emails, intake.phone);
  addNormalizedPhone(phones, intake.phone);

  const seedProfile = await profileById(targetUserIdForIntake(intake));
  if (seedProfile) {
    addIfPresent(ids, seedProfile.id);
    addNormalizedEmail(emails, seedProfile.email);
    addNormalizedPhone(phones, seedProfile.phone_number);
    addNormalizedPhone(phones, seedProfile.whatsapp_number);
  }

  const addAccounts = async () => {
    const emailValues = Array.from(emails);
    const phoneValues = Array.from(phones);
    const [legacyByEmail, legacyByPhone, supabaseByEmail, supabaseByPhone] = await Promise.all([
      Promise.all(emailValues.map((email) => searchLegacyAccountsExact({ email, phone: null }))),
      Promise.all(phoneValues.map((phone) => searchLegacyAccountsExact({ email: null, phone }))),
      Promise.all(emailValues.map((email) => searchSupabaseAuthAccountsExact({ email, phone: null }))),
      Promise.all(phoneValues.map((phone) => searchSupabaseAuthAccountsExact({ email: null, phone }))),
    ]);

    for (const account of legacyByEmail.flat().concat(legacyByPhone.flat())) {
      addIfPresent(ids, account.id);
      addIfPresent(ids, account.active_profile_id);
      addNormalizedEmail(emails, account.email);
      addNormalizedPhone(phones, account.phone_number);
    }
    for (const account of supabaseByEmail.flat().concat(supabaseByPhone.flat())) {
      addIfPresent(ids, account.id);
      addNormalizedEmail(emails, account.email);
      addNormalizedPhone(phones, account.phone_number);
    }
  };

  const addProfiles = async () => {
    const where = profileIdentityWhere({
      ids: Array.from(ids),
      emails: Array.from(emails),
      phones: Array.from(phones),
    });
    if (!where) return;
    const profileRows = await db.select({
      id: profiles.id,
      email: profiles.email,
      phone_number: profiles.phone_number,
      whatsapp_number: profiles.whatsapp_number,
    }).from(profiles).where(where);
    for (const profile of profileRows) {
      addIfPresent(ids, profile.id);
      addNormalizedEmail(emails, profile.email);
      addNormalizedPhone(phones, profile.phone_number);
      addNormalizedPhone(phones, profile.whatsapp_number);
    }
  };

  await addAccounts();
  await addProfiles();
  await addAccounts();
  await addProfiles();

  const intakeWhere = lifecycleIntakeIdentityWhere({
    selectedIntakeId: intake.id,
    ids: Array.from(ids),
    emails: Array.from(emails),
    phones: Array.from(phones),
  });
  const matchingIntakes = await db.select({
    id: userIntakes.id,
    user_id: userIntakes.user_id,
    elder_user_id: userIntakes.elder_user_id,
    family_user_id: userIntakes.family_user_id,
    email: userIntakes.email,
    phone: userIntakes.phone,
  }).from(userIntakes).where(intakeWhere);

  for (const row of matchingIntakes) {
    intakeIds.add(row.id);
    addIfPresent(ids, row.user_id);
    addIfPresent(ids, row.elder_user_id);
    addIfPresent(ids, row.family_user_id);
    addNormalizedEmail(emails, row.email);
    addNormalizedEmail(emails, row.phone);
    addNormalizedPhone(phones, row.phone);
  }

  await addProfiles();

  return {
    ids: Array.from(ids),
    emails: Array.from(emails),
    phones: Array.from(phones),
    intakeIds: Array.from(intakeIds),
  };
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
  try {
    const [profile] = await db.select(adminProfileSelect).from(profiles).where(eq(profiles.id, profileId)).limit(1);
    return (profile ?? null) as typeof profiles.$inferSelect | null;
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
    console.warn("[admin-lifecycle] profile detail columns unavailable; falling back to identity-only profile lookup", error);
    const [profile] = await db.select(identityProfileSelect).from(profiles).where(eq(profiles.id, profileId)).limit(1);
    return (profile ?? null) as typeof profiles.$inferSelect | null;
  }
}

function buildMappingWarnings(mapping: LoginMapping) {
  const warnings: string[] = [];
  if (!mapping.effective_profile_id) {
    warnings.push("This login does not yet have an app profile.");
  }
  if (mapping.effective_account_status === "disabled") {
    warnings.push("The app reads this login's active profile as disabled. Enable app access before testing voice.");
  }
  if (mapping.lifecycle_profile_id && mapping.effective_profile_id && mapping.lifecycle_profile_id !== mapping.effective_profile_id) {
    warnings.push("Admin is editing a lifecycle profile, but the app reads a different active login profile.");
  }
  return warnings;
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
      effective_account_status: effectiveProfile?.account_status ?? null,
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
    mapping.warnings.push(...buildMappingWarnings(mapping));
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
      effective_account_status: effectiveProfile?.account_status ?? null,
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
    mapping.warnings.push(...buildMappingWarnings(mapping));
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

async function profileIdsForAccountIds(accountIds: string[]) {
  const ids = new Set<string>();
  if (accountIds.length === 0) return ids;

  let accountRows: Array<Pick<typeof users.$inferSelect, "id" | "active_profile_id">> = [];
  try {
    accountRows = await db
      .select({ id: users.id, active_profile_id: users.active_profile_id })
      .from(users)
      .where(inArray(users.id, accountIds));
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  for (const accountId of accountIds) ids.add(accountId);
  for (const row of accountRows) {
    ids.add(row.id);
    if (row.active_profile_id) ids.add(row.active_profile_id);
  }

  if (accountRows.length) {
    try {
      const membershipRows = await db
        .select({ profile_id: profileMemberships.profile_id })
        .from(profileMemberships)
        .where(and(
          inArray(profileMemberships.user_id, accountRows.map((account) => account.id)),
          eq(profileMemberships.status, "active"),
        ));
      for (const row of membershipRows) ids.add(row.profile_id);
    } catch (error) {
      if (!isMissingRelationError(error)) throw error;
    }
  }

  return ids;
}

async function applySubscriptionPatchToProfiles(input: {
  ids: string[];
  profilePatch: Partial<typeof profiles.$inferInsert>;
  email?: string | null;
  phone?: string | null;
}) {
  const ids = Array.from(new Set(input.ids.filter(Boolean)));
  if (!ids.length) return ids;

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
  const email = normalizedEmail(input.email);
  const phone = normalizedPhoneOrNull(input.phone);

  for (const id of missingIds) {
    await db
      .insert(profiles)
      .values({
        id,
        email: email ?? undefined,
        phone_number: phone ?? undefined,
        ...input.profilePatch,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: input.profilePatch,
      });
  }

  return ids;
}

async function syncSubscriptionForAccessIdentity(input: {
  email?: string | null;
  phone?: string | null;
  seedProfileId: string;
  profilePatch: Partial<typeof profiles.$inferInsert>;
  accountIds?: Array<string | null | undefined>;
  explicitProfileIds?: Array<string | null | undefined>;
}) {
  const profileIds = new Set<string>([input.seedProfileId]);
  for (const profileId of input.explicitProfileIds ?? []) {
    if (profileId) profileIds.add(profileId);
  }

  if (normalizedEmail(input.email)) {
    for (const profileId of await syncSubscriptionForEmail({
      email: input.email ?? null,
      seedProfileId: input.seedProfileId,
      profilePatch: input.profilePatch,
    })) {
      profileIds.add(profileId);
    }
  }

  if (normalizedPhoneOrNull(input.phone)) {
    for (const profileId of await syncSubscriptionForPhone({
      phone: input.phone ?? null,
      seedProfileId: input.seedProfileId,
      profilePatch: input.profilePatch,
    })) {
      profileIds.add(profileId);
    }
  }

  const accountIds = Array.from(new Set((input.accountIds ?? []).filter((id): id is string => Boolean(id))));
  for (const profileId of await profileIdsForAccountIds(accountIds)) {
    profileIds.add(profileId);
  }

  const ids = Array.from(profileIds);
  await applySubscriptionPatchToProfiles({
    ids,
    profilePatch: input.profilePatch,
    email: input.email,
    phone: input.phone,
  });

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

function activityString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function activityActor(metadata: Record<string, unknown>, channel?: string | null) {
  return (
    activityString(metadata.changed_by)
    ?? activityString(metadata.deleted_by)
    ?? activityString(metadata.shared_by)
    ?? activityString(metadata.updated_by)
    ?? activityString(metadata.created_by)
    ?? activityString(metadata.triggered_by)
    ?? activityString(metadata.actor)
    ?? (channel === "admin" ? "Admin" : null)
    ?? activityString(channel)
    ?? "System"
  );
}

function activityLabel(value: string | null | undefined) {
  return (value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function lifecycleActivityAction(eventType: string) {
  const labels: Record<string, string> = {
    access_link_created: "Created access link",
    admin_role_updated: "Updated admin access",
    admin_subscription_updated: "Changed tier",
    consent_result_recorded: "Recorded consent result",
    consent_triggered: "Started consent call",
    duplicate_merged: "Merged duplicate user",
    intake_created: "Created intake",
    link_sent: "Sent invite link",
    organization_archived: "Archived organization",
    organization_assigned: "Assigned organization",
    organization_created: "Created organization",
    organization_restored: "Restored organization",
    organization_updated: "Updated organization",
    profile_updated: "Updated profile",
    scheduled_event_cancelled: "Cancelled scheduled event",
    scheduled_event_created: "Created scheduled event",
    scheduled_event_paused: "Paused scheduled event",
    scheduled_event_resumed: "Resumed scheduled event",
    scheduled_event_updated: "Updated scheduled event",
    user_deleted: "Removed from Users",
    user_disabled: "Disabled app access",
    user_enabled: "Enabled app access",
    user_restored: "Restored to Users",
  };
  return labels[eventType] ?? activityLabel(eventType);
}

function lifecycleActivityResult(input: {
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  metadata: Record<string, unknown>;
}) {
  const error = activityString(input.metadata.dispatch_error) ?? activityString(input.metadata.error);
  if (error) return { status: "failed" as const, label: `Failed: ${error}` };
  if (input.eventType.includes("failed")) return { status: "failed" as const, label: "Failed" };
  if (input.fromStatus && input.toStatus && input.fromStatus !== input.toStatus) {
    return { status: "success" as const, label: `${activityLabel(input.fromStatus)} -> ${activityLabel(input.toStatus)}` };
  }
  return { status: "success" as const, label: "Completed" };
}

function lifecycleActivityDetails(metadata: Record<string, unknown>) {
  const details = [
    activityString(metadata.organization_name) ? `Org: ${activityString(metadata.organization_name)}` : null,
    activityString(metadata.previous_subscription_tier) && activityString(metadata.subscription_tier)
      ? `Tier: ${activityString(metadata.previous_subscription_tier)} -> ${activityString(metadata.subscription_tier)}`
      : activityString(metadata.subscription_tier)
        ? `Tier: ${activityString(metadata.subscription_tier)}`
        : null,
    activityString(metadata.reason) ? `Reason: ${activityString(metadata.reason)}` : null,
    activityString(metadata.status) ? `Status: ${activityString(metadata.status)}` : null,
  ].filter(Boolean);
  return details.slice(0, 3).join(" - ");
}

function organizationTargetFromMetadata(metadata: Record<string, unknown>) {
  const organizationName = activityString(metadata.organization_name);
  const organizationId = activityString(metadata.organization_id);
  if (!organizationName && !organizationId) return null;
  return {
    target_type: "organization",
    target_name: organizationName ?? organizationId ?? "Organization",
    target_detail: organizationName && organizationId ? organizationId : null,
  };
}

async function optionalAdminDelete(label: string, query: Promise<unknown>) {
  try {
    await query;
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
    console.warn(`[admin-lifecycle] optional delete skipped for ${label}`, error);
  }
}

function minimalLifecycleIdentityScope(intake: typeof userIntakes.$inferSelect) {
  const ids = new Set<string>();
  const emails = new Set<string>();
  const phones = new Set<string>();

  addIfPresent(ids, intake.user_id);
  addIfPresent(ids, intake.elder_user_id);
  addIfPresent(ids, intake.family_user_id);
  addIfPresent(ids, targetUserIdForIntake(intake));
  addNormalizedEmail(emails, intake.email);
  addNormalizedEmail(emails, intake.phone);
  addNormalizedPhone(phones, intake.phone);

  return {
    ids: Array.from(ids),
    emails: Array.from(emails),
    phones: Array.from(phones),
    intakeIds: [intake.id],
  };
}

async function safeLifecycleIdentityScope(intake: typeof userIntakes.$inferSelect) {
  try {
    return { scope: await lifecycleIdentityScope(intake), errors: [] as string[] };
  } catch (error) {
    console.error("[admin-lifecycle] falling back to selected intake identity for delete", error);
    return {
      scope: minimalLifecycleIdentityScope(intake),
      errors: [String((error as { message?: string })?.message ?? error)],
    };
  }
}

type LifecycleIdentityScope = Awaited<ReturnType<typeof lifecycleIdentityScope>>;

async function clearLifecycleDeletedProfileMarkers(scope: LifecycleIdentityScope, updatedAt: Date) {
  const profileWhere = profileIdentityWhere(scope);
  if (!profileWhere) return [];
  return optionalAdminRows(db.update(profiles).set({
    disabled_reason: "Restored to Users; app access remains disabled",
    updated_at: updatedAt,
  }).where(and(
    profileWhere,
    eq(profiles.account_status, "disabled"),
    eq(profiles.disabled_reason, "Deleted from lifecycle admin"),
  )).returning({ id: profiles.id }));
}

async function bestEffortAdminDelete(label: string, query: Promise<unknown>, cleanupErrors: string[]) {
  try {
    await query;
  } catch (error) {
    if (isMissingRelationError(error)) {
      console.warn(`[admin-lifecycle] optional cleanup skipped for ${label}`, error);
      return;
    }
    console.error(`[admin-lifecycle] optional cleanup failed for ${label}`, error);
    cleanupErrors.push(`${label}: ${String((error as { message?: string })?.message ?? error)}`);
  }
}

const lifecycleSchemaRequirements = [
  {
    table: "profiles",
    label: "App profiles",
    columns: [
      "id",
      "full_name",
      "preferred_name",
      "email",
      "phone_number",
      "whatsapp_number",
      "deployment",
      "subscription_tier",
      "subscription_status",
      "trial_ends_at",
      "account_status",
      "role",
      "disabled_at",
      "disabled_reason",
      "disabled_by",
      "updated_at",
    ],
  },
  {
    table: "users",
    label: "Login accounts",
    columns: ["id", "email", "phone_number", "active_profile_id", "last_seen_at", "created_at"],
  },
  {
    table: "user_intakes",
    label: "Lifecycle users",
    columns: [
      "id",
      "user_id",
      "elder_user_id",
      "family_user_id",
      "name",
      "phone",
      "email",
      "entry_point",
      "user_type",
      "organization_id",
      "tier",
      "status",
      "journey_step",
      "consent_status",
      "metadata",
      "dropped_at",
      "last_activity_at",
      "updated_at",
    ],
  },
  {
    table: "lifecycle_events",
    label: "Lifecycle audit",
    columns: ["id", "intake_id", "user_id", "event_type", "from_status", "to_status", "channel", "metadata", "created_at"],
  },
  {
    table: "communications_log",
    label: "Communications",
    columns: ["id", "intake_id", "user_id", "channel", "recipient", "status", "metadata", "created_at"],
  },
  {
    table: "organizations",
    label: "Organizations",
    columns: ["id", "name", "slug", "default_tier", "is_active", "metadata", "updated_at"],
  },
  {
    table: "tier_entitlements",
    label: "Tier access",
    columns: ["id", "tier", "display_name", "voice_assistant", "medication_tracking", "symptom_check", "concierge", "caregiver_dashboard", "is_active"],
  },
  {
    table: "consent_attempts",
    label: "Consent",
    columns: ["id", "intake_id", "elder_user_id", "family_user_id", "status", "attempt_number", "created_at"],
  },
  {
    table: "scheduled_events",
    label: "Schedule events",
    columns: ["id", "user_id", "title", "scheduled_for", "status", "created_by", "updated_at"],
  },
  {
    table: "scheduled_interactions",
    label: "Recurring support",
    columns: ["id", "user_id", "interaction_type", "status", "admin_edit_allowed", "updated_at"],
  },
] as const;

async function lifecycleSchemaHealth() {
  const tables = Array.from(new Set(lifecycleSchemaRequirements.map((item) => item.table)));
  const result = await pool.query<{ table_name: string; column_name: string }>(
    `
      select table_name, column_name
      from information_schema.columns
      where table_schema = current_schema()
        and table_name = any($1::text[])
    `,
    [tables],
  );
  const existing = new Set(result.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missing = lifecycleSchemaRequirements.flatMap((requirement) => (
    requirement.columns
      .filter((column) => !existing.has(`${requirement.table}.${column}`))
      .map((column) => ({
        table: requirement.table,
        column,
        label: requirement.label,
      }))
  ));
  const requiredCount = lifecycleSchemaRequirements.reduce((total, item) => total + item.columns.length, 0);

  return {
    ok: missing.length === 0,
    status: missing.length === 0 ? "healthy" : "warning",
    checked_at: new Date().toISOString(),
    required_count: requiredCount,
    missing_count: missing.length,
    missing,
  };
}

function adminLifecycleLoadError(res: Response, section: string, error: unknown) {
  console.error(`[admin-lifecycle] failed to load ${section}`, error);
  return res.status(500).json({ error: `Could not load ${section}. Please refresh and try again.` });
}

function emptyActivityResponse() {
  return {
    activity: [],
    summary: {
      total: 0,
      failed: 0,
      warning: 0,
      latest_at: null,
    },
    degraded: true,
  };
}

adminLifecycleRouter.get("/schema-health", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    return res.json(await lifecycleSchemaHealth());
  } catch (error) {
    return adminLifecycleLoadError(res, "schema health", error);
  }
});

adminLifecycleRouter.get("/summary", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    return res.json(await lifecycleService.getLifecycleSummary());
  } catch (error) {
    return adminLifecycleLoadError(res, "summary", error);
  }
});

adminLifecycleRouter.get("/activity", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const requestedLimit = Number(req.query.limit ?? 150);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 25), 300) : 150;

  try {
    const [eventRows, communicationRows] = await Promise.all([
      db
        .select({
          id: lifecycleEvents.id,
          intake_id: lifecycleEvents.intake_id,
          user_id: lifecycleEvents.user_id,
          event_type: lifecycleEvents.event_type,
          from_status: lifecycleEvents.from_status,
          to_status: lifecycleEvents.to_status,
          channel: lifecycleEvents.channel,
          metadata: lifecycleEvents.metadata,
          created_at: lifecycleEvents.created_at,
          intake_name: userIntakes.name,
          intake_phone: userIntakes.phone,
          intake_email: userIntakes.email,
          intake_user_type: userIntakes.user_type,
          intake_entry_point: userIntakes.entry_point,
          organization_id: organizations.id,
          organization_name: organizations.name,
        })
        .from(lifecycleEvents)
        .leftJoin(userIntakes, eq(lifecycleEvents.intake_id, userIntakes.id))
        .leftJoin(organizations, eq(userIntakes.organization_id, organizations.id))
        .orderBy(desc(lifecycleEvents.created_at))
        .limit(limit),
      db
        .select({
          id: communicationsLog.id,
          intake_id: communicationsLog.intake_id,
          user_id: communicationsLog.user_id,
          channel: communicationsLog.channel,
          recipient: communicationsLog.recipient,
          purpose: communicationsLog.purpose,
          status: communicationsLog.status,
          metadata: communicationsLog.metadata,
          created_at: communicationsLog.created_at,
          sent_at: communicationsLog.sent_at,
          intake_name: userIntakes.name,
          intake_phone: userIntakes.phone,
          intake_email: userIntakes.email,
          intake_user_type: userIntakes.user_type,
          intake_entry_point: userIntakes.entry_point,
          organization_id: organizations.id,
          organization_name: organizations.name,
        })
        .from(communicationsLog)
        .leftJoin(userIntakes, eq(communicationsLog.intake_id, userIntakes.id))
        .leftJoin(organizations, eq(userIntakes.organization_id, organizations.id))
        .orderBy(desc(communicationsLog.created_at))
        .limit(limit),
    ]);

    const lifecycleActivity = eventRows.map((row) => {
      const metadata = jsonRecord(row.metadata);
      const organizationTarget = organizationTargetFromMetadata(metadata);
      const result = lifecycleActivityResult({
        eventType: row.event_type,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        metadata,
      });
      const userTargetName = row.intake_name || row.intake_email || row.intake_phone || row.user_id || "System";
      const target = organizationTarget ?? (row.organization_id && row.event_type.startsWith("organization_")
        ? {
          target_type: "organization",
          target_name: row.organization_name ?? row.organization_id,
          target_detail: row.organization_name ? row.organization_id : null,
        }
        : {
          target_type: row.user_id || row.intake_id ? "user" : "system",
          target_name: userTargetName,
          target_detail: [
            row.intake_user_type ? activityLabel(row.intake_user_type) : null,
            row.intake_entry_point ? activityLabel(row.intake_entry_point) : null,
          ].filter(Boolean).join(" - ") || null,
        });

      return {
        id: `event-${row.id}`,
        source: "lifecycle_event",
        actor: activityActor(metadata, row.channel),
        action: lifecycleActivityAction(row.event_type),
        event_type: row.event_type,
        result: result.label,
        result_status: result.status,
        channel: row.channel,
        created_at: row.created_at,
        details: lifecycleActivityDetails(metadata),
        metadata,
        ...target,
      };
    });

    const communicationActivity = communicationRows.map((row) => {
      const metadata = jsonRecord(row.metadata);
      const error = activityString(metadata.dispatch_error) ?? activityString(metadata.provider_error_message) ?? activityString(metadata.provider_status);
      const failed = row.status === "failed";
      const queued = row.status === "queued";
      const recipientName = activityString(metadata.recipient_name);
      return {
        id: `communication-${row.id}`,
        source: "communication",
        actor: activityActor(metadata, "admin"),
        action: row.purpose === "share_signup_form"
          ? `Shared signup invite by ${activityLabel(row.channel)}`
          : `${activityLabel(row.purpose)} by ${activityLabel(row.channel)}`,
        event_type: row.purpose,
        result: failed ? `Failed: ${error ?? "Delivery failed"}` : queued ? "Queued" : "Sent",
        result_status: failed ? "failed" : queued ? "warning" : "success",
        channel: row.channel,
        created_at: row.created_at,
        target_type: "recipient",
        target_name: recipientName ?? row.recipient,
        target_detail: recipientName ? row.recipient : null,
        details: activityString(metadata.url) ?? "",
        metadata,
      };
    });

    const activity = [...lifecycleActivity, ...communicationActivity]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return res.json({
      activity,
      summary: {
        total: activity.length,
        failed: activity.filter((item) => item.result_status === "failed").length,
        warning: activity.filter((item) => item.result_status === "warning").length,
        latest_at: activity[0]?.created_at ?? null,
      },
    });
  } catch (error) {
    console.warn("[admin-lifecycle] activity log unavailable; returning empty admin log", error);
    return res.json(emptyActivityResponse());
  }
});

adminLifecycleRouter.get("/home-plan-cards", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const rows = await db.select().from(homePlanCards).orderBy(desc(homePlanCards.base_priority));
    return res.json({ cards: rows });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code === "42P01") {
      return res.status(503).json({
        error: "Home cards are not available yet. Deploy and run migrations, including migrations/0032_home_plan_cards.sql.",
      });
    }

    console.error("[adminLifecycle] GET /home-plan-cards error:", error);
    return res.status(500).json({ error: "Could not load home cards." });
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

adminLifecycleRouter.get("/hero-messages/metrics", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const days = Math.min(Math.max(Number(req.query.days ?? 7) || 7, 1), 90);
  const surface = typeof req.query.surface === "string" && req.query.surface !== "all"
    ? req.query.surface
    : undefined;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = surface
    ? and(gte(heroMessageEvents.created_at, since), eq(heroMessageEvents.surface, surface))
    : gte(heroMessageEvents.created_at, since);

  try {
    const rows = await db
      .select({
        surface: heroMessageEvents.surface,
        message_id: heroMessageEvents.message_id,
        language: heroMessageEvents.language,
        source: heroMessageEvents.source,
        event_type: heroMessageEvents.event_type,
        count: sql<number>`count(*)::int`,
      })
      .from(heroMessageEvents)
      .where(where)
      .groupBy(
        heroMessageEvents.surface,
        heroMessageEvents.message_id,
        heroMessageEvents.language,
        heroMessageEvents.source,
        heroMessageEvents.event_type,
      );

    const metrics = rows.map((row) => ({ ...row, count: Number(row.count ?? 0) }));
    return res.json({
      metrics,
      summary: {
        days,
        surface: surface ?? "all",
        impressions: metrics.filter((row) => row.event_type === "impression").reduce((sum, row) => sum + row.count, 0),
        cta_clicks: metrics.filter((row) => row.event_type === "cta_click").reduce((sum, row) => sum + row.count, 0),
        fallbacks: metrics.filter((row) => row.event_type === "fallback").reduce((sum, row) => sum + row.count, 0),
      },
    });
  } catch {
    return res.json({
      metrics: [],
      summary: { days, surface: surface ?? "all", impressions: 0, cta_clicks: 0, fallbacks: 0 },
      warning: "Hero message metrics are not migrated yet. Run schema/hero_messages.sql.",
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

function optionalBooleanParam(value: unknown) {
  if (value === undefined) return undefined;
  const normalized = Array.isArray(value) ? value[0] : value;
  return String(normalized).toLowerCase() === "true";
}

adminLifecycleRouter.get("/users", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    return res.json({
      users: await lifecycleService.listLifecycleUsers({
        entry_point: req.query.entry_point as "form" | "phone" | "whatsapp" | "admin" | undefined,
        user_type: req.query.user_type as "elder" | "family" | "admin" | undefined,
        status: req.query.status as "created" | "link_sent" | "consent_pending" | "active" | "dropped" | undefined,
        tier: req.query.tier ? String(req.query.tier) : undefined,
        query: req.query.query ? String(req.query.query) : undefined,
        callback_onboarding: optionalBooleanParam(req.query.callback_onboarding),
        inbound_phone_onboarding: optionalBooleanParam(req.query.inbound_phone_onboarding),
        include_removed: optionalBooleanParam(req.query.include_removed),
      }),
    });
  } catch (error) {
    return adminLifecycleLoadError(res, "users", error);
  }
});

adminLifecycleRouter.post("/users/bulk", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = bulkUserActionSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid bulk user action" });

  const ids = Array.from(new Set(parsed.data.ids));
  const actor = req.user?.email ?? req.user?.id ?? "admin";
  const now = new Date();
  const results: Array<{
    id: string;
    name?: string;
    status: "success" | "failed";
    message: string;
    hidden_intake_ids?: string[];
  }> = [];

  if (parsed.data.action === "assign_org" && !parsed.data.organization_id) {
    return res.status(400).json({ error: "Choose an organization before applying the bulk action." });
  }
  if (parsed.data.action === "change_tier" && !parsed.data.tier) {
    return res.status(400).json({ error: "Choose a tier before applying the bulk action." });
  }

  const [intakeRows, targetOrg] = await Promise.all([
    db.select().from(userIntakes).where(inArray(userIntakes.id, ids)),
    parsed.data.organization_id
      ? db.select().from(organizations).where(eq(organizations.id, parsed.data.organization_id)).limit(1)
      : Promise.resolve([]),
  ]);
  if (parsed.data.organization_id && (!targetOrg[0] || !targetOrg[0].is_active)) {
    return res.status(400).json({ error: "Choose an active organization." });
  }

  const intakesById = new Map(intakeRows.map((intake) => [intake.id, intake]));

  for (const id of ids) {
    const intake = intakesById.get(id);
    if (!intake) {
      results.push({ id, status: "failed", message: "User was not found." });
      continue;
    }

    try {
      const userId = targetUserIdForIntake(intake);

      if (parsed.data.action === "assign_org") {
        await db.update(userIntakes).set({
          organization_id: parsed.data.organization_id ?? null,
          last_activity_at: now,
          updated_at: now,
        }).where(eq(userIntakes.id, intake.id));
        await recordEvent({
          intakeId: intake.id,
          userId,
          eventType: "organization_assigned",
          channel: "admin",
          metadata: {
            organization_id: parsed.data.organization_id,
            organization_name: targetOrg[0]?.name ?? null,
            changed_by: actor,
          },
        });
        results.push({ id, name: intake.name, status: "success", message: `Assigned to ${targetOrg[0]?.name ?? "organization"}.` });
        continue;
      }

      if (parsed.data.action === "restore") {
        const metadata = jsonRecord(intake.metadata);
        const rowMarkedRemoved = intake.journey_step === "admin_deleted"
          || metadata.hidden_from_lifecycle === true
          || metadata.deleted_from_lifecycle === true;
        const removed = rowMarkedRemoved || await lifecycleService.isLifecycleIntakeRemovedForAdmin(intake);
        if (!removed) {
          results.push({ id, name: intake.name, status: "failed", message: "User is already visible in Users." });
          continue;
        }

        const { scope, errors: scopeErrors } = await safeLifecycleIdentityScope(intake);
        const restoredStatus = userId ? "active" : "created";
        const clearedProfileMarkers = await clearLifecycleDeletedProfileMarkers(scope, now);
        await db.update(userIntakes).set({
          status: restoredStatus,
          journey_step: "admin_restored",
          dropped_at: null,
          last_activity_at: now,
          updated_at: now,
          metadata: {
            ...metadata,
            hidden_from_lifecycle: false,
            deleted_from_lifecycle: false,
            remove_from_users: false,
            restored_from_lifecycle: true,
            restored_at: now.toISOString(),
            restored_by: actor,
            restored_previous_status: intake.status,
            restored_previous_journey_step: intake.journey_step,
            app_access_unchanged: true,
            bulk_action: true,
          },
        }).where(eq(userIntakes.id, intake.id));
        await recordEvent({
          intakeId: intake.id,
          userId,
          eventType: "user_restored",
          fromStatus: intake.status,
          toStatus: restoredStatus,
          channel: "admin",
          metadata: {
            changed_by: actor,
            restored_by: actor,
            restored_at: now.toISOString(),
            name: intake.name,
            email: intake.email,
            phone: intake.phone,
            app_access_unchanged: true,
            bulk_action: true,
            previous_journey_step: intake.journey_step,
            identity_scope: {
              intake_ids: scope.intakeIds,
              profile_or_login_ids: scope.ids,
              emails: scope.emails,
              phones: scope.phones,
            },
            cleared_lifecycle_deleted_profile_ids: clearedProfileMarkers.map((profile) => profile.id),
            scope_errors: scopeErrors,
          },
        });
        results.push({ id, name: intake.name, status: "success", message: "Restored to Users. App access was unchanged." });
        continue;
      }

      if (parsed.data.action === "resend_invite") {
        const linkResult = await lifecycleService.sendIntakeLink(intake.id, publicBaseUrl(req));
        if (!linkResult) {
          results.push({ id, name: intake.name, status: "failed", message: "Invite could not be created." });
          continue;
        }
        const dispatchResult = await dispatchCommunicationsByIds([linkResult.communication.id]);
        const delivery = dispatchResult.results[0];
        if (delivery?.status === "failed") {
          results.push({ id, name: intake.name, status: "failed", message: delivery.error ? `Invite created, delivery failed: ${delivery.error}` : "Invite created, delivery failed." });
          continue;
        }
        results.push({ id, name: intake.name, status: "success", message: "Invite sent." });
        continue;
      }

      const { scope, errors: scopeErrors } = await safeLifecycleIdentityScope(intake);
      const intakeWhere = lifecycleIntakeIdentityWhere({
        selectedIntakeId: intake.id,
        ids: scope.ids,
        emails: scope.emails,
        phones: scope.phones,
      });
      const profileWhere = profileIdentityWhere(scope);

      if (parsed.data.action === "disable") {
        const disabledProfiles = profileWhere
          ? await optionalAdminRows(db.update(profiles).set({
            account_status: "disabled",
            disabled_at: now,
            disabled_reason: "Disabled by admin bulk action",
            disabled_by: actor,
            updated_at: now,
          }).where(profileWhere).returning({ id: profiles.id }))
          : [];
        await db.update(userIntakes).set({
          status: "dropped",
          journey_step: "admin_disabled",
          dropped_at: now,
          last_activity_at: now,
          updated_at: now,
        }).where(intakeWhere);
        await recordEvent({
          intakeId: intake.id,
          userId,
          eventType: "user_disabled",
          fromStatus: intake.status,
          toStatus: "dropped",
          channel: "admin",
          metadata: { changed_by: actor, bulk_action: true, matched_profile_ids: disabledProfiles.map((profile) => profile.id), scope_errors: scopeErrors },
        });
        results.push({ id, name: intake.name, status: "success", message: disabledProfiles.length ? `Disabled app access for ${disabledProfiles.length} linked profile${disabledProfiles.length === 1 ? "" : "s"}.` : "Lifecycle user disabled. No linked app profile was found." });
        continue;
      }

      if (parsed.data.action === "change_tier") {
        const tier = normalizeSubscriptionTier(parsed.data.tier);
        const syncedProfiles = profileWhere
          ? await optionalAdminRows(db.update(profiles).set({
            subscription_tier: tier,
            subscription_status: "active",
            updated_at: now,
          }).where(profileWhere).returning({ id: profiles.id }))
          : [];
        await db.update(userIntakes).set({
          tier,
          last_activity_at: now,
          updated_at: now,
        }).where(and(
          intakeWhere,
          sql`coalesce(${userIntakes.metadata}->>'hidden_from_lifecycle', 'false') <> 'true'`,
          sql`coalesce(${userIntakes.metadata}->>'deleted_from_lifecycle', 'false') <> 'true'`,
        ));
        await recordEvent({
          intakeId: intake.id,
          userId,
          eventType: "admin_subscription_updated",
          channel: "admin",
          metadata: {
            changed_by: actor,
            bulk_action: true,
            previous_subscription_tier: intake.tier,
            subscription_tier: tier,
            matched_profile_ids: syncedProfiles.map((profile) => profile.id),
            scope_errors: scopeErrors,
          },
        });
        results.push({ id, name: intake.name, status: "success", message: `Tier changed to ${tier}.` });
        continue;
      }

      const matchingIntakes = await db.select().from(userIntakes).where(intakeWhere);
      const hiddenIds: string[] = [];
      for (const row of matchingIntakes) {
        const [hidden] = await db.update(userIntakes).set({
          status: "dropped",
          journey_step: "admin_deleted",
          dropped_at: now,
          last_activity_at: now,
          updated_at: now,
          metadata: {
            ...jsonRecord(row.metadata),
            hidden_from_lifecycle: true,
            deleted_from_lifecycle: true,
            deleted_at: now.toISOString(),
            deleted_by: actor,
            bulk_action: true,
            deleted_identity_scope: {
              intake_ids: scope.intakeIds,
              profile_or_login_ids: scope.ids,
              emails: scope.emails,
              phones: scope.phones,
            },
          },
        }).where(eq(userIntakes.id, row.id)).returning({ id: userIntakes.id });
        if (hidden) hiddenIds.push(hidden.id);
      }
      await recordEvent({
        intakeId: intake.id,
        userId,
        eventType: "user_deleted",
        fromStatus: intake.status,
        toStatus: "dropped",
        channel: "admin",
        metadata: {
          changed_by: actor,
          bulk_action: true,
          hidden_from_lifecycle: true,
          hidden_intake_ids: hiddenIds,
          app_access_unchanged: true,
          scope_errors: scopeErrors,
        },
      });
      results.push({ id, name: intake.name, status: "success", message: "Removed from Users. App access was unchanged.", hidden_intake_ids: hiddenIds });
    } catch (error) {
      console.error("[admin-lifecycle] bulk user action failed", { id, action: parsed.data.action, error });
      results.push({ id, name: intake.name, status: "failed", message: String((error as { message?: string })?.message ?? error) });
    }
  }

  const succeeded = results.filter((result) => result.status === "success").length;
  const failed = results.filter((result) => result.status === "failed").length;
  return res.json({ action: parsed.data.action, total: ids.length, succeeded, failed, results });
});

adminLifecycleRouter.post("/callbacks/:id/trigger", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "Callback intake not found" });
  const metadata = intake.metadata && typeof intake.metadata === "object" && !Array.isArray(intake.metadata)
    ? intake.metadata as Record<string, unknown>
    : {};
  if (!metadata.callback && !intake.journey_step.startsWith("callback_")) {
    return res.status(400).json({ error: "This intake is not a callback onboarding request" });
  }

  const result = await triggerCallbackOnboardingCall(intake);
  return res.json(result);
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
    account_status: "enabled",
    disabled_at: null,
    disabled_reason: null,
    disabled_by: null,
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
  const subscriptionPhone = normalizedPhoneOrNull(parsed.data.account_phone) ?? normalizedPhoneOrNull(profile.phone_number) ?? normalizedPhoneOrNull(profile.whatsapp_number);

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

  const syncedProfileIds = await syncSubscriptionForAccessIdentity({
    email: subscriptionEmail,
    phone: subscriptionPhone,
    seedProfileId: profile.id,
    profilePatch,
    accountIds: [syncedAccountId ?? parsed.data.account_id],
    explicitProfileIds: [syncedActiveProfileId],
  });

  await syncIntakeTiersForProfiles(syncedProfileIds, subscriptionEmail, subscriptionTier);
  await syncIntakeTiersForPhone(syncedProfileIds, subscriptionPhone, subscriptionTier);

  try {
    await recordEvent({
      intakeId: null,
      userId: profile.id,
      eventType: "admin_subscription_updated",
      channel: "admin",
      metadata: {
        previous_subscription_tier: existingProfile?.subscription_tier ?? null,
        subscription_tier: subscriptionTier,
        previous_subscription_status: existingProfile?.subscription_status ?? null,
        subscription_status: subscriptionStatus,
        account_email: subscriptionEmail,
        synced_profile_ids: syncedProfileIds,
      },
    });
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  const freshProfile = await profileById(profile.id) ?? profile;
  const effectiveProfile = syncedActiveProfileId ? await profileById(syncedActiveProfileId) : freshProfile;
  const subscriptionSync = await syncProfileEntitlement({
    profile: effectiveProfile ?? freshProfile,
    profileId: (effectiveProfile ?? freshProfile).id,
    accountUserId: syncedAccountId,
    email: subscriptionEmail,
    phone: (effectiveProfile ?? freshProfile).phone_number ?? subscriptionPhone,
    whatsapp: (effectiveProfile ?? freshProfile).whatsapp_number,
    repairProfile: false,
  });

  return res.json({
    account: {
      account_id: syncedAccountId,
      account_source: parsed.data.account_source ?? null,
      active_profile_id: syncedActiveProfileId,
      is_active_profile: syncedActiveProfileId === freshProfile.id,
      profile_id: freshProfile.id,
      profile_email: freshProfile.email,
      full_name: freshProfile.full_name,
      preferred_name: freshProfile.preferred_name,
      subscription_status: freshProfile.subscription_status,
      subscription_tier: normalizeSubscriptionTier(freshProfile.subscription_tier),
      stored_subscription_tier: freshProfile.subscription_tier,
      trial_ends_at: freshProfile.trial_ends_at,
      account_status: freshProfile.account_status,
      profile_role: freshProfile.role,
      updated_at: freshProfile.updated_at,
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
    const profile = await profileById(userId);
    const mapping = await resolveLoginMappings({
      intake,
      lifecycleProfile: profile ?? null,
    });
    const userEventWhere = userId
      ? or(eq(lifecycleEvents.intake_id, intake.id), eq(lifecycleEvents.user_id, userId))
      : eq(lifecycleEvents.intake_id, intake.id);
    const userCommunicationWhere = userId
      ? or(eq(communicationsLog.intake_id, intake.id), eq(communicationsLog.user_id, userId))
      : eq(communicationsLog.intake_id, intake.id);
    const userAccessLinkWhere = userId
      ? or(eq(accessLinks.intake_id, intake.id), eq(accessLinks.user_id, userId))
      : eq(accessLinks.intake_id, intake.id);

    const [communicationRows, lifecycleRows, consentRows, accessLinkRows, scheduledRows, support, careTeamInviteRows] = await Promise.all([
      optionalAdminRows(db.select().from(communicationsLog).where(userCommunicationWhere).orderBy(desc(communicationsLog.created_at)).limit(100)),
      optionalAdminRows(db.select().from(lifecycleEvents).where(userEventWhere).orderBy(desc(lifecycleEvents.created_at)).limit(100)),
      optionalAdminRows(db.select().from(consentAttempts).where(eq(consentAttempts.intake_id, intake.id)).orderBy(desc(consentAttempts.created_at)).limit(50)),
      optionalAdminRows(db.select().from(accessLinks).where(userAccessLinkWhere).orderBy(desc(accessLinks.created_at)).limit(50)),
      scheduledItemsForUser(userId),
      scheduledSupportForUser(userId),
      userId
        ? optionalAdminRows(db.select().from(teamInvitations).where(eq(teamInvitations.senior_id, userId)).orderBy(desc(teamInvitations.created_at)).limit(50))
        : Promise.resolve([]),
    ]);

    return res.json({
      intake,
      profile,
      account_mappings: mapping.mappings,
      account_mapping_warnings: mapping.warnings,
      account_match_field: mapping.match_field,
      communications: communicationRows,
      lifecycle_events: lifecycleRows,
      consent_attempts: consentRows,
      access_links: accessLinkRows,
      scheduled_events: scheduledRows,
      scheduled_support: support.schedules,
      interaction_logs: support.logs,
      consent_audit_logs: support.audit_logs,
      care_team_invitations: careTeamInviteRows,
    });
  } catch (error) {
    console.error("[admin-lifecycle] user details failed", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Could not load user details" });
  }
});

adminLifecycleRouter.post("/users/:id/caregiver-invite", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = caregiverInviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid caregiver invite" });

  try {
    const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
    if (!intake) return res.status(404).json({ error: "User intake not found" });

    const userId = targetUserIdForIntake(intake);
    if (!userId) return res.status(400).json({ error: "Create or link the elder app profile before inviting a caregiver." });

    const profile = await profileById(userId);
    if (!profile) return res.status(404).json({ error: "Linked elder profile not found" });

    const data = parsed.data;
    const role = normalizeCaregiverInviteRole(data.role);
    const email = cleanOptionalContact(data.email)?.toLowerCase() ?? null;
    const phone = cleanOptionalContact(data.phone) ? normalizePhone(data.phone ?? "") || null : null;
    const whatsapp = cleanOptionalContact(data.whatsapp) ? normalizePhone(data.whatsapp ?? "") || null : null;
    const relationship = cleanOptionalContact(data.relationship);
    if (!email && !phone && !whatsapp) {
      return res.status(400).json({ error: "Add at least one caregiver email, phone, or WhatsApp number." });
    }

    const permissions = { ...caregiverInviteDefaults(role), ...data.permissions };
    const inviteToken = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const [invitation] = await db
      .insert(teamInvitations)
      .values({
        senior_id: userId,
        invitee_name: data.name,
        invitee_phone: phone,
        invitee_email: email,
        invitee_whatsapp: whatsapp,
        role,
        relationship,
        invite_token: inviteToken,
        invite_channel: "admin_template",
        status: "pending",
        expires_at: expiresAt,
        can_receive_daily_digest: Boolean(permissions.daily_summary),
        can_receive_safety_alerts: Boolean(permissions.safety_alerts),
        can_receive_health_alerts: Boolean(permissions.health_alerts),
        can_receive_mood_alerts: Boolean(permissions.mood_updates),
        can_receive_medication_alerts: Boolean(permissions.medication_alerts),
        can_view_dashboard: Boolean(permissions.dashboard_access),
        can_view_health_reports: Boolean(permissions.health_reports),
        can_view_vital_signs: Boolean(permissions.vital_signs),
        can_view_journal_summaries: Boolean(permissions.journal_summaries),
      })
      .returning();

    const seniorName = profile.full_name ?? profile.preferred_name ?? intake.name;
    const baseUrl = publicBaseUrl(req).replace(/\/+$/, "");
    const inviteUrl = `${baseUrl}/care-team/invite/${encodeURIComponent(inviteToken)}`;
    const body = `VYVA: ${seniorName || "someone you support"} invited you to their care team. Review and accept securely: ${inviteUrl}`;
    const phoneRecipient = phone ?? whatsapp;
    const deliveryChannel = signupPhoneInviteChannel();
    const recipients = [
      ...(email ? [{ channel: "email", recipient: email }] : []),
      ...(phoneRecipient ? [{ channel: deliveryChannel, recipient: phoneRecipient }] : []),
    ];
    const dedupedRecipients = Array.from(
      new Map(recipients.map((item) => [`${item.channel}:${item.recipient.toLowerCase()}`, item])).values(),
    );

    const communicationRows: Array<typeof communicationsLog.$inferInsert> = dedupedRecipients.map((target) => ({
      intake_id: intake.id,
      user_id: userId,
      channel: target.channel,
      recipient: target.recipient,
      purpose: "care_team_invite",
      status: "queued",
      body,
      metadata: {
        url: inviteUrl,
        subject: `${seniorName || "VYVA"} invited you to their VYVA care team`,
        invitation_id: invitation.id,
        senior_id: userId,
        senior_name: seniorName,
        invitee_name: invitation.invitee_name,
        recipient_name: invitation.invitee_name,
        target_role: invitation.role,
        relationship: invitation.relationship,
        shared_by_admin: req.user?.email ?? req.user?.id ?? null,
      },
    }));

    const communications = communicationRows.length
      ? await db.insert(communicationsLog).values(communicationRows).returning()
      : [];
    const dispatchResult = communications.length
      ? await dispatchCommunicationsByIds(communications.map((item) => item.id))
      : { processed: 0, results: [] };
    const sent = dispatchResult.results.filter((item) => item.status === "sent").length;
    const failed = dispatchResult.results.filter((item) => item.status === "failed").length;

    await lifecycleService.recordLifecycleEvent({
      intakeId: intake.id,
      userId,
      eventType: "caregiver_invite_sent",
      fromStatus: intake.status,
      toStatus: intake.status,
      channel: "admin_template",
      metadata: {
        invitation_id: invitation.id,
        invitee_name: invitation.invitee_name,
        target_role: invitation.role,
        relationship,
        queued: communications.length,
        sent,
        failed,
      },
    });

    return res.status(201).json({
      invitation,
      invite_url: inviteUrl,
      delivery: {
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
      },
      communications,
    });
  } catch (error) {
    console.error("[admin-lifecycle] caregiver invite failed", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Could not send caregiver invite" });
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
      account_status: "enabled",
      disabled_at: null,
      disabled_reason: null,
      disabled_by: null,
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

    for (const profileId of await syncSubscriptionForAccessIdentity({
      email: nextEmail,
      phone: nextPhone,
      seedProfileId: userId,
      profilePatch: subscriptionPatch,
      accountIds: mapping.mappings.map((accountMapping) => accountMapping.login_uid),
      explicitProfileIds: Array.from(profileIds),
    })) {
      profileIds.add(profileId);
    }

    await syncIntakeTiersForProfiles(Array.from(profileIds), nextEmail, profilePatch.subscription_tier);
    await syncIntakeTiersForPhone(Array.from(profileIds), nextPhone, profilePatch.subscription_tier);

    await applySubscriptionPatchToProfiles({
      ids: Array.from(profileIds),
      profilePatch: subscriptionPatch,
      email: nextEmail,
      phone: nextPhone,
    });
    syncedProfileIds = Array.from(profileIds);
  }

  const freshProfile = await profileById(userId);
  const freshMapping = await resolveLoginMappings({
    intake: updatedIntake,
    lifecycleProfile: freshProfile,
    email: nextEmail,
    phone: nextPhone,
  });

  try {
    await recordEvent({
      intakeId: intake.id,
      userId,
      eventType: "admin_profile_updated",
      channel: "admin",
      metadata: {
        previous_subscription_tier: existingProfile.subscription_tier,
        subscription_tier: profilePatch.subscription_tier ?? existingProfile.subscription_tier,
        previous_subscription_status: existingProfile.subscription_status,
        subscription_status: profilePatch.subscription_status ?? existingProfile.subscription_status,
        synced_profile_ids: syncedProfileIds,
        account_mappings: freshMapping.mappings.map((item) => ({
          source: item.source,
          login_uid: item.login_uid,
          effective_profile_id: item.effective_profile_id,
        })),
      },
    });
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

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
  const scope = await lifecycleIdentityScope(intake);
  const disabledAt = new Date();
  const profileWhere = profileIdentityWhere(scope);

  const disabledProfiles = profileWhere
    ? await db.update(profiles).set({
      account_status: "disabled",
      disabled_at: disabledAt,
      disabled_reason: reason || "Disabled by admin",
      disabled_by: "admin",
      updated_at: disabledAt,
    }).where(profileWhere).returning()
    : [];

  await db.update(userIntakes).set({
    status: "dropped",
    journey_step: "admin_disabled",
    dropped_at: disabledAt,
    last_activity_at: disabledAt,
    updated_at: disabledAt,
  }).where(lifecycleIntakeIdentityWhere({
    selectedIntakeId: intake.id,
    ids: scope.ids,
    emails: scope.emails,
    phones: scope.phones,
  }));

  await recordEvent({
    intakeId: intake.id,
    userId,
    eventType: "user_disabled",
    fromStatus: intake.status,
    toStatus: "dropped",
    channel: "admin",
    metadata: { reason, matched_profile_ids: disabledProfiles.map((profile) => profile.id) },
  });
  return res.json({ profile: disabledProfiles[0] ?? null, profiles: disabledProfiles });
});

adminLifecycleRouter.post("/users/:id/enable", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });
  const userId = targetUserIdForIntake(intake);
  if (!userId) return res.status(400).json({ error: "This intake is not linked to a profile yet" });
  const scope = await lifecycleIdentityScope(intake);
  const enabledAt = new Date();
  const profileWhere = profileIdentityWhere(scope);

  const enabledProfiles = profileWhere
    ? await db.update(profiles).set({
      account_status: "enabled",
      disabled_at: null,
      disabled_reason: null,
      disabled_by: null,
      updated_at: enabledAt,
    }).where(profileWhere).returning()
    : [];

  await db.update(userIntakes).set({
    status: "active",
    journey_step: "admin_enabled",
    dropped_at: null,
    last_activity_at: enabledAt,
    updated_at: enabledAt,
  }).where(and(
    lifecycleIntakeIdentityWhere({
      selectedIntakeId: intake.id,
      ids: scope.ids,
      emails: scope.emails,
      phones: scope.phones,
    }),
    sql`coalesce((${userIntakes.metadata}->>'hidden_from_lifecycle')::boolean, false) = false`,
  ));

  await recordEvent({
    intakeId: intake.id,
    userId,
    eventType: "user_enabled",
    fromStatus: intake.status,
    toStatus: "active",
    channel: "admin",
    metadata: { matched_profile_ids: enabledProfiles.map((profile) => profile.id) },
  });
  return res.json({ profile: enabledProfiles[0] ?? null, profiles: enabledProfiles });
});

adminLifecycleRouter.delete("/users/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = z.object({ confirm: z.enum(["REMOVE_FROM_USERS", "DELETE"]) }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Confirm removal from the Users table." });

  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });

  const userId = targetUserIdForIntake(intake);
  const deleted = {
    intake: false,
    profile: false,
    login: false,
    login_account: false,
  };
  const deletedAt = new Date();
  const deletedBy = req.user?.email ?? req.user?.id ?? "admin";
  const { scope, errors: scopeErrors } = await safeLifecycleIdentityScope(intake);
  const cleanupErrors = scopeErrors.map((error) => `identity scope: ${error}`);

  const intakeWhere = lifecycleIntakeIdentityWhere({
    selectedIntakeId: intake.id,
    ids: scope.ids,
    emails: scope.emails,
    phones: scope.phones,
  });
  let intakesToHide: Array<typeof userIntakes.$inferSelect> = [];
  try {
    intakesToHide = await db.select().from(userIntakes).where(intakeWhere);
  } catch (error) {
    console.error("[admin-lifecycle] failed to find matching intakes during delete", error);
    cleanupErrors.push(`find matching intakes: ${String((error as { message?: string })?.message ?? error)}`);
  }

  const intakesById = new Map<string, typeof userIntakes.$inferSelect>();
  for (const row of intakesToHide) intakesById.set(row.id, row);
  intakesById.set(intake.id, intake);
  const hiddenIntakeIds: string[] = [];

  for (const row of intakesById.values()) {
    try {
      const [hiddenIntake] = await db.update(userIntakes).set({
        status: "dropped",
        journey_step: "admin_deleted",
        dropped_at: deletedAt,
        last_activity_at: deletedAt,
        updated_at: deletedAt,
        metadata: {
          ...jsonRecord(row.metadata),
          hidden_from_lifecycle: true,
          deleted_from_lifecycle: true,
          deleted_at: deletedAt.toISOString(),
          deleted_by: deletedBy,
          deleted_identity: {
            user_id: row.user_id,
            elder_user_id: row.elder_user_id,
            family_user_id: row.family_user_id,
            name: row.name,
            email: row.email,
            phone: row.phone,
          },
          deleted_identity_scope: {
            intake_ids: scope.intakeIds,
            profile_or_login_ids: scope.ids,
            emails: scope.emails,
            phones: scope.phones,
          },
          remove_from_users: true,
          app_access_unchanged: true,
        },
      }).where(eq(userIntakes.id, row.id)).returning({ id: userIntakes.id });
      if (hiddenIntake) hiddenIntakeIds.push(hiddenIntake.id);
    } catch (error) {
      console.error("[admin-lifecycle] failed to hide lifecycle intake during delete", error);
      cleanupErrors.push(`hide lifecycle intake ${row.id}: ${String((error as { message?: string })?.message ?? error)}`);
    }
  }
  deleted.intake = hiddenIntakeIds.length > 0;

  if (!hiddenIntakeIds.includes(intake.id)) {
    return res.status(500).json({ error: "User could not be removed from the Users table. Please refresh and try again." });
  }

  await bestEffortAdminDelete(
    "user removed lifecycle event",
    recordEvent({
      intakeId: intake.id,
      userId,
      eventType: "user_deleted",
      fromStatus: intake.status,
      toStatus: "dropped",
      channel: "admin",
      metadata: {
        deleted_by: deletedBy,
        deleted_at: deletedAt.toISOString(),
        hidden_from_lifecycle: true,
        name: intake.name,
        email: intake.email,
        phone: intake.phone,
        hidden_intake_ids: hiddenIntakeIds,
        app_access_unchanged: true,
        identity_scope: {
          intake_ids: scope.intakeIds,
          profile_or_login_ids: scope.ids,
          emails: scope.emails,
          phones: scope.phones,
        },
        cleanup: deleted,
        cleanup_errors: cleanupErrors,
      },
    }),
    cleanupErrors,
  );

  return res.json({
    deleted,
    hidden_intake: true,
    hidden_intake_ids: hiddenIntakeIds,
    cleanup_errors: cleanupErrors,
    identity_scope: {
      intake_ids: scope.intakeIds,
      profile_or_login_ids: scope.ids,
      emails: scope.emails,
      phones: scope.phones,
    },
    user_id: userId,
    intake_id: intake.id,
  });
});

adminLifecycleRouter.post("/users/:id/restore", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });

  const metadata = jsonRecord(intake.metadata);
  const rowMarkedRemoved = intake.journey_step === "admin_deleted"
    || metadata.hidden_from_lifecycle === true
    || metadata.deleted_from_lifecycle === true;
  const removed = rowMarkedRemoved || await lifecycleService.isLifecycleIntakeRemovedForAdmin(intake);
  if (!removed) {
    return res.status(409).json({ error: "This user is already visible in Users." });
  }

  const restoredAt = new Date();
  const restoredBy = req.user?.email ?? req.user?.id ?? "admin";
  const userId = targetUserIdForIntake(intake);
  const restoredStatus = userId ? "active" : "created";
  const { scope, errors: scopeErrors } = await safeLifecycleIdentityScope(intake);
  const clearedProfileMarkers = await clearLifecycleDeletedProfileMarkers(scope, restoredAt);

  const [restoredIntake] = await db.update(userIntakes).set({
    status: restoredStatus,
    journey_step: "admin_restored",
    dropped_at: null,
    last_activity_at: restoredAt,
    updated_at: restoredAt,
    metadata: {
      ...metadata,
      hidden_from_lifecycle: false,
      deleted_from_lifecycle: false,
      remove_from_users: false,
      restored_from_lifecycle: true,
      restored_at: restoredAt.toISOString(),
      restored_by: restoredBy,
      restored_previous_status: intake.status,
      restored_previous_journey_step: intake.journey_step,
      app_access_unchanged: true,
    },
  }).where(eq(userIntakes.id, intake.id)).returning();

  await recordEvent({
    intakeId: intake.id,
    userId,
    eventType: "user_restored",
    fromStatus: intake.status,
    toStatus: restoredStatus,
    channel: "admin",
    metadata: {
      changed_by: restoredBy,
      restored_by: restoredBy,
      restored_at: restoredAt.toISOString(),
      name: intake.name,
      email: intake.email,
      phone: intake.phone,
      app_access_unchanged: true,
      previous_journey_step: intake.journey_step,
      identity_scope: {
        intake_ids: scope.intakeIds,
        profile_or_login_ids: scope.ids,
        emails: scope.emails,
        phones: scope.phones,
      },
      cleared_lifecycle_deleted_profile_ids: clearedProfileMarkers.map((profile) => profile.id),
      scope_errors: scopeErrors,
    },
  });

  return res.json({
    intake: restoredIntake,
    restored_intake: true,
    app_access_unchanged: true,
    cleared_lifecycle_deleted_profile_ids: clearedProfileMarkers.map((profile) => profile.id),
    scope_errors: scopeErrors,
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
  const dispatchResult = await dispatchCommunicationsByIds([result.communication.id]);
  return res.json({ ...result, delivery: dispatchResult.results[0] ?? null });
});

adminLifecycleRouter.get("/consent", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    return res.json({ attempts: await lifecycleService.listConsentAttempts() });
  } catch (error) {
    return adminLifecycleLoadError(res, "consent", error);
  }
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
  try {
    return res.json({ organizations: await lifecycleService.listOrganizations() });
  } catch (error) {
    return adminLifecycleLoadError(res, "organizations", error);
  }
});

adminLifecycleRouter.post("/organizations", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = orgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid organization" });
  try {
    const org = await lifecycleService.createOrganization(parsed.data);
    await recordEvent({
      eventType: "organization_created",
      channel: "admin",
      metadata: {
        organization_id: org.id,
        organization_name: org.name,
        default_tier: org.default_tier,
        changed_by: req.user?.email ?? req.user?.id ?? "admin",
      },
    });
    return res.status(201).json({ organization: org });
  } catch (error) {
    if (error instanceof lifecycleService.OrganizationConflictError) {
      return res.status(409).json({
        error: error.message,
        organization: error.existingOrganization,
      });
    }
    const databaseError = error as { code?: string };
    if (databaseError.code === "23505") {
      return res.status(409).json({ error: "Organization already exists. Restore or use the existing organization instead." });
    }
    throw error;
  }
});

adminLifecycleRouter.patch("/organizations/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = orgUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid organization" });
  try {
    const org = await lifecycleService.updateOrganization({
      organizationId: req.params.id,
      ...parsed.data,
    });
    if (!org) return res.status(404).json({ error: "Organization not found" });
    await recordEvent({
      eventType: "organization_updated",
      channel: "admin",
      metadata: {
        organization_id: org.id,
        organization_name: org.name,
        default_tier: org.default_tier,
        changed_by: req.user?.email ?? req.user?.id ?? "admin",
        changed_fields: Object.keys(parsed.data),
      },
    });
    return res.json({ organization: org });
  } catch (error) {
    if (error instanceof lifecycleService.OrganizationConflictError) {
      return res.status(409).json({
        error: error.message,
        organization: error.existingOrganization,
      });
    }
    const databaseError = error as { code?: string };
    if (databaseError.code === "23505") {
      return res.status(409).json({ error: "Organization already exists. Restore or use the existing organization instead." });
    }
    throw error;
  }
});

adminLifecycleRouter.delete("/organizations/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const org = await lifecycleService.setOrganizationActive(req.params.id, false);
  if (!org) return res.status(404).json({ error: "Organization not found" });
  await recordEvent({
    eventType: "organization_archived",
    channel: "admin",
    metadata: {
      organization_id: org.id,
      organization_name: org.name,
      default_tier: org.default_tier,
      changed_by: req.user?.email ?? req.user?.id ?? "admin",
    },
  });
  return res.json({ organization: org });
});

adminLifecycleRouter.post("/organizations/:id/restore", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const org = await lifecycleService.setOrganizationActive(req.params.id, true);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    await recordEvent({
      eventType: "organization_restored",
      channel: "admin",
      metadata: {
        organization_id: org.id,
        organization_name: org.name,
        default_tier: org.default_tier,
        changed_by: req.user?.email ?? req.user?.id ?? "admin",
      },
    });
    return res.json({ organization: org });
  } catch (error) {
    if (error instanceof lifecycleService.OrganizationConflictError) {
      return res.status(409).json({
        error: error.message,
        organization: error.existingOrganization,
      });
    }
    throw error;
  }
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
  try {
    const plans = await listPlans();
    return res.json({ plans });
  } catch (error) {
    return adminLifecycleLoadError(res, "plans", error);
  }
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
  try {
    const [rows, providerStatus] = await Promise.all([
      db.select().from(communicationsLog).orderBy(desc(communicationsLog.created_at)).limit(150),
      communicationProviderStatus(),
    ]);
    return res.json({ communications: rows, provider_status: providerStatus });
  } catch (error) {
    return adminLifecycleLoadError(res, "communications", error);
  }
});

adminLifecycleRouter.post("/signup-share", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const namedInviteRecipientSchema = z.object({
    name: z.string().trim().max(120).optional(),
    recipient: z.string().trim().min(1),
  });
  const parsed = z.object({
    emails: z.array(z.string().trim().email()).optional().default([]),
    whatsapp_numbers: z.array(z.string().trim().min(3)).optional().default([]),
    email_recipients: z.array(namedInviteRecipientSchema.extend({
      recipient: z.string().trim().email(),
    })).optional().default([]),
    whatsapp_recipients: z.array(namedInviteRecipientSchema.extend({
      recipient: z.string().trim().min(3),
    })).optional().default([]),
    invite_type: z.enum(["elder", "caregiver"]).optional().default("elder"),
    message: z.string().trim().max(500).optional(),
    language: z.string().trim().optional(),
  }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid signup share request" });

  const language = normalizeSignupInviteLanguage(parsed.data.language);
  const inviteType = parsed.data.invite_type;
  const setupFor = inviteType === "caregiver" ? "someone_else" : "self";
  const copy = signupInviteCopyFor(language);
  const baseUrl = publicBaseUrl(req);
  const signupUrl = buildSignupInviteUrl(baseUrl, language, { setupFor });
  const emailRecipients = mergeSignupInviteRecipients(
    parsed.data.emails,
    parsed.data.email_recipients,
    (recipient) => recipient.trim().toLowerCase() || null,
  );
  const whatsappRecipients = mergeSignupInviteRecipients(
    parsed.data.whatsapp_numbers,
    parsed.data.whatsapp_recipients,
    (recipient) => normalizePhone(recipient) || null,
  );
  if (emailRecipients.length + whatsappRecipients.length === 0) {
    return res.status(400).json({ error: "Add at least one email or phone number." });
  }

  const emailByName = inviteRecipientMapByName(emailRecipients);
  const whatsappByName = inviteRecipientMapByName(whatsappRecipients);
  const phoneInviteChannel = signupPhoneInviteChannel();
  const intro = parsed.data.message || copy.defaultIntro;
  const buildBody = (setupUrl: string) => `${intro}\n\n${copy.startHere}: ${setupUrl}`;
  const buildSetupUrl = (prefill: SignupInvitePrefill) => buildSignupInviteUrl(baseUrl, language, { ...prefill, setupFor });
  const sharedBy = req.user?.email ?? req.user?.id ?? null;
  const rows: Array<typeof communicationsLog.$inferInsert> = [];

  for (const emailRecipient of emailRecipients) {
    const { recipient, name } = emailRecipient;
    const matchedWhatsapp = matchingInviteRecipient(emailRecipient, whatsappRecipients, whatsappByName);
    const inviteId = randomUUID();
    const intake = await ensureSignupInviteIntake({
      inviteId,
      inviteType,
      name,
      email: recipient,
      phone: matchedWhatsapp?.recipient,
      channel: "email",
      language,
      sharedBy,
    });
    const setupUrl = buildSetupUrl({
      name,
      email: recipient,
      phone: matchedWhatsapp?.recipient,
      whatsapp: matchedWhatsapp?.recipient,
      inviteId,
    });
    rows.push({
      intake_id: intake.id,
      user_id: req.user?.id ?? null,
      channel: "email",
      recipient,
      purpose: "share_signup_form",
      status: "queued",
      body: buildBody(setupUrl),
      metadata: {
        invite_id: inviteId,
        invite_type: inviteType,
        url: setupUrl,
        language,
        intro,
        subject: copy.subject,
        ...(name ? { recipient_name: name } : {}),
        shared_by: sharedBy,
      },
    });
    await lifecycleService.recordLifecycleEvent({
      intakeId: intake.id,
      userId: intake.user_id,
      eventType: "signup_invite_sent",
      fromStatus: intake.status,
      toStatus: intake.status,
      channel: "email",
      metadata: { invite_id: inviteId, invite_type: inviteType, recipient, language, shared_by: sharedBy },
    });
  }

  for (const whatsappRecipient of whatsappRecipients) {
    const { recipient, name } = whatsappRecipient;
    const matchedEmail = matchingInviteRecipient(whatsappRecipient, emailRecipients, emailByName);
    const inviteId = randomUUID();
    const intake = await ensureSignupInviteIntake({
      inviteId,
      inviteType,
      name,
      email: matchedEmail?.recipient,
      phone: recipient,
      channel: phoneInviteChannel,
      language,
      sharedBy,
    });
    const setupUrl = buildSetupUrl({
      name,
      email: matchedEmail?.recipient,
      phone: recipient,
      whatsapp: recipient,
      inviteId,
    });
    rows.push({
      intake_id: intake.id,
      user_id: req.user?.id ?? null,
      channel: phoneInviteChannel,
      recipient,
      purpose: "share_signup_form",
      status: "queued",
      body: buildBody(setupUrl),
      metadata: {
        invite_id: inviteId,
        invite_type: inviteType,
        url: setupUrl,
        language,
        requested_channel: "phone",
        delivery_channel: phoneInviteChannel,
        whatsapp_fallback_to_sms: phoneInviteChannel === "sms",
        ...(name ? { recipient_name: name } : {}),
        shared_by: sharedBy,
      },
    });
    await lifecycleService.recordLifecycleEvent({
      intakeId: intake.id,
      userId: intake.user_id,
      eventType: "signup_invite_sent",
      fromStatus: intake.status,
      toStatus: intake.status,
      channel: phoneInviteChannel,
      metadata: { invite_id: inviteId, invite_type: inviteType, recipient, language, shared_by: sharedBy },
    });
  }

  const communications = await db.insert(communicationsLog).values(rows).returning();
  const dispatchResult = await dispatchCommunicationsByIds(communications.map((item) => item.id));
  const sent = dispatchResult.results.filter((item) => item.status === "sent").length;
  const failed = dispatchResult.results.filter((item) => item.status === "failed").length;

  return res.status(201).json({
    signup_url: signupUrl,
    invite_type: inviteType,
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
    metadata: {
      from_role: existing.role,
      to_role: parsed.data.role,
      email: existing.email,
      changed_by: req.user?.email ?? req.user?.id ?? "admin",
    },
  });

  return res.json({ user });
});
