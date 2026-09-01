import { describe, expect, it } from "vitest";
import { isDrAiAgentSlug, resolveDrAiVoiceAccess, resolveHealthAssistantAgentId } from "./drAiVoiceFeature";

describe("Dr. AI voice feature access", () => {
  it("uses one canonical Health Assistant ID with legacy fallbacks", () => {
    expect(resolveHealthAssistantAgentId({
      ELEVENLABS_HEALTH_ASSISTANT_AGENT_ID: "agent_canonical",
      ELEVENLABS_DR_AI_AGENT_ID: "agent_dr_ai_legacy",
      ELEVENLABS_HEALTH_AGENT_ID: "agent_health_legacy",
    })).toBe("agent_canonical");
    expect(resolveHealthAssistantAgentId({ ELEVENLABS_DR_AI_AGENT_ID: "agent_dr_ai_legacy" })).toBe("agent_dr_ai_legacy");
    expect(resolveHealthAssistantAgentId({ ELEVENLABS_HEALTH_AGENT_ID: "agent_health_legacy" })).toBe("agent_health_legacy");
  });

  it("fails closed for missing and invalid modes", () => {
    expect(resolveDrAiVoiceAccess({ userId: "user-1", env: {} })).toEqual({ enabled: false, mode: "disabled" });
    expect(resolveDrAiVoiceAccess({ userId: "user-1", env: { VYVA_DR_AI_VOICE_MODE: "maybe" } })).toEqual({ enabled: false, mode: "disabled" });
  });

  it("allows only listed users during the pilot", () => {
    const env = {
      VYVA_DR_AI_VOICE_MODE: "pilot",
      VYVA_DR_AI_VOICE_PILOT_USER_IDS: "user-1, user-3",
    };
    expect(resolveDrAiVoiceAccess({ userId: "user-1", env }).enabled).toBe(true);
    expect(resolveDrAiVoiceAccess({ userId: "user-2", env }).enabled).toBe(false);
  });

  it("allows authenticated users when active", () => {
    expect(resolveDrAiVoiceAccess({ userId: "user-1", env: { VYVA_DR_AI_VOICE_MODE: "active" } }).enabled).toBe(true);
    expect(resolveDrAiVoiceAccess({ userId: null, env: { VYVA_DR_AI_VOICE_MODE: "active" } }).enabled).toBe(false);
  });

  it("recognizes both dedicated slugs", () => {
    expect(isDrAiAgentSlug("dr-ai")).toBe(true);
    expect(isDrAiAgentSlug("ask-dr-ai")).toBe(true);
    expect(isDrAiAgentSlug("health")).toBe(false);
  });
});
