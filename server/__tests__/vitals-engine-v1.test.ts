import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseVitalsText } from "../../shared/vitalsParsing.js";

const { dbExecuteMock, openAiCreateMock, openAiToFileMock, openAiTranscriptionCreateMock } = vi.hoisted(() => ({
  dbExecuteMock: vi.fn(),
  openAiCreateMock: vi.fn(),
  openAiToFileMock: vi.fn(),
  openAiTranscriptionCreateMock: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: {
    execute: dbExecuteMock,
  },
}));

vi.mock("../lib/profileAccess.js", () => ({
  getActiveProfileContext: vi.fn(async (userId: string) => ({ profileId: userId })),
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

import vitalsEngineRouter from "../routes/vitalsEngine.js";
import { authMiddleware } from "../middleware/auth.js";

function buildApp() {
  const app = express();
  app.use(express.json({ limit: "12mb" }));
  app.use(authMiddleware);
  app.use("/api/vitals-engine", vitalsEngineRouter);
  return app;
}

const app = buildApp();

describe("Vitals Hub V1 parsing", () => {
  it("extracts common home readings from natural text", () => {
    const result = parseVitalsText("BP 128 over 76, oxygen 97, sugar 142, temp 37.8, pulse 72, weight 81 kg, pain 4, mood 7, sleep 6");

    expect(result.proposed_readings).toEqual(expect.arrayContaining([
      expect.objectContaining({ signal_type: "bp_systolic", value: 128 }),
      expect.objectContaining({ signal_type: "bp_diastolic", value: 76 }),
      expect.objectContaining({ signal_type: "oxygen_saturation", value: 97 }),
      expect.objectContaining({ signal_type: "glucose_mgdl", value: 142 }),
      expect.objectContaining({ signal_type: "temperature_c", value: 37.8 }),
      expect.objectContaining({ signal_type: "resting_hr_bpm", value: 72 }),
      expect.objectContaining({ signal_type: "weight_kg", value: 81 }),
      expect.objectContaining({ signal_type: "pain_score", value: 4 }),
      expect.objectContaining({ signal_type: "mood_score", value: 7 }),
      expect.objectContaining({ signal_type: "sleep_quality_score", value: 6 }),
    ]));
  });

  it("asks for glucose units when the number looks like mmol/L", () => {
    const result = parseVitalsText("sugar 7.2");

    expect(result.proposed_readings.some((reading) => reading.signal_type === "glucose_mgdl")).toBe(false);
    expect(result.clarification_prompt).toMatch(/mmol\/L or mg\/dL/i);
  });
});

describe("Vitals Hub V1 routes", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    dbExecuteMock.mockReset();
    openAiCreateMock.mockReset();
    openAiToFileMock.mockReset();
    openAiTranscriptionCreateMock.mockReset();
  });

  it("parses typed readings without saving them", async () => {
    const res = await request(app)
      .post("/api/vitals-engine/parse-text")
      .set("x-user-id", "11111111-1111-4111-8111-111111111111")
      .send({ text: "oxygen 96 and glucose 151" })
      .expect(200);

    expect(res.body.needs_confirmation).toBe(true);
    expect(res.body.proposed_readings).toEqual(expect.arrayContaining([
      expect.objectContaining({ signal_type: "oxygen_saturation", value: 96 }),
      expect.objectContaining({ signal_type: "glucose_mgdl", value: 151 }),
    ]));
    expect(dbExecuteMock).not.toHaveBeenCalled();
  });

  it("transcribes voice readings and returns confirmation candidates", async () => {
    openAiToFileMock.mockResolvedValue("audio-file");
    openAiTranscriptionCreateMock.mockResolvedValue({ text: "blood pressure 128 over 76 and oxygen 97" });

    const res = await request(app)
      .post("/api/vitals-engine/parse-audio")
      .set("x-user-id", "11111111-1111-4111-8111-111111111111")
      .set("Content-Type", "audio/webm")
      .send(Buffer.from("voice audio content that is long enough"))
      .expect(200);

    expect(openAiTranscriptionCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-4o-mini-transcribe",
      file: "audio-file",
    }));
    expect(res.body.proposed_readings).toEqual(expect.arrayContaining([
      expect.objectContaining({ signal_type: "bp_systolic", value: 128, capture_method: "voice" }),
      expect.objectContaining({ signal_type: "bp_diastolic", value: 76, capture_method: "voice" }),
      expect.objectContaining({ signal_type: "oxygen_saturation", value: 97, capture_method: "voice" }),
    ]));
  });

  it("reads device-photo candidates without saving them", async () => {
    openAiCreateMock.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            proposed_readings: [
              { signal_type: "glucose_mgdl", value: 142, context_tag: "general", explanation: "Glucose meter display." },
            ],
          }),
        },
      }],
    });

    const res = await request(app)
      .post("/api/vitals-engine/scan-device-photo")
      .set("x-user-id", "11111111-1111-4111-8111-111111111111")
      .send({ image: "data:image/png;base64,ZmFrZQ==" })
      .expect(200);

    expect(res.body.needs_confirmation).toBe(true);
    expect(res.body.proposed_readings).toEqual([
      expect.objectContaining({ signal_type: "glucose_mgdl", value: 142, capture_method: "device_photo" }),
    ]);
    expect(dbExecuteMock).not.toHaveBeenCalled();
  });

  it("bulk saves confirmed readings and rejects another user's target", async () => {
    const otherUser = "22222222-2222-4222-8222-222222222222";
    await request(app)
      .post("/api/vitals-engine/readings")
      .set("x-user-id", "11111111-1111-4111-8111-111111111111")
      .send({
        user_id: otherUser,
        readings: [{ signal_type: "glucose_mgdl", value: 142 }],
      })
      .expect(403);

    dbExecuteMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "reading-1", signal_type: "bp_systolic", value: 128 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "reading-2", signal_type: "bp_diastolic", value: 76 }] });

    const res = await request(app)
      .post("/api/vitals-engine/readings")
      .set("x-user-id", "11111111-1111-4111-8111-111111111111")
      .send({
        readings: [
          { signal_type: "bp_systolic", value: 128, capture_method: "manual" },
          { signal_type: "bp_diastolic", value: 76, capture_method: "manual" },
        ],
      })
      .expect(201);

    expect(res.body.saved_count).toBe(2);
    expect(dbExecuteMock).toHaveBeenCalledTimes(4);
  });

  it("rejects impossible vital values before saving", async () => {
    await request(app)
      .post("/api/vitals-engine/readings")
      .set("x-user-id", "11111111-1111-4111-8111-111111111111")
      .send({
        readings: [{ signal_type: "oxygen_saturation", value: 140 }],
      })
      .expect(400);

    expect(dbExecuteMock).not.toHaveBeenCalled();
  });
});
