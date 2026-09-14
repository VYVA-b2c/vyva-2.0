import { describe, expect, it, vi } from "vitest";
import { InMemoryProactiveEngagementAuditStore } from "./proactiveAuditPersistence.js";
import {
  InMemoryPreventiveOutboundCallStore,
  type PreventiveOutboundCallProviderAttemptStart,
} from "./preventiveOutboundCallStore.js";
import {
  revokePreventiveOutboundCallConsent,
  runPreventiveOutboundCallEntry,
} from "./preventiveOutboundCallRuntime.js";
import {
  basePreventiveOutboundCallEvaluationInput,
  validPreventiveOutboundCallEnv,
  validPreventiveOutboundCallNow,
  validPreventiveOutboundCallPhone,
} from "./preventiveOutboundCallFixtures.js";
import type { PreventiveOutboundCallProvider } from "./preventiveOutboundCallProvider.js";

function provider(
  result: Awaited<ReturnType<PreventiveOutboundCallProvider["start"]>>,
  cancelResult?: Awaited<ReturnType<NonNullable<PreventiveOutboundCallProvider["cancel"]>>>,
): PreventiveOutboundCallProvider {
  return {
    start: vi.fn(async () => result),
    cancel: vi.fn(async () => cancelResult ?? { outcome: "cancel_requested" }),
  };
}

async function consentedStore() {
  const store = new InMemoryPreventiveOutboundCallStore();
  await store.provisionConsent({
    userId: "user.test",
    profileId: "profile.test.elder",
    enabled: true,
    phoneE164: validPreventiveOutboundCallPhone,
    phoneVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    verificationSource: "admin_provisioned",
    verificationReference: "ticket.task11",
    now: validPreventiveOutboundCallNow,
  });
  return store;
}

