import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSocialAgentId } from "./conversationToken";

const ENV_KEYS = [
  "ELEVENLABS_MAIN_VYVA_AGENT_ID",
  "ELEVENLABS_COMPANION_AGENT_ID",
  "ELEVENLABS_AGENT_VYVA",
  "ELEVENLABS_SOCIAL_AGENT_ID",
  "ELEVENLABS_AGENT_ID",
  "VITE_ELEVENLABS_COMPANION_AGENT_ID",
  "VITE_ELEVENLABS_SOCIAL_AGENT_ID",
  "VITE_ELEVENLABS_AGENT_ID",
  "ELEVENLABS_HEALTH_ASSISTANT_AGENT_ID",
  "ELEVENLABS_HEALTH_AGENT_ID",
] as const;

const originalEnv = new Map<string, string | undefined>();

describe("conversation token agent resolution", () => {
  beforeEach(() => {
    originalEnv.clear();
    ENV_KEYS.forEach((key) => {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    });
  });

  afterEach(() => {
    ENV_KEYS.forEach((key) => {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  it("resolves Home main VYVA from the companion agent env var", () => {
    process.env.ELEVENLABS_COMPANION_AGENT_ID = "agent_companion";

    const resolved = resolveSocialAgentId("main-vyva");

    expect(resolved.agentId).toBe("agent_companion");
    expect(resolved.expectedKeys).toContain("ELEVENLABS_COMPANION_AGENT_ID");
  });

  it("prefers the dedicated main VYVA env var when present", () => {
    process.env.ELEVENLABS_MAIN_VYVA_AGENT_ID = "agent_main";
    process.env.ELEVENLABS_COMPANION_AGENT_ID = "agent_companion";

    const resolved = resolveSocialAgentId("main-vyva");

    expect(resolved.agentId).toBe("agent_main");
  });

  it("accepts the documented health agent env alias", () => {
    process.env.ELEVENLABS_HEALTH_AGENT_ID = "agent_health";

    const resolved = resolveSocialAgentId("health");

    expect(resolved.agentId).toBe("agent_health");
    expect(resolved.expectedKeys).toContain("ELEVENLABS_HEALTH_AGENT_ID");
  });
});
