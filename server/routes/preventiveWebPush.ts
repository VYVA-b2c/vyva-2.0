import { Router, type Request } from "express";
import { z } from "zod";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import { isLocalDevelopmentRequest } from "../lib/requestEnvironment.js";
import {
  resolvePreventiveWebPushFlag,
  type PreventiveWebPushEnvironmentMap,
} from "../engagement/preventiveWebPushFeatureFlags.js";
import {
  resolvePreventiveWebPushProviderConfig,
} from "../engagement/preventiveWebPushProvider.js";
import {
  defaultPreventiveWebPushStore,
  type PreventiveWebPushStore,
} from "../engagement/preventiveWebPushStore.js";
import {
  normalizePreventiveWebPushSubscription,
  parsePreventiveWebPushEntryToken,
  PREVENTIVE_WEB_PUSH_ALLOWED_ROUTE,
} from "../engagement/preventiveWebPushSecurity.js";
import { db } from "../db.js";
import { userChannelPreferences } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

const subscribeBodySchema = z.object({
  subscription: z.unknown().refine((value) => value !== undefined),
}).strict();

const redeemBodySchema = z.object({
  token: z.unknown().refine((value) => value !== undefined),
}).strict();

const flowStartedBodySchema = z.object({
  entryId: z.string().uuid(),
}).strict();

export type PreventiveWebPushRouterDependencies = Readonly<{
  store?: PreventiveWebPushStore;
  env?: PreventiveWebPushEnvironmentMap;
  currentTime?: () => Date;
  resolveProfileId?: (req: Request) => Promise<string | null>;
  retainSharedSubscription?: (userId: string) => Promise<boolean>;
}>;

async function refillPushUsesSharedSubscription(userId: string) {
  try {
    const [preference] = await db.select({ enabled: userChannelPreferences.medication_refill_push_enabled })
      .from(userChannelPreferences)
      .where(eq(userChannelPreferences.user_id, userId))
      .limit(1);
    return preference?.enabled === true;
  } catch {
    return false;
  }
}

async function defaultResolveProfileId(req: Request): Promise<string | null> {
  if (!req.user?.id) return null;
  const context = await getActiveProfileContext(req.user.id);
  if (context.profileId) return context.profileId;
  if (isLocalDevelopmentRequest(req)) return req.user.id;
  return null;
}

function safeNow(provider: () => Date): Date {
  const value = provider();
  return value instanceof Date && Number.isFinite(value.getTime()) ? value : new Date();
}

function publicConfig(env: PreventiveWebPushEnvironmentMap, userId: string) {
  const provider = resolvePreventiveWebPushProviderConfig(env);
  const flag = resolvePreventiveWebPushFlag({
    env,
    userRef: userId,
    cohortKey: `settings:${userId}`,
  });
  return {
    supported: true,
    enabled: flag.effectiveMode === "pilot" && provider.ok,
    reason: flag.reasonCode,
    publicKey: provider.ok ? provider.config.publicKey : null,
  };
}

