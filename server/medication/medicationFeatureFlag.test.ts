import { describe, expect, it } from "vitest";
import {
  MEDICATION_SPECIALIST_FLAG_ID,
  MEDICATION_SPECIALIST_FLAG_VERSION,
  resolveMedicationSpecialistFlag,
} from "./medicationFeatureFlag";
import {
  TASK17_USER_ID,
  task17MedicationEnabledEnv,
} from "./medicationFixtures";

describe("Medication specialist feature flag", () => {
  it("is identified as a per-specialist migration flag", () => {
    const result = resolveMedicationSpecialistFlag({
      env: task17MedicationEnabledEnv,
      userRef: TASK17_USER_ID,
    });
    expect(result.flagId).toBe(MEDICATION_SPECIALIST_FLAG_ID);
    expect(result.flagVersion).toBe(MEDICATION_SPECIALIST_FLAG_VERSION);
  });

  it("defaults to legacy-only", () => {
    expect(resolveMedicationSpecialistFlag({ env: {}, userRef: TASK17_USER_ID }))
      .toMatchObject({ effectiveMode: "legacy_only", selected: false, reasonCode: "default_legacy" });
  });

  it("selects allowlisted users", () => {
    expect(resolveMedicationSpecialistFlag({
      env: task17MedicationEnabledEnv,
      userRef: TASK17_USER_ID,
    })).toMatchObject({
      effectiveMode: "specialist_preview",
      selected: true,
      reasonCode: "selected_by_allowlist",
    });
  });

  it("gives denylist precedence", () => {
    expect(resolveMedicationSpecialistFlag({
      env: {
        NODE_ENV: "test",
        VYVA_MEDICATION_SPECIALIST_MODE: "specialist_preview",
        VYVA_MEDICATION_SPECIALIST_ALLOW_USERS: TASK17_USER_ID,
        VYVA_MEDICATION_SPECIALIST_DENY_USERS: TASK17_USER_ID,
      },
      userRef: TASK17_USER_ID,
    })).toMatchObject({ effectiveMode: "legacy_only", selected: false, reasonCode: "denied_by_user" });
  });

  it("fails closed for malformed rollout and whitespace-polluted configuration", () => {
    for (const env of [{
      VYVA_MEDICATION_SPECIALIST_MODE: " specialist_preview",
    }, {
      VYVA_MEDICATION_SPECIALIST_MODE: "specialist_preview",
      VYVA_MEDICATION_SPECIALIST_ROLLOUT_BPS: "10 ",
    }, {
      VYVA_MEDICATION_SPECIALIST_MODE: "specialist_preview",
      VYVA_MEDICATION_SPECIALIST_ALLOW_USERS: ` ${TASK17_USER_ID}`,
    }, {
      VYVA_MEDICATION_SPECIALIST_MODE: "specialist_preview",
      VYVA_MEDICATION_SPECIALIST_ROLLOUT_BPS: "10001",
    }]) {
      expect(resolveMedicationSpecialistFlag({ env, userRef: TASK17_USER_ID }))
        .toMatchObject({ effectiveMode: "legacy_only", selected: false, reasonCode: "invalid_configuration" });
    }
  });

  it("blocks production unless explicitly approved", () => {
    expect(resolveMedicationSpecialistFlag({
      env: {
        NODE_ENV: "production",
        VYVA_MEDICATION_SPECIALIST_MODE: "specialist_preview",
        VYVA_MEDICATION_SPECIALIST_ALLOW_USERS: TASK17_USER_ID,
      },
      userRef: TASK17_USER_ID,
    })).toMatchObject({
      effectiveMode: "legacy_only",
      selected: false,
      reasonCode: "production_not_allowed",
    });
  });
});
