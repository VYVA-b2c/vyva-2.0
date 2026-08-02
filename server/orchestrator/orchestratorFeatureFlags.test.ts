import { describe, expect, it } from "vitest";
import { parseCompatibilityFeatureFlagState } from "../../shared/orchestration/compatibilityBoundary.js";
import {
  ORCHESTRATOR_SHELL_ENV,
  ORCHESTRATOR_SHELL_FLAG,
  computeOrchestratorCohortBucket,
  resolveOrchestratorShellMode,
} from "./orchestratorFeatureFlags.js";

const NOW = new Date("2026-08-02T12:00:00.000Z");

function validShadowEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    VYVA_ORCHESTRATOR_MODE: "shadow_compare",
    VYVA_ORCHESTRATOR_SHADOW_ROLLOUT_BPS: "10000",
    VYVA_ORCHESTRATOR_SHADOW_EVIDENCE_IDS: "evidence.task6.review",
    VYVA_ORCHESTRATOR_SHADOW_ROLLBACK_PLAN_ID: "rollback.task6.legacy",
    VYVA_ORCHESTRATOR_SHADOW_EXPIRY: "2026-09-01T00:00:00.000Z",
    VYVA_ORCHESTRATOR_SHADOW_OWNER_REFERENCE: "team.architecture",
    VYVA_ORCHESTRATOR_SHADOW_AUDIT_REFERENCE: "audit.task6.shell",
    VYVA_ORCHESTRATOR_SHADOW_ALLOW_PRODUCTION: "false",
    NODE_ENV: "staging",
    ...overrides,
  };
}

function resolve(
  env: Record<string, string | undefined>,
  cohortKey = "session-test-1",
) {
  return resolveOrchestratorShellMode({ env, now: NOW, cohortKey });
}

