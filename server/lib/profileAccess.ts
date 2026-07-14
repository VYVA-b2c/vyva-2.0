import type { Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { profileMemberships, profiles, users } from "../../shared/schema.js";
import { isMissingRelationError, missingColumnName } from "./dbCompatibility.js";

type ProfileMemberRole = (typeof profileMemberships.$inferSelect)["role"];

export type ProfileChoice = {
  profileId: string;
  role: ProfileMemberRole;
  relationship: string | null;
  displayName: string | null;
  fullName: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
  isPrimary: boolean;
};

export type ActiveProfileContext = {
  accountUserId: string;
  profileId: string | null;
  role: ProfileMemberRole | null;
  profileCount: number;
  needsProfileSetup: boolean;
  needsProfileSelection: boolean;
};

type DirectProfile = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  onboarding_complete: boolean;
  current_stage: string | null;
};

export function isMissingAccountProfileLinkColumnError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("does not exist") && (
    message.includes("active_profile_id") ||
    message.includes("onboarding_intent")
  );
}

function isProfileMembershipSchemaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return isMissingRelationError(err, "profile_memberships") || (
    message.includes("does not exist") &&
    message.includes("profile_memberships")
  );
}

function isProfileColumnMissingError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return Boolean(missingColumnName(err)) && message.includes("profiles");
}

function hasLegacyProfileContent(profile: DirectProfile | undefined): profile is DirectProfile {
  if (!profile) return false;
  return Boolean(
    profile.onboarding_complete ||
    profile.full_name ||
    profile.preferred_name ||
    profile.date_of_birth ||
    profile.phone_number ||
    (profile.current_stage && profile.current_stage !== "stage_1_identity"),
  );
}

export async function getProfileChoices(accountUserId: string): Promise<ProfileChoice[]> {
  let memberships: Array<{
    profile_id: string;
    role: ProfileMemberRole;
    relationship: string | null;
    display_name: string | null;
    is_primary: boolean;
    created_at: Date;
  }> = [];

  try {
    memberships = await db
      .select({
        profile_id: profileMemberships.profile_id,
        role: profileMemberships.role,
        relationship: profileMemberships.relationship,
        display_name: profileMemberships.display_name,
        is_primary: profileMemberships.is_primary,
        created_at: profileMemberships.created_at,
      })
      .from(profileMemberships)
      .where(and(
        eq(profileMemberships.user_id, accountUserId),
        eq(profileMemberships.status, "active"),
      ))
      .orderBy(desc(profileMemberships.is_primary), desc(profileMemberships.created_at));
  } catch (err) {
    if (!isProfileMembershipSchemaError(err)) throw err;
    console.warn("[profileAccess] profile_memberships schema is unavailable; using direct profile fallback.");
    return [];
  }

  const profileIds = Array.from(new Set(memberships.map((membership) => membership.profile_id)));
  if (profileIds.length === 0) return [];

  let profileRows: Array<{
    id: string;
    full_name?: string | null;
    preferred_name?: string | null;
    avatar_url?: string | null;
  }>;
  try {
    profileRows = await db
      .select({
        id: profiles.id,
        full_name: profiles.full_name,
        preferred_name: profiles.preferred_name,
        avatar_url: profiles.avatar_url,
      })
      .from(profiles)
      .where(inArray(profiles.id, profileIds));
  } catch (err) {
    if (!isProfileColumnMissingError(err)) throw err;
    console.warn("[profileAccess] profile display columns unavailable; using profile ids only.");
    profileRows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(inArray(profiles.id, profileIds));
  }

  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));

  return memberships
    .map((membership) => {
      const profile = profileById.get(membership.profile_id);
      if (!profile) return null;
      return {
        profileId: profile.id,
        role: membership.role,
        relationship: membership.relationship,
        displayName: membership.display_name,
        fullName: profile.full_name,
        preferredName: profile.preferred_name,
        avatarUrl: profile.avatar_url,
        isPrimary: membership.is_primary,
      };
    })
    .filter((choice): choice is ProfileChoice => Boolean(choice));
}

