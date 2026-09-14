import { describe, expect, it } from "vitest";
import {
  computeProactiveEngagementCohortBucket,
  PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV,
  resolveProactiveEngagementAuditShadowMode,
} from "./proactiveFeatureFlags.js";

const now = new Date("2026-08-03T12:00:00.000Z");

function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.mode]: "audit_shadow",
    [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.rolloutBasisPoints]: "10000",
    [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.expiry]: "2026-08-04T00:00:00.000Z",
    [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.ownerReference]: "owner.task8",
    [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.auditReference]: "audit.task8",
    [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.environment]: "test",
    ...overrides,
  };
}

describe("Task 8 proactive audit-shadow feature flag", () => {
  it("defaults disabled and rejects malformed mode, rollout and expiry", () => {
    expect(resolveProactiveEngagementAuditShadowMode({
      env: {},
      now,
      cohortKey: "cohort.a",
    }).reasonCode).toBe("engagement_shadow_default_disabled");

    expect(resolveProactiveEngagementAuditShadowMode({
      env: validEnv({ [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.mode]: " audit_shadow" }),
      now,
      cohortKey: "cohort.a",
    }).reasonCode).toBe("engagement_shadow_mode_invalid");

    expect(resolveProactiveEngagementAuditShadowMode({
      env: validEnv({ [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.rolloutBasisPoints]: "0" }),
      now,
      cohortKey: "cohort.a",
    }).reasonCode).toBe("engagement_shadow_rollout_invalid");

    expect(resolveProactiveEngagementAuditShadowMode({
      env: validEnv({ [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.expiry]: "August 3, 2026" }),
      now,
      cohortKey: "cohort.a",
    }).reasonCode).toBe("engagement_shadow_expiry_missing");
  });

  it("requires owner, audit reference, cohort and production authorization", () => {
    expect(resolveProactiveEngagementAuditShadowMode({
      env: validEnv({ [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.ownerReference]: undefined }),
      now,
      cohortKey: "cohort.a",
    }).reasonCode).toBe("engagement_shadow_owner_missing");
    expect(resolveProactiveEngagementAuditShadowMode({
      env: validEnv({ [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.auditReference]: undefined }),
      now,
      cohortKey: "cohort.a",
    }).reasonCode).toBe("engagement_shadow_audit_missing");
    expect(resolveProactiveEngagementAuditShadowMode({
      env: validEnv(),
      now,
      cohortKey: "",
    }).reasonCode).toBe("engagement_shadow_cohort_missing");
    expect(resolveProactiveEngagementAuditShadowMode({
      env: validEnv({ [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.environment]: "production" }),
      now,
      cohortKey: "cohort.a",
    }).reasonCode).toBe("engagement_shadow_production_not_authorized");
  });

  it("selects audit shadow deterministically when configuration is complete", () => {
    const result = resolveProactiveEngagementAuditShadowMode({
      env: validEnv(),
      now,
      cohortKey: "cohort.a",
    });
    expect(result.effectiveMode).toBe("audit_shadow");
    expect(result.shadowOnly).toBe(true);
    expect(result.nonExecutable).toBe(true);
    expect(result.rolloutBucket).toBe(computeProactiveEngagementCohortBucket("cohort.a"));
  });

  it("does not authorize any candidate or authoritative delivery mode", () => {
    for (const mode of ["candidate_delivery", "authoritative", "shadow_compare"]) {
      expect(resolveProactiveEngagementAuditShadowMode({
        env: validEnv({ [PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.mode]: mode }),
        now,
        cohortKey: "cohort.a",
      }).effectiveMode).toBe("disabled");
    }
  });
});
