import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryPreventiveWebPushStore } from "../engagement/preventiveWebPushStore.js";
import { createPreventiveWebPushRouter } from "./preventiveWebPush.js";
import {
  normalizePreventiveWebPushSubscription,
  parsePreventiveWebPushEntryToken,
  sha256Digest,
} from "../engagement/preventiveWebPushSecurity.js";
import {
  validPreventiveWebPushEnv,
  validPreventiveWebPushSubscription,
} from "../engagement/preventiveWebPushFixtures.js";

function app(store: InMemoryPreventiveWebPushStore, userId = "profile.test.elder") {
  const value = express();
  value.use(express.json());
  value.use("/api/preventive-web-push", createPreventiveWebPushRouter({
    store,
    env: validPreventiveWebPushEnv(),
    currentTime: () => new Date("2026-08-03T12:00:00.000Z"),
    resolveProfileId: async () => userId,
  }));
  return value;
}

async function createDeliveredEntry(input: {
  store: InMemoryPreventiveWebPushStore;
  userId?: string;
  token?: string;
  now?: Date;
}) {
  const userId = input.userId ?? "profile.test.elder";
  const token = input.token ?? "a".repeat(43);
  const now = input.now ?? new Date("2026-08-03T12:00:00.000Z");
  const consent = await input.store.setConsent({ userId, enabled: true, now });
  const normalized = normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription());
  expect(normalized.ok).toBe(true);
  if (!normalized.ok) throw new Error("invalid test subscription");
  const stored = await input.store.upsertSubscription({
    userId,
    subscription: normalized.subscription,
    consentRevision: consent.revision,
    now,
  });
  expect(stored.outcome).toBe("stored");
  if (stored.outcome !== "stored") throw new Error("test subscription not stored");
  const parsed = parsePreventiveWebPushEntryToken(token);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error("invalid test token");
  const claim = await input.store.acquireDeliveryClaim({
    userId,
    subscriptionId: stored.subscription.id,
    scheduleOccurrenceId: `occurrence.${token.slice(0, 8)}`,
    scheduleId: "schedule.daily.checkin",
    policyAuditId: "audit.test",
    policyDecisionDigest: `sha256:${"b".repeat(64)}`,
    entryTokenDigest: parsed.tokenDigest,
    claimToken: "claim.test",
    claimExpiresAt: new Date(now.getTime() + 60_000),
    now,
  });
  expect(claim.outcome).toBe("acquired");
  if (claim.outcome !== "acquired") throw new Error("test delivery not acquired");
  const providerAttempt = await input.store.markProviderAttemptStarted({
    deliveryId: claim.delivery.id,
    claimToken: "claim.test",
    providerAttemptId: "provider-attempt.test",
    now,
  });
  expect(providerAttempt.outcome).toBe("started");
  await input.store.recordEntryToken({
    deliveryId: claim.delivery.id,
    userId,
    tokenDigest: parsed.tokenDigest,
    scheduleOccurrenceId: `occurrence.${token.slice(0, 8)}`,
    issuedAt: new Date(now.getTime() - 60_000),
    expiresAt: new Date(now.getTime() + 30 * 60_000),
  });
  await input.store.markProviderAccepted({
    deliveryId: claim.delivery.id,
    providerAttemptId: "provider-attempt.test",
    providerStatus: 201,
    now,
  });
  await input.store.markDeliverySent({
    deliveryId: claim.delivery.id,
    providerAttemptId: "provider-attempt.test",
    providerStatus: 201,
    now,
  });
  return { token };
}