export function createPreventiveWebPushRouter(
  dependencies: PreventiveWebPushRouterDependencies = {},
) {
  const router = Router();
  const store = dependencies.store ?? defaultPreventiveWebPushStore;
  const env = dependencies.env ?? process.env;
  const currentTime = dependencies.currentTime ?? (() => new Date());
  const resolveProfileId = dependencies.resolveProfileId ?? defaultResolveProfileId;
  const retainSharedSubscription = dependencies.retainSharedSubscription
    ?? (dependencies.store ? async () => false : refillPushUsesSharedSubscription);

  router.get("/config", async (req, res) => {
    const userId = await resolveProfileId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    return res.json(publicConfig(env, userId));
  });

  router.get("/status", async (req, res) => {
    const userId = await resolveProfileId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const [consent, subscription] = await Promise.all([
      store.readConsent(userId),
      store.activeSubscription(userId),
    ]);
    return res.json({
      consentEnabled: consent.enabled,
      consentRevision: consent.revision,
      subscribed: Boolean(subscription),
      config: publicConfig(env, userId),
    });
  });

  router.post("/subscriptions", async (req, res) => {
    const userId = await resolveProfileId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const body = subscribeBodySchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Invalid subscription request" });
    const normalized = normalizePreventiveWebPushSubscription(body.data.subscription);
    if (!normalized.ok) {
      return res.status(400).json({ error: "Invalid push subscription", reason: normalized.reason });
    }
    const consent = await store.setConsent({ userId, enabled: true, now: safeNow(currentTime) });
    const stored = await store.upsertSubscription({
      userId,
      subscription: normalized.subscription,
      consentRevision: consent.revision,
      now: safeNow(currentTime),
    });
    if (stored.outcome === "endpoint_conflict") {
      await store.setConsent({ userId, enabled: false, now: safeNow(currentTime) }).catch(() => {});
      return res.status(409).json({ error: "Push subscription belongs to another user" });
    }
    if (stored.outcome === "unavailable") {
      await store.setConsent({ userId, enabled: false, now: safeNow(currentTime) }).catch(() => {});
      return res.status(503).json({ error: "Unable to save push subscription" });
    }
    return res.json({
      ok: true,
      consentEnabled: true,
      consentRevision: consent.revision,
      subscribed: true,
      subscriptionId: stored.subscription.id,
    });
  });

  router.delete("/subscriptions", async (req, res) => {
    const userId = await resolveProfileId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const now = safeNow(currentTime);
    await store.setConsent({ userId, enabled: false, now });
    const retainedForRefills = await retainSharedSubscription(userId);
    if (!retainedForRefills) {
      const revoked = await store.revokeSubscriptions({ userId, now });
      if (revoked.outcome === "unavailable") {
        return res.status(503).json({ error: "Unable to revoke push subscription" });
      }
    }
    return res.json({ ok: true, consentEnabled: false, subscribed: retainedForRefills });
  });

  router.post("/entry/redeem", async (req, res) => {
    const userId = await resolveProfileId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const parsed = redeemBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid entry token request" });
    const token = parsePreventiveWebPushEntryToken(parsed.data.token);
    if (!token.ok) return res.status(400).json({ error: "Invalid entry token" });
    const redeemed = await store.redeemEntryToken({
      userId,
      tokenDigest: token.tokenDigest,
      now: safeNow(currentTime),
    });
    if (redeemed.outcome === "invalid" || redeemed.outcome === "wrong_user") {
      return res.status(404).json({ error: "Push entry not found" });
    }
    if (redeemed.outcome === "expired") {
      return res.status(410).json({ error: "Push entry expired" });
    }
    if (redeemed.outcome === "unavailable") {
      return res.status(503).json({ error: "Push entry temporarily unavailable" });
    }
    return res.json({
      ok: true,
      entryId: redeemed.entryId,
      route: PREVENTIVE_WEB_PUSH_ALLOWED_ROUTE,
      flowId: redeemed.flowId,
      flowVersion: redeemed.flowVersion,
      status: redeemed.outcome,
    });
  });

  router.post("/entry/flow-started", async (req, res) => {
    const userId = await resolveProfileId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const parsed = flowStartedBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid entry marker request" });
    const marked = await store.recordFlowStarted({
      userId,
      entryId: parsed.data.entryId,
      now: safeNow(currentTime),
    });
    if (marked.outcome === "invalid" || marked.outcome === "wrong_user") {
      return res.status(404).json({ error: "Push entry not found" });
    }
    if (marked.outcome === "expired") {
      return res.status(410).json({ error: "Push entry expired" });
    }
    if (marked.outcome === "unavailable") {
      return res.status(503).json({ error: "Push entry temporarily unavailable" });
    }
    return res.json({
      ok: true,
      entryId: marked.entryId,
      route: marked.route,
      flowId: marked.flowId,
      flowVersion: marked.flowVersion,
      status: marked.outcome,
    });
  });

  return router;
}

export default createPreventiveWebPushRouter();
