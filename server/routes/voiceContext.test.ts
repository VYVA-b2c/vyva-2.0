import { describe, expect, it } from "vitest";
import { resolveVoiceContextDomain } from "./voiceContext";

describe("voice context domain resolution", () => {
  it("keeps onboarding profile voice sessions out of generic social context", () => {
    expect(resolveVoiceContextDomain({ agent_slug: "onboarding-profile" })).toBe("onboarding_profile");
    expect(resolveVoiceContextDomain({ agent_slug: "profile-onboarding" })).toBe("onboarding_profile");
    expect(resolveVoiceContextDomain({ domain: "onboarding_profile" })).toBe("onboarding_profile");
  });
});
