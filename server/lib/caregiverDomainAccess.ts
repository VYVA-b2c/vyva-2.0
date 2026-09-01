import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  profileMemberships,
  profiles,
  teamInvitations,
} from "../../shared/schema.js";
import { getActiveProfileContext } from "./profileAccess.js";

export const CAREGIVER_DOMAIN_PERMISSION_KEYS = {
  safety: ["view_alerts"],
  health: ["view_vitals"],
  meds: ["view_adherence", "receive_missed_dose_alerts", "receive_refill_alerts", "manage_inventory"],
} as const;

export type CaregiverDomain = keyof typeof CAREGIVER_DOMAIN_PERMISSION_KEYS;
export type CaregiverDomainPermission = typeof CAREGIVER_DOMAIN_PERMISSION_KEYS[CaregiverDomain][number];
export type CaregiverDomainPermissions = Record<CaregiverDomainPermission, boolean>;

export type CaregiverDomainAccessContext = {
  targetUserId: string;
  actorUserId: string;
  actorRole: "elder" | "caregiver" | "family" | "admin" | "user";
  isOwnProfile: boolean;
  isAdmin: boolean;
  domain: CaregiverDomain;
  permissions: CaregiverDomainPermissions;
};

type CareTeamConsent = {
  can_receive_safety_alerts?: boolean | null;
  can_receive_health_alerts?: boolean | null;
  can_receive_medication_alerts?: boolean | null;
  can_view_health_reports?: boolean | null;
  can_view_vital_signs?: boolean | null;
} | null | undefined;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function isSuperAdminEmail(value: unknown): boolean {
  const configured = (process.env.SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();
  return typeof value === "string" && value.trim().toLowerCase() === configured;
}

function emptyDomainPermissions(domain: CaregiverDomain): CaregiverDomainPermissions {
  return CAREGIVER_DOMAIN_PERMISSION_KEYS[domain].reduce((permissions, key) => ({
    ...permissions,
    [key]: false,
  }), {} as CaregiverDomainPermissions);
}

function fullDomainPermissions(domain: CaregiverDomain): CaregiverDomainPermissions {
  return CAREGIVER_DOMAIN_PERMISSION_KEYS[domain].reduce((permissions, key) => ({
    ...permissions,
    [key]: true,
  }), {} as CaregiverDomainPermissions);
}

export function normalizeDomainPermissions(domain: CaregiverDomain, value: unknown): CaregiverDomainPermissions {
  const raw = asRecord(value);
  return CAREGIVER_DOMAIN_PERMISSION_KEYS[domain].reduce((permissions, key) => ({
    ...permissions,
    [key]: raw[key] === true,
  }), emptyDomainPermissions(domain));
}

export function domainPermissionsFromCareTeamConsent(
  domain: CaregiverDomain,
  value: CareTeamConsent,
): CaregiverDomainPermissions {
  const permissions = emptyDomainPermissions(domain);

  if (domain === "safety") {
    permissions.view_alerts = Boolean(value?.can_receive_safety_alerts);
  }

  if (domain === "health") {
    permissions.view_vitals = Boolean(value?.can_view_vital_signs || value?.can_view_health_reports);
  }

  if (domain === "meds") {
    permissions.receive_missed_dose_alerts = Boolean(value?.can_receive_medication_alerts);
    permissions.receive_refill_alerts = Boolean(value?.can_receive_medication_alerts);
  }

  return permissions;
}

export function effectiveDomainPermissions(input: {
  domain: CaregiverDomain;
  membershipPermissions?: unknown;
  careTeamConsent?: CareTeamConsent;
}): CaregiverDomainPermissions {
  const root = asRecord(input.membershipPermissions);
  if (input.domain in root) {
    return normalizeDomainPermissions(input.domain, root[input.domain]);
  }
  return domainPermissionsFromCareTeamConsent(input.domain, input.careTeamConsent);
}

export function hasDomainPermission(
  permissions: CaregiverDomainPermissions,
  permission: CaregiverDomainPermission,
) {
  return permissions[permission] === true;
}

export function isDomainSelfAccess(input: {
  actorUserId: string;
  targetUserId: string;
  activeProfileId?: string | null;
  activeProfileRole?: string | null;
}) {
  return input.targetUserId === input.actorUserId ||
    (input.activeProfileId === input.targetUserId && input.activeProfileRole === "elder");
}

export async function resolveDomainAccess(input: {
  actorUserId: string;
  targetUserId: string;
  domain: CaregiverDomain;
  requiredPermission?: CaregiverDomainPermission;
  actorEmail?: string | null;
  actorRequestRole?: string | null;
}): Promise<CaregiverDomainAccessContext | null> {
  const activeContext = await getActiveProfileContext(input.actorUserId);
  const isOwnProfile = isDomainSelfAccess({
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    activeProfileId: activeContext.profileId,
    activeProfileRole: activeContext.role,
  });

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
        can_receive_safety_alerts: teamInvitations.can_receive_safety_alerts,
        can_receive_health_alerts: teamInvitations.can_receive_health_alerts,
        can_receive_medication_alerts: teamInvitations.can_receive_medication_alerts,
        can_view_health_reports: teamInvitations.can_view_health_reports,
        can_view_vital_signs: teamInvitations.can_view_vital_signs,
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
    ? fullDomainPermissions(input.domain)
    : effectiveDomainPermissions({
        domain: input.domain,
        membershipPermissions: membership?.permissions,
        careTeamConsent: invitation,
      });

  if (!isOwnProfile && !isAdmin && !membership) return null;
  if (input.requiredPermission && !hasDomainPermission(permissions, input.requiredPermission)) return null;

  return {
    targetUserId: input.targetUserId,
    actorUserId: input.actorUserId,
    actorRole,
    isOwnProfile,
    isAdmin,
    domain: input.domain,
    permissions,
  };
}
