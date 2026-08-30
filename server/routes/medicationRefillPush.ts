import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { userChannelPreferences } from "../../shared/schema.js";
import { resolvePreventiveWebPushProviderConfig } from "../engagement/preventiveWebPushProvider.js";
import { defaultPreventiveWebPushStore } from "../engagement/preventiveWebPushStore.js";
import { normalizePreventiveWebPushSubscription } from "../engagement/preventiveWebPushSecurity.js";
import { ensureRefillPersistence } from "../medication/refillPersistence.js";

const router = Router();
const subscriptionSchema = z.object({
  subscription: z.unknown().refine((value) => value !== undefined),
}).strict();

function providerConfig() {
  const provider = resolvePreventiveWebPushProviderConfig(process.env);
  return {
    supported: true,
    enabled: provider.ok,
    publicKey: provider.ok ? provider.config.publicKey : null,
    reason: provider.ok ? "available" : provider.reason,
  };
}

router.get("/config", async (_req, res) => res.json(providerConfig()));

router.get("/status", async (req, res) => {
  await ensureRefillPersistence();
  const userId = req.user!.id;
  const [[preference], subscription] = await Promise.all([
    db.select({ enabled: userChannelPreferences.medication_refill_push_enabled })
      .from(userChannelPreferences)
      .where(eq(userChannelPreferences.user_id, userId))
      .limit(1),
    defaultPreventiveWebPushStore.activeSubscription(userId),
  ]);
  return res.json({
    consentEnabled: preference?.enabled ?? false,
    subscribed: Boolean(subscription),
    config: providerConfig(),
  });
});

router.post("/subscriptions", async (req, res) => {
  await ensureRefillPersistence();
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid subscription request" });
  const normalized = normalizePreventiveWebPushSubscription(parsed.data.subscription);
  if (!normalized.ok) {
    return res.status(400).json({ error: "Invalid push subscription", reason: normalized.reason });
  }
  const userId = req.user!.id;
  const preventiveConsent = await defaultPreventiveWebPushStore.readConsent(userId);
  const stored = await defaultPreventiveWebPushStore.upsertSubscription({
    userId,
    subscription: normalized.subscription,
    consentRevision: preventiveConsent.revision,
    now: new Date(),
  });
  if (stored.outcome === "endpoint_conflict") {
    return res.status(409).json({ error: "Push subscription belongs to another user" });
  }
  if (stored.outcome === "unavailable") {
    return res.status(503).json({ error: "Unable to save push subscription" });
  }
  await db.insert(userChannelPreferences).values({
    user_id: userId,
    medication_refill_push_enabled: true,
  }).onConflictDoUpdate({
    target: userChannelPreferences.user_id,
    set: { medication_refill_push_enabled: true, updated_at: new Date() },
  });
  return res.json({ ok: true, consentEnabled: true, subscribed: true });
});

router.delete("/subscriptions", async (req, res) => {
  await ensureRefillPersistence();
  const userId = req.user!.id;
  await db.insert(userChannelPreferences).values({
    user_id: userId,
    medication_refill_push_enabled: false,
  }).onConflictDoUpdate({
    target: userChannelPreferences.user_id,
    set: { medication_refill_push_enabled: false, updated_at: new Date() },
  });
  const preventiveConsent = await defaultPreventiveWebPushStore.readConsent(userId);
  if (!preventiveConsent.enabled) {
    await defaultPreventiveWebPushStore.revokeSubscriptions({ userId, now: new Date() });
  }
  return res.json({ ok: true, consentEnabled: false, subscribed: preventiveConsent.enabled });
});

export default router;
