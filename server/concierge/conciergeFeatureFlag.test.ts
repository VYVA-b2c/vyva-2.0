import { describe, expect, it } from "vitest";
import {
  CONCIERGE_SPECIALIST_FLAG_ID,
  CONCIERGE_SPECIALIST_FLAG_VERSION,
  resolveConciergeSpecialistFlag,
} from "./conciergeFeatureFlag";
import {
  TASK18_USER_ID,
  task18FlagEnabledEnv,
} from "./conciergeFixtures";

describe("Concierge specialist feature flag", () => {
  it("is identified as a per-specialist migration flag", () => {
    const result = resolveConciergeSpecialistFlag({
      env: task18FlagEnabledEnv,
      userRef: TASK18_USER_ID,
    });
    expect(result.flagId).toBe(CONCIERGE_SPECIALIST_FLAG_ID);
    expect(result.flagVersion).toBe(CONCIERGE_SPECIALIST_FLAG_VERSION);
  });

  it("defaults to legacy-only", () => {
    expect(resolveConciergeSpecialistFlag({ env: {}, userRef: TASK18_USER_ID }))
      .toMatchObject({ effectiveMode: "legacy_only", selected: false, reasonCode: "default_legacy" });
  });

  it("selects allowlisted users", () => {
    expect(resolveConciergeSpecialistFlag({
      env: task18FlagEnabledEnv,
      userRef: TASK18_USER_ID,
    })).toMatchObject({
      effectiveMode: "specialist_preview",
      selected: true,
      reasonCode: "selected_by_allowlist",
    });
  });

  it("gives denylist precedence", () => {
    expect(resolveConciergeSpecialistFlag({
      env: {
        NODE_ENV: "test",
        VYVA_CONCIERGE_SPECIALIST_MODE: "specialist_preview",
        VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS: TASK18_USER_ID,
        VYVA_CONCIERGE_SPECIALIST_DENY_USERS: TASK18_USER_ID,
      },
      userRef: TASK18_USER_ID,
    })).toMatchObject({ effectiveMode: "legacy_only", selected: false, reasonCode: "denied_by_user" });
  });

  it("fails closed for malformed rollout and whitespace-polluted configuration", () => {
    for (const env of [{
      VYVA_CONCIERGE_SPECIALIST_MODE: " specialist_preview",
    }, {
      VYVA_CONCIERGE_SPECIALIST_MODE: "specialist_preview",
      VYVA_CONCIERGE_SPECIALIST_ROLLOUT_BPS: "10 ",
    }, {
      VYVA_CONCIERGE_SPECIALIST_MODE: "specialist_preview",
      VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS: ` ${TASK18_USER_ID}`,
    }, {
      VYVA_CONCIERGE_SPECIALIST_MODE: "specialist_preview",
      VYVA_CONCIERGE_SPECIALIST_ROLLOUT_BPS: "10001",
    }]) {
      expect(resolveConciergeSpecialistFlag({ env, userRef: TASK18_USER_ID }))
        .toMatchObject({ effectiveMode: "legacy_only", selected: false, reasonCode: "invalid_configuration" });
    }
  });

  it("blocks production unless explicitly approved", () => {
    expect(resolveConciergeSpecialistFlag({
      env: {
        NODE_ENV: "production",
        VYVA_CONCIERGE_SPECIALIST_MODE: "specialist_preview",
        VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS: TASK18_USER_ID,
      },
      userRef: TASK18_USER_ID,
    })).toMatchObject({
      effectiveMode: "legacy_only",
      selected: false,
      reasonCode: "production_not_allowed",
    });
  });
});
