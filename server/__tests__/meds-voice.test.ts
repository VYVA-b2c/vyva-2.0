import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const { openAiCreateMock, openAiToFileMock, openAiTranscriptionCreateMock } = vi.hoisted(() => ({
  openAiCreateMock: vi.fn(),
  openAiToFileMock: vi.fn(),
  openAiTranscriptionCreateMock: vi.fn(),
}));

vi.mock("openai", () => {
  class MockOpenAI {
    static toFile = openAiToFileMock;

    chat = {
      completions: {
        create: openAiCreateMock,
      },
    };

    audio = {
      transcriptions: {
        create: openAiTranscriptionCreateMock,
      },
    };
  }

  return { default: MockOpenAI };
});

import {
  medsVoiceParseHandler,
  medsVoiceTranscribeAudioBody,
  medsVoiceTranscribeHandler,
} from "../routes/medsVoiceParse.js";

function app() {
  const testApp = express();
  testApp.use(express.json({ limit: "12mb" }));
  testApp.post("/api/meds-voice-transcribe", medsVoiceTranscribeAudioBody, medsVoiceTranscribeHandler);
  testApp.post("/api/meds-voice-parse", medsVoiceParseHandler);
  return testApp;
}

describe("medication voice routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    openAiCreateMock.mockReset();
    openAiToFileMock.mockReset();
    openAiTranscriptionCreateMock.mockReset();
  });

  it("transcribes raw medication audio", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    openAiToFileMock.mockResolvedValue("audio-file");
    openAiTranscriptionCreateMock.mockResolvedValue({ text: "Metformin 500mg twice a day" });

    const res = await request(app())
      .post("/api/meds-voice-transcribe?language=en")
      .set("Content-Type", "audio/webm")
      .send(Buffer.alloc(64, 1))
      .expect(200);

    expect(res.body).toEqual({ transcript: "Metformin 500mg twice a day" });
    expect(openAiToFileMock).toHaveBeenCalledWith(expect.any(Buffer), "medication-voice.webm", { type: "audio/webm" });
    expect(openAiTranscriptionCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      file: "audio-file",
      model: "gpt-4o-mini-transcribe",
      prompt: expect.stringContaining("Medication details"),
    }));
  });

  it("returns a clear voice setup error when medication transcription is not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const res = await request(app())
      .post("/api/meds-voice-transcribe")
      .set("Content-Type", "audio/webm")
      .send(Buffer.alloc(64, 1))
      .expect(503);

    expect(res.body).toEqual({ error: "Voice transcription is not configured." });
    expect(openAiTranscriptionCreateMock).not.toHaveBeenCalled();
  });

  it("parses a medication transcript into structured fields", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    openAiCreateMock.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            name: "Metformin",
            dosage: "500mg",
            frequency: "twice_daily",
          }),
        },
      }],
    });

    const res = await request(app())
      .post("/api/meds-voice-parse")
      .send({ transcript: "I take Metformin 500mg twice daily" })
      .expect(200);

    expect(res.body).toEqual({
      name: "Metformin",
      dosage: "500mg",
      frequency: "twice_daily",
    });
    expect(openAiCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      response_format: { type: "json_object" },
      temperature: 0,
    }));
  });
});
