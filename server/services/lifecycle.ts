import { randomBytes, randomUUID } from "crypto";
import { and, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db.js";
import { normalizeSubscriptionTier } from "../lib/plans.js";
import { premiumTrialEndsAt } from "../lib/premiumTrial.js";
import {
  accessLinks,
  communicationsLog,
  consentAttempts,
  lifecycleEvents,
  organizations,
  profiles,
  scheduledEvents,
  userIntakes,
  userMedications,
  users,
} from "../../shared/schema.js";

type Database = typeof db;
type Intake = typeof userIntakes.$inferSelect;
type IntakeStatus = "created" | "link_sent" | "consent_pending" | "active" | "dropped";
type EntryPoint = "form" | "phone" | "whatsapp" | "admin";
type UserType = "elder" | "family" | "admin";
type ConsentStatus = "pending" | "approved" | "rejected" | "no_answer" | "failed";
type ConsentAttempt = typeof consentAttempts.$inferSelect;

export type IntakeCreateInput = {
  name: string;
  phone: string;
  email?: string | null;
  user_type: UserType;
  entry_point: EntryPoint;
  organization_id?: string | null;
  tier: string;
  source_payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  elder?: {
    name?: string;
    phone?: string;
    email?: string | null;
  };
};

export type AccessLinkCreateInput = {
  intake_id?: string | null;
  user_id?: string | null;
  organization_id?: string | null;
  link_type: "trial" | "unlimited" | "organization" | "custom" | "caregiver";
  tier: string;
  destination: string;
  target_role: string;
  expires_in_days: number;
  max_uses: number;
};

export type BulkRowInput = {
  first_name?: string;
  last_name?: string;
  name?: string;
  preferred_name?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  language?: string;
  timezone?: string;
  user_type?: UserType;
  tier?: string;
};

export function accessLinkTypeForTier(tier: string) {
  return normalizeSubscriptionTier(tier) === "premium" ? "unlimited" : "trial";
}

export function targetUserIdForIntake(intake: Intake): string | null {
  return intake.elder_user_id ?? intake.user_id ?? intake.family_user_id ?? null;
}

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  return trimmed.replace(/\D/g, "");
}

