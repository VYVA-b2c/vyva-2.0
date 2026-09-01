import { describe, expect, it } from "vitest";
import {
  PREVENTIVE_WEB_PUSH_FLAG_ENV,
  resolvePreventiveWebPushFlag,
} from "./preventiveWebPushFeatureFlags.js";
import {
  PREVENTIVE_WEB_PUSH_PROVIDER_ENV,
} from "./preventiveWebPushProvider.js";
import { validPreventiveWebPushEnv } from "./preventiveWebPushFixtures.js";

describe("Task 10 preventive web push feature flag", () => {
  it("defaults disabled and rejects permissive whitespace parsing", () => {
    expect(resolvePreventiveWebPushFlag({ env: {}, cohortKey: "cohort", userRef: "user" })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "preventive_web_push_default_disabled",
    });
    expect(resolvePreventiveWebPushFlag({
      env: validPreventiveWebPushEnv({ [PREVENTIVE_WEB_PUSH_FLAG_ENV.mode]: " pilot" }),
      cohortKey: "cohort",
      userRef: "user",
    })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "preventive_web_push_mode_invalid",
    });
  });

  it("requires provider configuration before selecting the Stage 5 runtime", () => {
    expect(resolvePreventiveWebPushFlag({
      env: {
        [PREVENTIVE_WEB_PUSH_FLAG_ENV.mode]: "pilot",
        [PREVENTIVE_WEB_PUSH_FLAG_ENV.rolloutBasisPoints]: "10000",
        [PREVENTIVE_WEB_PUSH_FLAG_ENV.environment]: "test",
      },
      cohortKey: "cohort",
      userRef: "user",
    })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "preventive_web_push_provider_config_missing",
    });
    expect(resolvePreventiveWebPushFlag({
      env: validPreventiveWebPushEnv({
        [PREVENTIVE_WEB_PUSH_PROVIDER_ENV.publicKey]: "not-a-key!",
      }),
      cohortKey: "cohort",
      userRef: "user",
    })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "preventive_web_push_provider_config_invalid",
    });
  });

  it("keeps deny precedence over allowlist and rollout", () => {
    const env = validPreventiveWebPushEnv({
      [PREVENTIVE_WEB_PUSH_FLAG_ENV.allowUsers]: "user.test",
      [PREVENTIVE_WEB_PUSH_FLAG_ENV.denyUsers]: "user.test",
      [PREVENTIVE_WEB_PUSH_FLAG_ENV.rolloutBasisPoints]: "10000",
    });
    expect(resolvePreventiveWebPushFlag({ env, cohortKey: "cohort", userRef: "user.test" })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "preventive_web_push_denied_user",
    });
  });

  it("rejects malformed allowlist and denylist CSV instead of filtering entries", () => {
    const malformedLists = [
      ",",
      ",user.test",
      "user.test,",
      "user.a,,user.b",
      "user.a,user.a",
      " user.a",
      "user.a ",
      "user.a,\tuser.b",
      "user.a\nuser.b",
      "user.a,\u00A0user.b",
      "user a",
      Array.from({ length: 101 }, (_, index) => `user.${index}`).join(","),
      `${"a".repeat(161)}`,
    ];
    for (const value of malformedLists) {
      expect(resolvePreventiveWebPushFlag({
        env: validPreventiveWebPushEnv({
          [PREVENTIVE_WEB_PUSH_FLAG_ENV.allowUsers]: value,
        }),
        cohortKey: "cohort",
        userRef: "user.a",
      })).toMatchObject({
        effectiveMode: "disabled",
        reasonCode: "preventive_web_push_mode_invalid",
      });
      expect(resolvePreventiveWebPushFlag({
        env: validPreventiveWebPushEnv({
          [PREVENTIVE_WEB_PUSH_FLAG_ENV.denyUsers]: value,
        }),
        cohortKey: "cohort",
        userRef: "user.a",
      })).toMatchObject({
        effectiveMode: "disabled",
        reasonCode: "preventive_web_push_mode_invalid",
      });
    }
  });

  it("requires explicit production authorization", () => {
    expect(resolvePreventiveWebPushFlag({
      env: validPreventiveWebPushEnv({ [PREVENTIVE_WEB_PUSH_FLAG_ENV.environment]: "production" }),
      cohortKey: "cohort",
      userRef: "user",
    })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "preventive_web_push_production_not_authorized",
    });
    expect(resolvePreventiveWebPushFlag({
      env: validPreventiveWebPushEnv({
        [PREVENTIVE_WEB_PUSH_FLAG_ENV.environment]: "production",
        [PREVENTIVE_WEB_PUSH_FLAG_ENV.allowProduction]: "true",
      }),
      cohortKey: "cohort",
      userRef: "user",
    })).toMatchObject({
      effectiveMode: "pilot",
    });
  });

  it("selects allowlisted or rolled-out users only after all gates pass", () => {
    expect(resolvePreventiveWebPushFlag({
      env: validPreventiveWebPushEnv({
        [PREVENTIVE_WEB_PUSH_FLAG_ENV.allowUsers]: "user.allowed",
        [PREVENTIVE_WEB_PUSH_FLAG_ENV.rolloutBasisPoints]: "0",
      }),
      cohortKey: "cohort",
      userRef: "user.allowed",
    })).toMatchObject({
      effectiveMode: "pilot",
      reasonCode: "preventive_web_push_allowed_user",
    });
    expect(resolvePreventiveWebPushFlag({
      env: validPreventiveWebPushEnv({ [PREVENTIVE_WEB_PUSH_FLAG_ENV.rolloutBasisPoints]: "10000" }),
      cohortKey: "cohort",
      userRef: "user.rollout",
    })).toMatchObject({
      effectiveMode: "pilot",
      reasonCode: "preventive_web_push_rollout_selected",
    });
  });
});
