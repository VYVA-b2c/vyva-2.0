import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { scrypt, randomBytes, randomUUID } from "crypto";
import { promisify } from "util";
import { z } from "zod";
import { db } from "../db.js";
import { accessLinks, communicationsLog, lifecycleEvents, onboardingState, profileMemberships, profiles, teamInvitations, userIntakes, users } from "../../shared/schema.js";
import { signMagicLoginToken, verifyMagicLoginToken } from "../lib/jwt.js";
import { authMiddleware } from "../middleware/auth.js";
import { sendMagicLoginEmail, sendPasswordResetEmail } from "../lib/email.js";
import { getActiveProfileContext, isMissingAccountProfileLinkColumnError, type ActiveProfileContext } from "../lib/profileAccess.js";
import { getSupabaseConfig } from "../lib/supabaseAuth.js";
import { clearAuthSessionCookie, issueAuthSessionCookie } from "../lib/sessionCookie.js";
import { premiumTrialProfilePatch } from "../lib/premiumTrial.js";
import { isProductionRuntime } from "../lib/requestEnvironment.js";
import { isRelationSchemaUnavailableError } from "../lib/dbCompatibility.js";
import {
  upsertProfileMembershipToleratingMissingColumns,
  upsertProfileToleratingMissingColumns,
} from "../lib/profileWriteCompatibility.js";

const scryptAsync = promisify(scrypt);

const isDev = !isProductionRuntime();
const isProduction = isProductionRuntime();
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();
const emailSchema = z.string().trim().email();
const SUPPORTED_PROFILE_LANGUAGES = ["es", "en", "fr", "de", "it", "pt", "cy"] as const;
type ProfileLanguage = (typeof SUPPORTED_PROFILE_LANGUAGES)[number];

