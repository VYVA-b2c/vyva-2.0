import { describe, expect, it } from "vitest";
import {
  consentFromProfileDataSharing,
  evaluateHealthMemoryPolicy,
  resolveHealthMemoryPolicyFlag,
} from "./healthMemoryPolicy.js";
import {
  TASK13_NOW,
  TASK13_PROFILE_ID,
  TASK13_USER_ID,
  task13NoSemanticMemoryConsent,
  task13PilotEnv,
  task13RevokedSemanticMemoryConsent,
  task13SemanticMemoryConsent,
} from "./healthMemoryFixtures.js";

function policyInput(overrides: Record<string, unknown> = {}) {
  return {
    userId: TASK13_USER_ID,
    profileId: TASK13_PROFILE_ID,
    flowId: "health.preventive_check",
    flowVersion: "1.0.0",
    purpose: "health.preventive_check",
    category: "routine_health_context",
    operation: "read",
    target: "mem0",
    consent: consentFromProfileDataSharing(task13SemanticMemoryConsent),
    requestedAt: TASK13_NOW.toISOString(),
    ...overrides,
  };
}

describe("Task 13 Health memory policy", () => {
  it("fails closed by default and requires explicit pilot selection", () => {
    expect(resolveHealthMemoryPolicyFlag({ env: {}, userRef: TASK13_USER_ID })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "health_memory_policy_default_disabled",
    });
    expect(resolveHealthMemoryPolicyFlag({
      env: task13PilotEnv,
      userRef: TASK13_USER_ID,
      cohortKey: "flow-instance",
    })).toMatchObject({
      effectiveMode: "pilot",
      reasonCode: "health_memory_policy_allowed_user",
    });
    expect(resolveHealthMemoryPolicyFlag({
      env: {
        ...task13PilotEnv,
        VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_MODE: " pilot",
      },
      userRef: TASK13_USER_ID,
    })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "health_memory_policy_mode_invalid",
    });
  });

  it("allows category reads only when explicit semantic memory read consent exists", () => {
    const allowed = evaluateHealthMemoryPolicy(policyInput());
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.decision).toMatchObject({
      decision: "allow",
      reasonCode: "health_memory_policy_read_allowed",
      providerDeliveryAllowed: false,
    });

    const denied = evaluateHealthMemoryPolicy(policyInput({
      consent: consentFromProfileDataSharing(task13NoSemanticMemoryConsent),
    }));
    expect(denied.ok).toBe(true);
    if (!denied.ok) return;
    expect(denied.decision).toMatchObject({
      decision: "deny",
      reasonCode: "health_memory_policy_missing_read_consent",
    });
  });

  it("allows low-risk proposed writes only with explicit semantic memory write consent", () => {
    const allowed = evaluateHealthMemoryPolicy(policyInput({ operation: "propose_write" }));
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.decision).toMatchObject({
      decision: "allow",
      reasonCode: "health_memory_policy_proposal_allowed",
      providerDeliveryAllowed: true,
    });

    const approvalRequired = evaluateHealthMemoryPolicy(policyInput({
      operation: "propose_write",
      consent: consentFromProfileDataSharing(task13NoSemanticMemoryConsent),
    }));
    expect(approvalRequired.ok).toBe(true);
    if (!approvalRequired.ok) return;
    expect(approvalRequired.decision).toMatchObject({
      decision: "approval_required",
      reasonCode: "health_memory_policy_approval_required",
      providerDeliveryAllowed: false,
    });
  });

  it("does not treat a generic memory object as explicit semantic-memory consent", () => {
    expect(consentFromProfileDataSharing({
      memory: {
        read_allowed: true,
        write_allowed: true,
      },
    })).toMatchObject({
      semanticMemoryReadAllowed: false,
      semanticMemoryWriteAllowed: false,
    });
  });

  it.each([
    ["restricted_health", "health_memory_policy_restricted_requires_explicit_approval"],
    ["mental_health", "health_memory_policy_mental_health_requires_case_approval"],
    ["safety_emergency", "health_memory_policy_safety_not_semantic_memory"],
    ["care_instruction", "health_memory_policy_care_instruction_not_semantic_authority"],
  ])("never auto-writes %s semantic memory", (category, reasonCode) => {
    const decision = evaluateHealthMemoryPolicy(policyInput({
      category,
      operation: "propose_write",
      consent: consentFromProfileDataSharing(task13SemanticMemoryConsent),
    }));
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.decision).toMatchObject({
      decision: "proposal_only",
      reasonCode,
      providerDeliveryAllowed: false,
      retainedForAuditOnly: true,
    });
  });

  it("revoked consent blocks reads and writes before category decisions", () => {
    const decision = evaluateHealthMemoryPolicy(policyInput({
      operation: "propose_write",
      consent: consentFromProfileDataSharing(task13RevokedSemanticMemoryConsent),
    }));
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.decision).toMatchObject({
      decision: "deny",
      reasonCode: "health_memory_policy_consent_revoked",
      providerDeliveryAllowed: false,
    });
  });

  it("allows low-risk corrections only with current write consent", () => {
    const allowed = evaluateHealthMemoryPolicy(policyInput({ operation: "correct" }));
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.decision).toMatchObject({
      decision: "allow",
      reasonCode: "health_memory_policy_write_allowed",
      providerDeliveryAllowed: true,
    });

    const denied = evaluateHealthMemoryPolicy(policyInput({
      operation: "correct",
      consent: consentFromProfileDataSharing(task13NoSemanticMemoryConsent),
    }));
    expect(denied.ok).toBe(true);
    if (!denied.ok) return;
    expect(denied.decision).toMatchObject({
      decision: "deny",
      reasonCode: "health_memory_policy_missing_write_consent",
      providerDeliveryAllowed: false,
    });
  });

  it("rejects accessor-backed policy input without invoking getters", () => {
    let getterCalls = 0;
    const raw = policyInput();
    Object.defineProperty(raw, "category", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "routine_health_context";
      },
    });
    expect(evaluateHealthMemoryPolicy(raw)).toEqual({
      ok: false,
      reasonCode: "health_memory_policy_invalid_input",
    });
    expect(getterCalls).toBe(0);
  });

  it("produces stable decision digests for semantically identical decisions", () => {
    const first = evaluateHealthMemoryPolicy(policyInput());
    const second = evaluateHealthMemoryPolicy(policyInput());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.decision.decisionDigest).toBe(second.decision.decisionDigest);
  });
});
