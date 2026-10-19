import { describe, expect, it } from "vitest";
import { resolveExpertCareFeatureFlag } from "./expertCareFeatureFlag";

describe("Expert Care feature flag", () => {
  it("defaults closed in production and open for local development", () => {
    expect(resolveExpertCareFeatureFlag({ userId: "u1" }, { NODE_ENV: "production" })).toMatchObject({ enabled: false, mode: "disabled" });
    expect(resolveExpertCareFeatureFlag({ userId: "u1" }, { NODE_ENV: "development" })).toMatchObject({ enabled: true, mode: "general" });
  });

  it("allows only explicit identities during staged pilots", () => {
    const env = { NODE_ENV: "production", EXPERT_CARE_RELEASE_MODE: "limited_pilot", EXPERT_CARE_ALLOWED_IDENTITIES: "member-1, pilot@example.test" };
    expect(resolveExpertCareFeatureFlag({ userId: "member-1" }, env)).toMatchObject({ enabled: true });
    expect(resolveExpertCareFeatureFlag({ userId: "member-2", email: "pilot@example.test" }, env)).toMatchObject({ enabled: true });
    expect(resolveExpertCareFeatureFlag({ userId: "member-3" }, env)).toMatchObject({ enabled: false, reason: "pilot_access_required" });
  });
});
