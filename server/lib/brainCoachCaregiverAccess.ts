import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  consentAuditLogs,
  profileMemberships,
  profiles,
  teamInvitations,
} from "../../shared/schema.js";
import { getActiveProfileContext } from "./profileAccess.js";

export const BRAIN_COACH_CAREGIVER_PERMISSION_KEYS = [
  "view_summary",
  "manage_plan_preferences",
  "manage_schedule",
  "send_nudges",
  "preview_plan",
] as const;

export type BrainCoachCaregiverPermission = typeof BRAIN_COACH_CAREGIVER_PERMISSION_KEYS[number];

export type BrainCoachCaregiverPermissions = Record<BrainCoachCaregiverPermission, boolean>;

export type BrainCoachAccessContext = {
  targetUserId: string;
  actorUserId: string;
  actorRole: "elder" | "caregiver" | "family" | "admin" | "user";
  isOwnProfile: boolean;
  isAdmin: boolean;
  permissions: BrainCoachCaregiverPermissions;
};

const EMPTY_PERMISSIONS: BrainCoachCaregiverPermissions = {
  view_summary: false,
  manage_plan_preferences: false,
  manage_schedule: false,
  send_nudges: false,
  preview_plan: false,
};

const FULL_PERMISSIONS: BrainCoachCaregiverPermissions = {
  view_summary: true,
  manage_plan_preferences: true,
  manage_schedule: true,
  send_nudges: true,
  preview_plan: true,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function isSuperAdminEmail(value: unknown): boolean {
  const configured = (process.env.SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();
  return typeof value === "string" && value.trim().toLowerCase() === configured;
}

export function normalizeBrainCoachPermissions(value: unknown): BrainCoachCaregiverPermissions {
  const raw = asRecord(value);
  return BRAIN_COACH_CAREGIVER_PERMISSION_KEYS.reduce((permissions, key) => ({
    ...permissions,
    [key]: raw[key] === true,
  }), { ...EMPTY_PERMISSIONS });
}

export function brainCoachPermissionsFromCareTeamConsent(value: {
  can_view_dashboard?: boolean | null;
  can_view_journal_summaries?: boolean | null;
} | null | undefined): BrainCoachCaregiverPermissions {
  return {
    ...EMPTY_PERMISSIONS,
    view_summary: Boolean(value?.can_view_dashboard && value?.can_view_journal_summaries),
  };
}

export function effectiveBrainCoachPermissions(input: {
  membershipPermissions?: unknown;
  careTeamConsent?: {
    can_view_dashboard?: boolean | null;
    can_view_journal_summaries?: boolean | null;
  } | null;
}): BrainCoachCaregiverPermissions {
  const root = asRecord(input.membershipPermissions);
  if ("brain_coach" in root) {
    return normalizeBrainCoachPermissions(root.brain_coach);
  }
  return brainCoachPermissionsFromCareTeamConsent(input.careTeamConsent);
}

export function withBrainCoachPermissions(
  existingPermissions: unknown,
  brainCoachPermissions: Partial<BrainCoachCaregiverPermissions>,
) {
  const root = asRecord(existingPermissions);
  return {
    ...root,
    brain_coach: {
      ...normalizeBrainCoachPermissions(root.brain_coach),
      ...brainCoachPermissions,
    },
  };
}

export function hasBrainCoachPermission(
  permissions: BrainCoachCaregiverPermissions,
  permission: BrainCoachCaregiverPermission,
) {
  return permissions[permission] === true;
}

export async function resolveBrainCoachAccess(input: {
  actorUserId: string;
  targetUserId: string;
  requiredPermission?: BrainCoachCaregiverPermission;
  actorEmail?: string | null;
  actorRequestRole?: string | null;
}): Promise<BrainCoachAccessContext | null> {
  const activeContext = await getActiveProfileContext(input.actorUserId);
  const isOwnProfile = input.targetUserId === input.actorUserId || activeContext.profileId === input.targetUserId;

  const [[actorProfile], [membership], [invitation]] = await Promise.all([
    db
      .select({ role: profiles.role, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, input.actorUserId))
      .limit(1),
    db
      .select()
      .from(profileMemberships)
      .where(and(
        eq(profileMemberships.user_id, input.actorUserId),
        eq(profileMemberships.profile_id, input.targetUserId),
        eq(profileMemberships.status, "active"),
      ))
      .limit(1),
    db
      .select({
        can_view_dashboard: teamInvitations.can_view_dashboard,
        can_view_journal_summaries: teamInvitations.can_view_journal_summaries,
      })
      .from(teamInvitations)
      .where(and(
        eq(teamInvitations.senior_id, input.targetUserId),
        eq(teamInvitations.accepted_user_id, input.actorUserId),
        eq(teamInvitations.status, "accepted"),
      ))
      .orderBy(desc(teamInvitations.accepted_at))
      .limit(1),
  ]);

  const isAdmin = input.actorRequestRole === "admin" ||
    actorProfile?.role === "admin" ||
    isSuperAdminEmail(input.actorEmail) ||
    isSuperAdminEmail(actorProfile?.email);

  const actorRole = isOwnProfile
    ? "elder"
    : isAdmin
      ? "admin"
      : membership?.role === "caregiver" || membership?.role === "family"
        ? membership.role
        : "user";
  const permissions = isOwnProfile || isAdmin
    ? { ...FULL_PERMISSIONS }
    : effectiveBrainCoachPermissions({
        membershipPermissions: membership?.permissions,
        careTeamConsent: invitation,
      });

  if (!isOwnProfile && !isAdmin && !membership) return null;
  if (input.requiredPermission && !hasBrainCoachPermission(permissions, input.requiredPermission)) return null;

  return {
    targetUserId: input.targetUserId,
    actorUserId: input.actorUserId,
    actorRole,
    isOwnProfile,
    isAdmin,
    permissions,
  };
}

export async function auditBrainCoachCaregiverChange(input: {
  access: BrainCoachAccessContext;
  previousValue: unknown;
  newValue: unknown;
  source?: string;
}) {
  await db.insert(consentAuditLogs).values({
    user_id: input.access.targetUserId,
    schedule_id: null,
    changed_by: input.access.actorUserId,
    changed_by_role: input.access.actorRole,
    previous_value: input.previousValue ?? {},
    new_value: input.newValue ?? {},
    consent_source: input.source ?? "brain_coach_caregiver",
  });
}
