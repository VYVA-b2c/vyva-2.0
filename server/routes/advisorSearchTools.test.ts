import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/participation.js", () => ({
  buildParticipationPulse: vi.fn(async () => ({
    generatedAt: "2026-09-14T10:00:00.000Z",
    featuredEvent: {
      title: "Gentle museum visit",
      summary: "A calm local outing.",
      tags: ["museum"],
      locationLabel: "City museum",
      timeLabel: "Saturday",
      source: "curated",
      sourceUrl: "https://vyva.life/events/museum",
    },
    recommendations: [],
  })),
}));

import { signAdvisorSearchToolToken } from "../lib/jwt.js";
import { advisorLiveSearchToolHandler } from "./advisorSearchTools.js";

function app() {
  const result = express();
  result.use(express.json());
  result.post("/tool", advisorLiveSearchToolHandler);
  return result;
}

describe("advisor live-search tool", () => {
  it("rejects a request without the scoped session token", async () => {
    await request(app())
      .post("/tool")
      .send({ user_id: "user-1", conversation_id: "conversation-1", advisor_slug: "marta", query: "museum" })
      .expect(400);
  });

  it("uses VYVA curated events first for Outings Companion", async () => {
    const token = await signAdvisorSearchToolToken("user-1", "conversation-1", "marta");
    const response = await request(app())
      .post("/tool")
      .send({
        user_id: "user-1",
        conversation_id: "conversation-1",
        advisor_slug: "marta",
        advisor_search_tool_token: token,
        query: "museum",
      })
      .expect(200);

    expect(response.body).toMatchObject({ ok: true, source: "vyva_curated_events" });
    expect(response.body.results[0]).toMatchObject({
      source_name: "curated",
      source_url: "https://vyva.life/events/museum",
      date: "2026-09-14T10:00:00.000Z",
    });
  });

  it("does not allow a token issued for one advisor to search as another", async () => {
    const token = await signAdvisorSearchToolToken("user-1", "conversation-1", "marta");
    await request(app())
      .post("/tool")
      .send({
        user_id: "user-1",
        conversation_id: "conversation-1",
        advisor_slug: "ines",
        advisor_search_tool_token: token,
        query: "pension help",
      })
      .expect(403);
  });
});
