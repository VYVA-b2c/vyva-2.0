import { describe, expect, it } from "vitest";
import {
  proactiveChannelSchema,
  proactiveConsentFactSchema,
  proactiveEngagementAuditSchema,
  proactiveEngagementEvaluationInputSchema,
  proactiveEngagementIdempotencyKey,
  proactiveEngagementPolicyDecisionSchema,
  proactiveIanaTimeZoneSchema,
  proactiveIsoDateTimeSchema,
  proactiveReasonCodeSchema,
  type ProactiveEngagementEvaluationInput,
} from "./proactiveEngagement.js";

function validInput(): ProactiveEngagementEvaluationInput {
  return {
    schemaVersion: "1.0.0",
    evaluationId: "eval.contract.valid",
    policyVersion: "1.0.0",
    scheduleOccurrenceId: "occ.contract.valid",
    scheduleId: "schedule.contract.valid",
    purposeId: "preventive_health_check",
    dueAt: "2026-08-03T10:00:00.000Z",
    evaluatedAt: "2026-08-03T10:01:00.000Z",
    timezone: "Europe/Madrid",
    locale: "en-US",
    userRef: "user.contract",
    source: "scheduled_interaction",
    consentFacts: [{
      consentId: "consent.contract",
      purposeId: "preventive_health_check",
      channel: "in_app",
      subject: "user",
      state: "granted",
      effectiveAt: "2026-01-01T00:00:00.000Z",
      recordedAt: "2026-01-01T00:00:00.000Z",
      revision: 1,
    }],
    channelPreferences: {
      preferredChannel: "in_app",
      fallbackChain: [],
      fallbackPermissions: [],
    },
    channelCandidates: [{
      channel: "in_app",
      preferenceRank: 0,
      availability: "available",
      purposeId: "preventive_health_check",
    }],
    quietHours: { mode: "none" },
    recentAttempts: [],
    limitPolicy: { enforcement: "not_required", channelLimits: [] },
    existingAuditStates: [],
    nonExecutable: true,
  };
}

