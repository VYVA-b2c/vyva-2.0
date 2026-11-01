import express from "express";
import request from "supertest";
import { DEFAULT_CONTACT_POLICY } from "../../shared/contactPolicy";
import { describe, it, expect, vi, afterEach } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("../db.js", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    }),
    insert: mocks.insert,
  },
}));
vi.mock("../lib/contactPolicyStore.js", () => ({
  getContactPolicyForUser: async () => ({ policy: DEFAULT_CONTACT_POLICY }),
}));
vi.mock("../middleware/auth.js", () => ({
  requireUser: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    req.user = { id: "resident" } as typeof req.user;
    next();
  },
}));
vi.mock("../lib/profileAccess.js", () => ({
  getActiveProfileContext: async () => ({ profileId: "resident" }),
}));
import router, { computeNextRunAt } from "./scheduledSupport";
afterEach(() => vi.useRealTimers());
describe("multilingual scheduling", () => {
  it("Spanish weekly days produce a run", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T11:00:00Z"));
    const next = computeNextRunAt({
      status: "ACTIVE",
      frequency_type: "WEEKLY",
      days_of_week: ["lunes", "miércoles", "viernes"],
      times_of_day: ["10:00"],
      timezone: "Europe/Madrid",
    });
    expect(next?.toISOString()).toBe("2026-11-09T09:00:00.000Z");
  });
  it("DAILY weekdays skips weekends", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T11:00:00Z"));
    expect(
      computeNextRunAt({
        status: "ACTIVE",
        frequency_type: "DAILY",
        days_of_week: ["weekdays"],
        times_of_day: ["10:00"],
        timezone: "Europe/Madrid",
      })?.toISOString(),
    ).toBe("2026-11-09T09:00:00.000Z");
  });
});

describe("schedule route day validation", () => {
  const app = express();
  app.use(express.json());
  app.use(router);
  it("rejects garbage days with 400", async () => {
    const r = await request(app)
      .post("/users/resident/schedules")
      .send({
        interaction_type: "CHECK_IN",
        frequency_type: "WEEKLY",
        days_of_week: ["nonsense"],
        times_of_day: ["10:00"],
      });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain("No entendí los días");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("creates a Spanish weekly schedule with a next run", async () => {
    mocks.insert.mockReturnValue({
      values: (row: Record<string, unknown>) => ({
        returning: async () => [{ id: "schedule", ...row }],
      }),
    });
    const r = await request(app)
      .post("/users/resident/schedules")
      .send({
        interaction_type: "CHECK_IN",
        frequency_type: "WEEKLY",
        days_of_week: ["lunes", "miércoles", "viernes"],
        times_of_day: ["10:00"],
      });
    expect(r.status).toBe(201);
    expect(r.body.schedule.days_of_week).toEqual(["MON", "WED", "FRI"]);
    expect(r.body.schedule.next_run_at).toBeTruthy();
  });
});