describe("Task 10 preventive web push routes", () => {
  it("subscribes only through the authenticated profile context and rejects spoofed body user IDs", async () => {
    const store = new InMemoryPreventiveWebPushStore();
    await request(app(store))
      .post("/api/preventive-web-push/subscriptions?userId=attacker")
      .set("x-user-id", "attacker")
      .send({
        userId: "attacker",
        subscription: validPreventiveWebPushSubscription(),
      })
      .expect(400);

    const response = await request(app(store))
      .post("/api/preventive-web-push/subscriptions?userId=attacker")
      .set("x-user-id", "attacker")
      .send({
        subscription: validPreventiveWebPushSubscription(),
      })
      .expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      consentEnabled: true,
      subscribed: true,
    });
    expect(await store.readConsent("profile.test.elder")).toMatchObject({ enabled: true });
    expect(await store.readConsent("attacker")).toMatchObject({ enabled: false });
  });

  it("rejects malformed or unsafe subscription payloads without server-side consent", async () => {
    const store = new InMemoryPreventiveWebPushStore();
    await request(app(store))
      .post("/api/preventive-web-push/subscriptions")
      .send([validPreventiveWebPushSubscription()])
      .expect(400);
    await request(app(store))
      .post("/api/preventive-web-push/subscriptions")
      .send(JSON.parse('{"subscription":{"endpoint":"https://fcm.googleapis.com/fcm/send/token"},"__proto__":{"polluted":true}}'))
      .expect(400);
    await request(app(store))
      .post("/api/preventive-web-push/subscriptions")
      .send({
        subscription: validPreventiveWebPushSubscription({
          endpoint: "http://127.0.0.1/push",
        }),
      })
      .expect(400);
    expect(await store.readConsent("profile.test.elder")).toMatchObject({ enabled: false });
  });

  it("revokes server consent before local browser unsubscribe work happens on the client", async () => {
    const store = new InMemoryPreventiveWebPushStore();
    await request(app(store))
      .post("/api/preventive-web-push/subscriptions")
      .send({ subscription: validPreventiveWebPushSubscription() })
      .expect(200);
    await request(app(store))
      .delete("/api/preventive-web-push/subscriptions")
      .expect(200);
    expect(await store.readConsent("profile.test.elder")).toMatchObject({ enabled: false });
    expect(await store.activeSubscription("profile.test.elder")).toBeNull();
  });

  it("redeems opaque same-user entry tokens and never accepts arbitrary route redirects", async () => {
    const store = new InMemoryPreventiveWebPushStore();
    const { token } = await createDeliveredEntry({ store });

    await request(app(store))
      .post("/api/preventive-web-push/entry/redeem")
      .send({ token, redirect: "https://evil.example" })
      .expect(400);
    await request(app(store))
      .post("/api/preventive-web-push/entry/redeem")
      .send([{ token }])
      .expect(400);

    const redeemed = await request(app(store))
      .post("/api/preventive-web-push/entry/redeem")
      .send({ token })
      .expect(200);
    expect(redeemed.body).toMatchObject({
      ok: true,
      route: "/health/check-in",
      flowId: "health.preventive_check",
      flowVersion: "1.0.0",
    });

    const flowStarted = await request(app(store))
      .post("/api/preventive-web-push/entry/flow-started")
      .send({ entryId: redeemed.body.entryId })
      .expect(200);
    expect(flowStarted.body).toMatchObject({
      ok: true,
      status: "flow_started",
      route: "/health/check-in",
      flowId: "health.preventive_check",
      flowVersion: "1.0.0",
    });
  });

  it("rejects cross-user entry redemption", async () => {
    const store = new InMemoryPreventiveWebPushStore();
    const token = "b".repeat(43);
    expect(sha256Digest(token)).toMatch(/^sha256:[a-f0-9]{64}$/);
    await createDeliveredEntry({ store, token });
    await request(app(store, "profile.other"))
      .post("/api/preventive-web-push/entry/redeem")
      .send({ token })
      .expect(404);
  });

  it("fails closed after consent is revoked before click or before Flow start", async () => {
    const store = new InMemoryPreventiveWebPushStore();
    const now = new Date("2026-08-03T12:00:00.000Z");
    const { token } = await createDeliveredEntry({ store, token: "c".repeat(43), now });
    await store.setConsent({ userId: "profile.test.elder", enabled: false, now: new Date(now.getTime() + 1_000) });
    await request(app(store))
      .post("/api/preventive-web-push/entry/redeem")
      .send({ token })
      .expect(404);

    const second = await createDeliveredEntry({ store, token: "d".repeat(43), now: new Date(now.getTime() + 2_000) });
    const opened = await request(app(store))
      .post("/api/preventive-web-push/entry/redeem")
      .send({ token: second.token })
      .expect(200);
    await store.setConsent({ userId: "profile.test.elder", enabled: false, now: new Date(now.getTime() + 3_000) });
    await request(app(store))
      .post("/api/preventive-web-push/entry/flow-started")
      .send({ entryId: opened.body.entryId })
      .expect(404);
  });
});
