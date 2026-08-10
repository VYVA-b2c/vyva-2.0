import { describe, expect, it } from "vitest";
import {
  SOCIAL_SUPPORT_SPECIALIST_FLAG_ID,
  SOCIAL_SUPPORT_SPECIALIST_FLAG_VERSION,
  resolveSocialSupportSpecialistFlag,
} from "./socialSupportFeatureFlag";
import {
  TASK19_USER_ID,
  task19FlagEnabledEnv,
} from "./socialSupportFixtures";

describe("Social Support specialist feature flag", () => {
  it("is identified as a per-specialist migration flag", () => {
    const result = resolveSocialSupportSpecialistFlag({
      env: task19FlagEnabledEnv,
      userRef: TASK19_USER_ID,
    });
    expect(result.flagId).toBe(SOCIAL_SUPPORT_SPECIALIST_FLAG_ID);
    expect(result.flagVersion).toBe(SOCIAL_SUPPORT_SPECIALIST_FLAG_VERSION);
  });

  it("defaults to legacy-only", () => {
    expect(resolveSocialSupportSpecialistFlag({ env: {}, userRef: TASK19_USER_ID }))
      .toMatchObject({ effectiveMode: "legacy_only", selected: false, reasonCode: "default_legacy" });
  });

  it("selects allowlisted users", () => {
    expect(resolveSocialSupportSpecialistFlag({
      env: task19FlagEnabledEnv,
      userRef: TASK19_USER_ID,
    })).toMatchObject({
      effectiveMode: "specialist_preview",
      selected: true,
      reasonCode: "selected_by_allowlist",
    });
  });

  it("gives denylist precedence", () => {
    expect(resolveSocialSupportSpecialistFlag({
      env: {
        NODE_ENV: "test",
        VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE: "specialist_preview",
        VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_USERS: TASK19_USER_ID,
        VYVA_SOCIAL_SUPPORT_SPECIALIST_DENY_USERS: TASK19_USER_ID,
      },
      userRef: TASK19_USER_ID,
    })).toMatchObject({ effectiveMode: "legacy_only", selected: false, reasonCode: "denied_by_user" });
  });

  it("fails closed for malformed rollout and whitespace-polluted configuration", () => {
    for (const env of [{
      VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE: " specialist_preview",
    }, {
      VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE: "specialist_preview",
      VYVA_SOCIAL_SUPPORT_SPECIALIST_ROLLOUT_BPS: "10 ",
    }, {
      VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE: "specialist_preview",
      VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_USERS: ` ${TASK19_USER_ID}`,
    }, {
      VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE: "specialist_preview",
      VYVA_SOCIAL_SUPPORT_SPECIALIST_ROLLOUT_BPS: "10001",
    }]) {
      expect(resolveSocialSupportSpecialistFlag({ env, userRef: TASK19_USER_ID }))
        .toMatchObject({ effectiveMode: "legacy_only", selected: false, reasonCode: "invalid_configuration" });
    }
  });

  it("blocks production unless explicitly approved", () => {
    expect(resolveSocialSupportSpecialistFlag({
      env: {
        NODE_ENV: "production",
        VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE: "specialist_preview",
        VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_USERS: TASK19_USER_ID,
      },
      userRef: TASK19_USER_ID,
    })).toMatchObject({
      effectiveMode: "legacy_only",
      selected: false,
      reasonCode: "production_not_allowed",
    });
  });
});
