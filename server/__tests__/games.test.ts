import "dotenv/config";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import gamesRouter, { buildBrainCoachProgress, calculateBrainCoachStreak } from "../routes/games.js";
import { authMiddleware, requireUser } from "../middleware/auth.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/games", authMiddleware, requireUser, gamesRouter);
  return app;
}

const app = buildApp();
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

describe("brain game API routes", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_BRAIN_TTS_VOICE_ID;
    delete process.env.ELEVENLABS_VOICE_ID;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns JSON fallback scoring when OpenAI is not configured", async () => {
    const res = await request(app)
      .post("/api/games/score-retell")
      .set("x-user-id", "test-user")
      .send({
        retellText: "Ana bought bread.",
        keyFacts: ["Ana went out", "Ana bought bread", "Ana sat in the park"],
        language: "en",
      })
      .expect(200);

    expect(res.body).toMatchObject({
      covered: [],
      not_covered: [1, 2, 3],
      covered_count: 0,
      total_count: 3,
    });
    expect(res.body.error).toContain("OpenAI API key");
  });

  it("returns a clear TTS configuration error when ElevenLabs is not configured", async () => {
    const res = await request(app)
      .post("/api/games/tts")
      .set("x-user-id", "test-user")
      .send({ text: "Hello", language: "en" })
      .expect(503);

    expect(res.body.error).toBe("ElevenLabs TTS is not configured.");
  });

  it("returns audio from the TTS route when ElevenLabs responds successfully", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.ELEVENLABS_BRAIN_TTS_VOICE_ID = "voice-id";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "audio/mpeg" }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as Response);

    const res = await request(app)
      .post("/api/games/tts")
      .set("x-user-id", "test-user")
      .send({ text: "Hello", language: "en" })
      .expect(200);

    expect(res.headers["content-type"]).toContain("audio/mpeg");
    expect(Buffer.from(res.body)).toEqual(Buffer.from([1, 2, 3]));
  });

  it("calculates real Brain Coach streaks from completed session dates", () => {
    const now = new Date("2026-05-31T12:00:00.000Z");

    expect(calculateBrainCoachStreak([
      {
        activityType: "memory_match",
        domain: "visual_memory",
        completed: true,
        playedAt: "2026-05-31T09:00:00.000Z",
      },
      {
        activityType: "number_trails",
        domain: "processing_speed",
        completed: true,
        playedAt: "2026-05-30T18:00:00.000Z",
      },
      {
        activityType: "category_sort",
        domain: "executive_function",
        completed: true,
        playedAt: "2026-05-28T18:00:00.000Z",
      },
    ], now)).toBe(2);

    expect(calculateBrainCoachStreak([
      {
        activityType: "memory_match",
        domain: "visual_memory",
        completed: true,
        playedAt: "2026-05-29T09:00:00.000Z",
      },
    ], now)).toBe(0);
  });

  it("builds unified progress and activity history across game families", () => {
    const progress = buildBrainCoachProgress([
      {
        activityType: "memory_match",
        domain: "visual_memory",
        difficulty: 2,
        completed: true,
        score: 840,
        durationSeconds: 92,
        playedAt: "2026-05-31T09:00:00.000Z",
      },
      {
        activityType: "number_trails",
        domain: "processing_speed",
        secondaryDomain: "executive_function",
        difficulty: 3,
        completed: true,
        score: 720,
        durationSeconds: 48,
        playedAt: "2026-05-30T17:00:00.000Z",
      },
      {
        activityType: "category_sort",
        domain: "executive_function",
        difficulty: 3,
        completed: false,
        abandoned: true,
        score: 0,
        durationSeconds: 15,
        playedAt: "2026-05-30T16:00:00.000Z",
      },
    ], new Date("2026-05-31T12:00:00.000Z"));

    expect(progress.summary).toMatchObject({
      totalSessions: 3,
      completedSessions: 2,
      streakDays: 2,
      totalDurationSeconds: 155,
    });
    expect(progress.today.activityTypes).toEqual(["memory_match"]);
    expect(progress.activities.map((activity) => activity.activityType)).toEqual([
      "memory_match",
      "number_trails",
      "category_sort",
    ]);
    expect(progress.history.map((session) => session.activityType)).toEqual([
      "memory_match",
      "number_trails",
      "category_sort",
    ]);
  });
});
