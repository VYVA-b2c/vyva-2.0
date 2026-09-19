import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: { select: dbMocks.select },
}));

import { evaluateParsedProactiveEngagementPolicy } from "./proactivePolicy.js";
import { buildProactiveOutreachRuntimeInput, type ProactiveOutreachCandidate } from "./proactiveOutreachContext.js";
import { PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID } from "./preventiveOutboundCallSecurity.js";
import type { PreventiveOutboundCallConsentState, PreventiveOutboundCallStore } from "./preventiveOutboundCallStore.js";

function queryResolving(rows: unknown[]) {
  return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue(rows) })) })) };
}

const now = new Date("2026-09-18T12:00:00.000Z");

const candidate: ProactiveOutreachCandidate = {
  userId: "user.ctx",
  profileId: "user.ctx",
  reasonSummary: "your Wellness Coach noticed it's been a while",
  scheduleOccurrenceId: "proactive_outreach.wellness_silence.user.ctx.2026-09-18",
  scheduleId: "proactive_outreach.wellness_silence",
  source: "scheduled_interaction",
};

function consent(overrides: Partial<PreventiveOutboundCallConsentState> = {}): PreventiveOutboundCallConsentState {
  return {
    id: null,
    userId: "user.ctx",
    profileId: "user.ctx",
    enabled: false,
    revision: 0,
    phoneE164: null,
    phoneDigest: null,
    phoneLast4: null,
    phoneVerifiedAt: null,
    verificationSource: null,
    verificationReference: null,
    updatedAt: null,
    grantedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

function storeWith(consentState: PreventiveOutboundCallConsentState): PreventiveOutboundCallStore {
  return {
    readConsent: vi.fn().mockResolvedValue(consentState),
    listRecentAttempts: vi.fn().mockResolvedValue([]),
  } as unknown as PreventiveOutboundCallStore;
}

describe("buildProactiveOutreachRuntimeInput", () => {
  beforeEach(() => dbMocks.select.mockReset());

  it("carries the reason summary alongside a policy-engine-valid evaluation input", async () => {
    dbMocks.select.mockReturnValueOnce(queryResolving([{ timezone: "Europe/Madrid", language: "es" }]));
    const store = storeWith(consent({ id: "consent-1", enabled: true, grantedAt: now, phoneE164: "+34600000000" }));

    const runtimeInput = await buildProactiveOutreachRuntimeInput(candidate, { callStore: store, currentTime: () => now });

    expect(runtimeInput.reasonSummary).toBe(candidate.reasonSummary);
    expect(runtimeInput.evaluationInput.purposeId).toBe(PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID);
    expect(runtimeInput.evaluationInput.timezone).toBe("Europe/Madrid");
    expect(runtimeInput.evaluationInput.locale).toBe("es");

    // Must be genuinely valid input to the unchanged policy engine, not just
    // structurally typed - this is what "the actual new work" has to get right.
    const evaluation = evaluateParsedProactiveEngagementPolicy(runtimeInput.evaluationInput);
    expect(evaluation.ok).toBe(true);
  });

  it("marks consent as granted when the store says enabled, without requiring a separate opt-in fact", async () => {
    dbMocks.select.mockReturnValueOnce(queryResolving([]));
    const store = storeWith(consent({ id: "consent-2", enabled: true, grantedAt: now }));

    const runtimeInput = await buildProactiveOutreachRuntimeInput(candidate, { callStore: store, currentTime: () => now });
    const purposeFact = runtimeInput.evaluationInput.consentFacts.find((fact) => fact.channel === undefined);
    expect(purposeFact?.state).toBe("granted");
  });

  it("marks consent as unknown (not denied) when no consent record exists yet", async () => {
    dbMocks.select.mockReturnValueOnce(queryResolving([]));
    const store = storeWith(consent());

    const runtimeInput = await buildProactiveOutreachRuntimeInput(candidate, { callStore: store, currentTime: () => now });
    const purposeFact = runtimeInput.evaluationInput.consentFacts.find((fact) => fact.channel === undefined);
    expect(purposeFact?.state).toBe("unknown");
  });

  it("marks consent as revoked once a real consent record has enabled=false", async () => {
    dbMocks.select.mockReturnValueOnce(queryResolving([]));
    const store = storeWith(consent({ id: "consent-3", enabled: false, revokedAt: now }));

    const runtimeInput = await buildProactiveOutreachRuntimeInput(candidate, { callStore: store, currentTime: () => now });
    const purposeFact = runtimeInput.evaluationInput.consentFacts.find((fact) => fact.channel === undefined);
    expect(purposeFact?.state).toBe("revoked");
  });

  it("falls back to a safe default timezone and drops a malformed locale rather than failing", async () => {
    dbMocks.select.mockReturnValueOnce(queryResolving([{ timezone: null, language: "not-a-locale!!" }]));
    const store = storeWith(consent({ id: "consent-4", enabled: true, grantedAt: now }));

    const runtimeInput = await buildProactiveOutreachRuntimeInput(candidate, { callStore: store, currentTime: () => now });
    expect(runtimeInput.evaluationInput.timezone).toBe("Europe/Madrid");
    expect(runtimeInput.evaluationInput.locale).toBeUndefined();
  });
});