function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64) || `org-${randomBytes(3).toString("hex")}`;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function publicBaseUrl() {
  return process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? "5000"}`;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> {
  const record = metadataRecord(value);
  return metadataRecord(record[key]);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function elderDetails(intake: Intake) {
  return nestedRecord(intake.metadata, "elder");
}

function lifecycleIdentityKeys(input: {
  userId?: string | null;
  elderUserId?: string | null;
  familyUserId?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const keys: string[] = [];
  for (const id of [input.userId, input.elderUserId, input.familyUserId]) {
    if (id) keys.push(`user:${id}`);
  }
  const email = normalizeEmail(input.email);
  if (email) keys.push(`email:${email}`);
  const phone = input.phone ? normalizePhone(input.phone) : "";
  if (phone) keys.push(`phone:${phone}`);
  return keys;
}

function hasLifecycleIdentity(existing: Set<string>, input: {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  return lifecycleIdentityKeys(input).some((key) => existing.has(key));
}

function rememberLifecycleIdentity(existing: Set<string>, input: {
  userId?: string | null;
  elderUserId?: string | null;
  familyUserId?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  for (const key of lifecycleIdentityKeys(input)) existing.add(key);
}

function canonicalIdentityKey(intake: Intake) {
  const userId = targetUserIdForIntake(intake) ?? intake.user_id ?? intake.elder_user_id ?? intake.family_user_id;
  if (userId) return `user:${userId}`;
  const email = normalizeEmail(intake.email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(intake.phone);
  if (phone) return `phone:${phone}`;
  return `intake:${intake.id}`;
}

function isMergedLifecycleDuplicate(intake: Intake) {
  const metadata = metadataRecord(intake.metadata);
  return typeof metadata.merged_into_intake_id === "string" || metadata.hidden_from_lifecycle === true;
}

function statusRank(status: string | null | undefined) {
  if (status === "active") return 5;
  if (status === "link_sent") return 4;
  if (status === "consent_pending") return 3;
  if (status === "created") return 2;
  if (status === "dropped") return 1;
  return 0;
}

function timestampRank(value: Date | string | null | undefined) {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function intakeCompletenessScore(intake: Intake) {
  return [
    intake.elder_user_id,
    intake.user_id,
    intake.email,
    normalizePhone(intake.phone),
    intake.organization_id,
    intake.link_sent_at,
    intake.activated_at,
  ].filter(Boolean).length;
}

function chooseCanonicalIntake(rows: Intake[]) {
  return [...rows].sort((a, b) => {
    const activeDiff = Number(!isMergedLifecycleDuplicate(b)) - Number(!isMergedLifecycleDuplicate(a));
    if (activeDiff) return activeDiff;
    const scoreDiff = intakeCompletenessScore(b) - intakeCompletenessScore(a);
    if (scoreDiff) return scoreDiff;
    const statusDiff = statusRank(b.status) - statusRank(a.status);
    if (statusDiff) return statusDiff;
    return timestampRank(b.last_activity_at ?? b.updated_at ?? b.created_at) - timestampRank(a.last_activity_at ?? a.updated_at ?? a.created_at);
  })[0];
}

function strongestStatus(rows: Intake[]): IntakeStatus {
  return rows.reduce((best, row) => statusRank(row.status) > statusRank(best) ? row.status as IntakeStatus : best, "created" as IntakeStatus);
}

function fallbackLifecyclePhone(input: {
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  id: string;
  prefix: string;
}) {
  const phone = normalizePhone(input.phone ?? "");
  if (phone) return phone;
  const whatsapp = normalizePhone(input.whatsapp ?? "");
  if (whatsapp) return whatsapp;
  const email = normalizeEmail(input.email);
  return email || `${input.prefix}:${input.id}`;
}

function channelForIntakeLink(intake: Intake) {
  const email = normalizeEmail(intake.email);
  const normalizedPhone = normalizePhone(intake.phone);
  const phoneLooksSynthetic = intake.phone.includes("@") || intake.phone.includes(":");
  if (email && (!normalizedPhone || phoneLooksSynthetic)) return "email";
  return intake.entry_point === "whatsapp" ? "whatsapp" : "sms";
}

export function elderPhoneForIntake(intake: Intake) {
  return normalizePhone(stringValue(elderDetails(intake).phone) || intake.phone);
}

function consentRetryDelaysMinutes() {
  const configured = (process.env.CONSENT_RETRY_DELAYS_MINUTES ?? "30,120").split(",");
  return configured
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

function maxConsentAttempts() {
  const configured = Number(process.env.CONSENT_MAX_ATTEMPTS ?? 3);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 3;
}

function nextConsentRetryAt(attemptNumber: number) {
  const delays = consentRetryDelaysMinutes();
  const delayMinutes = delays[Math.max(0, attemptNumber - 1)];
  if (delayMinutes === undefined) return null;
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

function consentVoiceUrl(attemptId: string) {
  return `${publicBaseUrl()}/api/webhooks/twilio/consent/${attemptId}/voice`;
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

export async function scheduledItemsForUser(userId: string | null, database = db) {
  if (!userId) return [];
  const [events, medications] = await Promise.all([
    database.select().from(scheduledEvents).where(eq(scheduledEvents.user_id, userId)).orderBy(desc(scheduledEvents.scheduled_for)).limit(100),
    database.select().from(userMedications).where(eq(userMedications.user_id, userId)).limit(100),
  ]);
  return [...events, ...medicationEventsFromRows(medications)];
}

export async function repairLifecycleDuplicates(database = db) {
  const rows = await database.select().from(userIntakes);
  const groups: Intake[][] = [];
  const keyToGroup = new Map<string, Intake[]>();
  for (const row of rows) {
    const keys = lifecycleIdentityKeys({
      userId: row.user_id,
      elderUserId: row.elder_user_id,
      familyUserId: row.family_user_id,
      email: row.email,
      phone: row.phone,
    });
    if (!keys.length) keys.push(canonicalIdentityKey(row));
    const matchingGroups = Array.from(new Set(keys.map((key) => keyToGroup.get(key)).filter(Boolean))) as Intake[][];
    const group = matchingGroups[0] ?? [];
    if (!matchingGroups.length) groups.push(group);
    for (const extraGroup of matchingGroups.slice(1)) {
      group.push(...extraGroup);
      const index = groups.indexOf(extraGroup);
      if (index >= 0) groups.splice(index, 1);
    }
    group.push(row);
    for (const item of group) {
      for (const key of lifecycleIdentityKeys({
        userId: item.user_id,
        elderUserId: item.elder_user_id,
        familyUserId: item.family_user_id,
        email: item.email,
        phone: item.phone,
      })) keyToGroup.set(key, group);
    }
  }
  const repaired: Array<{ canonical_id: string; duplicate_id: string }> = [];

  for (const groupRows of groups) {
    const activeRows = groupRows.filter((row) => !isMergedLifecycleDuplicate(row));
    if (activeRows.length <= 1) continue;

    const canonical = chooseCanonicalIntake(activeRows);
    const duplicates = activeRows.filter((row) => row.id !== canonical.id);
    const strongest = strongestStatus(activeRows);
    const latest = activeRows.reduce((best, row) => {
      const candidate = timestampRank(row.last_activity_at ?? row.updated_at ?? row.created_at);
      return candidate > timestampRank(best.last_activity_at ?? best.updated_at ?? best.created_at) ? row : best;
    }, canonical);
    const bestTier = latest.tier || canonical.tier;
    const bestOrg = latest.organization_id ?? canonical.organization_id;
    const linkSentAt = activeRows
      .map((row) => row.link_sent_at)
      .filter(Boolean)
      .sort((a, b) => timestampRank(b) - timestampRank(a))[0] ?? canonical.link_sent_at;
    const activatedAt = activeRows
      .map((row) => row.activated_at)
      .filter(Boolean)
      .sort((a, b) => timestampRank(b) - timestampRank(a))[0] ?? canonical.activated_at;

    await database.update(userIntakes).set({
      status: strongest,
      tier: bestTier,
      organization_id: bestOrg,
      link_sent_at: linkSentAt,
      activated_at: activatedAt,
      last_activity_at: latest.last_activity_at ?? latest.updated_at ?? latest.created_at,
      metadata: {
        ...metadataRecord(canonical.metadata),
        duplicate_intake_ids: duplicates.map((row) => row.id),
        duplicate_repair_at: new Date().toISOString(),
      },
      updated_at: new Date(),
    }).where(eq(userIntakes.id, canonical.id));

    for (const duplicate of duplicates) {
      await database.update(userIntakes).set({
        status: "dropped",
        journey_step: "merged_duplicate",
        metadata: {
          ...metadataRecord(duplicate.metadata),
          hidden_from_lifecycle: true,
          merged_into_intake_id: canonical.id,
          merged_at: new Date().toISOString(),
        },
        dropped_at: duplicate.dropped_at ?? new Date(),
        updated_at: new Date(),
      }).where(eq(userIntakes.id, duplicate.id));
      repaired.push({ canonical_id: canonical.id, duplicate_id: duplicate.id });
      await recordLifecycleEvent({
        intakeId: duplicate.id,
        userId: targetUserIdForIntake(duplicate),
        eventType: "lifecycle_duplicate_merged",
        fromStatus: duplicate.status,
        toStatus: "dropped",
        channel: "admin",
        metadata: { canonical_intake_id: canonical.id },
      }, database);
    }

    await recordLifecycleEvent({
      intakeId: canonical.id,
      userId: targetUserIdForIntake(canonical),
      eventType: "lifecycle_duplicates_repaired",
      toStatus: strongest,
      channel: "admin",
      metadata: { duplicate_intake_ids: duplicates.map((row) => row.id) },
    }, database);
  }

  return repaired;
}

export async function backfillLifecycleUsers(database = db) {
  const [existingIntakes, profileRows, accountRows] = await Promise.all([
    database.select().from(userIntakes),
    database.select().from(profiles),
    database.select().from(users),
  ]);
  const existing = new Set<string>();
  for (const intake of existingIntakes) {
    rememberLifecycleIdentity(existing, {
      userId: intake.user_id,
      elderUserId: intake.elder_user_id,
      familyUserId: intake.family_user_id,
      email: intake.email,
      phone: intake.phone,
    });
  }

  const inserted: Intake[] = [];
  for (const profile of profileRows) {
    const phone = fallbackLifecyclePhone({
      phone: profile.phone_number,
      whatsapp: profile.whatsapp_number,
      email: profile.email,
      id: profile.id,
      prefix: "profile",
    });
    if (hasLifecycleIdentity(existing, { userId: profile.id, email: profile.email, phone })) continue;

    const isDropped = profile.account_status === "disabled";
    const isActive = profile.onboarding_complete || profile.subscription_status === "active";
    const status: IntakeStatus = isDropped ? "dropped" : isActive ? "active" : "created";
    const name = profile.full_name || profile.preferred_name || profile.email || profile.phone_number || "App user";
    const now = new Date();
    const [intake] = await database.insert(userIntakes).values({
      user_id: profile.id,
      elder_user_id: profile.id,
      family_user_id: null,
      name,
      phone,
      email: profile.email ?? null,
      user_type: "elder",
      entry_point: "admin",
      organization_id: null,
      tier: normalizeSubscriptionTier(profile.subscription_tier),
      status,
      journey_step: profile.onboarding_complete ? "app_onboarding_complete" : "login_profile_backfilled",
      consent_status: "not_required",
      source_payload: { backfilled_from: "profiles" },
      metadata: {
        source: "login_profile_backfill",
        profile_id: profile.id,
        account_status: profile.account_status,
        subscription_status: profile.subscription_status,
        onboarding_complete: profile.onboarding_complete,
      },
      activated_at: status === "active" ? profile.updated_at ?? now : null,
      dropped_at: status === "dropped" ? profile.disabled_at ?? profile.updated_at ?? now : null,
      last_activity_at: profile.updated_at ?? profile.created_at ?? now,
    }).returning();

    rememberLifecycleIdentity(existing, {
      userId: intake.user_id,
      elderUserId: intake.elder_user_id,
      familyUserId: intake.family_user_id,
      email: intake.email,
      phone: intake.phone,
    });
    inserted.push(intake);
    await recordLifecycleEvent({
      intakeId: intake.id,
      userId: profile.id,
      eventType: "lifecycle_backfilled",
      toStatus: status,
      channel: "login",
      metadata: { source: "profiles" },
    }, database);
  }

  for (const account of accountRows) {
    const phone = fallbackLifecyclePhone({
      phone: account.phone_number,
      email: account.email,
      id: account.id,
      prefix: "login",
    });
    if (hasLifecycleIdentity(existing, { userId: account.id, email: account.email, phone })) continue;

    const name = account.email || account.phone_number || "Login user";
    const [intake] = await database.insert(userIntakes).values({
      user_id: account.id,
      elder_user_id: account.active_profile_id ?? null,
      family_user_id: null,
      name,
      phone,
      email: account.email ?? null,
      user_type: "elder",
      entry_point: "admin",
      organization_id: null,
      tier: "free",
      status: "created",
      journey_step: "login_registered_no_profile",
      consent_status: "not_required",
      source_payload: { backfilled_from: "users" },
      metadata: {
        source: "login_user_backfill",
        login_user_id: account.id,
        active_profile_id: account.active_profile_id,
        onboarding_intent: account.onboarding_intent,
        last_seen_at: account.last_seen_at?.toISOString() ?? null,
      },
      last_activity_at: account.last_seen_at ?? account.created_at ?? new Date(),
    }).returning();

    rememberLifecycleIdentity(existing, {
      userId: intake.user_id,
      elderUserId: intake.elder_user_id,
      familyUserId: intake.family_user_id,
      email: intake.email,
      phone: intake.phone,
    });
    inserted.push(intake);
    await recordLifecycleEvent({
      intakeId: intake.id,
      userId: account.id,
      eventType: "lifecycle_backfilled",
      toStatus: "created",
      channel: "login",
      metadata: { source: "users" },
    }, database);
  }

  await repairLifecycleDuplicates(database);
  return inserted;
}

export async function recordLifecycleEvent(input: {
  intakeId?: string | null;
  userId?: string | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  channel?: string | null;
  metadata?: Record<string, unknown>;
}, database: Database = db) {
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

export async function ensurePasswordlessUser(input: {
  name: string;
  phone: string;
  email?: string | null;
  tier: string;
  organizationId?: string | null;
  profile?: Record<string, unknown>;
}, database: Database = db) {
  const normalizedPhone = normalizePhone(input.phone);
  const email = input.email ? input.email.toLowerCase() : null;
  const [existingByEmail] = email
    ? await database
      .select({
        id: profiles.id,
        email: profiles.email,
        subscription_tier: profiles.subscription_tier,
        subscription_status: profiles.subscription_status,
        trial_ends_at: profiles.trial_ends_at,
        stripe_subscription_id: profiles.stripe_subscription_id,
      })
      .from(profiles)
      .where(sql`lower(${profiles.email}) = ${email}`)
      .limit(1)
    : [];
  const [existingByPhone] = existingByEmail
    ? []
    : await database
      .select({
        id: profiles.id,
        email: profiles.email,
        subscription_tier: profiles.subscription_tier,
        subscription_status: profiles.subscription_status,
        trial_ends_at: profiles.trial_ends_at,
        stripe_subscription_id: profiles.stripe_subscription_id,
      })
      .from(profiles)
      .where(eq(profiles.phone_number, normalizedPhone))
      .limit(1);
  const user = existingByEmail ?? existingByPhone ?? {
    id: randomUUID(),
    email,
    subscription_tier: null,
    subscription_status: null,
    trial_ends_at: null,
    stripe_subscription_id: null,
  };
  const preferredName = typeof input.profile?.preferred_name === "string" && input.profile.preferred_name.trim()
    ? input.profile.preferred_name.trim()
    : input.name.split(" ")[0] ?? input.name;
  const dateOfBirth = typeof input.profile?.date_of_birth === "string" ? input.profile.date_of_birth : null;
  const language = typeof input.profile?.language === "string" && input.profile.language ? input.profile.language : "es";
  const timezone = typeof input.profile?.timezone === "string" && input.profile.timezone ? input.profile.timezone : "Europe/Madrid";
  const countryCode = typeof input.profile?.country_code === "string" && input.profile.country_code ? input.profile.country_code : "ES";
  const whatsappNumber = typeof input.profile?.whatsapp_number === "string" && input.profile.whatsapp_number.trim()
    ? input.profile.whatsapp_number.trim()
    : normalizePhone(input.phone);
  const subscriptionTier = normalizeSubscriptionTier(input.tier);
  const existingTrialEndsAt = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const preservesPaidPremium = (
    subscriptionTier === "premium" &&
    normalizeSubscriptionTier(user.subscription_tier) === "premium" &&
    (user.subscription_status === "active" || Boolean(user.stripe_subscription_id))
  );
  const trialEndsAt = subscriptionTier === "premium" && !preservesPaidPremium
    ? existingTrialEndsAt && existingTrialEndsAt.getTime() > Date.now()
      ? existingTrialEndsAt
      : premiumTrialEndsAt()
    : null;
  const subscriptionStatus = subscriptionTier === "premium" && !preservesPaidPremium ? "trial" : "active";

  await database.insert(profiles).values({
    id: user.id,
    full_name: input.name,
    preferred_name: preferredName,
    date_of_birth: dateOfBirth,
    language,
    phone_number: normalizedPhone,
    whatsapp_number: whatsappNumber,
    email: input.email || user.email || null,
    country_code: countryCode,
    timezone,
    subscription_tier: subscriptionTier,
    subscription_status: subscriptionStatus,
    trial_ends_at: trialEndsAt,
  } as typeof profiles.$inferInsert).onConflictDoUpdate({
    target: profiles.id,
    set: {
      full_name: input.name,
      preferred_name: preferredName,
      date_of_birth: dateOfBirth,
      language,
      phone_number: normalizedPhone,
      whatsapp_number: whatsappNumber,
      email: input.email || user.email || null,
      country_code: countryCode,
      timezone,
      subscription_tier: subscriptionTier,
      subscription_status: subscriptionStatus,
      trial_ends_at: trialEndsAt,
      updated_at: new Date(),
    },
  });

  return user;
}

export function validateFamilyIntake(data: IntakeCreateInput): string | null {
  if (data.user_type !== "family") return null;

  const elderName = data.elder?.name?.trim() ?? "";
  const elderPhone = normalizePhone(data.elder?.phone ?? "");
  const familyPhone = normalizePhone(data.phone);
  const elderEmail = normalizeEmail(data.elder?.email);
  const familyEmail = normalizeEmail(data.email);

  if (!elderName || !elderPhone) return "Family intakes require separate elder name and phone details";
  if (elderPhone === familyPhone) return "Elder phone must be different from the family contact phone";
  if (elderEmail && familyEmail && elderEmail === familyEmail) return "Elder email must be different from the family contact email";

  return null;
}

export async function getLifecycleSummary(database = db) {
  await backfillLifecycleUsers(database);
  const [allRows, consentRows] = await Promise.all([
    database.select().from(userIntakes).orderBy(desc(userIntakes.created_at)),
    database.select().from(consentAttempts).orderBy(desc(consentAttempts.created_at)),
  ]);
  const rows = allRows.filter((row) => !isMergedLifecycleDuplicate(row));
  const by = (key: "entry_point" | "user_type" | "status" | "tier" | "consent_status") =>
    rows.reduce<Record<string, number>>((acc, row) => {
      const value = String(row[key] ?? "unknown");
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});
  const percent = (part: number, total: number) => total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
  const countRows = (predicate: (row: Intake) => boolean) => rows.filter(predicate).length;
  const total = rows.length;
  const linkSent = countRows((row) => row.status === "link_sent" || row.status === "active" || !!row.link_sent_at);
  const active = countRows((row) => row.status === "active");
  const dropped = countRows((row) => row.status === "dropped");
  const family = countRows((row) => row.user_type === "family");
  const consentApproved = countRows((row) => row.user_type === "family" && row.consent_status === "approved");
  const consentRejected = countRows((row) => row.user_type === "family" && row.consent_status === "rejected");
  const consentNoAnswer = countRows((row) => row.user_type === "family" && row.consent_status === "no_answer");
  const consentFailed = countRows((row) => row.user_type === "family" && row.consent_status === "failed");
  const entryPoints = ["form", "phone", "whatsapp", "admin"] as const;
  const statusOrder = ["created", "consent_pending", "link_sent", "active", "dropped"] as const;
  const droppedByJourneyStep = rows
    .filter((row) => row.status === "dropped")
    .reduce<Record<string, number>>((acc, row) => {
      const value = row.journey_step || "unknown";
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});
  const attemptCounts = consentRows.reduce<Record<string, number>>((acc, attempt) => {
    acc[attempt.status] = (acc[attempt.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total,
    active,
    pendingConsent: rows.filter((r) => r.status === "consent_pending").length,
    dropped,
    byEntryPoint: by("entry_point"),
    byUserType: by("user_type"),
    byStatus: by("status"),
    byTier: by("tier"),
    byConsent: by("consent_status"),
    funnel: {
      generated_at: new Date().toISOString(),
      stages: [
        { key: "created", label: "Intake created", count: total, rate: percent(total, total) },
        { key: "consent_required", label: "Consent required", count: family, rate: percent(family, total) },
        { key: "consent_approved", label: "Consent approved", count: consentApproved, rate: percent(consentApproved, family) },
        { key: "link_sent", label: "Link sent", count: linkSent, rate: percent(linkSent, total) },
        { key: "active", label: "Active", count: active, rate: percent(active, total) },
      ],
      dropoffs: [
        {
          key: "created_not_linked",
          label: "Created, link not sent",
          count: countRows((row) => row.user_type !== "family" && row.status === "created"),
          rate: percent(countRows((row) => row.user_type !== "family" && row.status === "created"), total),
        },
        {
          key: "consent_pending",
          label: "Waiting for consent",
          count: countRows((row) => row.status === "consent_pending"),
          rate: percent(countRows((row) => row.status === "consent_pending"), total),
        },
        {
          key: "link_sent_not_active",
          label: "Link sent, not active",
          count: countRows((row) => row.status === "link_sent"),
          rate: percent(countRows((row) => row.status === "link_sent"), linkSent),
        },
        {
          key: "dropped",
          label: "Dropped",
          count: dropped,
          rate: percent(dropped, total),
        },
      ],
      by_entry_point: entryPoints.map((entryPoint) => {
        const channelRows = rows.filter((row) => row.entry_point === entryPoint);
        const channelTotal = channelRows.length;
        const channelLinkSent = channelRows.filter((row) => row.status === "link_sent" || row.status === "active" || !!row.link_sent_at).length;
        const channelActive = channelRows.filter((row) => row.status === "active").length;
        const channelDropped = channelRows.filter((row) => row.status === "dropped").length;
        return {
          entry_point: entryPoint,
          total: channelTotal,
          link_sent: channelLinkSent,
          active: channelActive,
          dropped: channelDropped,
          link_rate: percent(channelLinkSent, channelTotal),
          conversion_rate: percent(channelActive, channelTotal),
          drop_rate: percent(channelDropped, channelTotal),
        };
      }),
      by_status: statusOrder.map((status) => ({
        status,
        count: rows.filter((row) => row.status === status).length,
        rate: percent(rows.filter((row) => row.status === status).length, total),
      })),
      consent: {
        required: family,
        approved: consentApproved,
        rejected: consentRejected,
        no_answer: consentNoAnswer,
        failed: consentFailed,
        pending: countRows((row) => row.user_type === "family" && row.consent_status === "pending"),
        success_rate: percent(consentApproved, family),
        rejection_rate: percent(consentRejected, family),
        attempts: consentRows.length,
        attempts_by_status: attemptCounts,
      },
      dropped_by_journey_step: Object.entries(droppedByJourneyStep)
        .map(([journey_step, count]) => ({ journey_step, count, rate: percent(count, dropped) }))
        .sort((a, b) => b.count - a.count),
      tier_distribution: Object.entries(by("tier"))
        .map(([tier, count]) => ({ tier, count, rate: percent(count, total) }))
        .sort((a, b) => b.count - a.count),
    },
  };
}

export async function listLifecycleUsers(filters: {
  entry_point?: EntryPoint;
  user_type?: UserType;
  status?: IntakeStatus;
  tier?: string;
}, database = db) {
  await backfillLifecycleUsers(database);
  const where = [
    filters.entry_point ? eq(userIntakes.entry_point, filters.entry_point) : undefined,
    filters.user_type ? eq(userIntakes.user_type, filters.user_type) : undefined,
    filters.status ? eq(userIntakes.status, filters.status) : undefined,
    filters.tier ? eq(userIntakes.tier, filters.tier) : undefined,
  ].filter(Boolean);

  const rows = (await database
    .select({
      intake: userIntakes,
      organization_name: organizations.name,
    })
    .from(userIntakes)
    .leftJoin(organizations, eq(userIntakes.organization_id, organizations.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(userIntakes.created_at))
    .limit(240))
    .filter((row) => !isMergedLifecycleDuplicate(row.intake))
    .slice(0, 200);

  const profileIds = Array.from(new Set(rows.map((row) => targetUserIdForIntake(row.intake)).filter(Boolean))) as string[];
  const profileRows = profileIds.length
    ? await database
      .select({
        id: profiles.id,
        account_status: profiles.account_status,
        disabled_at: profiles.disabled_at,
        subscription_tier: profiles.subscription_tier,
      })
      .from(profiles)
      .where(inArray(profiles.id, profileIds))
    : [];
  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));

  return rows.map((row) => {
    const profile = profileById.get(targetUserIdForIntake(row.intake) ?? "");
    return {
      ...row.intake,
      intake_tier: row.intake.tier,
      profile_subscription_tier: profile?.subscription_tier ?? null,
      tier: profile?.subscription_tier ?? row.intake.tier,
      organization_name: row.organization_name,
      account_status: profile?.account_status ?? "enabled",
      disabled_at: profile?.disabled_at ?? null,
    };
  });
}

export async function getLifecycleUserDetails(intakeId: string, database = db) {
  await backfillLifecycleUsers(database);
  const [intake] = await database.select().from(userIntakes).where(eq(userIntakes.id, intakeId)).limit(1);
  if (!intake) return null;

  const userId = targetUserIdForIntake(intake);
  const [profile] = userId
    ? await database.select().from(profiles).where(eq(profiles.id, userId)).limit(1)
    : [];
  const [communicationRows, lifecycleRows, consentRows, scheduledRows] = await Promise.all([
    database.select().from(communicationsLog).where(eq(communicationsLog.intake_id, intake.id)).orderBy(desc(communicationsLog.created_at)).limit(100),
    database.select().from(lifecycleEvents).where(eq(lifecycleEvents.intake_id, intake.id)).orderBy(desc(lifecycleEvents.created_at)).limit(100),
    database.select().from(consentAttempts).where(eq(consentAttempts.intake_id, intake.id)).orderBy(desc(consentAttempts.created_at)).limit(50),
    scheduledItemsForUser(userId, database),
  ]);

  return {
    intake,
    profile: profile ?? null,
    communications: communicationRows,
    lifecycle_events: lifecycleRows,
    consent_attempts: consentRows,
    scheduled_events: scheduledRows,
  };
}

export async function createLifecycleIntake(input: IntakeCreateInput, database = db) {
  const data = { ...input, tier: normalizeSubscriptionTier(input.tier) };
  const familyError = validateFamilyIntake(data);
  if (familyError) return { error: familyError as string };

  const elderName = data.user_type === "family" ? data.elder?.name?.trim() ?? "" : data.name;
  const elderPhone = data.user_type === "family" ? data.elder?.phone?.trim() ?? "" : data.phone;
  const elderEmail = data.user_type === "family" ? (data.elder?.email || undefined) : data.email || undefined;
  const elderUser = await ensurePasswordlessUser({
    name: elderName,
    phone: elderPhone,
    email: elderEmail || null,
    tier: data.tier,
    organizationId: data.organization_id ?? null,
    profile: data.user_type === "family" ? (data.metadata?.elder_profile as Record<string, unknown> | undefined) : data.metadata,
  }, database);

  let familyUserId: string | null = null;
  if (data.user_type === "family") {
    const familyUser = await ensurePasswordlessUser({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      tier: data.tier,
      organizationId: data.organization_id ?? null,
      profile: data.metadata,
    }, database);
    familyUserId = familyUser.id;
  }

  const initialStatus = data.user_type === "family" ? "consent_pending" : "created";
  const [intake] = await database.insert(userIntakes).values({
    user_id: data.user_type === "family" ? familyUserId : elderUser.id,
    elder_user_id: elderUser.id,
    family_user_id: familyUserId,
    name: data.name,
    phone: normalizePhone(data.phone),
    email: data.email || null,
    user_type: data.user_type,
    entry_point: data.entry_point,
    organization_id: data.organization_id ?? null,
    tier: data.tier,
    status: initialStatus,
    journey_step: data.user_type === "family" ? "elder_consent_required" : "intake_created",
    consent_status: data.user_type === "family" ? "pending" : "not_required",
    source_payload: data.source_payload ?? {},
    metadata: { ...(data.metadata ?? {}), elder: data.elder ?? null },
    last_activity_at: new Date(),
  }).returning();

  await recordLifecycleEvent({
    intakeId: intake.id,
    userId: intake.user_id,
    eventType: "intake_created",
    toStatus: initialStatus,
    channel: data.entry_point,
  }, database);

  return { intake };
}

export async function updateLifecycleIntakeStatus(input: {
  intakeId: string;
  status: IntakeStatus;
  journey_step?: string;
  consent_status?: string;
}, database = db) {
  const [existing] = await database.select().from(userIntakes).where(eq(userIntakes.id, input.intakeId)).limit(1);
  if (!existing) return null;

  const now = new Date();
  const [updated] = await database.update(userIntakes).set({
    status: input.status,
    journey_step: input.journey_step ?? existing.journey_step,
    consent_status: input.consent_status ?? existing.consent_status,
    activated_at: input.status === "active" ? now : existing.activated_at,
    dropped_at: input.status === "dropped" ? now : existing.dropped_at,
    last_activity_at: now,
    updated_at: now,
  }).where(eq(userIntakes.id, input.intakeId)).returning();

  await recordLifecycleEvent({
    intakeId: updated.id,
    userId: updated.user_id,
    eventType: "status_updated",
    fromStatus: existing.status,
    toStatus: updated.status,
  }, database);

  return updated;
}

export async function createAccessLink(input: AccessLinkCreateInput, baseUrl: string, database = db) {
  const data = {
    ...input,
    tier: normalizeSubscriptionTier(input.tier),
    link_type: input.link_type === "trial" || input.link_type === "unlimited"
      ? accessLinkTypeForTier(input.tier)
      : input.link_type,
  };
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000);
  const [link] = await database.insert(accessLinks).values({
    token,
    user_id: data.user_id ?? null,
    intake_id: data.intake_id ?? null,
    organization_id: data.organization_id ?? null,
    link_type: data.link_type,
    tier: data.tier,
    destination: data.destination,
    target_role: data.target_role,
    max_uses: data.max_uses,
    expires_at: expiresAt,
  }).returning();

  if (data.intake_id) {
    await database.update(userIntakes).set({
      status: "link_sent",
      journey_step: "access_link_created",
      link_sent_at: new Date(),
      updated_at: new Date(),
    }).where(eq(userIntakes.id, data.intake_id));
    await recordLifecycleEvent({ intakeId: data.intake_id, userId: data.user_id, eventType: "access_link_created", toStatus: "link_sent" }, database);
  }

  return { link, url: `${baseUrl}/access/${token}` };
}

export async function sendIntakeLink(intakeId: string, baseUrl: string, database = db) {
  const [intake] = await database.select().from(userIntakes).where(eq(userIntakes.id, intakeId)).limit(1);
  if (!intake) return null;

  const targetUserId = intake.user_type === "family" ? intake.family_user_id : intake.elder_user_id;
  const token = randomBytes(32).toString("base64url");
  const destination = intake.user_type === "family" ? "/caregiver" : "/onboarding";
  const [link] = await database.insert(accessLinks).values({
    token,
    user_id: targetUserId ?? intake.user_id,
    intake_id: intake.id,
    organization_id: intake.organization_id,
    link_type: accessLinkTypeForTier(intake.tier),
    tier: intake.tier,
    destination,
    target_role: intake.user_type,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  }).returning();
  const url = `${baseUrl}/access/${token}`;
  const channel = channelForIntakeLink(intake);
  const recipient = channel === "email" ? normalizeEmail(intake.email) : intake.phone;

  const [communication] = await database.insert(communicationsLog).values({
    intake_id: intake.id,
    user_id: targetUserId ?? intake.user_id,
    channel,
    recipient,
    purpose: "send_app_link",
    status: "queued",
    body: `VYVA: aqui tiene su enlace seguro para continuar: ${url}`,
    metadata: { url },
  }).returning();

  await database.update(userIntakes).set({
    status: "link_sent",
    journey_step: "link_sent",
    link_sent_at: new Date(),
    last_activity_at: new Date(),
    updated_at: new Date(),
  }).where(eq(userIntakes.id, intake.id));
  await recordLifecycleEvent({ intakeId: intake.id, userId: targetUserId, eventType: "link_sent", fromStatus: intake.status, toStatus: "link_sent", channel }, database);

  return { link, url, communication };
}

async function createQueuedLinkCommunication(input: {
  intake: Intake;
  userId: string | null;
  recipient: string;
  channel: string;
  role: string;
  destination: string;
  purpose: string;
  baseUrl: string;
}, database = db) {
  const token = randomBytes(32).toString("base64url");
  const [link] = await database.insert(accessLinks).values({
    token,
    user_id: input.userId ?? input.intake.user_id,
    intake_id: input.intake.id,
    organization_id: input.intake.organization_id,
    link_type: input.role === "family" ? "caregiver" : accessLinkTypeForTier(input.intake.tier),
    tier: input.intake.tier,
    destination: input.destination,
    target_role: input.role,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  }).returning();
  const url = `${input.baseUrl}/access/${token}`;

  const [communication] = await database.insert(communicationsLog).values({
    intake_id: input.intake.id,
    user_id: input.userId ?? input.intake.user_id,
    channel: input.channel,
    recipient: input.recipient,
    purpose: input.purpose,
    status: "queued",
    body: input.role === "family"
      ? `VYVA: elder consent is approved. Your caregiver dashboard link: ${url}`
      : `VYVA: consent is approved. Your secure app link: ${url}`,
    metadata: { url, target_role: input.role },
  }).returning();

  return { link, url, communication };
}

export async function sendApprovedFamilyLinks(intakeId: string, baseUrl = publicBaseUrl(), database = db) {
  const [intake] = await database.select().from(userIntakes).where(eq(userIntakes.id, intakeId)).limit(1);
  if (!intake) return null;
  if (intake.status === "link_sent" && intake.journey_step === "dual_links_sent") {
    return { elder: null, caregiver: null, already_sent: true };
  }
  if (intake.user_type !== "family") return sendIntakeLink(intake.id, baseUrl, database);

  const elderPhone = elderPhoneForIntake(intake);
  const familyChannel = intake.entry_point === "whatsapp" ? "whatsapp" : "sms";
  const elderChannel = familyChannel;

  const [elder, caregiver] = await Promise.all([
    createQueuedLinkCommunication({
      intake,
      userId: intake.elder_user_id,
      recipient: elderPhone,
      channel: elderChannel,
      role: "elder",
      destination: "/onboarding",
      purpose: "send_elder_app_link",
      baseUrl,
    }, database),
    createQueuedLinkCommunication({
      intake,
      userId: intake.family_user_id,
      recipient: intake.phone,
      channel: familyChannel,
      role: "family",
      destination: "/caregiver",
      purpose: "send_caregiver_dashboard_link",
      baseUrl,
    }, database),
  ]);

  await database.update(userIntakes).set({
    status: "link_sent",
    journey_step: "dual_links_sent",
    link_sent_at: new Date(),
    last_activity_at: new Date(),
    updated_at: new Date(),
  }).where(eq(userIntakes.id, intake.id));

  await recordLifecycleEvent({
    intakeId: intake.id,
    userId: intake.family_user_id,
    eventType: "dual_links_sent",
    fromStatus: intake.status,
    toStatus: "link_sent",
    channel: familyChannel,
  }, database);

  return { elder, caregiver };
}

export async function listConsentAttempts(database = db) {
  const rows = await database
    .select({ attempt: consentAttempts, intake: userIntakes })
    .from(consentAttempts)
    .leftJoin(userIntakes, eq(consentAttempts.intake_id, userIntakes.id))
    .orderBy(desc(consentAttempts.created_at))
    .limit(100);
  return rows.map((row) => ({ ...row.attempt, intake: row.intake }));
}

export async function queueConsentCallForAttempt(attemptId: string, database = db) {
  const [attempt] = await database.select().from(consentAttempts).where(eq(consentAttempts.id, attemptId)).limit(1);
  if (!attempt?.intake_id) return null;
  if (attempt.status !== "pending") return null;
  if (attempt.source_session_id) return null;
  if (attempt.scheduled_at && attempt.scheduled_at > new Date()) return null;

  const [intake] = await database.select().from(userIntakes).where(eq(userIntakes.id, attempt.intake_id)).limit(1);
  if (!intake) return null;

  const recipient = elderPhoneForIntake(intake);
  const [communication] = await database.insert(communicationsLog).values({
    intake_id: intake.id,
    user_id: intake.elder_user_id,
    channel: "voice",
    recipient,
    purpose: "elder_consent_call",
    status: "queued",
    body: "VYVA consent call for family caregiver access.",
    metadata: {
      consent_attempt_id: attempt.id,
      consent_attempt_number: attempt.attempt_number,
      voice_url: consentVoiceUrl(attempt.id),
    },
  }).returning();

  await database.update(consentAttempts).set({
    source_session_id: communication.id,
  }).where(eq(consentAttempts.id, attempt.id));

  await database.update(userIntakes).set({
    status: "consent_pending",
    consent_status: "pending",
    journey_step: attempt.attempt_number > 1 ? "consent_retry_queued" : "consent_call_queued",
    updated_at: new Date(),
  }).where(eq(userIntakes.id, intake.id));

  await recordLifecycleEvent({
    intakeId: intake.id,
    userId: intake.elder_user_id,
    eventType: attempt.attempt_number > 1 ? "consent_retry_queued" : "consent_call_queued",
    toStatus: "consent_pending",
    channel: "voice",
    metadata: { attempt_id: attempt.id, attempt_number: attempt.attempt_number },
  }, database);

  return communication;
}

export async function queueDueConsentCalls(limit = 25, database = db) {
  const dueAttempts = await database
    .select()
    .from(consentAttempts)
    .where(and(
      eq(consentAttempts.status, "pending"),
      isNull(consentAttempts.source_session_id),
      lte(consentAttempts.scheduled_at, new Date()),
    ))
    .orderBy(desc(consentAttempts.created_at))
    .limit(limit);

  const queued = [];
  for (const attempt of dueAttempts) {
    const communication = await queueConsentCallForAttempt(attempt.id, database);
    if (communication) queued.push(communication);
  }
  return queued;
}

export async function triggerConsentAttempt(intakeId: string, database = db) {
  const [intake] = await database.select().from(userIntakes).where(eq(userIntakes.id, intakeId)).limit(1);
  if (!intake) return null;

  const [{ count }] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(consentAttempts)
    .where(eq(consentAttempts.intake_id, intake.id));

  const [attempt] = await database.insert(consentAttempts).values({
    intake_id: intake.id,
    elder_user_id: intake.elder_user_id,
    family_user_id: intake.family_user_id,
    attempt_number: (count ?? 0) + 1,
    status: "pending",
    channel: "voice",
    scheduled_at: new Date(),
  }).returning();
  await queueConsentCallForAttempt(attempt.id, database);
  await recordLifecycleEvent({ intakeId: intake.id, userId: intake.elder_user_id, eventType: "consent_triggered", toStatus: "consent_pending", channel: "voice" }, database);

  return attempt;
}

async function scheduleConsentRetry(attempt: ConsentAttempt, database = db) {
  if (!attempt.intake_id) return null;
  if (attempt.attempt_number >= maxConsentAttempts()) return null;

  const scheduledAt = nextConsentRetryAt(attempt.attempt_number);
  if (!scheduledAt) return null;

  const [retry] = await database.insert(consentAttempts).values({
    intake_id: attempt.intake_id,
    elder_user_id: attempt.elder_user_id,
    family_user_id: attempt.family_user_id,
    attempt_number: attempt.attempt_number + 1,
    status: "pending",
    channel: "voice",
    scheduled_at: scheduledAt,
    result_payload: {
      retry_after_attempt_id: attempt.id,
      retry_after_status: attempt.status,
    },
  }).returning();

  await database.update(userIntakes).set({
    status: "consent_pending",
    consent_status: "pending",
    journey_step: "consent_retry_scheduled",
    updated_at: new Date(),
  }).where(eq(userIntakes.id, attempt.intake_id));

  await recordLifecycleEvent({
    intakeId: attempt.intake_id,
    userId: attempt.elder_user_id,
    eventType: "consent_retry_scheduled",
    toStatus: "consent_pending",
    channel: "voice",
    metadata: {
      previous_attempt_id: attempt.id,
      next_attempt_id: retry.id,
      next_attempt_number: retry.attempt_number,
      scheduled_at: scheduledAt.toISOString(),
    },
  }, database);

  return retry;
}

export async function recordConsentResult(input: {
  attemptId: string;
  status: ConsentStatus;
  source_session_id?: string;
  result_payload?: Record<string, unknown>;
  baseUrl?: string;
}, database = db) {
  const [attempt] = await database.select().from(consentAttempts).where(eq(consentAttempts.id, input.attemptId)).limit(1);
  if (!attempt) return null;
  if (attempt.status !== "pending") return { attempt, links: null };

  const [updatedAttempt] = await database.update(consentAttempts).set({
    status: input.status,
    completed_at: new Date(),
    source_session_id: input.source_session_id ?? attempt.source_session_id,
    result_payload: input.result_payload ?? {},
  }).where(eq(consentAttempts.id, attempt.id)).returning();

  const retry = input.status === "no_answer" || input.status === "failed"
    ? await scheduleConsentRetry(updatedAttempt, database)
    : null;
  let links: Awaited<ReturnType<typeof sendApprovedFamilyLinks>> | null = null;

  if (attempt.intake_id) {
    const exhaustedRetries = (input.status === "no_answer" || input.status === "failed") && !retry;
    const nextStatus = input.status === "approved"
      ? "created"
      : input.status === "rejected" || exhaustedRetries
        ? "dropped"
        : "consent_pending";
    await database.update(userIntakes).set({
      status: nextStatus,
      consent_status: input.status,
      journey_step: input.status === "approved"
        ? "consent_approved_send_links"
        : exhaustedRetries
          ? `consent_${input.status}_max_attempts`
          : retry
            ? "consent_retry_scheduled"
            : `consent_${input.status}`,
      updated_at: new Date(),
      dropped_at: input.status === "rejected" || exhaustedRetries ? new Date() : null,
    }).where(eq(userIntakes.id, attempt.intake_id));
    await recordLifecycleEvent({
      intakeId: attempt.intake_id,
      userId: attempt.elder_user_id,
      eventType: "consent_result",
      toStatus: nextStatus,
      metadata: {
        consent_status: input.status,
        retry_attempt_id: retry?.id ?? null,
        max_attempts_reached: exhaustedRetries,
      },
    }, database);

    if (input.status === "approved") {
      links = await sendApprovedFamilyLinks(attempt.intake_id, input.baseUrl ?? publicBaseUrl(), database);
    }
  }

  return { attempt: updatedAttempt, links };
}

export async function listOrganizations(database = db) {
  return database.select().from(organizations).orderBy(desc(organizations.created_at));
}

export async function createOrganization(input: {
  name: string;
  slug?: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  default_tier: string;
}, database = db) {
  const data = { ...input, default_tier: normalizeSubscriptionTier(input.default_tier) };
  const [org] = await database.insert(organizations).values({
    name: data.name,
    slug: data.slug ? slugify(data.slug) : slugify(data.name),
    contact_name: data.contact_name ?? null,
    contact_email: data.contact_email || null,
    contact_phone: data.contact_phone ?? null,
    default_tier: data.default_tier,
  }).returning();
  return org;
}

export async function setOrganizationActive(organizationId: string, isActive: boolean, database = db) {
  const [org] = await database
    .update(organizations)
    .set({ is_active: isActive, updated_at: new Date() })
    .where(eq(organizations.id, organizationId))
    .returning();

  if (!org) return null;

  await recordLifecycleEvent({
    eventType: isActive ? "organization_restored" : "organization_archived",
    metadata: { organization_id: org.id, organization_name: org.name },
  }, database);

  return org;
}

function normalizeBulkRow(row: BulkRowInput, defaultTier: string) {
  const fromName = splitName(row.name ?? "");
  const firstName = (row.first_name ?? "").trim() || fromName.firstName;
  const lastName = (row.last_name ?? "").trim() || fromName.lastName;
  const fullName = `${firstName} ${lastName}`.trim() || (row.name ?? "").trim();
  const phone = normalizePhone(row.phone ?? "");
  const whatsapp = (row.whatsapp ?? "").trim() ? normalizePhone(row.whatsapp ?? "") : phone;
  const language = (row.language ?? "").trim() || "es";
  const timezone = (row.timezone ?? "").trim() || "Europe/Madrid";
  const tier = normalizeSubscriptionTier((row.tier ?? "").trim() || defaultTier || "free");

  return {
    first_name: firstName,
    last_name: lastName,
    name: fullName,
    preferred_name: (row.preferred_name ?? "").trim(),
    date_of_birth: (row.date_of_birth ?? "").trim(),
    gender: (row.gender ?? "").trim() || "prefer_not_to_say",
    phone,
    whatsapp,
    email: (row.email ?? "").trim(),
    language,
    timezone,
    user_type: row.user_type ?? "elder",
    tier,
  };
}

export async function buildBulkIntakePreview(organizationId: string, rows: BulkRowInput[], database = db) {
  const [org] = await database.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) return { error: "Organization not found" as const };

  const normalized = rows.map((row, index) => ({
    index,
    values: normalizeBulkRow(row, org.default_tier),
    errors: [] as string[],
  }));
  const seenPhones = new Map<string, number>();
  const phones = Array.from(new Set(normalized.map((row) => row.values.phone).filter(Boolean)));
  const existingPhones = new Set(
    phones.length
      ? (await database
        .select({ phone: userIntakes.phone })
        .from(userIntakes)
        .where(inArray(userIntakes.phone, phones))).map((row) => row.phone)
      : []
  );

  for (const row of normalized) {
    if (!row.values.first_name) row.errors.push("First name is required");
    if (!row.values.last_name) row.errors.push("Last name is required");
    if (!row.values.phone) row.errors.push("Phone is required");
    if (row.values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.values.email)) row.errors.push("Email is invalid");
    if (!["elder", "family", "admin"].includes(row.values.user_type)) row.errors.push("User type must be elder, family, or admin");

    if (row.values.phone) {
      const firstSeen = seenPhones.get(row.values.phone);
      if (firstSeen !== undefined) {
        row.errors.push(`Duplicate phone in file, first seen on row ${firstSeen + 1}`);
      } else {
        seenPhones.set(row.values.phone, row.index);
      }

      if (existingPhones.has(row.values.phone)) row.errors.push("Phone already exists in lifecycle intakes");
    }
  }

  return {
    organization: org,
    rows: normalized.map((row) => ({
      index: row.index,
      row_number: row.index + 1,
      valid: row.errors.length === 0,
      errors: row.errors,
      values: row.values,
    })),
  };
}

export async function importBulkIntakes(input: {
  organizationId: string;
  rows: BulkRowInput[];
  sendLinks: boolean;
  baseUrl: string;
}) {
  const preview = await buildBulkIntakePreview(input.organizationId, input.rows);
  if ("error" in preview) return preview;

  const skipped = preview.rows.filter((row) => !row.valid);

  return db.transaction(async (tx) => {
    const database = tx as Database;
    const imported = [];
    const links = [];

    for (const row of preview.rows.filter((item) => item.valid)) {
      const values = row.values;
      const requiresConsent = values.user_type === "family";
      const shouldSendLink = input.sendLinks && !requiresConsent;
      const user = await ensurePasswordlessUser({
        name: values.name,
        phone: values.phone,
        email: values.email || null,
        tier: values.tier,
        organizationId: preview.organization.id,
        profile: {
          first_name: values.first_name,
          last_name: values.last_name,
          preferred_name: values.preferred_name,
          date_of_birth: values.date_of_birth,
          gender: values.gender,
          phone_number: values.phone,
          whatsapp_number: values.whatsapp,
          email: values.email,
          language: values.language,
          timezone: values.timezone,
        },
      }, database);

      const [intake] = await database.insert(userIntakes).values({
        user_id: user.id,
        elder_user_id: values.user_type === "elder" ? user.id : null,
        family_user_id: values.user_type === "family" ? user.id : null,
        name: values.name,
        phone: values.phone,
        email: values.email || null,
        user_type: values.user_type,
        entry_point: "admin",
        organization_id: preview.organization.id,
        tier: values.tier,
        status: requiresConsent ? "consent_pending" : shouldSendLink ? "link_sent" : "created",
        journey_step: requiresConsent ? "bulk_import_consent_required" : shouldSendLink ? "bulk_import_link_sent" : "bulk_import_created",
        consent_status: requiresConsent ? "pending" : "not_required",
        source_payload: { bulk_import: true, row_number: row.row_number },
        metadata: {
          first_name: values.first_name,
          last_name: values.last_name,
          preferred_name: values.preferred_name,
          date_of_birth: values.date_of_birth,
          gender: values.gender,
          whatsapp_number: values.whatsapp,
          language: values.language,
          timezone: values.timezone,
          import_source: "organization_csv",
        },
        link_sent_at: shouldSendLink ? new Date() : null,
        last_activity_at: new Date(),
      }).returning();

      await recordLifecycleEvent({
        intakeId: intake.id,
        userId: user.id,
        eventType: "bulk_intake_imported",
        toStatus: intake.status,
        channel: "admin",
        metadata: { organization_id: preview.organization.id, row_number: row.row_number },
      }, database);

      imported.push(intake);

      if (shouldSendLink) {
        const token = randomBytes(32).toString("base64url");
        const destination = values.user_type === "family" ? "/caregiver" : "/onboarding";
        const [link] = await database.insert(accessLinks).values({
          token,
          user_id: user.id,
          intake_id: intake.id,
          organization_id: preview.organization.id,
          link_type: accessLinkTypeForTier(values.tier),
          tier: values.tier,
          destination,
          target_role: values.user_type,
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        }).returning();
        const url = `${input.baseUrl}/access/${token}`;

        await database.insert(communicationsLog).values({
          intake_id: intake.id,
          user_id: user.id,
          channel: "sms",
          recipient: values.phone,
          purpose: "bulk_send_app_link",
          status: "queued",
          body: `VYVA: here is your secure link to continue: ${url}`,
          metadata: { url, organization_id: preview.organization.id },
        });

        links.push({ intake_id: intake.id, link_id: link.id, url });
      }
    }

    return {
      imported,
      links,
      skipped,
      summary: {
        imported: imported.length,
        skipped: skipped.length,
        links_queued: links.length,
      },
    };
  });
}