export async function getActiveProfileContext(accountUserId: string): Promise<ActiveProfileContext> {
  let directProfile: DirectProfile | undefined;
  try {
    [directProfile] = await db
      .select({
        id: profiles.id,
        full_name: profiles.full_name,
        preferred_name: profiles.preferred_name,
        date_of_birth: profiles.date_of_birth,
        phone_number: profiles.phone_number,
        onboarding_complete: profiles.onboarding_complete,
        current_stage: profiles.current_stage,
      })
      .from(profiles)
      .where(eq(profiles.id, accountUserId))
      .limit(1);
  } catch (err) {
    if (!isProfileColumnMissingError(err)) throw err;
    console.warn("[profileAccess] direct profile detail columns unavailable; using profile id only.");
    const [minimalProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, accountUserId))
      .limit(1);
    directProfile = minimalProfile
      ? {
        id: minimalProfile.id,
        full_name: null,
        preferred_name: null,
        date_of_birth: null,
        phone_number: null,
        onboarding_complete: false,
        current_stage: null,
      }
      : undefined;
  }

  let account: { active_profile_id: string | null } | null = null;
  try {
    const [accountRow] = await db
      .select({ active_profile_id: users.active_profile_id })
      .from(users)
      .where(eq(users.id, accountUserId))
      .limit(1);
    account = accountRow ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("does not exist")) throw err;
  }

  const choices = await getProfileChoices(accountUserId);
  const choiceCount = choices.length;

  if (account?.active_profile_id) {
    const [activeProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, account.active_profile_id))
      .limit(1);

    let activeMembership: { role: ProfileMemberRole } | undefined;
    try {
      [activeMembership] = await db
        .select({ role: profileMemberships.role })
        .from(profileMemberships)
        .where(and(
          eq(profileMemberships.user_id, accountUserId),
          eq(profileMemberships.profile_id, account.active_profile_id),
          eq(profileMemberships.status, "active"),
        ))
        .limit(1);
    } catch (err) {
      if (!isProfileMembershipSchemaError(err)) throw err;
      console.warn("[profileAccess] active profile membership lookup unavailable; using active profile without membership role.");
    }

    if (activeProfile) {
      return {
        accountUserId,
        profileId: activeProfile.id,
        role: activeMembership?.role ?? null,
        profileCount: Math.max(choiceCount, 1),
        needsProfileSetup: false,
        needsProfileSelection: false,
      };
    }
  }

  const membership = choices[0];
  if (membership) {
    if (account) {
      await db
        .update(users)
        .set({ active_profile_id: membership.profileId })
        .where(eq(users.id, accountUserId));
    }
    return {
      accountUserId,
      profileId: membership.profileId,
      role: membership.role,
      profileCount: choiceCount,
      needsProfileSetup: false,
      needsProfileSelection: choiceCount > 1,
    };
  }

  if (directProfile) {
    if (hasLegacyProfileContent(directProfile)) {
      try {
        await db
          .insert(profileMemberships)
          .values({
            user_id: accountUserId,
            profile_id: directProfile.id,
            role: "elder",
            relationship: "self",
            is_primary: true,
            accepted_at: new Date(),
          })
          .onConflictDoNothing();
      } catch (err) {
        if (!isProfileMembershipSchemaError(err)) throw err;
        console.warn("[profileAccess] legacy direct profile membership backfill skipped because profile_memberships is unavailable.");
      }
    }

    if (account) {
      await db
        .update(users)
        .set({ active_profile_id: directProfile.id })
        .where(eq(users.id, accountUserId));
    }

    return {
      accountUserId,
      profileId: directProfile.id,
      role: "elder",
      profileCount: 1,
      needsProfileSetup: false,
      needsProfileSelection: false,
    };
  }

  return {
    accountUserId,
    profileId: null,
    role: null,
    profileCount: 0,
    needsProfileSetup: true,
    needsProfileSelection: false,
  };
}

export async function requireActiveProfileId(accountUserId: string, res: Response): Promise<string | null> {
  const context = await getActiveProfileContext(accountUserId);
  if (!context.profileId) {
    res.status(409).json({
      error: "No care profile selected",
      nextRoute: "/onboarding/who-for",
    });
    return null;
  }
  return context.profileId;
}
