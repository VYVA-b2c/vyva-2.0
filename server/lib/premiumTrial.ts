import { eq, or } from "drizzle-orm";
import { db } from "../db.js";
import { lifecycleEvents, profiles, userIntakes } from "../../shared/schema.js";
import { normalizeSubscriptionTier } from "./plans.js";

type ProfileRow = typeof profiles.$inferSelect;

export const PREMIUM_TRIAL_DAYS = 14;
export const PREMIUM_TRIAL_EXPIRED_EVENT_TYPE = "premium_trial_expired";

export function premiumTrialEndsAt(from = new Date()) {
  return new Date(from.getTime() + PREMIUM_TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export function premiumTrialProfilePatch(from = new Date()) {
  return {
    subscription_tier: "premium",
    subscription_status: "trial",
    trial_ends_at: premiumTrialEndsAt(from),
  };
}

export function isExpiredNoCardPremiumTrial(profile: ProfileRow | null | undefined, now = new Date()) {
  if (!profile) return false;
  if (normalizeSubscriptionTier(profile.subscription_tier) !== "premium") return false;
  if (profile.subscription_status !== "trial") return false;
  if (profile.stripe_subscription_id) return false;
  if (!profile.trial_ends_at) return false;
  return new Date(profile.trial_ends_at).getTime() <= now.getTime();
}

export function asFreeActiveProfile(profile: ProfileRow): ProfileRow {
  return {
    ...profile,
    subscription_tier: "free",
    subscription_status: "active",
    trial_ends_at: null,
    updated_at: new Date(),
  };
}

export async function downgradeExpiredPremiumTrial(profile: ProfileRow, now = new Date()) {
  if (!isExpiredNoCardPremiumTrial(profile, now)) return false;

  await db
    .update(profiles)
    .set({
      subscription_tier: "free",
      subscription_status: "active",
      trial_ends_at: null,
      updated_at: now,
    })
    .where(eq(profiles.id, profile.id));

  await db
    .update(userIntakes)
    .set({
      tier: "free",
      updated_at: now,
    })
    .where(or(
      eq(userIntakes.user_id, profile.id),
      eq(userIntakes.elder_user_id, profile.id),
      eq(userIntakes.family_user_id, profile.id),
    ));

  await db.insert(lifecycleEvents).values({
    intake_id: null,
    user_id: profile.id,
    event_type: PREMIUM_TRIAL_EXPIRED_EVENT_TYPE,
    from_status: "premium",
    to_status: "free",
    channel: "system",
    metadata: {
      previous_subscription_tier: profile.subscription_tier,
      previous_subscription_status: profile.subscription_status,
      trial_ended_at: profile.trial_ends_at?.toISOString?.() ?? profile.trial_ends_at,
      downgraded_subscription_tier: "free",
      downgraded_subscription_status: "active",
    },
  });

  return true;
}