function getPublicAppUrl(req: Request): string | null {
  const configuredAppUrl = process.env.APP_URL?.trim();
  if (configuredAppUrl) {
    return configuredAppUrl.replace(/\/+$/, "");
  }

  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.get("host")?.trim();
  if (!host) return null;

  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || req.protocol || (isProduction ? "https" : "http");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function buildPublicAppLink(req: Request, path: string): string {
  const appUrl = getPublicAppUrl(req);
  if (!appUrl) {
    throw new Error("APP_URL is not configured and the request host could not be resolved.");
  }

  return `${appUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function isLocalRequest(req: Request): boolean {
  if (process.env.NODE_ENV === "test") return true;
  const host = (req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host") || "").toLowerCase();
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]") || host.startsWith("::1");
}

type ContactIdentifier = {
  email: string | null;
  phone: string | null;
  kind: "email" | "phone";
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = emailSchema.safeParse(trimmed);
  return parsed.success ? parsed.data.toLowerCase() : null;
}

function isSuperAdminEmail(value: unknown): boolean {
  return normalizeEmail(value) === SUPER_ADMIN_EMAIL;
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const startsInternational = trimmed.startsWith("+");
  const compact = trimmed.replace(/[^\d+]/g, "");
  const normalized = compact.startsWith("00")
    ? `+${compact.slice(2).replace(/\D/g, "")}`
    : startsInternational
      ? `+${compact.slice(1).replace(/\D/g, "")}`
      : compact.replace(/\D/g, "");
  const digitCount = normalized.replace(/\D/g, "").length;
  if (digitCount < 7 || digitCount > 15) return null;
  return normalized;
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeProfileLanguage(value: unknown): ProfileLanguage {
  if (typeof value !== "string") return "es";
  const raw = value.trim().toLowerCase().split("-")[0];
  return SUPPORTED_PROFILE_LANGUAGES.includes(raw as ProfileLanguage)
    ? raw as ProfileLanguage
    : "es";
}

function resolveProfileLanguage(profile?: { language?: string | null; language_preference?: string | null } | null): ProfileLanguage {
  return normalizeProfileLanguage(profile?.language_preference ?? profile?.language);
}

function resolveContactIdentifier(body: {
  email?: unknown;
  phone?: unknown;
  identifier?: unknown;
}): ContactIdentifier | null {
  const email = normalizeEmail(body.email);
  if (email) return { email, phone: null, kind: "email" };

  const phone = normalizePhone(body.phone);
  if (phone) return { email: null, phone, kind: "phone" };

  if (typeof body.identifier === "string") {
    const identifier = body.identifier.trim();
    if (!identifier) return null;
    if (identifier.includes("@")) {
      const identifierEmail = normalizeEmail(identifier);
      return identifierEmail ? { email: identifierEmail, phone: null, kind: "email" } : null;
    }
    const identifierPhone = normalizePhone(identifier);
    return identifierPhone ? { email: null, phone: identifierPhone, kind: "phone" } : null;
  }

  return null;
}

async function findUserByContact(contact: ContactIdentifier) {
  const whereClause = contact.kind === "email" && contact.email
    ? eq(users.email, contact.email)
    : eq(users.phone_number, contact.phone ?? "");

  const [user] = await db
    .select()
    .from(users)
    .where(whereClause)
    .limit(1);

  return user ?? null;
}

async function findUserById(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
}

async function getOrCreateAuthenticatedUser(userId: string, email?: unknown) {
  const existing = await findUserById(userId);
  if (existing) return existing;

  const normalizedEmail = normalizeEmail(email);
  const [created] = await db
    .insert(users)
    .values({
      id: userId,
      email: normalizedEmail,
      password_hash: "external:supabase",
    })
    .onConflictDoNothing()
    .returning();

  return created ?? await findUserById(userId);
}

async function getProfileRole(userId: string, fallbackEmail?: unknown): Promise<string> {
  const [profile] = await db
    .select({ role: profiles.role, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (isSuperAdminEmail(fallbackEmail) || isSuperAdminEmail(profile?.email)) return "admin";
  return profile?.role ?? "user";
}

async function getOrCreateAuthenticatedProfile(userId: string, email?: unknown) {
  const normalizedEmail = normalizeEmail(email);
  const role = isSuperAdminEmail(normalizedEmail) ? "admin" : "user";
  const trialPatch = premiumTrialProfilePatch();
  const [created] = await db
    .insert(profiles)
    .values({
      id: userId,
      email: normalizedEmail,
      role,
      ...trialPatch,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email: normalizedEmail,
        ...(role === "admin" ? { role } : {}),
        updated_at: new Date(),
      },
    })
    .returning({
      id: profiles.id,
      email: profiles.email,
      phone: profiles.phone_number,
      language: profiles.language,
      language_preference: profiles.language_preference,
      role: profiles.role,
    });

  if (created) return created;

  const [profile] = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      phone: profiles.phone_number,
      language: profiles.language,
      language_preference: profiles.language_preference,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return profile ?? null;
}

async function getUserProfileLanguage(
  userId: string,
  context?: ActiveProfileContext,
): Promise<ProfileLanguage> {
  const activeContext = context ?? await getActiveProfileContext(userId);
  if (!activeContext.profileId) return "es";

  const [profile] = await db
    .select({ language: profiles.language, language_preference: profiles.language_preference })
    .from(profiles)
    .where(eq(profiles.id, activeContext.profileId))
    .limit(1);

  return resolveProfileLanguage(profile);
}

async function authResponseUser(
  user: typeof users.$inferSelect,
  prevSeenAt: string | null,
  role = "user",
  languageOverride?: ProfileLanguage,
) {
  const context = await getActiveProfileContext(user.id);
  return {
    userId: user.id,
    email: user.email,
    phone: user.phone_number,
    language: languageOverride ?? await getUserProfileLanguage(user.id, context),
    activeProfileId: context.profileId,
    activeProfileRole: context.role,
    profileCount: context.profileCount,
    needsProfileSetup: context.needsProfileSetup,
    needsProfileSelection: context.needsProfileSelection,
    role,
    prevSeenAt,
  };
}

async function createInitialSignupProfile(
  user: typeof users.$inferSelect,
  setupFor: "self" | "someone_else",
  language: ProfileLanguage,
) {
  const isSelf = setupFor === "self";
  const profileId = isSelf ? user.id : randomUUID();
  const trialPatch = premiumTrialProfilePatch();
  const now = new Date();

  await upsertProfileToleratingMissingColumns({
    id: profileId,
    email: isSelf ? user.email : null,
    phone_number: isSelf ? user.phone_number : null,
    language,
    language_preference: language,
    onboarding_channel: isSelf ? "web_form" : "proxy_web",
    current_stage: "stage_1_identity",
    ...trialPatch,
  }, {
    ...(user.email ? { email: user.email } : {}),
    ...(user.phone_number ? { phone_number: user.phone_number } : {}),
    language,
    language_preference: language,
    onboarding_channel: isSelf ? "web_form" : "proxy_web",
    updated_at: now,
  }, "[auth/register]");

  const membershipSaved = await upsertProfileMembershipToleratingMissingColumns({
    user_id: user.id,
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
  }, "[auth/register]");

  if (!membershipSaved && !isSelf) {
    throw new Error("profile_memberships table is required for proxy profile setup");
  }

  try {
    await db
      .update(users)
      .set({
        active_profile_id: profileId,
        onboarding_intent: setupFor,
      })
      .where(eq(users.id, user.id));
  } catch (err) {
    if (!isMissingAccountProfileLinkColumnError(err)) throw err;
    console.warn("[auth/register] users profile link columns are missing; continuing with profile_memberships fallback.");
  }

  try {
    await db
      .insert(onboardingState)
      .values({ user_id: profileId })
      .onConflictDoNothing();
  } catch (err) {
    if (!isRelationSchemaUnavailableError(err, "onboarding_state")) throw err;
    console.warn("[auth/register] onboarding_state schema is unavailable; continuing without onboarding state seed.");
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return derived.toString("hex") === hash;
}

function friendlyAuthWriteError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("ENOTFOUND helium")) {
    return "Local database is not reachable from here. Test signup inside Replit, or use a reachable DATABASE_URL locally.";
  }
  if (
    message.includes("phone_number") ||
    message.includes("active_profile_id") ||
    message.includes("onboarding_intent") ||
    message.includes("does not exist")
  ) {
    if (!isProduction) {
      return "Account setup is not ready in this environment. Run npm run db:auth against the app database, restart the backend, and try again.";
    }
    return "We could not create the account right now. Please try again later or contact VYVA support.";
  }
  if (!isProduction) {
    return `Registration failed: ${message.slice(0, 240)}`;
  }
  return "Registration failed. Please try again.";
}

const registerSchema = z.object({
  email:      z.string().optional(),
  phone:      z.string().optional(),
  identifier: z.string().optional(),
  language:   z.string().optional(),
  invite_id:  z.string().trim().min(8).max(120).optional(),
  care_team_invite_token: z.string().trim().min(8).max(120).optional(),
  setup_for: z.enum(["self", "someone_else"]).optional(),
  password:   z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email:      z.string().optional(),
  phone:      z.string().optional(),
  identifier: z.string().optional(),
  password:   z.string().min(1),
});

const magicLinkRequestSchema = z.object({
  email:      z.string().optional(),
  phone:      z.string().optional(),
  identifier: z.string().optional(),
});

const magicLoginSchema = z.object({
  token: z.string().min(1, "Magic link token is required"),
});

const resetRequestSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const resetPasswordSchema = z.object({
  token:    z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const consumeAccessLinkSchema = z.object({
  token: z.string().min(16, "Access token is required"),
});

type CareTeamInviteRow = typeof teamInvitations.$inferSelect;
type CareTeamInvitePublicStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";

function careTeamInviteStatus(invitation: CareTeamInviteRow): CareTeamInvitePublicStatus {
  if (invitation.status === "pending" && new Date() > invitation.expires_at) return "expired";
  return invitation.status as CareTeamInvitePublicStatus;
}

function normalizedInviteContacts(invitation: CareTeamInviteRow) {
  return {
    invitedEmails: [
      normalizeEmail(invitation.invitee_email),
    ].filter((value): value is string => Boolean(value)),
    invitedPhones: [
      normalizePhone(invitation.invitee_phone),
      normalizePhone(invitation.invitee_whatsapp),
    ].filter((value): value is string => Boolean(value)),
  };
}

function invitedContactMatchesValues(input: {
  invitation: CareTeamInviteRow;
  emails?: Array<string | null | undefined>;
  phones?: Array<string | null | undefined>;
}) {
  const { invitedEmails, invitedPhones } = normalizedInviteContacts(input.invitation);

  if (invitedEmails.length === 0 && invitedPhones.length === 0) return true;

  const accountEmails = (input.emails ?? [])
    .map((email) => normalizeEmail(email))
    .filter((value): value is string => Boolean(value));
  const accountPhones = (input.phones ?? [])
    .map((phone) => normalizePhone(phone))
    .filter((value): value is string => Boolean(value));

  return (
    accountEmails.some((email) => invitedEmails.includes(email)) ||
    accountPhones.some((phone) => invitedPhones.includes(phone))
  );
}

function seniorDisplayName(profile?: Pick<(typeof profiles.$inferSelect), "full_name" | "preferred_name"> | null): string {
  return profile?.preferred_name?.trim() || profile?.full_name?.trim() || "Your VYVA member";
}

function requestedCareTeamPermissions(invitation: CareTeamInviteRow) {
  return {
    dailyDigest: invitation.can_receive_daily_digest,
    safetyAlerts: invitation.can_receive_safety_alerts,
    healthAlerts: invitation.can_receive_health_alerts,
    moodAlerts: invitation.can_receive_mood_alerts,
    medicationAlerts: invitation.can_receive_medication_alerts,
    dashboardAccess: invitation.can_view_dashboard,
    healthReports: invitation.can_view_health_reports,
    vitalSigns: invitation.can_view_vital_signs,
    journalSummaries: invitation.can_view_journal_summaries,
  };
}

function publicCareTeamInvitePayload(
  invitation: CareTeamInviteRow,
  senior?: Pick<(typeof profiles.$inferSelect), "full_name" | "preferred_name"> | null,
) {
  const status = careTeamInviteStatus(invitation);
  return {
    invite: {
      status,
      canAccept: status === "pending",
      seniorDisplayName: seniorDisplayName(senior),
      inviteeName: invitation.invitee_name,
      role: invitation.role,
      relationship: invitation.relationship,
      expiresAt: invitation.expires_at.toISOString(),
      acceptedAt: invitation.accepted_at?.toISOString() ?? null,
      requestedPermissions: requestedCareTeamPermissions(invitation),
    },
  };
}

function invitedContactMatchesAccount(input: {
  invitation: CareTeamInviteRow;
  user: typeof users.$inferSelect;
  requestUser?: Request["user"];
}) {
  return invitedContactMatchesValues({
    invitation: input.invitation,
    emails: [input.user.email, input.requestUser?.email],
    phones: [input.user.phone_number, input.requestUser?.phone],
  });
}

function profileMembershipRoleForInvite(role: CareTeamInviteRow["role"]): (typeof profileMemberships.$inferSelect)["role"] {
  if (role === "caregiver") return "caregiver";
  if (role === "doctor" || role === "gp") return "doctor";
  return "family";
}

function careTeamMembershipPermissions(invitation: CareTeamInviteRow) {
  return {
    care_team: requestedCareTeamPermissions(invitation),
    caregiver_dashboard: {
      view: invitation.can_view_dashboard,
      healthReports: invitation.can_view_health_reports,
      vitalSigns: invitation.can_view_vital_signs,
      journalSummaries: invitation.can_view_journal_summaries,
    },
  };
}

class RouteHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RouteHttpError";
    this.status = status;
  }
}

const signupInviteTrackSchema = z.object({
  invite_id: z.string().trim().min(8).max(120),
  event: z.enum(["clicked", "profile_started", "profile_created", "profile_completed"]),
  destination: z.string().trim().max(200).optional(),
});

/** Token lifetime: 1 hour */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const authRouter = Router();

authRouter.get("/supabase-config", (_req: Request, res: Response) => {
  const config = getSupabaseConfig();
  if (!config) return res.status(404).json({ configured: false });
  return res.json({ configured: true, url: config.url, anonKey: config.anonKey });
});

const signupInviteEventType: Record<z.infer<typeof signupInviteTrackSchema>["event"], string> = {
  clicked: "signup_invite_clicked",
  profile_started: "signup_invite_profile_started",
  profile_created: "signup_invite_profile_created",
  profile_completed: "signup_invite_profile_completed",
};

const signupInviteJourneyRank: Record<string, number> = {
  signup_invite_sent: 1,
  signup_invite_clicked: 2,
  signup_invite_profile_started: 3,
  signup_invite_profile_created: 4,
  signup_invite_profile_completed: 5,
};

function strongestSignupInviteStep(currentStep: string | null | undefined, nextStep: string) {
  const currentRank = signupInviteJourneyRank[currentStep ?? ""] ?? 0;
  const nextRank = signupInviteJourneyRank[nextStep] ?? 0;
  return nextRank >= currentRank ? nextStep : currentStep ?? nextStep;
}

async function intakeForSignupInvite(inviteId: string) {
  const [communication] = await db
    .select()
    .from(communicationsLog)
    .where(sql`${communicationsLog.metadata}->>'invite_id' = ${inviteId}`)
    .orderBy(desc(communicationsLog.created_at))
    .limit(1);

  if (communication?.intake_id) {
    const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, communication.intake_id)).limit(1);
    if (intake) return { intake, communication };
  }

  const [intake] = await db
    .select()
    .from(userIntakes)
    .where(sql`${userIntakes.metadata}->>'latest_invite_id' = ${inviteId}`)
    .orderBy(desc(userIntakes.updated_at))
    .limit(1);

  return { intake: intake ?? null, communication: communication ?? null };
}

async function recordSignupInviteAudit(input: {
  inviteId: string;
  event: z.infer<typeof signupInviteTrackSchema>["event"];
  destination?: string | null;
  userId?: string | null;
  language?: string | null;
}) {
  const { intake, communication } = await intakeForSignupInvite(input.inviteId);
  if (!intake && !communication) return { tracked: false };

  const now = new Date();
  const eventType = signupInviteEventType[input.event];
  const userId = input.userId ?? intake?.user_id ?? intake?.elder_user_id ?? intake?.family_user_id ?? null;
  const status = intake?.status === "active" || input.event === "profile_completed"
    ? "active"
    : intake?.status === "created"
      ? "link_sent"
      : intake?.status ?? "link_sent";

  if (intake) {
    const metadata = jsonRecord(intake.metadata);
    const caregiverInvite = intake.user_type === "family" || metadata.invite_type === "caregiver";
    await db.update(userIntakes).set({
      user_id: userId ?? intake.user_id,
      elder_user_id: caregiverInvite ? intake.elder_user_id : userId ?? intake.elder_user_id,
      family_user_id: caregiverInvite ? userId ?? intake.family_user_id : intake.family_user_id,
      status,
      journey_step: strongestSignupInviteStep(intake.journey_step, eventType),
      activated_at: status === "active" ? now : intake.activated_at,
      last_activity_at: now,
      updated_at: now,
      metadata: {
        ...metadata,
        latest_invite_id: input.inviteId,
        latest_invite_event: eventType,
        ...(input.language ? { invite_language: input.language } : {}),
      },
    }).where(eq(userIntakes.id, intake.id));

    const [existingEvent] = await db
      .select({ id: lifecycleEvents.id })
      .from(lifecycleEvents)
      .where(and(
        eq(lifecycleEvents.intake_id, intake.id),
        eq(lifecycleEvents.event_type, eventType),
        sql`${lifecycleEvents.metadata}->>'invite_id' = ${input.inviteId}`,
      ))
      .limit(1);

    if (!existingEvent) {
      await db.insert(lifecycleEvents).values({
        intake_id: intake.id,
        user_id: userId,
        event_type: eventType,
        from_status: intake.status,
        to_status: status,
        channel: communication?.channel ?? "invite",
        metadata: {
          invite_id: input.inviteId,
          destination: input.destination ?? null,
          communication_id: communication?.id ?? null,
        },
      });
    }
  }

  return { tracked: Boolean(intake), intake_id: intake?.id ?? null };
}

async function validateCareTeamInviteForRegistration(token: string, contact: ContactIdentifier) {
  const [invitation] = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.invite_token, token))
    .limit(1);

  if (!invitation) {
    throw new RouteHttpError(404, "This care-team invitation is invalid.");
  }

  if (invitation.status === "accepted") {
    throw new RouteHttpError(409, "This invitation has already been accepted.");
  }

  const status = careTeamInviteStatus(invitation);
  if (status === "expired" || status === "revoked" || status === "declined") {
    if (status === "expired" && invitation.status === "pending") {
      await db
        .update(teamInvitations)
        .set({ status: "expired", updated_at: new Date() })
        .where(eq(teamInvitations.id, invitation.id));
    }
    throw new RouteHttpError(410, "This invitation link is no longer active.");
  }

  if (!invitedContactMatchesValues({
    invitation,
    emails: [contact.email],
    phones: [contact.phone],
  })) {
    throw new RouteHttpError(403, "Please create or sign in with the invited email or mobile number.");
  }

  return invitation;
}

authRouter.post("/signup-invite/track", async (req: Request, res: Response) => {
  const parsed = signupInviteTrackSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(204).end();

  try {
    const result = await recordSignupInviteAudit({
      inviteId: parsed.data.invite_id,
      event: parsed.data.event,
      destination: parsed.data.destination,
    });
    return res.json(result);
  } catch (error) {
    console.warn("[auth/signup-invite/track] skipped invite audit", error);
    return res.status(204).end();
  }
});

/**
 * POST /api/auth/register
 * Creates a new user account and an empty profile, returns a signed JWT.
 */
authRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid request";
    return res.status(400).json({ error: msg });
  }

  const { password } = parsed.data;
  const language = normalizeProfileLanguage(parsed.data.language ?? req.language);
  const contact = resolveContactIdentifier(parsed.data);
  if (!contact) {
    return res.status(400).json({ error: "Please enter a valid email address or mobile number." });
  }

  try {
    const existing = await findUserByContact(contact);

    if (existing) {
      return res.status(409).json({
        error: contact.kind === "phone"
          ? "An account with this mobile number already exists."
          : "An account with this email already exists.",
      });
    }

    const careTeamInvite = parsed.data.care_team_invite_token
      ? await validateCareTeamInviteForRegistration(parsed.data.care_team_invite_token, contact)
      : null;

    const password_hash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({ email: contact.email, phone_number: contact.phone, password_hash })
      .returning();

    if (careTeamInvite) {
      await db
        .update(users)
        .set({ onboarding_intent: "someone_else" })
        .where(eq(users.id, user.id));
    } else if (parsed.data.setup_for) {
      await createInitialSignupProfile(user, parsed.data.setup_for, language);
    }

    if (parsed.data.invite_id) {
      try {
        await recordSignupInviteAudit({
          inviteId: parsed.data.invite_id,
          event: "profile_created",
          destination: "/",
          userId: user.id,
          language,
        });
      } catch (auditError) {
        console.warn("[auth/register] skipped signup invite audit", auditError);
      }
    }

    const token = await issueAuthSessionCookie(res, user.id);
    return res.status(201).json({ token, ...(await authResponseUser(user, null, "user", language)) });
  } catch (err) {
    if (err instanceof RouteHttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[auth/register]", err);
    return res.status(500).json({ error: friendlyAuthWriteError(err) });
  }
});

/**
 * POST /api/auth/login
 * Verifies credentials and returns a signed JWT.
 */
authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid sign-in details" });
  }

  const { password } = parsed.data;
  const contact = resolveContactIdentifier(parsed.data);
  if (!contact) {
    return res.status(400).json({ error: "Please enter a valid email address or mobile number." });
  }

  const user = await findUserByContact(contact);

  const ok = user ? await checkPassword(password, user.password_hash) : false;

  if (!user || !ok) {
    return res.status(401).json({ error: "Incorrect email, mobile number, or password." });
  }

  const prevSeenAt = user.last_seen_at ? user.last_seen_at.toISOString() : null;

  await db
    .update(users)
    .set({ last_seen_at: new Date() })
    .where(eq(users.id, user.id));

  const token = await issueAuthSessionCookie(res, user.id);
  return res.json({
    token,
    ...(await authResponseUser(
      user,
      prevSeenAt,
      await getProfileRole(user.id, user.email),
    )),
  });
});

/**
 * GET /api/auth/me
 * Returns the current user's id and email. Requires a valid JWT.
 */
authRouter.get("/me", authMiddleware, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    if (req.user.authProvider === "supabase") {
      const profile = await getOrCreateAuthenticatedProfile(req.user.id, req.user.email);
      if (!profile) {
        return res.status(401).json({ error: "User not found" });
      }

      const token = await issueAuthSessionCookie(res, profile.id);

      return res.json({
        id: profile.id,
        token,
        email: profile.email ?? (typeof req.user.email === "string" ? req.user.email : null),
        phone: profile.phone ?? null,
        activeProfileId: profile.id,
        activeProfileRole: "elder",
        profileCount: 1,
        needsProfileSetup: false,
        needsProfileSelection: false,
        language: resolveProfileLanguage(profile),
        role: isSuperAdminEmail(profile.email) || isSuperAdminEmail(req.user.email) ? "admin" : profile.role ?? "user",
        prevSeenAt: null,
      });
    }

    const user = await getOrCreateAuthenticatedUser(req.user.id, req.user.email);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const prevSeenAt = user.last_seen_at ? user.last_seen_at.toISOString() : null;

    await db
      .update(users)
      .set({ last_seen_at: new Date() })
      .where(eq(users.id, user.id));

    const token = await issueAuthSessionCookie(res, user.id);

    return res.json({
      ...(await authResponseUser(
        user,
        prevSeenAt,
        await getProfileRole(user.id, user.email ?? req.user.email),
      )),
      id: user.id,
      token,
    });
  } catch (err) {
    console.error("[auth/me]", err);
    return res.status(500).json({ error: "Could not load your account" });
  }
});

authRouter.post("/logout", (_req: Request, res: Response) => {
  clearAuthSessionCookie(res);
  return res.json({ ok: true });
});

/**
 * POST /api/auth/magic-link-request
 * Sends a short-lived sign-in link. The response stays generic so people
 * cannot probe whether an email or phone number has an account.
 */
authRouter.post("/magic-link-request", async (req: Request, res: Response) => {
  const parsed = magicLinkRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please enter a valid email address or mobile number." });
  }

  const contact = resolveContactIdentifier(parsed.data);
  if (!contact) {
    return res.status(400).json({ error: "Please enter a valid email address or mobile number." });
  }

  const genericOk: Record<string, unknown> = {
    message: "If an account exists, a secure sign-in link has been sent.",
  };

  const user = await findUserByContact(contact);
  if (!user) {
    return res.json(genericOk);
  }

  const magicToken = await signMagicLoginToken(user.id);
  let magicLink: string;
  try {
    magicLink = buildPublicAppLink(req, `/login?magic_token=${encodeURIComponent(magicToken)}`);
  } catch (err) {
    console.error("[auth] Failed to build magic login link:", err);
    return res.status(500).json({ error: "Could not prepare sign-in link. Please try again later." });
  }

  if (user.email) {
    try {
      await sendMagicLoginEmail({ to: user.email, magicLink, allowDevelopmentLog: isLocalRequest(req) });
    } catch (err) {
      console.error("[auth] Failed to send magic login email:", err);
      return res.status(500).json({ error: "Failed to send sign-in link. Please try again later." });
    }
  } else if (isDev) {
    console.log("[auth:dev] Magic login link for phone-only account:", magicLink);
  }

  return res.json(genericOk);
});

/**
 * POST /api/auth/magic-login
 * Exchanges a valid magic link token for the normal app JWT.
 */
authRouter.post("/magic-login", async (req: Request, res: Response) => {
  const parsed = magicLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid magic link" });
  }

  const userId = await verifyMagicLoginToken(parsed.data.token);
  if (!userId) {
    return res.status(401).json({ error: "This sign-in link is invalid or expired." });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return res.status(401).json({ error: "This sign-in link is invalid or expired." });
  }

  const prevSeenAt = user.last_seen_at ? user.last_seen_at.toISOString() : null;
  await db
    .update(users)
    .set({ last_seen_at: new Date() })
    .where(eq(users.id, user.id));

  const token = await issueAuthSessionCookie(res, user.id);
  return res.json({
    token,
    ...(await authResponseUser(
      user,
      prevSeenAt,
      await getProfileRole(user.id),
    )),
  });
});

/**
 * GET /api/auth/careteam-invites/:token
 * Public, non-sensitive preview for a care-team invitation claim link.
 */
authRouter.get("/careteam-invites/:token", async (req: Request, res: Response) => {
  const token = typeof req.params.token === "string" ? req.params.token.trim() : "";
  if (!token) {
    return res.status(404).json({ error: "This care-team invitation is invalid." });
  }

  try {
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.invite_token, token))
      .limit(1);

    if (!invitation) {
      return res.status(404).json({ error: "This care-team invitation is invalid." });
    }

    const [senior] = await db
      .select({
        full_name: profiles.full_name,
        preferred_name: profiles.preferred_name,
      })
      .from(profiles)
      .where(eq(profiles.id, invitation.senior_id))
      .limit(1);

    const payload = publicCareTeamInvitePayload(invitation, senior);
    const status = payload.invite.status;
    if (status === "expired" || status === "revoked" || status === "declined") {
      return res.status(410).json({ error: "This invitation link is no longer active.", ...payload });
    }
    if (status === "accepted") {
      return res.status(409).json({ error: "This invitation has already been accepted.", ...payload });
    }

    return res.json(payload);
  } catch (err) {
    console.error("[auth/careteam-invites:get]", err);
    return res.status(500).json({ error: "Could not load this invitation" });
  }
});

/**
 * POST /api/auth/careteam-invites/:token/accept
 * Claims a pending invitation for the signed-in caregiver account.
 */
authRouter.post("/careteam-invites/:token/accept", authMiddleware, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Please sign in or create an account to accept this invitation." });
  }

  const token = typeof req.params.token === "string" ? req.params.token.trim() : "";
  if (!token) {
    return res.status(404).json({ error: "This care-team invitation is invalid." });
  }

  try {
    const authenticatedUser = await getOrCreateAuthenticatedUser(req.user.id, req.user.email);
    if (!authenticatedUser) {
      return res.status(401).json({ error: "Please sign in or create an account to accept this invitation." });
    }

    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.invite_token, token))
      .limit(1);

    if (!invitation) {
      return res.status(404).json({ error: "This care-team invitation is invalid." });
    }

    if (invitation.status === "accepted") {
      if (invitation.accepted_user_id === authenticatedUser.id) {
        await db.update(users).set({ active_profile_id: invitation.senior_id }).where(eq(users.id, authenticatedUser.id));
        return res.json({
          ok: true,
          status: "accepted",
          alreadyAccepted: true,
          seniorProfileId: invitation.senior_id,
          destination: "/caregiver",
        });
      }

      return res.status(409).json({ error: "This invitation has already been accepted by another account." });
    }

    const status = careTeamInviteStatus(invitation);
    if (status === "expired" || status === "revoked" || status === "declined") {
      if (status === "expired" && invitation.status === "pending") {
        await db
          .update(teamInvitations)
          .set({ status: "expired", updated_at: new Date() })
          .where(eq(teamInvitations.id, invitation.id));
      }
      return res.status(410).json({ error: "This invitation link is no longer active." });
    }

    if (!invitedContactMatchesAccount({ invitation, user: authenticatedUser, requestUser: req.user })) {
      return res.status(403).json({ error: "Please sign in with the invited email or mobile number." });
    }

    const now = new Date();
    const outcome = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(teamInvitations)
        .where(eq(teamInvitations.id, invitation.id))
        .limit(1);

      if (!current) {
        throw new RouteHttpError(404, "This care-team invitation is invalid.");
      }

      if (current.status === "accepted") {
        if (current.accepted_user_id === authenticatedUser.id) {
          await tx.update(users).set({ active_profile_id: current.senior_id }).where(eq(users.id, authenticatedUser.id));
          return { alreadyAccepted: true, seniorProfileId: current.senior_id };
        }
        throw new RouteHttpError(409, "This invitation has already been accepted by another account.");
      }

      const currentStatus = careTeamInviteStatus(current);
      if (currentStatus !== "pending") {
        if (currentStatus === "expired" && current.status === "pending") {
          await tx
            .update(teamInvitations)
            .set({ status: "expired", updated_at: now })
            .where(eq(teamInvitations.id, current.id));
        }
        throw new RouteHttpError(410, "This invitation link is no longer active.");
      }

      const [existingMembership] = await tx
        .select({ permissions: profileMemberships.permissions })
        .from(profileMemberships)
        .where(and(
          eq(profileMemberships.user_id, authenticatedUser.id),
          eq(profileMemberships.profile_id, current.senior_id),
        ))
        .limit(1);

      const existingPermissions = existingMembership?.permissions && typeof existingMembership.permissions === "object"
        ? existingMembership.permissions as Record<string, unknown>
        : {};

      await tx
        .insert(profileMemberships)
        .values({
          user_id: authenticatedUser.id,
          profile_id: current.senior_id,
          role: profileMembershipRoleForInvite(current.role),
          relationship: current.relationship,
          display_name: current.invitee_name,
          status: "active",
          permissions: {
            ...existingPermissions,
            ...careTeamMembershipPermissions(current),
          },
          is_primary: false,
          accepted_at: now,
        })
        .onConflictDoUpdate({
          target: [profileMemberships.user_id, profileMemberships.profile_id],
          set: {
            role: profileMembershipRoleForInvite(current.role),
            relationship: current.relationship,
            display_name: current.invitee_name,
            status: "active",
            permissions: {
              ...existingPermissions,
              ...careTeamMembershipPermissions(current),
            },
            accepted_at: now,
            updated_at: now,
          },
        });

      await tx
        .update(teamInvitations)
        .set({
          status: "accepted",
          accepted_user_id: authenticatedUser.id,
          accepted_at: now,
          updated_at: now,
        })
        .where(eq(teamInvitations.id, current.id));

      await tx
        .update(users)
        .set({ active_profile_id: current.senior_id })
        .where(eq(users.id, authenticatedUser.id));

      return { alreadyAccepted: false, seniorProfileId: current.senior_id };
    });

    return res.json({
      ok: true,
      status: "accepted",
      alreadyAccepted: outcome.alreadyAccepted,
      seniorProfileId: outcome.seniorProfileId,
      destination: "/caregiver",
    });
  } catch (err) {
    if (err instanceof RouteHttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[auth/careteam-invites:accept]", err);
    return res.status(500).json({ error: "Could not accept this invitation" });
  }
});

/**
 * POST /api/auth/access-link/consume
 * Passwordless entry for elder/family invite links. Valid links return the
 * same JWT used by the rest of the app, so onboarding/app routes remain intact.
 */
authRouter.post("/access-link/consume", async (req: Request, res: Response) => {
  const parsed = consumeAccessLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid access link" });
  }

  const [link] = await db
    .select()
    .from(accessLinks)
    .where(eq(accessLinks.token, parsed.data.token))
    .limit(1);

  if (!link || link.revoked_at) {
    return res.status(404).json({ error: "This access link is invalid." });
  }
  if (new Date() > link.expires_at) {
    return res.status(410).json({ error: "This access link has expired." });
  }
  if (link.use_count >= link.max_uses) {
    return res.status(410).json({ error: "This access link has already been used." });
  }

  let userId = link.user_id;
  let intake: typeof userIntakes.$inferSelect | undefined;
  if (link.intake_id) {
    [intake] = await db
      .select()
      .from(userIntakes)
      .where(eq(userIntakes.id, link.intake_id))
      .limit(1);
    userId = userId ?? intake?.user_id ?? intake?.elder_user_id ?? intake?.family_user_id ?? null;
  }

  if (!userId) {
    return res.status(409).json({ error: "This access link is not attached to a user yet." });
  }

  const [profileAccess] = await db
    .select({ account_status: profiles.account_status })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (profileAccess?.account_status === "disabled") {
    return res.status(403).json({ error: "This account is currently disabled." });
  }

  const now = new Date();
  await db
    .update(accessLinks)
    .set({
      clicked_at: link.clicked_at ?? now,
      converted_at: now,
      use_count: link.use_count + 1,
    })
    .where(eq(accessLinks.id, link.id));

  if (intake) {
    await db
      .update(userIntakes)
      .set({
        journey_step: "access_link_clicked",
        last_activity_at: now,
        updated_at: now,
      })
      .where(eq(userIntakes.id, intake.id));

    await db.insert(lifecycleEvents).values({
      intake_id: intake.id,
      user_id: userId,
      event_type: "access_link_clicked",
      from_status: intake.status,
      to_status: intake.status,
      channel: "passwordless_link",
      metadata: { destination: link.destination, link_type: link.link_type },
    });
  }

  await db.update(users).set({ last_seen_at: now }).where(eq(users.id, userId));

  const token = await issueAuthSessionCookie(res, userId);
  return res.json({
    token,
    userId,
    destination: link.destination,
    tier: link.tier,
    targetRole: link.target_role,
  });
});

/**
 * POST /api/auth/reset-request
 * Generates a one-time password reset token, stores it in the DB, and emails a
 * reset link to the user. The token is NEVER included in the response in
 * production — in development it is logged to the console and included under
 * `_devToken` so the test suite can retrieve it without an email service.
 * Always returns the same generic 200 regardless of whether the account exists
 * (prevents email enumeration attacks).
 */
authRouter.post("/reset-request", async (req: Request, res: Response) => {
  const parsed = resetRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid request";
    return res.status(400).json({ error: msg });
  }

  const lowerEmail = parsed.data.email.toLowerCase();

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, lowerEmail))
    .limit(1);

  // Always return the same response regardless of whether the account exists
  // (prevents email enumeration attacks).
  const genericOk = { message: "If an account with that email exists, a reset link has been sent." };

  if (!user || !user.email) {
    return res.json(genericOk);
  }

  const resetToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db
    .update(users)
    .set({ reset_token: resetToken, reset_token_expires_at: expiresAt })
    .where(eq(users.id, user.id));

  let resetLink: string;
  try {
    resetLink = buildPublicAppLink(req, `/reset-password?token=${encodeURIComponent(resetToken)}`);
  } catch (err) {
    console.error("[auth] Failed to build password reset link:", err);
    return res.status(500).json({ error: "Could not prepare reset email. Please try again later." });
  }

  try {
    await sendPasswordResetEmail({ to: user.email, resetLink, allowDevelopmentLog: isLocalRequest(req) });
  } catch (err) {
    console.error("[auth] Failed to send password reset email:", err);
    const message = err instanceof Error && err.message.trim()
      ? err.message
      : "Failed to send reset email. Please try again later.";
    return res.status(503).json({ error: message });
  }

  const response: Record<string, unknown> = { ...genericOk };

  // Expose token only in non-production environments so tests can retrieve it
  // directly from the API without requiring a real mail server.
  if (isDev && isLocalRequest(req)) {
    response._devToken = resetToken;
  }

  return res.json(response);
});

/**
 * POST /api/auth/reset-password
 * Verifies the one-time token and updates the user's password.
 * Rejects expired or already-consumed tokens.
 */
authRouter.post("/reset-password", async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid request";
    return res.status(400).json({ error: msg });
  }

  const { token, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.reset_token, token))
    .limit(1);

  if (!user || !user.reset_token_expires_at) {
    return res.status(400).json({ error: "Invalid or expired reset token." });
  }

  if (new Date() > user.reset_token_expires_at) {
    return res.status(400).json({ error: "This reset link has expired. Please request a new one." });
  }

  const password_hash = await hashPassword(password);

  await db
    .update(users)
    .set({ password_hash, reset_token: null, reset_token_expires_at: null })
    .where(eq(users.id, user.id));

  return res.json({ message: "Password has been reset successfully. You can now log in." });
});
