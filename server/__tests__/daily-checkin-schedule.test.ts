import { describe, expect, it } from "vitest";
import {
  evaluateDailyCheckinSchedule,
  nextCheckinRunAt,
} from "../lib/dailyCheckinSchedule.js";

describe("daily check-in schedule evaluation", () => {
  it("marks a check-in completed when today's response exists", () => {
    const status = evaluateDailyCheckinSchedule({
      now: new Date("2026-05-29T10:30:00.000Z"),
      timezone: "UTC",
      scheduledTimes: ["10:00"],
      latestCompletedAt: new Date("2026-05-29T10:12:00.000Z"),
    });

    expect(status.state).toBe("completed");
    expect(status.latest_completed_at).toBe("2026-05-29T10:12:00.000Z");
  });

  it("keeps a same-day due check-in in the gentle window before escalating", () => {
    const status = evaluateDailyCheckinSchedule({
      now: new Date("2026-05-29T10:45:00.000Z"),
      timezone: "UTC",
      scheduledTimes: ["10:00"],
      latestCompletedAt: null,
      graceMinutes: 120,
    });

    expect(status.state).toBe("due_now");
    expect(status.minutes_overdue).toBeNull();
  });

  it("marks no response overdue after the grace window", () => {
    const status = evaluateDailyCheckinSchedule({
      now: new Date("2026-05-29T13:15:00.000Z"),
      timezone: "UTC",
      scheduledTimes: ["10:00"],
      latestCompletedAt: null,
      graceMinutes: 120,
    });

    expect(status.state).toBe("overdue");
    expect(status.minutes_overdue).toBe(75);
  });

  it("does not call an unscheduled user overdue", () => {
    const status = evaluateDailyCheckinSchedule({
      now: new Date("2026-05-29T13:15:00.000Z"),
      timezone: "UTC",
      scheduledTimes: [],
      latestCompletedAt: null,
    });

    expect(status.state).toBe("not_scheduled");
  });

  it("finds the next future daily run", () => {
    const next = nextCheckinRunAt({
      now: new Date("2026-05-29T13:15:00.000Z"),
      timezone: "UTC",
      scheduledTimes: ["10:00"],
      status: "ACTIVE",
    });

    expect(next?.toISOString()).toBe("2026-05-30T10:00:00.000Z");
  });
});
