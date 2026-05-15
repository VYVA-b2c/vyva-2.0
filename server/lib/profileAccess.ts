import type { Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import { profileMemberships, profiles, users } from "../../shared/schema.js";

export type ActiveProfileContext = {
  accountUserId: string;
  profileId: string | null;
  role: (typeof profileMemberships.$inferSelect)["role"] | null;
};

export async function getActiveProfileContext(accountUserId: string): Promise<ActiveProfileContext> {
  const [directProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, accountUserId))
    .limit(1);

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

  if (account?.active_profile_id) {
    const [[activeProfile], [activeMembership]] = await Promise.all([
      db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, account.active_profile_id))
        .limit(1),
      db
        .select({ role: profileMemberships.role })
        .from(profileMemberships)
        .where(and(
          eq(profileMemberships.user_id, accountUserId),
          eq(profileMemberships.profile_id, account.active_profile_id),
          eq(profileMemberships.status, "active"),
        ))
        .limit(1),
    ]);

    if (activeProfile) {
      return { accountUserId, profileId: activeProfile.id, role: activeMembership?.role ?? null };
    }
  }

  const [membership] = await db
    .select({ profile_id: profileMemberships.profile_id, role: profileMemberships.role })
    .from(profileMemberships)
    .where(and(
      eq(profileMemberships.user_id, accountUserId),
      eq(profileMemberships.status, "active"),
    ))
    .orderBy(desc(profileMemberships.is_primary), desc(profileMemberships.created_at))
    .limit(1);

  if (membership) {
    if (account) {
      await db
        .update(users)
        .set({ active_profile_id: membership.profile_id })
        .where(eq(users.id, accountUserId));
    }
    return { accountUserId, profileId: membership.profile_id, role: membership.role };
  }

  if (directProfile) {
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

    if (account) {
      await db
        .update(users)
        .set({ active_profile_id: directProfile.id })
        .where(eq(users.id, accountUserId));
    }

    return { accountUserId, profileId: directProfile.id, role: "elder" };
  }

  return { accountUserId, profileId: null, role: null };
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
