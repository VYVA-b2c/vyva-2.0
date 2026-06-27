import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { conversationReadinessHandler, conversationTokenHandler, resolveSocialAgentId } from "./conversationToken";

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
  "ELEVENLABS_CONCIERGE_AGENT_ID",
  "ELEVENLABS_API_KEY",
  "VITE_ELEVENLABS_API_KEY",
  "ELEVENLABS_CONVAI_API_KEY",
] as const;

const originalEnv = new Map<string, string | undefined>();

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/readiness", conversationReadinessHandler);
  app.post("/token", conversationTokenHandler);
  return app;
}

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
    vi.unstubAllGlobals();
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

  it("returns a missing agent code when no matching agent is configured", async () => {
    const res = await request(buildApp())
      .post("/token")
      .send({ agent_slug: "concierge" })
      .expect(400);

    expect(res.body).toMatchObject({
      code: "ELEVENLABS_AGENT_MISSING",
      agent_slug: "concierge",
    });
  });

  it("checks readiness with the same agent resolution without creating a signed URL", async () => {
    process.env.ELEVENLABS_CONCIERGE_AGENT_ID = "agent_concierge";
    process.env.ELEVENLABS_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(buildApp())
      .post("/readiness")
      .send({ agent_slug: "concierge" })
      .expect(200);

    expect(res.body).toMatchObject({
      ready: true,
      agent_slug: "concierge",
      source: "slug",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a missing agent code from readiness before opening ElevenLabs", async () => {
    const res = await request(buildApp())
      .post("/readiness")
      .send({ agent_slug: "concierge" })
      .expect(400);

    expect(res.body).toMatchObject({
      code: "ELEVENLABS_AGENT_MISSING",
      agent_slug: "concierge",
    });
  });

  it("returns a missing API key code from readiness when agent config exists", async () => {
    process.env.ELEVENLABS_CONCIERGE_AGENT_ID = "agent_concierge";

    const res = await request(buildApp())
      .post("/readiness")
      .send({ agent_slug: "concierge" })
      .expect(500);

    expect(res.body).toMatchObject({
      code: "ELEVENLABS_API_KEY_MISSING",
      error: "Missing ElevenLabs API key",
    });
  });

  it("returns a missing API key code when an agent exists without server credentials", async () => {
    process.env.ELEVENLABS_CONCIERGE_AGENT_ID = "agent_concierge";

    const res = await request(buildApp())
      .post("/token")
      .send({ agent_slug: "concierge" })
      .expect(500);

    expect(res.body).toMatchObject({
      code: "ELEVENLABS_API_KEY_MISSING",
      error: "Missing ElevenLabs API key",
    });
  });

  it("returns a token error code when ElevenLabs omits the signed URL", async () => {
    process.env.ELEVENLABS_CONCIERGE_AGENT_ID = "agent_concierge";
    process.env.ELEVENLABS_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));

    const res = await request(buildApp())
      .post("/token")
      .send({ agent_slug: "concierge" })
      .expect(502);

    expect(res.body).toMatchObject({
      code: "ELEVENLABS_TOKEN_ERROR",
      error: "ElevenLabs signed URL response was empty",
    });
  });
});
