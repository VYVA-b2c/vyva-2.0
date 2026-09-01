import { describe, expect, it } from "vitest";
import {
  BRAIN_COACH_SPECIALIST_FLAG_ID,
  BRAIN_COACH_SPECIALIST_FLAG_VERSION,
  resolveBrainCoachSpecialistFlag,
} from "./brainCoachFeatureFlag";
import {
  TASK15_USER_ID,
  task15BrainCoachEnabledEnv,
} from "./brainCoachFixtures";

describe("Brain Coach specialist feature flag", () => {
  it("is identified as a per-specialist migration flag", () => {
    const result = resolveBrainCoachSpecialistFlag({
      env: task15BrainCoachEnabledEnv,
      userRef: TASK15_USER_ID,
    });
    expect(result.flagId).toBe(BRAIN_COACH_SPECIALIST_FLAG_ID);
    expect(result.flagVersion).toBe(BRAIN_COACH_SPECIALIST_FLAG_VERSION);
  });

  it("defaults to legacy-only", () => {
    expect(resolveBrainCoachSpecialistFlag({ env: {}, userRef: TASK15_USER_ID }))
      .toMatchObject({ effectiveMode: "legacy_only", selected: false, reasonCode: "default_legacy" });
  });

  it("selects allowlisted users", () => {
    expect(resolveBrainCoachSpecialistFlag({
      env: task15BrainCoachEnabledEnv,
      userRef: TASK15_USER_ID,
    })).toMatchObject({
      effectiveMode: "specialist_preview",
      selected: true,
      reasonCode: "selected_by_allowlist",
    });
  });

  it("gives denylist precedence", () => {
    expect(resolveBrainCoachSpecialistFlag({
      env: {
        NODE_ENV: "test",
        VYVA_BRAIN_COACH_SPECIALIST_MODE: "specialist_preview",
        VYVA_BRAIN_COACH_SPECIALIST_ALLOW_USERS: TASK15_USER_ID,
        VYVA_BRAIN_COACH_SPECIALIST_DENY_USERS: TASK15_USER_ID,
      },
      userRef: TASK15_USER_ID,
    })).toMatchObject({ effectiveMode: "legacy_only", selected: false, reasonCode: "denied_by_user" });
  });

  it("fails closed for malformed rollout and whitespace-polluted configuration", () => {
    for (const env of [{
      VYVA_BRAIN_COACH_SPECIALIST_MODE: " specialist_preview",
    }, {
      VYVA_BRAIN_COACH_SPECIALIST_MODE: "specialist_preview",
      VYVA_BRAIN_COACH_SPECIALIST_ROLLOUT_BPS: "10 ",
    }, {
      VYVA_BRAIN_COACH_SPECIALIST_MODE: "specialist_preview",
      VYVA_BRAIN_COACH_SPECIALIST_ALLOW_USERS: ` ${TASK15_USER_ID}`,
    }, {
      VYVA_BRAIN_COACH_SPECIALIST_MODE: "specialist_preview",
      VYVA_BRAIN_COACH_SPECIALIST_ROLLOUT_BPS: "10001",
    }]) {
      expect(resolveBrainCoachSpecialistFlag({ env, userRef: TASK15_USER_ID }))
        .toMatchObject({ effectiveMode: "legacy_only", selected: false, reasonCode: "invalid_configuration" });
    }
  });

  it("blocks production unless explicitly approved", () => {
    expect(resolveBrainCoachSpecialistFlag({
      env: {
        NODE_ENV: "production",
        VYVA_BRAIN_COACH_SPECIALIST_MODE: "specialist_preview",
        VYVA_BRAIN_COACH_SPECIALIST_ALLOW_USERS: TASK15_USER_ID,
      },
      userRef: TASK15_USER_ID,
    })).toMatchObject({
      effectiveMode: "legacy_only",
      selected: false,
      reasonCode: "production_not_allowed",
    });
  });
});
