import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import { entitlementForTier, normalizeSubscriptionTier } from "../lib/plans.js";
import { profiles } from "../../shared/schema.js";
import { syncProfileEntitlement } from "../lib/entitlementSync.js";
import { missingColumnName, omitColumns } from "../lib/dbCompatibility.js";

export type EntitlementFeature =
  | "voice_assistant"
  | "medication_tracking"
  | "symptom_check"
  | "concierge"
  | "caregiver_dashboard";

const FEATURE_LABELS: Record<EntitlementFeature, string> = {
  voice_assistant: "voice assistant",
  medication_tracking: "medication tracking",
  symptom_check: "symptom checks",
  concierge: "concierge",
  caregiver_dashboard: "caregiver dashboard",
};

type EntitlementProfile = typeof profiles.$inferSelect;

const ENTITLEMENT_PROFILE_DEFAULTS = {
  account_status: "enabled",
  subscription_tier: "free",
  subscription_status: "active",
  stripe_subscription_id: null,
  trial_ends_at: null,
  email: null,
  phone_number: null,
  whatsapp_number: null,
};

const ENTITLEMENT_PROFILE_COLUMNS = {
  id: profiles.id,
  account_status: profiles.account_status,
  subscription_tier: profiles.subscription_tier,
  subscription_status: profiles.subscription_status,
  stripe_subscription_id: profiles.stripe_subscription_id,
  trial_ends_at: profiles.trial_ends_at,
  email: profiles.email,
  phone_number: profiles.phone_number,
  whatsapp_number: profiles.whatsapp_number,
};

async function loadEntitlementProfile(profileId: string): Promise<EntitlementProfile | null> {
  const omittedColumns = new Set<string>();
  const optionalColumns = new Set(Object.keys(ENTITLEMENT_PROFILE_DEFAULTS));

  for (let attempt = 0; attempt <= optionalColumns.size; attempt += 1) {
    try {
      const [profile] = await db
        .select(omitColumns(ENTITLEMENT_PROFILE_COLUMNS, omittedColumns))
        .from(profiles)
        .where(eq(profiles.id, profileId))
        .limit(1);

      if (!profile) return null;
      return {
        ...ENTITLEMENT_PROFILE_DEFAULTS,
        ...profile,
        id: profile.id,
      } as EntitlementProfile;
    } catch (error) {
      const column = missingColumnName(error);
      if (!column || !optionalColumns.has(column) || omittedColumns.has(column)) throw error;
      omittedColumns.add(column);
      console.warn(`[entitlements] profile column ${column} unavailable; using default for feature access.`);
    }
  }

  throw new Error("Unable to load entitlement profile");
}

declare global {
  namespace Express {
    interface Request {
      entitlement?: {
        profileId: string;
        tier: string;
        feature: EntitlementFeature;
      };
    }
  }
}

async function activeProfileForRequest(req: Request) {
  if (!req.user?.id) return null;
  const context = await getActiveProfileContext(req.user.id);
  if (context.profileId) return context.profileId;
  return process.env.NODE_ENV !== "production" ? req.user.id : null;
}

export async function hasTierEntitlement(userId: string, feature: EntitlementFeature) {
  const context = await getActiveProfileContext(userId);
  const profileId = context.profileId ?? userId;
  const profile = await loadEntitlementProfile(profileId);

  if (!profile || profile.account_status === "disabled") {
    return { allowed: false, profileId, tier: "free", reason: "profile_unavailable" as const };
  }

  const subscriptionSync = await syncProfileEntitlement({
    profile,
    profileId,
    accountUserId: userId,
    repairProfile: true,
    repairChannel: "system",
    repairTrigger: "has_tier_entitlement",
  });
  const tier = normalizeSubscriptionTier(subscriptionSync.effectiveTier);
  const entitlement = await entitlementForTier(tier);
  const allowed = Boolean(entitlement?.is_active && entitlement[feature]);
  return {
    allowed,
    profileId,
    tier,
    subscriptionStatus: subscriptionSync.effectiveStatus,
    reason: allowed ? null : "feature_not_in_tier" as const,
  };
}

export function requireEntitlement(feature: EntitlementFeature) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const profileId = await activeProfileForRequest(req);
      if (!profileId) {
        res.status(409).json({
          error: "No care profile selected",
          nextRoute: "/onboarding/who-for",
        });
        return;
      }

      if (feature === "symptom_check") {
        req.entitlement = { profileId, tier: "core", feature };
        next();
        return;
      }

      const profile = await loadEntitlementProfile(profileId);

      if (!profile || profile.account_status === "disabled") {
        res.status(403).json({
          error: "Account is not enabled for this feature",
          feature,
          nextRoute: "/settings/subscription",
        });
        return;
      }

      const subscriptionSync = await syncProfileEntitlement({
        profile,
        profileId,
        accountUserId: req.user.id,
        repairProfile: true,
        repairChannel: "system",
        repairTrigger: `require_entitlement:${feature}`,
      });
      const tier = normalizeSubscriptionTier(subscriptionSync.effectiveTier);
      const entitlement = await entitlementForTier(tier);
      if (!entitlement?.is_active || !entitlement[feature]) {
        res.status(403).json({
          error: `Your current plan does not include ${FEATURE_LABELS[feature]}.`,
          code: "ENTITLEMENT_REQUIRED",
          feature,
          tier,
          nextRoute: "/settings/subscription",
        });
        return;
      }

      req.entitlement = { profileId, tier, feature };
      next();
    } catch (error) {
      console.error("[entitlements] failed to resolve feature access", error);
      res.status(503).json({
        error: "We could not verify access right now. Please try again.",
        code: "FEATURE_ACCESS_UNAVAILABLE",
        feature,
      });
    }
  };
}
