import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  homeFastHelpSyncAvailableForUser: vi.fn(),
  listHomeFastHelpJourneys: vi.fn(),
  syncHomeFastHelpJourneys: vi.fn(),
}));

vi.mock("../services/homeFastHelpSync.js", () => service);

import router from "./homeFastHelpSync.js";

function appFor(userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId } as Express.User;
    next();
  });
  app.use("/api/home/fast-help", router);
  return app;
}

const journey = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  actionId: "safe-home",
  impressionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  status: "opened",
  startedAt: "2026-07-17T10:00:00.000Z",
  updatedAt: "2026-07-17T10:00:00.000Z",
  referenceId: null,
  events: [{
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    status: "opened",
    occurredAt: "2026-07-17T10:00:00.000Z",
    referenceId: null,
  }],
};

const impression = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  actionIds: ["safe-home", "book-ride", "stay-well"],
  rankingVersion: "personalized-v1",
  shownAt: "2026-07-17T09:59:00.000Z",
};

describe("Home Fast Help sync route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the authenticated user and returns the merged journeys", async () => {
    service.homeFastHelpSyncAvailableForUser.mockResolvedValue(true);
    service.syncHomeFastHelpJourneys.mockResolvedValue([journey]);

    const response = await request(appFor())
      .post("/api/home/fast-help/sync")
      .send({ journeys: [journey], impressions: [impression] })
      .expect(200);

    expect(service.syncHomeFastHelpJourneys).toHaveBeenCalledWith(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      [journey],
      [impression],
    );
    expect(response.body.syncAvailable).toBe(true);
  });

  it("rejects sensitive or unrecognized payload fields", async () => {
    await request(appFor())
      .post("/api/home/fast-help/sync")
      .send({ journeys: [{ ...journey, symptomText: "private" }] })
      .expect(400);
    expect(service.syncHomeFastHelpJourneys).not.toHaveBeenCalled();

    await request(appFor())
      .post("/api/home/fast-help/sync")
      .send({ journeys: [journey], impressions: [{ ...impression, diagnosis: "private" }] })
      .expect(400);
    expect(service.syncHomeFastHelpJourneys).not.toHaveBeenCalled();
  });

  it("keeps local-only accounts working without attempting storage", async () => {
    service.homeFastHelpSyncAvailableForUser.mockResolvedValue(false);
    const response = await request(appFor("legacy-user"))
      .post("/api/home/fast-help/sync")
      .send({ journeys: [] })
      .expect(200);
    expect(response.body).toMatchObject({ syncAvailable: false, journeys: [] });
  });
});
