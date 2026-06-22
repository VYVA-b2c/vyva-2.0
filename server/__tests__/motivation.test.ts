import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../middleware/auth.js";
import motivationRouter from "../routes/motivation.js";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  loadBrainCoachProgressForUser: vi.fn(),
  state: {
    profileId: "profile-1",
    checkinTrend: { streak_days: 0, best_streak: 0, total_checkins: 0 },
    acknowledged: new Map<string, { domain: string; metric: string; threshold: number }>(),
  },
}));

vi.mock("../db.js", () => ({
  pool: {
    query: mocks.poolQuery,
  },
}));

vi.mock("../lib/profileAccess.js", () => ({
  getActiveProfileContext: vi.fn(async (accountUserId: string) => ({
    accountUserId,
    profileId: mocks.state.profileId,
    role: "elder",
    profileCount: 1,
    needsProfileSetup: false,
    needsProfileSelection: false,
  })),
}));

vi.mock("../routes/games.js", () => ({
  loadBrainCoachProgressForUser: mocks.loadBrainCoachProgressForUser,
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/motivation", authMiddleware, motivationRouter);
  return app;
}

const app = buildApp();

function ackKey(userId: string, domain: string, metric: string, threshold: number) {
  return `${userId}:${domain}:${metric}:${threshold}`;
}

beforeEach(() => {
  mocks.state.profileId = "profile-1";
  mocks.state.checkinTrend = { streak_days: 0, best_streak: 0, total_checkins: 0 };
  mocks.state.acknowledged.clear();
  mocks.poolQuery.mockReset();
  mocks.loadBrainCoachProgressForUser.mockReset();

  mocks.poolQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const normalized = sql.toLowerCase();

    if (normalized.includes("from checkin_trend_state")) {
      return { rows: [mocks.state.checkinTrend] };
    }

    if (normalized.includes("from user_milestone_acknowledgements")) {
      const userId = String(params[0]);
      return {
        rows: [...mocks.state.acknowledged.entries()]
          .filter(([key]) => key.startsWith(`${userId}:`))
          .map(([, row]) => row),
      };
    }

    if (normalized.includes("insert into user_milestone_acknowledgements")) {
      const [userId, domain, metric, threshold] = params as [string, string, string, number];
      mocks.state.acknowledged.set(ackKey(userId, domain, metric, threshold), {
        domain,
        metric,
        threshold,
      });
      return { rows: [] };
    }

    return { rows: [] };
  });

  mocks.loadBrainCoachProgressForUser.mockResolvedValue({
    summary: {
      streakDays: 0,
      totalSessions: 0,
      completedSessions: 0,
      lastPlayedAt: null,
    },
  });
});

describe("Motivation milestones API", () => {
  it("returns user-scoped pending milestones in priority order", async () => {
    mocks.state.checkinTrend = { streak_days: 7, best_streak: 7, total_checkins: 7 };
    mocks.loadBrainCoachProgressForUser.mockResolvedValue({
      summary: {
        streakDays: 14,
        totalSessions: 18,
        completedSessions: 14,
        lastPlayedAt: "2026-06-22T08:00:00.000Z",
      },
    });
    mocks.state.acknowledged.set(ackKey("user-1", "daily_checkin", "streak_days", 5), {
      domain: "daily_checkin",
      metric: "streak_days",
      threshold: 5,
    });

    const res = await request(app)
      .get("/api/motivation/milestones/pending")
      .set("x-user-id", "user-1")
      .expect(200);

    expect(res.body.milestones.map((milestone: { id: string }) => milestone.id).slice(0, 3)).toEqual([
      "daily_checkin:streak_days:7",
      "daily_checkin:streak_days:3",
      "brain_coach:streak_days:14",
    ]);
    expect(res.body.milestones).not.toContainEqual(expect.objectContaining({
      id: "daily_checkin:streak_days:5",
    }));
  });

  it("acknowledges a milestone and prevents duplicate repeats", async () => {
    await request(app)
      .post("/api/motivation/milestones/brain_coach:streak_days:5/acknowledge")
      .set("x-user-id", "user-1")
      .send({ achieved_value: 6, source_ref: { total_sessions: 6 } })
      .expect(200);

    await request(app)
      .post("/api/motivation/milestones/brain_coach:streak_days:5/acknowledge")
      .set("x-user-id", "user-1")
      .send({ achieved_value: 6 })
      .expect(200);

    expect(mocks.state.acknowledged.size).toBe(1);
    expect(mocks.state.acknowledged.get(ackKey("user-1", "brain_coach", "streak_days", 5))).toEqual({
      domain: "brain_coach",
      metric: "streak_days",
      threshold: 5,
    });
  });
});
