import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryProactiveEngagementAuditStore } from "./proactiveAuditPersistence.js";
import { baseProactiveEvaluationInput } from "./proactiveFixtures.js";
import { runPreventiveWebPushEntry } from "./preventiveWebPushRuntime.js";
import {
  InMemoryPreventiveWebPushStore,
  type PreventiveWebPushStore,
} from "./preventiveWebPushStore.js";
import {
  normalizePreventiveWebPushSubscription,
} from "./preventiveWebPushSecurity.js";
import {
  basePreventiveWebPushEvaluationInput,
  validPreventiveWebPushEnv,
  validPreventiveWebPushSubscription,
} from "./preventiveWebPushFixtures.js";

const now = () => new Date("2026-08-03T12:00:00.000Z");

function provider() {
  return {
    send: vi.fn(async () => ({ outcome: "sent" as const, providerStatus: 201 })),
  };
}

async function consentedStore() {
  const store = new InMemoryPreventiveWebPushStore();
  const consent = await store.setConsent({ userId: "user.test.elder", enabled: true, now: now() });
  const normalized = normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription());
  expect(normalized.ok).toBe(true);
  if (!normalized.ok) return store;
  await store.upsertSubscription({
    userId: "user.test.elder",
    subscription: normalized.subscription,
    consentRevision: consent.revision,
    now: now(),
  });
  return store;
}

function failFirstSentPersistence(store: InMemoryPreventiveWebPushStore): PreventiveWebPushStore {
  let failed = false;
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "markDeliverySent") {
        return vi.fn(async (input: Parameters<PreventiveWebPushStore["markDeliverySent"]>[0]) => {
          if (!failed) {
            failed = true;
            throw new Error("simulated_sent_persistence_failure");
          }
          return target.markDeliverySent(input);
        });
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as PreventiveWebPushStore;
}

