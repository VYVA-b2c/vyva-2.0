import { describe, expect, it, vi } from "vitest";
import {
  createPreventiveWebPushProvider,
  resolvePreventiveWebPushProviderConfig,
} from "./preventiveWebPushProvider.js";
import {
  validVapidPublicKey,
  validPreventiveWebPushEnv,
  validPreventiveWebPushSubscription,
} from "./preventiveWebPushFixtures.js";
import { normalizePreventiveWebPushSubscription } from "./preventiveWebPushSecurity.js";

describe("Task 10 preventive web push provider adapter", () => {
  it("accepts only strict VAPID configuration", () => {
    expect(resolvePreventiveWebPushProviderConfig(validPreventiveWebPushEnv())).toMatchObject({ ok: true });
    expect(resolvePreventiveWebPushProviderConfig(validPreventiveWebPushEnv({
      VYVA_WEB_PUSH_VAPID_SUBJECT: " https://example.com",
    }))).toEqual({ ok: false, reason: "invalid" });
    expect(resolvePreventiveWebPushProviderConfig(validPreventiveWebPushEnv({
      VYVA_WEB_PUSH_VAPID_SUBJECT: "http://example.com",
    }))).toEqual({ ok: false, reason: "invalid" });
    expect(resolvePreventiveWebPushProviderConfig(validPreventiveWebPushEnv({
      VYVA_WEB_PUSH_VAPID_SUBJECT: "https://localhost",
    }))).toEqual({ ok: false, reason: "invalid" });
    expect(resolvePreventiveWebPushProviderConfig(validPreventiveWebPushEnv({
      VYVA_WEB_PUSH_VAPID_PUBLIC_KEY: Buffer.alloc(60, 1).toString("base64url"),
    }))).toEqual({ ok: false, reason: "invalid" });
    expect(resolvePreventiveWebPushProviderConfig(validPreventiveWebPushEnv({
      VYVA_WEB_PUSH_VAPID_PRIVATE_KEY: Buffer.alloc(12, 1).toString("base64url"),
    }))).toEqual({ ok: false, reason: "invalid" });
    expect(resolvePreventiveWebPushProviderConfig(validPreventiveWebPushEnv({
      VYVA_WEB_PUSH_VAPID_PUBLIC_KEY: `${validVapidPublicKey}=`,
    }))).toEqual({ ok: false, reason: "invalid" });
    expect(resolvePreventiveWebPushProviderConfig(validPreventiveWebPushEnv({
      VYVA_WEB_PUSH_VAPID_PUBLIC_KEY: validVapidPublicKey,
      VYVA_WEB_PUSH_VAPID_PRIVATE_KEY: Buffer.from([1, ...Array.from({ length: 31 }, () => 0)]).toString("base64url"),
    }))).toEqual({ ok: false, reason: "invalid" });
    expect(JSON.stringify(resolvePreventiveWebPushProviderConfig(validPreventiveWebPushEnv({
      VYVA_WEB_PUSH_VAPID_PRIVATE_KEY: "not-a-private-key",
    })))).not.toContain("not-a-private-key");
    expect(resolvePreventiveWebPushProviderConfig({})).toEqual({ ok: false, reason: "missing" });
  });

  it("uses the established web-push sender and fixed payload shape", async () => {
    const normalized = normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription());
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    const sender = {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn(async () => ({ statusCode: 201, headers: {} })),
    };
    const resolved = resolvePreventiveWebPushProviderConfig(validPreventiveWebPushEnv());
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const provider = createPreventiveWebPushProvider({
      config: resolved.config,
      sender,
    });
    await expect(provider.send({
      subscription: normalized.subscription,
      payload: { type: "vyva.preventive_check", token: "a".repeat(43) },
    })).resolves.toEqual({ outcome: "sent", providerStatus: 201 });
    expect(sender.setVapidDetails).toHaveBeenCalledTimes(1);
    expect(sender.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: normalized.subscription.endpoint,
        keys: normalized.subscription.keys,
      },
      JSON.stringify({ type: "vyva.preventive_check", token: "a".repeat(43) }),
      expect.objectContaining({ topic: "vyva-preventive-check" }),
    );
  });

  it("classifies expired browser subscriptions as permanent failures", async () => {
    const normalized = normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription());
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    const sender = {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn(async () => {
        const error = new Error("gone") as Error & { statusCode: number };
        error.statusCode = 410;
        throw error;
      }),
    };
    const resolved = resolvePreventiveWebPushProviderConfig(validPreventiveWebPushEnv());
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const provider = createPreventiveWebPushProvider({ config: resolved.config, sender });
    await expect(provider.send({
      subscription: normalized.subscription,
      payload: { type: "vyva.preventive_check", token: "a".repeat(43) },
    })).resolves.toEqual({
      outcome: "failed_permanent",
      providerStatus: 410,
      reason: "provider_permanent_failure",
    });
  });

  it("sends the fixed refill payload on a medicine-specific push topic", async () => {
    const normalized = normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription());
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    const sender = {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn(async () => ({ statusCode: 201, headers: {} })),
    };
    const resolved = resolvePreventiveWebPushProviderConfig(validPreventiveWebPushEnv());
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const provider = createPreventiveWebPushProvider({ config: resolved.config, sender });
    const payload = {
      type: "vyva.medication_refill" as const,
      deliveryId: "11111111-1111-4111-8111-111111111111",
      alertId: "22222222-2222-4222-8222-222222222222",
    };
    await expect(provider.send({ subscription: normalized.subscription, payload }))
      .resolves.toEqual({ outcome: "sent", providerStatus: 201 });
    expect(sender.sendNotification).toHaveBeenCalledWith(
      expect.any(Object),
      JSON.stringify(payload),
      expect.objectContaining({ topic: `vyva-refill-${payload.alertId}` }),
    );
  });
});
