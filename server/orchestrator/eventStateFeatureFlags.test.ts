import { describe, expect, it } from "vitest";
import {
  EVENT_STATE_SHADOW_ENV,
  computeEventStateCohortBucket,
  resolveEventStateShadowMode,
} from "./eventStateFeatureFlags.js";

const future = new Date("2026-08-03T12:30:00.000Z");
const now = new Date("2026-08-02T12:30:00.000Z");

function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    [EVENT_STATE_SHADOW_ENV.mode]: "shadow_emit",
    [EVENT_STATE_SHADOW_ENV.rolloutBasisPoints]: "10000",
    [EVENT_STATE_SHADOW_ENV.expiry]: future.toISOString(),
    [EVENT_STATE_SHADOW_ENV.ownerReference]: "owner.task7",
    [EVENT_STATE_SHADOW_ENV.auditReference]: "audit.task7",
    [EVENT_STATE_SHADOW_ENV.environment]: "test",
    ...overrides,
  };
}

describe("event-state shadow feature flag", () => {
  it("defaults disabled", () => {
    expect(resolveEventStateShadowMode({ env: {}, now, cohortKey: "session-1" })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "event_state_default_disabled",
    });
  });

  it("enables deterministic shadow emission with complete safe config", () => {
    const resolved = resolveEventStateShadowMode({ env: validEnv(), now, cohortKey: "session-1" });
    expect(resolved).toMatchObject({
      effectiveMode: "shadow_emit",
      reasonCode: "event_state_shadow_selected",
      nonExecutable: true,
    });
    expect(resolved.rolloutBucket).toBe(computeEventStateCohortBucket("session-1"));
  });

  it.each([
    ["bad mode", { [EVENT_STATE_SHADOW_ENV.mode]: "authoritative" }, "event_state_mode_invalid", "session-1"],
    ["whitespace mode", { [EVENT_STATE_SHADOW_ENV.mode]: " shadow_emit" }, "event_state_mode_invalid", "session-1"],
    ["bad rollout", { [EVENT_STATE_SHADOW_ENV.rolloutBasisPoints]: "0" }, "event_state_rollout_invalid", "session-1"],
    ["missing cohort", {}, "event_state_cohort_missing", undefined],
    ["ambiguous expiry", { [EVENT_STATE_SHADOW_ENV.expiry]: "08/03/2026" }, "event_state_expiry_missing", "session-1"],
    ["expired", { [EVENT_STATE_SHADOW_ENV.expiry]: "2026-08-01T00:00:00.000Z" }, "event_state_expired", "session-1"],
    ["missing owner", { [EVENT_STATE_SHADOW_ENV.ownerReference]: undefined }, "event_state_owner_missing", "session-1"],
    ["bad environment", { [EVENT_STATE_SHADOW_ENV.environment]: "qa" }, "event_state_environment_invalid", "session-1"],
  ])("fails closed for %s", (_label, overrides, reasonCode, cohortKey) => {
    expect(resolveEventStateShadowMode({ env: validEnv(overrides), now, cohortKey })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode,
    });
  });

  it("requires explicit production authorization", () => {
    expect(resolveEventStateShadowMode({
      env: validEnv({ [EVENT_STATE_SHADOW_ENV.environment]: "production" }),
      now,
      cohortKey: "session-1",
    })).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "event_state_production_not_authorized",
    });

    expect(resolveEventStateShadowMode({
      env: validEnv({
        [EVENT_STATE_SHADOW_ENV.environment]: "production",
        [EVENT_STATE_SHADOW_ENV.allowProduction]: "true",
      }),
      now,
      cohortKey: "session-1",
    }).effectiveMode).toBe("shadow_emit");
  });
});