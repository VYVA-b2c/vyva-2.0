import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { signVoiceTriageToolToken } from "../lib/jwt.js";
import {
  elevenLabsTriageStepToolHandler,
  retainedMessagesForStatus,
  voiceTriageSessionAnswerHandler,
  voiceTriageSessionEndHandler,
} from "../routes/voiceTriage.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/api/elevenlabs/tools/triage-step", elevenLabsTriageStepToolHandler);
  app.post("/api/voice-triage/session/:conversation_id/answer", voiceTriageSessionAnswerHandler);
  app.post("/api/voice-triage/session/:conversation_id/end", voiceTriageSessionEndHandler);
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

  it("requires an authenticated user to end a session", async () => {
    const response = await request(buildApp())
      .post("/api/voice-triage/session/voice-session-1/end");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: "Not authenticated" });
  });

  it("retains only the minimum rolling text while a session is active", () => {
    const messages = [{ role: "user" as const, content: "I feel dizzy" }];
    expect(retainedMessagesForStatus("active", messages)).toEqual(messages);
    expect(retainedMessagesForStatus("complete", messages)).toEqual([]);
    expect(retainedMessagesForStatus("emergency", messages)).toEqual([]);
    expect(retainedMessagesForStatus("failed", messages)).toEqual([]);
    expect(retainedMessagesForStatus("abandoned", messages)).toEqual([]);
  });
});