describe("Task 10 preventive web push runtime", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes Task 8 audit first and remains disabled by default", async () => {
    const auditStore = new InMemoryProactiveEngagementAuditStore();
    const sendProvider = provider();
    await expect(runPreventiveWebPushEntry({
      userId: "user.test.elder",
      evaluationInput: basePreventiveWebPushEvaluationInput(),
    }, {
      auditStore,
      pushStore: await consentedStore(),
      provider: sendProvider,
      currentTime: now,
      env: {},
    })).resolves.toMatchObject({
      outcome: "flag_disabled",
      sent: false,
      fallbackAttempted: false,
      auditOnlyTask8Evaluated: true,
    });
    expect(auditStore.snapshot()).toHaveLength(1);
    expect(sendProvider.send).toHaveBeenCalledTimes(0);
  });

  it("rejects non-inert caller input without audit, flag, persistence, or provider work", async () => {
    const auditStore = new InMemoryProactiveEngagementAuditStore();
    const sendProvider = provider();
    let getterCalls = 0;
    const unsafe = {
      userId: "user.test.elder",
      evaluationInput: basePreventiveWebPushEvaluationInput(),
    };
    Object.defineProperty(unsafe, "userId", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "user.test.elder";
      },
    });
    await expect(runPreventiveWebPushEntry(unsafe, {
      auditStore,
      pushStore: await consentedStore(),
      provider: sendProvider,
      currentTime: now,
      env: validPreventiveWebPushEnv(),
    })).resolves.toMatchObject({ outcome: "invalid_input" });
    expect(getterCalls).toBe(0);
    expect(auditStore.snapshot()).toHaveLength(0);
    expect(sendProvider.send).toHaveBeenCalledTimes(0);
  });

  it("does not turn Task 8 into a dispatcher for other channels", async () => {
    const auditStore = new InMemoryProactiveEngagementAuditStore();
    const sendProvider = provider();
    await expect(runPreventiveWebPushEntry({
      userId: "user.test.elder",
      evaluationInput: baseProactiveEvaluationInput(),
    }, {
      auditStore,
      pushStore: await consentedStore(),
      provider: sendProvider,
      currentTime: now,
      env: validPreventiveWebPushEnv(),
    })).resolves.toMatchObject({
      outcome: "task8_not_web_push",
      sent: false,
      fallbackAttempted: false,
    });
    expect(auditStore.snapshot()).toHaveLength(1);
    expect(sendProvider.send).toHaveBeenCalledTimes(0);
  });

  it("requires server-side consent and an active subscription after policy allow", async () => {
    const auditStore = new InMemoryProactiveEngagementAuditStore();
    const sendProvider = provider();
    await expect(runPreventiveWebPushEntry({
      userId: "user.test.elder",
      evaluationInput: basePreventiveWebPushEvaluationInput(),
    }, {
      auditStore,
      pushStore: new InMemoryPreventiveWebPushStore(),
      provider: sendProvider,
      currentTime: now,
      env: validPreventiveWebPushEnv(),
    })).resolves.toMatchObject({
      outcome: "subscription_not_consented",
      sent: false,
    });
    expect(sendProvider.send).toHaveBeenCalledTimes(0);
  });

  it("claims delivery before provider send and persists duplicate results idempotently", async () => {
    const auditStore = new InMemoryProactiveEngagementAuditStore();
    const pushStore = await consentedStore();
    const sendProvider = provider();
    const input = {
      userId: "user.test.elder",
      evaluationInput: basePreventiveWebPushEvaluationInput(),
    };
    await expect(runPreventiveWebPushEntry(input, {
      auditStore,
      pushStore,
      provider: sendProvider,
      currentTime: now,
      env: validPreventiveWebPushEnv(),
      idFactory: () => "claim.test.1",
    })).resolves.toMatchObject({
      outcome: "sent",
      sent: true,
      channel: "web_push",
      flowId: "health.preventive_check",
      flowVersion: "1.0.0",
    });
    await expect(runPreventiveWebPushEntry(input, {
      auditStore,
      pushStore,
      provider: sendProvider,
      currentTime: now,
      env: validPreventiveWebPushEnv(),
      idFactory: () => "claim.test.2",
    })).resolves.toMatchObject({
      outcome: "delivery_duplicate",
      sent: false,
    });
    expect(sendProvider.send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(pushStore.snapshot())).toMatch(/"status":"sent"/);
    expect(JSON.stringify(sendProvider.send.mock.calls)).not.toMatch(/energy_level|mood|symptom/i);
  });

  it("does not blindly resend after provider acceptance when final sent persistence fails", async () => {
    const auditStore = new InMemoryProactiveEngagementAuditStore();
    const baseStore = await consentedStore();
    const pushStore = failFirstSentPersistence(baseStore);
    const sendProvider = provider();
    const input = {
      userId: "user.test.elder",
      evaluationInput: basePreventiveWebPushEvaluationInput(),
    };
    await expect(runPreventiveWebPushEntry(input, {
      auditStore,
      pushStore,
      provider: sendProvider,
      currentTime: now,
      env: validPreventiveWebPushEnv(),
      idFactory: () => "runtime.id",
    })).resolves.toMatchObject({
      outcome: "delivery_uncertain",
      sent: false,
    });
    await expect(runPreventiveWebPushEntry(input, {
      auditStore,
      pushStore,
      provider: sendProvider,
      currentTime: () => new Date("2026-08-03T12:03:00.000Z"),
      env: validPreventiveWebPushEnv(),
      idFactory: () => "runtime.retry",
    })).resolves.toMatchObject({
      outcome: "delivery_uncertain",
      sent: false,
    });
    expect(sendProvider.send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(baseStore.snapshot())).toMatch(/"status":"delivery_uncertain"/);
  });

  it("bounds concurrent duplicate dispatches to one automatic provider call", async () => {
    const auditStore = new InMemoryProactiveEngagementAuditStore();
    const pushStore = await consentedStore();
    const sendProvider = provider();
    const input = {
      userId: "user.test.elder",
      evaluationInput: basePreventiveWebPushEvaluationInput(),
    };
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) =>
      runPreventiveWebPushEntry(input, {
        auditStore,
        pushStore,
        provider: sendProvider,
        currentTime: now,
        env: validPreventiveWebPushEnv(),
        idFactory: () => `runtime.concurrent.${index}`,
      })
    ));
    expect(sendProvider.send).toHaveBeenCalledTimes(1);
    expect(results.filter((item) => item.outcome === "sent")).toHaveLength(1);
    expect(results.every((item) =>
      item.outcome === "sent" ||
      item.outcome === "delivery_pending" ||
      item.outcome === "delivery_duplicate" ||
      item.outcome === "delivery_uncertain"
    )).toBe(true);
  });

  it("marks expired provider subscriptions as permanent failures without fallback delivery", async () => {
    const sendProvider = {
      send: vi.fn(async () => ({
        outcome: "failed_permanent" as const,
        providerStatus: 410,
        reason: "provider_permanent_failure",
      })),
    };
    await expect(runPreventiveWebPushEntry({
      userId: "user.test.elder",
      evaluationInput: basePreventiveWebPushEvaluationInput(),
    }, {
      auditStore: new InMemoryProactiveEngagementAuditStore(),
      pushStore: await consentedStore(),
      provider: sendProvider,
      currentTime: now,
      env: validPreventiveWebPushEnv(),
    })).resolves.toMatchObject({
      outcome: "provider_failed_permanent",
      sent: false,
      fallbackAttempted: false,
    });
  });
});
