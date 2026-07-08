import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { signVoiceTriageToolToken } from "../lib/jwt.js";
import { elevenLabsTriageStepToolHandler, voiceTriageSessionAnswerHandler } from "../routes/voiceTriage.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/api/elevenlabs/tools/triage-step", elevenLabsTriageStepToolHandler);
  app.post("/api/voice-triage/session/:conversation_id/answer", voiceTriageSessionAnswerHandler);
  return app;
}

describe("ElevenLabs voice triage tool", () => {
  it("rejects missing triage tool tokens", async () => {
    const response = await request(buildApp())
      .post("/api/elevenlabs/tools/triage-step")
      .send({
        user_id: "user-1",
        conversation_id: "voice-session-1",
        locale: "en",
        utterance: "I feel dizzy",
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ ok: false, error: "Invalid or expired triage token" });
  });

  it("rejects tokens scoped to a different conversation", async () => {
    const token = await signVoiceTriageToolToken("user-1", "voice-session-1");
    const response = await request(buildApp())
      .post("/api/elevenlabs/tools/triage-step")
      .set("X-VYVA-Voice-Triage-Token", token)
      .send({
        user_id: "user-1",
        conversation_id: "voice-session-2",
        locale: "en",
        utterance: "I feel dizzy",
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ ok: false, error: "Triage token does not match this conversation" });
  });

  it("requires an authenticated user for touch answers", async () => {
    const response = await request(buildApp())
      .post("/api/voice-triage/session/voice-session-1/answer")
      .send({ choice_id: "no_red_flags", utterance: "No" });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: "Not authenticated" });
  });
});
