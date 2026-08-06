import { describe, expect, it } from "vitest";
import {
  PREVENTIVE_OUTBOUND_CALL_FLAG_ENV,
  resolvePreventiveOutboundCallFlag,
} from "./preventiveOutboundCallFeatureFlags.js";
import { PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV } from "./preventiveOutboundCallProvider.js";
import {
  validPreventiveOutboundCallEnv,
  validPreventiveOutboundCallNow,
} from "./preventiveOutboundCallFixtures.js";

describe("Task 11 preventive outbound call feature flag", () => {
  it("is default disabled", () => {
    expect(resolvePreventiveOutboundCallFlag({
      env: {},
      userRef: "profile.test.elder",
      now: validPreventiveOutboundCallNow,
    })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "preventive_outbound_call_default_disabled",
    });
  });

  it("requires exact explicit allowlist membership", () => {
    expect(resolvePreventiveOutboundCallFlag({
      env: validPreventiveOutboundCallEnv(),
      userRef: "profile.test.elder",
      now: validPreventiveOutboundCallNow,
    })).toMatchObject({
      effectiveMode: "pilot",
      reasonCode: "preventive_outbound_call_allowed_user",
    });
    expect(resolvePreventiveOutboundCallFlag({
      env: validPreventiveOutboundCallEnv(),
      userRef: "profile.other",
      now: validPreventiveOutboundCallNow,
    })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "preventive_outbound_call_not_allowlisted",
    });
  });

  it("gives denylist precedence over allowlist", () => {
    expect(resolvePreventiveOutboundCallFlag({
      env: validPreventiveOutboundCallEnv({
        [PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.denyUsers]: "profile.test.elder",
      }),
      userRef: "profile.test.elder",
      now: validPreventiveOutboundCallNow,
    })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "preventive_outbound_call_denied_user",
    });
  });

  it("fails closed for malformed CSV, duplicates, whitespace and CR/LF", () => {
    for (const raw of [
      "profile.test.elder,",
      "profile.test.elder,profile.test.elder",
      "profile.test.elder, profile.other",
      "profile.test.elder\nprofile.other",
    ]) {
      expect(resolvePreventiveOutboundCallFlag({
        env: validPreventiveOutboundCallEnv({
          [PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.allowUsers]: raw,
        }),
        userRef: "profile.test.elder",
        now: validPreventiveOutboundCallNow,
      })).toMatchObject({
        effectiveMode: "disabled",
        reasonCode: "preventive_outbound_call_mode_invalid",
      });
    }
  });

  it("requires strict UTC future expiry, owner, audit reference and production opt-in", () => {
    expect(resolvePreventiveOutboundCallFlag({
      env: validPreventiveOutboundCallEnv({
        [PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.expiresAt]: "2026-08-03T12:00:00.000+00:00",
      }),
      userRef: "profile.test.elder",
      now: validPreventiveOutboundCallNow,
    })).toMatchObject({ reasonCode: "preventive_outbound_call_expiry_invalid" });
    expect(resolvePreventiveOutboundCallFlag({
      env: validPreventiveOutboundCallEnv({
        [PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.expiresAt]: "2026-01-01T00:00:00.000Z",
      }),
      userRef: "profile.test.elder",
      now: validPreventiveOutboundCallNow,
    })).toMatchObject({ reasonCode: "preventive_outbound_call_expired" });
    expect(resolvePreventiveOutboundCallFlag({
      env: validPreventiveOutboundCallEnv({
        [PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.environment]: "production",
      }),
      userRef: "profile.test.elder",
      now: validPreventiveOutboundCallNow,
    })).toMatchObject({ reasonCode: "preventive_outbound_call_production_not_authorized" });
    expect(resolvePreventiveOutboundCallFlag({
      env: validPreventiveOutboundCallEnv({
        [PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.owner]: "",
      }),
      userRef: "profile.test.elder",
      now: validPreventiveOutboundCallNow,
    })).toMatchObject({ reasonCode: "preventive_outbound_call_owner_invalid" });
  });

  it("fails closed when dedicated provider config is missing or malformed", () => {
    expect(resolvePreventiveOutboundCallFlag({
      env: validPreventiveOutboundCallEnv({
        [PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.elevenLabsAgentId]: undefined,
      }),
      userRef: "profile.test.elder",
      now: validPreventiveOutboundCallNow,
    })).toMatchObject({ reasonCode: "preventive_outbound_call_provider_config_missing" });
    expect(resolvePreventiveOutboundCallFlag({
      env: validPreventiveOutboundCallEnv({
        [PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.twilioAccountSid]: "not-a-sid",
      }),
      userRef: "profile.test.elder",
      now: validPreventiveOutboundCallNow,
    })).toMatchObject({ reasonCode: "preventive_outbound_call_provider_config_invalid" });
  });
});
