import { describe, expect, it } from "vitest";
import { buildAgentOperatingRules } from "../../server/lib/voiceAgentPolicy";

describe("voice agent navigation policy", () => {
  it("directs broad requests for every pillar through the shared app action tool", () => {
    const rules = buildAgentOperatingRules("companion");

    expect(rules).toContain("health for Health");
    expect(rules).toContain("brain_coach for Mind");
    expect(rules).toContain("social for Community");
    expect(rules).toContain("concierge for Concierge");
    expect(rules).toContain("Do not invent a route or action type");
  });
});
