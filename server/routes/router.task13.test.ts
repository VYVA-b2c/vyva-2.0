import { describe, expect, it } from "vitest";
import {
  resolveRouterHealthMemoryPolicyFlag,
  shouldUseLegacyRouterMem0,
} from "./router.js";
import {
  TASK13_USER_ID,
  task13DisabledEnv,
  task13PilotEnv,
} from "../memory/healthMemoryFixtures.js";

describe("Task 13 router Health memory policy gate", () => {
  it("disables direct legacy Mem0 reads and writes for Health only when the pilot flag is active", () => {
    const healthPilot = resolveRouterHealthMemoryPolicyFlag({
      domain: "health",
      userId: TASK13_USER_ID,
      env: task13PilotEnv,
    });
    expect(healthPilot).toMatchObject({
      effectiveMode: "pilot",
      reasonCode: "health_memory_policy_allowed_user",
    });
    expect(shouldUseLegacyRouterMem0("health", healthPilot)).toBe(false);
  });

  it("preserves legacy Mem0 behavior when Health policy is disabled", () => {
    const healthDisabled = resolveRouterHealthMemoryPolicyFlag({
      domain: "health",
      userId: TASK13_USER_ID,
      env: task13DisabledEnv,
    });
    expect(healthDisabled).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "health_memory_policy_disabled_requested",
    });
    expect(shouldUseLegacyRouterMem0("health", healthDisabled)).toBe(true);
  });

  it("does not apply the Health-only policy gate to non-Health routing domains", () => {
    expect(resolveRouterHealthMemoryPolicyFlag({
      domain: "companion",
      userId: TASK13_USER_ID,
      env: task13PilotEnv,
    })).toBeNull();
    expect(shouldUseLegacyRouterMem0("companion", null)).toBe(true);
    expect(shouldUseLegacyRouterMem0("meds", null)).toBe(true);
    expect(shouldUseLegacyRouterMem0("brain_coach", null)).toBe(true);
  });
});
