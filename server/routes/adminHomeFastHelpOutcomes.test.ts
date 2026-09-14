import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  homeFastHelpOutcomeAggregate: vi.fn(),
}));

vi.mock("../services/homeFastHelpSync.js", () => service);

import router from "./adminHomeFastHelpOutcomes.js";

const aggregate = {
  generatedAt: "2026-07-17T12:00:00.000Z",
  windowDays: 30,
  totals: {
    shown: 12,
    attributedOpened: 3,
    attributedCompleted: 2,
    attributedBlocked: 1,
    opened: 3,
    completed: 2,
    dismissed: 0,
    abandoned: 0,
    blocked: 1,
    resumed: 0,
    recovered: 0,
  },
  actions: [],
  rankingVersions: [{
    rankingVersion: "personalized-v1",
    impressions: 4,
    shown: 12,
    opened: 3,
    completed: 2,
    blocked: 1,
    actions: [{
      actionId: "book-ride",
      shown: 4,
      opened: 3,
      completed: 2,
      blocked: 1,
    }],
  }],
};

describe("admin Home Fast Help ranking insights route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns aggregate funnels and ranking versions without user or profile records", async () => {
    service.homeFastHelpOutcomeAggregate.mockResolvedValue(aggregate);
    const app = express();
    app.use("/api/admin/home/fast-help-outcomes", router);

    const response = await request(app)
      .get("/api/admin/home/fast-help-outcomes?days=30")
      .expect(200);

    expect(service.homeFastHelpOutcomeAggregate).toHaveBeenCalledWith(30);
    expect(response.body).toEqual(aggregate);
    expect(JSON.stringify(response.body)).not.toMatch(/userId|profileId|diagnos|cognitive|symptom/i);
  });

  it("bounds the reporting window", async () => {
    const app = express();
    app.use("/api/admin/home/fast-help-outcomes", router);
    await request(app).get("/api/admin/home/fast-help-outcomes?days=91").expect(400);
    expect(service.homeFastHelpOutcomeAggregate).not.toHaveBeenCalled();
  });
});