describe("Task 11 preventive outbound call runtime", () => {
  it("does not place a call when Task 8 blocks or does not choose voice_call", async () => {
    const callProvider = provider({
      outcome: "started",
      providerStatus: 201,
      providerConversationId: "conv.task11",
      twilioCallSid: "CA11111111111111111111111111111111",
    });
    const result = await runPreventiveOutboundCallEntry({
      userId: "user.test",
      profileId: "profile.test.elder",
      evaluationInput: basePreventiveOutboundCallEvaluationInput({
        channelCandidates: [],
      }),
    }, {
      auditStore: new InMemoryProactiveEngagementAuditStore(),
      callStore: await consentedStore(),
      provider: callProvider,
      env: validPreventiveOutboundCallEnv(),
      currentTime: () => validPreventiveOutboundCallNow,
    });
    expect(result.outcome).toBe("invalid_input");
    expect(callProvider.start).not.toHaveBeenCalled();
  });

  it("requires dedicated call consent and verified phone after the allowlist flag", async () => {
    const store = new InMemoryPreventiveOutboundCallStore();
    const callProvider = provider({
      outcome: "started",
      providerStatus: 201,
      providerConversationId: "conv.task11",
      twilioCallSid: "CA11111111111111111111111111111111",
    });
    const result = await runPreventiveOutboundCallEntry({
      userId: "user.test",
      profileId: "profile.test.elder",
      evaluationInput: basePreventiveOutboundCallEvaluationInput(),
    }, {
      auditStore: new InMemoryProactiveEngagementAuditStore(),
      callStore: store,
      provider: callProvider,
      env: validPreventiveOutboundCallEnv(),
      currentTime: () => validPreventiveOutboundCallNow,
    });
    expect(result).toMatchObject({ outcome: "not_consented", providerStarted: false });
    expect(callProvider.start).not.toHaveBeenCalled();
  });

  it("starts exactly one provider call for duplicate schedule occurrence attempts", async () => {
    const store = await consentedStore();
    const callProvider = provider({
      outcome: "started",
      providerStatus: 201,
      providerConversationId: "conv.task11",
      twilioCallSid: "CA11111111111111111111111111111111",
    });
    const input = {
      userId: "user.test",
      profileId: "profile.test.elder",
      evaluationInput: basePreventiveOutboundCallEvaluationInput(),
    };
    const results = await Promise.all(Array.from({ length: 10 }, () =>
      runPreventiveOutboundCallEntry(input, {
        auditStore: new InMemoryProactiveEngagementAuditStore(),
        callStore: store,
        provider: callProvider,
        env: validPreventiveOutboundCallEnv(),
        currentTime: () => validPreventiveOutboundCallNow,
      })
    ));
    expect(results.filter((item) => item.outcome === "provider_started")).toHaveLength(1);
    expect(results.filter((item) => item.outcome === "call_pending" || item.outcome === "call_duplicate").length)
      .toBeGreaterThanOrEqual(1);
    expect(callProvider.start).toHaveBeenCalledTimes(1);
    expect(JSON.stringify((callProvider.start as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]))
      .not.toMatch(/symptom|medication|diagnosis|transcript|recording/i);
  });

  it("does not blindly redial provider-accepted calls when local persistence becomes uncertain", async () => {
    const store = await consentedStore();
    const baseMark = store.markProviderStarted.bind(store);
    let failOnce = true;
    store.markProviderStarted = vi.fn(async (input) => {
      if (failOnce) {
        failOnce = false;
        await store.markProviderFailed({
          attemptId: input.attemptId,
          providerAttemptId: input.providerAttemptId,
          status: "delivery_uncertain",
          reason: "test_uncertain",
          now: input.now,
        });
        return { outcome: "unavailable" };
      }
      return baseMark(input);
    });
    const callProvider = provider({
      outcome: "started",
      providerStatus: 201,
      providerConversationId: "conv.task11",
      twilioCallSid: "CA11111111111111111111111111111111",
    });
    const deps = {
      auditStore: new InMemoryProactiveEngagementAuditStore(),
      callStore: store,
      provider: callProvider,
      env: validPreventiveOutboundCallEnv(),
      currentTime: () => validPreventiveOutboundCallNow,
    };
    const input = {
      userId: "user.test",
      profileId: "profile.test.elder",
      evaluationInput: basePreventiveOutboundCallEvaluationInput(),
    };
    expect(await runPreventiveOutboundCallEntry(input, deps)).toMatchObject({ outcome: "delivery_uncertain" });
    expect(await runPreventiveOutboundCallEntry(input, deps)).toMatchObject({ outcome: "delivery_uncertain" });
    expect(callProvider.start).toHaveBeenCalledTimes(1);
  });

  it("treats provider-start responses without required correlation as delivery-uncertain and non-confirmable", async () => {
    const store = await consentedStore();
    const callProvider = provider({
      outcome: "delivery_uncertain",
      providerStatus: 201,
      reason: "provider_missing_required_correlation",
    });
    const result = await runPreventiveOutboundCallEntry({
      userId: "user.test",
      profileId: "profile.test.elder",
      evaluationInput: basePreventiveOutboundCallEvaluationInput(),
    }, {
      auditStore: new InMemoryProactiveEngagementAuditStore(),
      callStore: store,
      provider: callProvider,
      env: validPreventiveOutboundCallEnv(),
      currentTime: () => validPreventiveOutboundCallNow,
    });
    expect(result).toMatchObject({
      outcome: "delivery_uncertain",
      providerStarted: false,
      reason: "provider_missing_required_correlation",
    });
  });

  it("does not automatically redial retryable provider failures in the first slice", async () => {
    const store = await consentedStore();
    const callProvider = provider({
      outcome: "failed_retryable",
      providerStatus: 503,
      reason: "provider_retryable_failure",
    });
    const deps = {
      auditStore: new InMemoryProactiveEngagementAuditStore(),
      callStore: store,
      provider: callProvider,
      env: validPreventiveOutboundCallEnv(),
      currentTime: () => validPreventiveOutboundCallNow,
    };
    const input = {
      userId: "user.test",
      profileId: "profile.test.elder",
      evaluationInput: basePreventiveOutboundCallEvaluationInput(),
    };

    expect(await runPreventiveOutboundCallEntry(input, deps)).toMatchObject({
      outcome: "provider_failed_retryable",
      providerStarted: false,
    });
    expect(await runPreventiveOutboundCallEntry(input, deps)).toMatchObject({
      outcome: "call_duplicate",
      providerStarted: false,
    });
    expect(callProvider.start).toHaveBeenCalledTimes(1);
  });

  it("rechecks consent immediately before dispatch", async () => {
    const store = await consentedStore();
    const baseMark = store.markProviderAttemptStarted.bind(store);
    store.markProviderAttemptStarted = vi.fn(async (input): Promise<PreventiveOutboundCallProviderAttemptStart> => {
      const started = await baseMark(input);
      await store.revokeConsent({
        userId: "user.test",
        profileId: "profile.test.elder",
        now: new Date("2026-08-03T12:00:01.000Z"),
      });
      return started;
    });
    const callProvider = provider({
      outcome: "started",
      providerStatus: 201,
      providerConversationId: "conv.task11",
      twilioCallSid: "CA11111111111111111111111111111111",
    });
    const result = await runPreventiveOutboundCallEntry({
      userId: "user.test",
      profileId: "profile.test.elder",
      evaluationInput: basePreventiveOutboundCallEvaluationInput(),
    }, {
      auditStore: new InMemoryProactiveEngagementAuditStore(),
      callStore: store,
      provider: callProvider,
      env: validPreventiveOutboundCallEnv(),
      currentTime: () => validPreventiveOutboundCallNow,
    });
    expect(result).toMatchObject({ outcome: "not_consented" });
    expect(callProvider.start).not.toHaveBeenCalled();
  });

  it("revokes consent without a provider cancel call before dispatch", async () => {
    const store = await consentedStore();
    const callProvider = provider({
      outcome: "started",
      providerStatus: 201,
      providerConversationId: "conv.task11",
      twilioCallSid: "CA11111111111111111111111111111111",
    });
    await expect(revokePreventiveOutboundCallConsent({
      userId: "user.test",
      profileId: "profile.test.elder",
    }, {
      callStore: store,
      provider: callProvider,
      currentTime: () => validPreventiveOutboundCallNow,
    })).resolves.toMatchObject({
      outcome: "revoked",
      cancellationAttempts: 0,
    });
    expect(callProvider.cancel).not.toHaveBeenCalled();
  });

  it("cancels a correlated ringing call once, persists failure, and never restores consent", async () => {
    const store = await consentedStore();
    const callProvider = provider({
      outcome: "started",
      providerStatus: 201,
      providerConversationId: "conv.task11",
      twilioCallSid: "CA11111111111111111111111111111111",
    }, { outcome: "failed", reason: "provider_cancel_failed" });
    const input = {
      userId: "user.test",
      profileId: "profile.test.elder",
      evaluationInput: basePreventiveOutboundCallEvaluationInput(),
    };
    await runPreventiveOutboundCallEntry(input, {
      auditStore: new InMemoryProactiveEngagementAuditStore(),
      callStore: store,
      provider: callProvider,
      env: validPreventiveOutboundCallEnv(),
      currentTime: () => validPreventiveOutboundCallNow,
    });
    const attempt = store.snapshotAttempts()[0];
    expect(attempt?.twilioCallSid).toBe("CA11111111111111111111111111111111");
    await store.recordTwilioStatus({
      eventKey: `sha256:${"9".repeat(64)}`,
      twilioCallSid: "CA11111111111111111111111111111111",
      providerStatus: "ringing",
      receivedAt: validPreventiveOutboundCallNow,
    });
    const revoke = () => revokePreventiveOutboundCallConsent({
      userId: "user.test",
      profileId: "profile.test.elder",
    }, {
      callStore: store,
      provider: callProvider,
      currentTime: () => new Date("2026-08-03T12:01:00.000Z"),
    });
    const results = await Promise.all([revoke(), revoke()]);
    expect(results.reduce((sum, item) => sum + item.cancellationAttempts, 0)).toBe(1);
    expect(callProvider.cancel).toHaveBeenCalledTimes(1);
    const after = store.snapshotAttempts()[0];
    expect(after?.cancellationStatus).toBe("failed");
    await expect(store.readConsent({ userId: "user.test", profileId: "profile.test.elder" }))
      .resolves.toMatchObject({ enabled: false });
  });
});
