import { describe, expect, it } from "vitest";
import {
  MENTAL_WELLBEING_SPECIALIST_FLAG_ID,
  MENTAL_WELLBEING_SPECIALIST_FLAG_VERSION,
  resolveMentalWellbeingSpecialistFlag,
} from "./mentalWellbeingFeatureFlag";
import { TASK16_USER_ID } from "./mentalWellbeingFixtures";

describe("Mental Wellbeing specialist feature flag", () => {
  it("defaults to legacy-only", () => {
    const result = resolveMentalWellbeingSpecialistFlag({
      env: {},
      userRef: TASK16_USER_ID,
    });

    expect(result.flagId).toBe(MENTAL_WELLBEING_SPECIALIST_FLAG_ID);
    expect(result.flagVersion).toBe(MENTAL_WELLBEING_SPECIALIST_FLAG_VERSION);
    expect(result.effectiveMode).toBe("legacy_only");
    expect(result.selected).toBe(false);
    expect(result.reasonCode).toBe("default_legacy");
  });

  it("selects by explicit allowlist and gives denylist precedence", () => {
    expect(resolveMentalWellbeingSpecialistFlag({
      env: {
        VYVA_MENTAL_WELLBEING_SPECIALIST_MODE: "specialist_preview",
        VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS: TASK16_USER_ID,
      },
      userRef: TASK16_USER_ID,
    }).reasonCode).toBe("selected_by_allowlist");

    expect(resolveMentalWellbeingSpecialistFlag({
      env: {
        VYVA_MENTAL_WELLBEING_SPECIALIST_MODE: "specialist_preview",
        VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS: TASK16_USER_ID,
        VYVA_MENTAL_WELLBEING_SPECIALIST_DENY_USERS: TASK16_USER_ID,
      },
      userRef: TASK16_USER_ID,
    }).reasonCode).toBe("denied_by_user");
  });

  it("fails malformed and whitespace config closed to legacy", () => {
    for (const env of [
      { VYVA_MENTAL_WELLBEING_SPECIALIST_MODE: " specialist_preview" },
      {
        VYVA_MENTAL_WELLBEING_SPECIALIST_MODE: "specialist_preview",
        VYVA_MENTAL_WELLBEING_SPECIALIST_ROLLOUT_BPS: "10 ",
      },
      {
        VYVA_MENTAL_WELLBEING_SPECIALIST_MODE: "specialist_preview",
        VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS: ` ${TASK16_USER_ID}`,
      },
      {
        VYVA_MENTAL_WELLBEING_SPECIALIST_MODE: "specialist_preview",
        VYVA_MENTAL_WELLBEING_SPECIALIST_ROLLOUT_BPS: "10001",
      },
    ]) {
      expect(resolveMentalWellbeingSpecialistFlag({ env, userRef: TASK16_USER_ID }))
        .toMatchObject({ effectiveMode: "legacy_only", reasonCode: "invalid_configuration" });
    }
  });

  it("requires explicit production approval", () => {
    expect(resolveMentalWellbeingSpecialistFlag({
      env: {
        NODE_ENV: "production",
        VYVA_MENTAL_WELLBEING_SPECIALIST_MODE: "specialist_preview",
        VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS: TASK16_USER_ID,
      },
      userRef: TASK16_USER_ID,
    })).toMatchObject({ effectiveMode: "legacy_only", reasonCode: "production_not_allowed" });
  });
});