describe("orchestrator shell feature flags", () => {
  it("owns literal fixed flag identity and environment names", () => {
    expect(ORCHESTRATOR_SHELL_FLAG).toEqual({
      flagId: "flag.orchestrator.shell",
      flagVersion: "1.0.0",
      defaultMode: "legacy_only",
      deliveryAuthority: "legacy_handler",
    });
    expect(ORCHESTRATOR_SHELL_ENV).toEqual({
      mode: "VYVA_ORCHESTRATOR_MODE",
      rolloutBasisPoints: "VYVA_ORCHESTRATOR_SHADOW_ROLLOUT_BPS",
      evidenceIds: "VYVA_ORCHESTRATOR_SHADOW_EVIDENCE_IDS",
      rollbackPlanId: "VYVA_ORCHESTRATOR_SHADOW_ROLLBACK_PLAN_ID",
      expiry: "VYVA_ORCHESTRATOR_SHADOW_EXPIRY",
      ownerReference: "VYVA_ORCHESTRATOR_SHADOW_OWNER_REFERENCE",
      auditReference: "VYVA_ORCHESTRATOR_SHADOW_AUDIT_REFERENCE",
      allowProduction: "VYVA_ORCHESTRATOR_SHADOW_ALLOW_PRODUCTION",
      denyBuckets: "VYVA_ORCHESTRATOR_SHADOW_DENY_BUCKETS",
      denyReference: "VYVA_ORCHESTRATOR_SHADOW_DENY_REFERENCE",
      environment: "NODE_ENV",
    });
  });

  it("defaults missing configuration to legacy-only", () => {
    expect(resolve({})).toMatchObject({
      requestedMode: "legacy_only",
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_legacy_default",
    });
  });

  it("accepts an explicit legacy-only request", () => {
    expect(resolve({ VYVA_ORCHESTRATOR_MODE: "legacy_only" })).toMatchObject({
      requestedMode: "legacy_only",
      effectiveMode: "legacy_only",
      activationEligibility: "eligible",
    });
  });

  it.each(["unknown", "shadow", "LEGACY_ONLY", " "])(
    "fails malformed mode %s closed",
    (mode) => {
      const result = resolve({ VYVA_ORCHESTRATOR_MODE: mode });
      expect(result.effectiveMode).toBe("legacy_only");
      expect(result.reasonCode).toMatch(
        /orchestrator_shell_(mode_invalid|legacy_default)/,
      );
    },
  );

  it.each(["candidate_delivery", "authoritative"] as const)(
    "blocks future mode %s",
    (mode) => {
      expect(resolve({ VYVA_ORCHESTRATOR_MODE: mode })).toMatchObject({
        requestedMode: mode,
        effectiveMode: "legacy_only",
        activationEligibility: "future_contract_required",
        reasonCode: "orchestrator_shell_future_mode_blocked",
      });
    },
  );

  it.each(["0", "-1", "10001", "1.5", "not-a-number", ""])(
    "rejects rollout %s",
    (rollout) => {
      expect(resolve(validShadowEnv({
        VYVA_ORCHESTRATOR_SHADOW_ROLLOUT_BPS: rollout,
      }))).toMatchObject({
        effectiveMode: "legacy_only",
        reasonCode: "orchestrator_shell_rollout_invalid",
      });
    },
  );

  it("requires a usable cohort key", () => {
    expect(resolveOrchestratorShellMode({
      env: validShadowEnv(),
      now: NOW,
    })).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_cohort_missing",
    });
  });

  it("hashes the same cohort key deterministically", () => {
    expect(computeOrchestratorCohortBucket("session-stable")).toBe(
      computeOrchestratorCohortBucket("session-stable"),
    );
    expect(computeOrchestratorCohortBucket("session-stable")).toBeGreaterThanOrEqual(0);
    expect(computeOrchestratorCohortBucket("session-stable")).toBeLessThan(10_000);
  });

  it("selects and excludes deterministic cohorts at partial rollout", () => {
    const keys = Array.from({ length: 500 }, (_, index) => `session-${index}`);
    const selected = keys.find((key) =>
      computeOrchestratorCohortBucket(key) < 5_000);
    const excluded = keys.find((key) =>
      computeOrchestratorCohortBucket(key) >= 5_000);
    expect(selected).toBeDefined();
    expect(excluded).toBeDefined();

    const env = validShadowEnv({
      VYVA_ORCHESTRATOR_SHADOW_ROLLOUT_BPS: "5000",
    });
    expect(resolve(env, selected).effectiveMode).toBe("shadow_compare");
    expect(resolve(env, excluded)).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_cohort_not_selected",
    });
  });

  it("requires a recognized environment", () => {
    expect(resolve(validShadowEnv({ NODE_ENV: "preview" }))).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_environment_invalid",
    });
  });

  it("requires prerequisite evidence", () => {
    expect(resolve(validShadowEnv({
      VYVA_ORCHESTRATOR_SHADOW_EVIDENCE_IDS: undefined,
    }))).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_evidence_missing",
    });
  });

  it("bounds and deduplicates prerequisite evidence", () => {
    const tooMany = Array.from(
      { length: 33 },
      (_, index) => `evidence.task6.${index}`,
    ).join(",");
    for (const evidence of ["evidence.same,evidence.same", tooMany]) {
      expect(resolve(validShadowEnv({
        VYVA_ORCHESTRATOR_SHADOW_EVIDENCE_IDS: evidence,
      }))).toMatchObject({
        effectiveMode: "legacy_only",
        reasonCode: "orchestrator_shell_evidence_missing",
      });
    }
  });

  it("requires a rollback plan", () => {
    expect(resolve(validShadowEnv({
      VYVA_ORCHESTRATOR_SHADOW_ROLLBACK_PLAN_ID: undefined,
    }))).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_rollback_missing",
    });
  });

  it.each([
    undefined,
    "not-a-date",
    "08/03/2026",
    "August 3, 2026",
    "2026-09-01",
    "2026-09-01T00:00:00Z",
    "2026-09-01T00:00:00.000+00:00",
    " 2026-09-01T00:00:00.000Z",
    "2026-09-01T00:00:00.000Z ",
    "2026-9-1T00:00:00.000Z",
    "2026-02-30T00:00:00.000Z",
  ])("rejects non-canonical expiry %s", (expiry) => {
    expect(resolve(validShadowEnv({
      VYVA_ORCHESTRATOR_SHADOW_EXPIRY: expiry,
    }))).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_expiry_missing",
    });
  });

  it("accepts only a canonical future UTC ISO expiry", () => {
    const result = resolve(validShadowEnv({
      VYVA_ORCHESTRATOR_SHADOW_EXPIRY: "2026-09-01T00:00:00.000Z",
    }));

    expect(result.effectiveMode).toBe("shadow_compare");
    expect(result.task5FeatureFlagState?.expiry).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("rejects an expired flag", () => {
    expect(resolve(validShadowEnv({
      VYVA_ORCHESTRATOR_SHADOW_EXPIRY: "2026-08-02T11:59:59.000Z",
    }))).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_expired",
    });
  });

  it("requires an owner reference", () => {
    expect(resolve(validShadowEnv({
      VYVA_ORCHESTRATOR_SHADOW_OWNER_REFERENCE: undefined,
    }))).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_owner_missing",
    });
  });

  it("requires an audit reference", () => {
    expect(resolve(validShadowEnv({
      VYVA_ORCHESTRATOR_SHADOW_AUDIT_REFERENCE: undefined,
    }))).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_audit_missing",
    });
  });

  it("gives a valid deny list precedence over rollout", () => {
    const key = "session-denied";
    const bucket = computeOrchestratorCohortBucket(key);
    expect(resolve(validShadowEnv({
      VYVA_ORCHESTRATOR_SHADOW_DENY_BUCKETS: String(bucket),
      VYVA_ORCHESTRATOR_SHADOW_DENY_REFERENCE: "deny.task6.review",
    }), key)).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_deny_list_matched",
      rolloutBucket: bucket,
    });
  });

  it.each([
    {
      VYVA_ORCHESTRATOR_SHADOW_DENY_BUCKETS: "invalid",
      VYVA_ORCHESTRATOR_SHADOW_DENY_REFERENCE: "deny.task6.review",
    },
    {
      VYVA_ORCHESTRATOR_SHADOW_DENY_BUCKETS: "5",
      VYVA_ORCHESTRATOR_SHADOW_DENY_REFERENCE: undefined,
    },
    {
      VYVA_ORCHESTRATOR_SHADOW_DENY_BUCKETS: undefined,
      VYVA_ORCHESTRATOR_SHADOW_DENY_REFERENCE: "deny.task6.review",
    },
  ])("fails malformed deny configuration closed", (overrides) => {
    expect(resolve(validShadowEnv(overrides))).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_deny_configuration_invalid",
    });
  });

  it("bounds and deduplicates deny buckets", () => {
    const tooMany = Array.from({ length: 257 }, (_, index) => index).join(",");
    for (const denyBuckets of ["5,5", tooMany]) {
      expect(resolve(validShadowEnv({
        VYVA_ORCHESTRATOR_SHADOW_DENY_BUCKETS: denyBuckets,
        VYVA_ORCHESTRATOR_SHADOW_DENY_REFERENCE: "deny.task6.review",
      }))).toMatchObject({
        effectiveMode: "legacy_only",
        reasonCode: "orchestrator_shell_deny_configuration_invalid",
      });
    }
  });

  it("blocks production shadow without explicit authorization", () => {
    expect(resolve(validShadowEnv({
      NODE_ENV: "production",
      VYVA_ORCHESTRATOR_SHADOW_ALLOW_PRODUCTION: "false",
    }))).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_production_not_authorized",
    });
  });

  it("allows explicitly authorized production shadow only", () => {
    expect(resolve(validShadowEnv({
      NODE_ENV: "production",
      VYVA_ORCHESTRATOR_SHADOW_ALLOW_PRODUCTION: "true",
    }))).toMatchObject({
      requestedMode: "shadow_compare",
      effectiveMode: "shadow_compare",
      activationEligibility: "eligible",
    });
  });

  it("resolves a complete staging configuration to shadow", () => {
    expect(resolve(validShadowEnv())).toMatchObject({
      requestedMode: "shadow_compare",
      effectiveMode: "shadow_compare",
      defaultMode: "legacy_only",
      reasonCode: "orchestrator_shell_shadow_selected",
      nonExecutable: true,
    });
  });

  it("constructs a Task 5 feature-flag state accepted by its public parser", () => {
    const state = resolve(validShadowEnv()).task5FeatureFlagState;
    expect(state).toBeDefined();
    expect(parseCompatibilityFeatureFlagState(state)).toEqual(state);
    expect(state).toMatchObject({
      flagId: "flag.orchestrator.shell",
      flagVersion: "1.0.0",
      effectiveMode: "shadow_compare",
      percentageBasisPoints: 10_000,
      nonExecutable: true,
    });
  });

  it("fails closed when Task 5 flag parsing fails", () => {
    const result = resolveOrchestratorShellMode({
      env: validShadowEnv(),
      now: NOW,
      cohortKey: "session-test-1",
      parseFeatureFlagState: () => {
        throw new Error("frozen parser rejected state");
      },
    });
    expect(result).toMatchObject({
      effectiveMode: "legacy_only",
      reasonCode: "orchestrator_shell_task5_flag_invalid",
    });
  });
});
