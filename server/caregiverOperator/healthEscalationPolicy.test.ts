import { describe, expect, it } from "vitest";
import {
  HEALTH_CAREGIVER_OPERATOR_ESCALATION,
  consentFromStage9ProfileDataSharing,
  evaluateHealthEscalationAuthorization,
  resolveHealthEscalationFeatureFlag,
} from "./healthEscalationPolicy.js";

const digest = `sha256:${"a".repeat(64)}`;

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    subjectUserId: "senior-1",
    profileId: "senior-1",
    targetAudience: "caregiver",
    targetActorId: "caregiver-1",
    targetActorRole: "caregiver",
    purpose: HEALTH_CAREGIVER_OPERATOR_ESCALATION.purpose,
    flowId: "health.preventive_check",
    flowVersion: "1.0.0",
    flowInstanceId: "flow-1",
    sourceEventId: "event.health.preventive_check.completed.1",
    completionReference: "completion-1",
    answerDigest: digest,
    requestedAt: "2026-08-08T10:00:00.000Z",
    consent: {
      caregiverProjectionAllowed: true,
      operatorProjectionAllowed: true,
      consentRevision: 3,
      approvalReference: "consent-stage9-1",
    },
    caregiverAccess: {
      targetUserId: "senior-1",
      actorUserId: "caregiver-1",
      actorRole: "caregiver",
      isOwnProfile: false,
      isAdmin: false,
      domain: "health",
      permissions: { view_vitals: true },
    },
    ...overrides,
  };
}

function withoutField(input: Record<string, unknown>, field: string): Record<string, unknown> {
  const copy = { ...input };
  delete copy[field];
  return copy;
}

function operatorInput(overrides: Record<string, unknown> = {}) {
  return withoutField(baseInput({
    targetAudience: "operator",
    targetActorId: null,
    targetActorRole: "admin",
    operatorAuthorization: {
      actorUserId: "operator-1",
      actorRole: "admin",
      scope: "admin_health_escalation_queue",
    },
    ...overrides,
  }), "caregiverAccess");
}

describe("Task 14 Health caregiver/operator escalation policy", () => {
  it("defaults the Stage 9 flag to disabled and fails closed on whitespace-polluted config", () => {
    expect(resolveHealthEscalationFeatureFlag({ env: {} }).effectiveMode).toBe("disabled");
    expect(resolveHealthEscalationFeatureFlag({
      env: {
        VYVA_HEALTH_CAREGIVER_OPERATOR_ESCALATION_MODE: " pilot",
        NODE_ENV: "test",
      },
      userRef: "senior-1",
      cohortKey: "senior-1",
    }).reasonCode).toBe("health_escalation_mode_invalid");
  });

  it("extracts only the explicit Stage 9 purpose consent and ignores unrelated consent", () => {
    expect(consentFromStage9ProfileDataSharing({
      semantic_memory: { write_allowed: true },
      preventive_web_push: { enabled: true },
      preventive_outbound_call: { enabled: true },
      caregiver_health_alerts: true,
    })).toEqual({
      caregiverProjectionAllowed: false,
      operatorProjectionAllowed: false,
    });

    expect(consentFromStage9ProfileDataSharing({
      health_caregiver_operator_escalation: {
        caregiver_projection_allowed: true,
        operator_projection_allowed: true,
        revision: 7,
        approval_reference: "stage9-consent",
      },
    })).toEqual({
      caregiverProjectionAllowed: true,
      operatorProjectionAllowed: true,
      consentRevision: 7,
      approvalReference: "stage9-consent",
    });
  });

  it("rejects descriptor accessors in public consent parsing without invoking them", () => {
    let getterCalls = 0;
    const input = {};
    Object.defineProperty(input, "health_caregiver_operator_escalation", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return { caregiver_projection_allowed: true };
      },
    });

    expect(consentFromStage9ProfileDataSharing(input)).toEqual({
      caregiverProjectionAllowed: false,
      operatorProjectionAllowed: false,
    });
    expect(getterCalls).toBe(0);
  });

  it.each([
    ["valid relationship + valid purpose consent", baseInput(), "allow", "allow"],
    [
      "valid relationship + missing purpose consent",
      baseInput({ consent: { caregiverProjectionAllowed: false, operatorProjectionAllowed: false } }),
      "allow",
      "deny",
    ],
    [
      "valid relationship + revoked purpose consent",
      baseInput({
        consent: {
          caregiverProjectionAllowed: true,
          operatorProjectionAllowed: true,
          revokedAt: "2026-08-08T09:00:00.000Z",
        },
      }),
      "allow",
      "deny",
    ],
    [
      "wrong caregiver",
      baseInput({ targetActorId: "caregiver-2" }),
      "deny",
      "allow",
    ],
    [
      "caregiver for user A accessing user B",
      baseInput({ caregiverAccess: { ...baseInput().caregiverAccess, targetUserId: "senior-2" } }),
      "deny",
      "allow",
    ],
    [
      "inactive or missing relationship",
      withoutField(baseInput(), "caregiverAccess"),
      "deny",
      "allow",
    ],
    [
      "caregiver relationship without health permission",
      baseInput({ caregiverAccess: { ...baseInput().caregiverAccess, permissions: { view_vitals: false } } }),
      "deny",
      "allow",
    ],
  ])("evaluates caregiver matrix: %s", (_label, input, authDecision, consentDecision) => {
    const result = evaluateHealthEscalationAuthorization(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.authorizationDecision).toBe(authDecision);
    expect(result.decision.consentDecision).toBe(consentDecision);
  });

  it.each([
    [
      "authorized admin/operator role",
      operatorInput(),
      "allow",
    ],
    [
      "ordinary user denied",
      withoutField(operatorInput({
        targetActorRole: "user",
      }), "operatorAuthorization"),
      "deny",
    ],
    [
      "caregiver role alone denied operator projection",
      withoutField(operatorInput({
        targetActorRole: "caregiver",
      }), "operatorAuthorization"),
      "deny",
    ],
    [
      "wrong operator scope denied",
      operatorInput({
        operatorAuthorization: {
          actorUserId: "operator-1",
          actorRole: "admin",
          scope: "wrong_scope",
        },
      }),
      "deny",
    ],
    [
      "unknown role denied",
      withoutField(operatorInput({
        targetActorRole: "unknown",
      }), "operatorAuthorization"),
      "deny",
    ],
  ])("evaluates operator matrix: %s", (_label, input, authDecision) => {
    const result = evaluateHealthEscalationAuthorization(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.authorizationDecision).toBe(authDecision);
  });
});
