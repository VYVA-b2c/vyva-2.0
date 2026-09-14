import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  insert: vi.fn(),
  values: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: {
    insert: dbMocks.insert,
  },
}));

import heroMessagesRouter from "../routes/heroMessages.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/hero-messages", heroMessagesRouter);
  return app;
}

const app = buildApp();

beforeEach(() => {
  dbMocks.insert.mockReset();
  dbMocks.values.mockReset();
  dbMocks.values.mockResolvedValue(undefined);
  dbMocks.insert.mockReturnValue({ values: dbMocks.values });
});

describe("hero message aggregate events", () => {
  it("accepts valid aggregate event payloads", async () => {
    await request(app)
      .post("/api/hero-messages/events")
      .send({
        message_id: "health-safe-default",
        surface: "health",
        language: "en",
        event_type: "impression",
        reason: "evergreen",
        source: "built_in",
        route: "/health",
      })
      .expect(204);

    expect(dbMocks.values).toHaveBeenCalledWith({
      message_id: "health-safe-default",
      surface: "health",
      language: "en",
      event_type: "impression",
      reason: "evergreen",
      source: "built_in",
      route: "/health",
    });
  });

  it("rejects invalid or user-level event payloads", async () => {
    await request(app)
      .post("/api/hero-messages/events")
      .send({
        message_id: "health-safe-default",
        surface: "health",
        language: "en",
        event_type: "opened",
        reason: "evergreen",
        source: "built_in",
        user_id: "profile-1",
      })
      .expect(400);

    expect(dbMocks.insert).not.toHaveBeenCalled();
  });

  it("accepts dismiss events without user-level data", async () => {
    await request(app)
      .post("/api/hero-messages/events")
      .send({
        message_id: "home-voice-managed",
        surface: "home_voice",
        language: "en",
        event_type: "dismiss",
        reason: "evergreen",
        source: "managed",
      })
      .expect(204);

    expect(dbMocks.values).toHaveBeenCalledWith({
      message_id: "home-voice-managed",
      surface: "home_voice",
      language: "en",
      event_type: "dismiss",
      reason: "evergreen",
      source: "managed",
      route: "",
    });
  });
});
