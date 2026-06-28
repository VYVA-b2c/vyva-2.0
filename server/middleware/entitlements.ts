import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { getActiveProfileContext, type ActiveProfileContext } from "../lib/profileAccess.js";
import { entitlementForTier, normalizeSubscriptionTier } from "../lib/plans.js";
import { profiles } from "../../shared/schema.js";
import { syncProfileEntitlement } from "../lib/entitlementSync.js";

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

type EntitlementErrorContext = ActiveProfileContext & {
  usedDevFallback?: boolean;
};

async function activeProfileContextForRequest(req: Request): Promise<EntitlementErrorContext | null> {
  if (!req.user?.id) return null;
  const context = await getActiveProfileContext(req.user.id);
  if (context.profileId || process.env.NODE_ENV === "production") return context;
  return {
    ...context,
    profileId: req.user.id,
    profileCount: Math.max(context.profileCount, 1),
    needsProfileSetup: false,
    usedDevFallback: true,
  };
}

function entitlementContextPayload(
  context: EntitlementErrorContext | null,
  feature: EntitlementFeature,
  profileId?: string | null,
) {
  const resolvedProfileId = profileId ?? context?.profileId ?? null;
  return {
    feature,
    account_user_id: context?.accountUserId ?? null,
    active_profile_id: context?.profileId ?? null,
    profile_id: resolvedProfileId,
    active_profile_role: context?.role ?? null,
    profile_count: context?.profileCount ?? 0,
    needs_profile_setup: context?.needsProfileSetup ?? false,
    needs_profile_selection: context?.needsProfileSelection ?? false,
    used_dev_fallback: context?.usedDevFallback ?? false,
  };
}

export async function hasTierEntitlement(userId: string, feature: EntitlementFeature) {
  const context = await getActiveProfileContext(userId);
  const profileId = context.profileId ?? userId;
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

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
      const activeContext = await activeProfileContextForRequest(req);
      const profileId = activeContext?.profileId ?? null;
      if (!profileId) {
        res.status(409).json({
          error: "No care profile selected",
          code: "ACTIVE_PROFILE_REQUIRED",
          ...entitlementContextPayload(activeContext, feature),
          nextRoute: "/onboarding/who-for",
        });
        return;
      }

      if (feature === "symptom_check") {
        req.entitlement = { profileId, tier: "core", feature };
        next();
        return;
      }

      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, profileId))
        .limit(1);

      if (!profile) {
        res.status(409).json({
          error: "Active care profile was not found",
          code: "ACTIVE_PROFILE_NOT_FOUND",
          ...entitlementContextPayload(activeContext, feature, profileId),
          nextRoute: "/onboarding/who-for",
        });
        return;
      }

      if (profile.account_status === "disabled") {
        res.status(403).json({
          error: "Account access is disabled for the active profile",
          code: "ACCOUNT_ACCESS_DISABLED",
          feature,
          ...entitlementContextPayload(activeContext, feature, profileId),
          account_status: profile.account_status,
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