describe("Task 8 proactive engagement shared contracts", () => {
  it("accepts a minimized strict evaluation input", () => {
    expect(proactiveEngagementEvaluationInputSchema.parse(validInput()).schemaVersion).toBe("1.0.0");
  });

  it("validates all public timezone fields as IANA identifiers", () => {
    expect(proactiveIanaTimeZoneSchema.safeParse("Europe/Madrid").success).toBe(true);
    expect(proactiveIanaTimeZoneSchema.safeParse("UTC").success).toBe(true);
    expect(proactiveIanaTimeZoneSchema.safeParse("Asia/Kathmandu").success).toBe(true);
    expect(proactiveIanaTimeZoneSchema.safeParse("Not/A_Zone").success).toBe(false);
    expect(proactiveIanaTimeZoneSchema.safeParse("+01:00").success).toBe(false);
    expect(proactiveIanaTimeZoneSchema.safeParse("PST").success).toBe(false);

    const invalidEvaluationTimezone = { ...validInput(), timezone: "Not/A_Zone" };
    expect(proactiveEngagementEvaluationInputSchema.safeParse(invalidEvaluationTimezone).success).toBe(false);

    const invalidDecisionTimezone = {
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      decisionId: "decision.contract.timezone",
      evaluationId: "eval.contract.valid",
      scheduleOccurrenceId: "occ.contract.valid",
      scheduleId: "schedule.contract.valid",
      purposeId: "preventive_health_check",
      decision: "block",
      fallbackChainConsidered: [],
      reasonCodes: ["timezone_invalid"],
      evaluatedAt: "2026-08-03T10:01:00.000Z",
      localEvaluatedAt: "invalid-timezone",
      timezone: "+01:00",
      consentStatus: "missing",
      quietHoursStatus: "timezone_invalid",
      limitStatus: "not_configured",
      duplicateStatus: "not_duplicate",
      source: "scheduled_interaction",
      shadowOnly: true,
      nonExecutable: true,
    };
    expect(proactiveEngagementPolicyDecisionSchema.safeParse(invalidDecisionTimezone).success).toBe(false);

    const invalidAuditTimezone = {
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      auditId: "audit.contract.timezone",
      idempotencyKey: proactiveEngagementIdempotencyKey({
        policyVersion: "1.0.0",
        scheduleOccurrenceId: "occ.contract.valid",
        purposeId: "preventive_health_check",
      }),
      decisionDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      scheduleOccurrenceId: "occ.contract.valid",
      scheduleId: "schedule.contract.valid",
      purposeId: "preventive_health_check",
      decision: "block",
      reasonCodes: ["timezone_invalid"],
      dueAt: "2026-08-03T10:00:00.000Z",
      evaluatedAt: "2026-08-03T10:01:00.000Z",
      timezone: "PST",
      consentStatus: "missing",
      quietHoursStatus: "timezone_invalid",
      limitStatus: "not_configured",
      duplicateStatus: "not_duplicate",
      source: "scheduled_interaction",
      normalizedFacts: {
        fallbackChainConsidered: [],
        localEvaluatedAt: "invalid-timezone",
        channelCandidateCount: 1,
        recentAttemptCount: 0,
        consentFactCount: 1,
      },
      shadowOnly: true,
      nonExecutable: true,
    };
    expect(proactiveEngagementAuditSchema.safeParse(invalidAuditTimezone).success).toBe(false);
  });

  it("canonicalizes accepted timezone aliases and equivalent timestamp offsets", () => {
    expect(proactiveIanaTimeZoneSchema.parse("Etc/UTC")).toBe("UTC");
    expect(proactiveIanaTimeZoneSchema.parse("UTC")).toBe("UTC");
    expect(proactiveIanaTimeZoneSchema.parse("US/Eastern")).toBe("America/New_York");
    expect(proactiveIanaTimeZoneSchema.parse("America/New_York")).toBe("America/New_York");
    expect(proactiveIsoDateTimeSchema.parse("2026-08-03T12:00:00.000Z"))
      .toBe("2026-08-03T12:00:00.000Z");
    expect(proactiveIsoDateTimeSchema.parse("2026-08-03T13:00:00.000+01:00"))
      .toBe("2026-08-03T12:00:00.000Z");
    expect(proactiveIsoDateTimeSchema.parse("2026-08-03T07:00:00.000-05:00"))
      .toBe("2026-08-03T12:00:00.000Z");

    const parsedInput = proactiveEngagementEvaluationInputSchema.parse({
      ...validInput(),
      dueAt: "2026-08-03T11:00:00.000+01:00",
      evaluatedAt: "2026-08-03T11:01:00.000+01:00",
      timezone: "Etc/UTC",
      consentFacts: [{
        ...validInput().consentFacts[0],
        effectiveAt: "2026-01-01T01:00:00.000+01:00",
        recordedAt: "2026-01-01T01:00:00.000+01:00",
      }],
    });
    expect(parsedInput.timezone).toBe("UTC");
    expect(parsedInput.dueAt).toBe("2026-08-03T10:00:00.000Z");
    expect(parsedInput.evaluatedAt).toBe("2026-08-03T10:01:00.000Z");
    expect(parsedInput.consentFacts[0].effectiveAt).toBe("2026-01-01T00:00:00.000Z");
    expect(parsedInput.consentFacts[0].recordedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rejects unknown fields and explicit undefined", () => {
    expect(() => proactiveEngagementEvaluationInputSchema.parse({
      ...validInput(),
      metadata: {},
    })).toThrow();
    expect(() => proactiveEngagementEvaluationInputSchema.parse({
      ...validInput(),
      locale: undefined,
    })).toThrow();
  });

  it("keeps exported contract schemas descriptor-safe before Zod reads caller input", () => {
    let getterCalls = 0;
    let setterCalls = 0;
    const unsafeEvaluation = validInput() as Record<string, unknown>;
    Object.defineProperty(unsafeEvaluation, "evaluationId", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "eval.unsafe";
      },
    });
    expect(proactiveEngagementEvaluationInputSchema.safeParse(unsafeEvaluation).success).toBe(false);
    expect(getterCalls).toBe(0);

    const unsafeConsentFact = { ...validInput().consentFacts[0] } as Record<string, unknown>;
    Object.defineProperty(unsafeConsentFact, "state", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "granted";
      },
    });
    expect(proactiveConsentFactSchema.safeParse(unsafeConsentFact).success).toBe(false);
    expect(getterCalls).toBe(0);

    const unsafeSetter = validInput() as Record<string, unknown>;
    Object.defineProperty(unsafeSetter, "source", {
      enumerable: true,
      set() {
        setterCalls += 1;
      },
    });
    expect(proactiveEngagementEvaluationInputSchema.safeParse(unsafeSetter).success).toBe(false);
    expect(setterCalls).toBe(0);

    const sparse = validInput();
    sparse.recentAttempts = Array(1) as never;
    expect(proactiveEngagementEvaluationInputSchema.safeParse(sparse).success).toBe(false);
  });

  it("uses closed channel and reason vocabularies", () => {
    expect(proactiveChannelSchema.safeParse("whatsapp").success).toBe(true);
    expect(proactiveChannelSchema.safeParse("push").success).toBe(false);
    expect(proactiveReasonCodeSchema.safeParse("quiet_hours").success).toBe(true);
    expect(proactiveReasonCodeSchema.safeParse("provider_error_raw").success).toBe(false);
  });

  it("rejects duplicate channel candidates, duplicate fallbacks and unsupported prototypes", () => {
    const duplicateCandidates = validInput();
    duplicateCandidates.channelCandidates = [
      ...duplicateCandidates.channelCandidates,
      duplicateCandidates.channelCandidates[0],
    ];
    expect(proactiveEngagementEvaluationInputSchema.safeParse(duplicateCandidates).success).toBe(false);

    const duplicateFallback = validInput();
    duplicateFallback.channelPreferences = {
      preferredChannel: "in_app",
      fallbackChain: ["email", "email"],
      fallbackPermissions: [],
    };
    expect(proactiveEngagementEvaluationInputSchema.safeParse(duplicateFallback).success).toBe(false);
  });

  it("requires allow decisions to propose a channel and blocks to omit one", () => {
    const allowDecision = {
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      decisionId: "decision.contract.allow",
      evaluationId: "eval.contract.valid",
      scheduleOccurrenceId: "occ.contract.valid",
      scheduleId: "schedule.contract.valid",
      purposeId: "preventive_health_check",
      decision: "allow",
      proposedChannel: "in_app",
      fallbackChainConsidered: ["in_app"],
      reasonCodes: [
        "consent_valid",
        "outside_quiet_hours",
        "within_frequency_limit",
        "eligible_preferred_channel",
        "occurrence_not_previously_evaluated",
      ],
      evaluatedAt: "2026-08-03T10:01:00.000Z",
      localEvaluatedAt: "2026-08-03T12:01:00",
      timezone: "Europe/Madrid",
      consentStatus: "valid",
      quietHoursStatus: "outside_quiet_hours",
      limitStatus: "within_limit",
      duplicateStatus: "not_duplicate",
      source: "scheduled_interaction",
      shadowOnly: true,
      nonExecutable: true,
    };
    expect(proactiveEngagementPolicyDecisionSchema.safeParse(allowDecision).success).toBe(true);
    expect(proactiveEngagementPolicyDecisionSchema.safeParse({
      ...allowDecision,
      proposedChannel: undefined,
    }).success).toBe(false);
    expect(proactiveEngagementPolicyDecisionSchema.safeParse({
      ...allowDecision,
      decision: "block",
      reasonCodes: ["quiet_hours"],
    }).success).toBe(false);
  });

  it("requires shadow-only non-executable audit records", () => {
    const audit = {
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      auditId: "audit.contract.valid",
      idempotencyKey: proactiveEngagementIdempotencyKey({
        policyVersion: "1.0.0",
        scheduleOccurrenceId: "occ.contract.valid",
        purposeId: "preventive_health_check",
      }),
      decisionDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      scheduleOccurrenceId: "occ.contract.valid",
      scheduleId: "schedule.contract.valid",
      purposeId: "preventive_health_check",
      decision: "block",
      reasonCodes: ["quiet_hours"],
      dueAt: "2026-08-03T10:00:00.000Z",
      evaluatedAt: "2026-08-03T10:01:00.000Z",
      timezone: "Europe/Madrid",
      consentStatus: "valid",
      quietHoursStatus: "inside_quiet_hours",
      limitStatus: "within_limit",
      duplicateStatus: "not_duplicate",
      source: "scheduled_interaction",
      normalizedFacts: {
        fallbackChainConsidered: ["in_app"],
        localEvaluatedAt: "2026-08-03T12:01:00",
        channelCandidateCount: 1,
        recentAttemptCount: 0,
        consentFactCount: 1,
      },
      shadowOnly: true,
      nonExecutable: true,
    };
    expect(proactiveEngagementAuditSchema.safeParse(audit).success).toBe(true);
    expect(proactiveEngagementAuditSchema.safeParse({ ...audit, shadowOnly: false }).success).toBe(false);
    expect(proactiveEngagementAuditSchema.safeParse({ ...audit, body: "hello" }).success).toBe(false);
  });
});
