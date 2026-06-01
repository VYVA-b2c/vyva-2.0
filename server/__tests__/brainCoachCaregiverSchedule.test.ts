import { describe, expect, it } from "vitest";
import {
  computeBrainCoachNextRunAt,
  normalizeBrainCoachSchedule,
} from "../lib/brainCoachCaregiverSchedule.js";

describe("Brain Coach caregiver schedule", () => {
  it("normalizes days, times, timezone, and pause state", () => {
    const schedule = normalizeBrainCoachSchedule({
      daysOfWeek: ["monday", "WED", "bad"],
      timesOfDay: ["9:30", "25:00", "09:30"],
      timezone: " Europe/Madrid ",
      paused: true,
    });

    expect(schedule).toEqual({
      daysOfWeek: ["MON", "WED"],
      timesOfDay: ["09:30"],
      timezone: "Europe/Madrid",
      paused: true,
    });
  });

  it("uses a gentle default weekly Brain Coach rhythm when empty", () => {
    expect(normalizeBrainCoachSchedule(null)).toMatchObject({
      daysOfWeek: ["MON", "WED", "FRI"],
      timesOfDay: ["11:00"],
      timezone: "Europe/Madrid",
      paused: false,
    });
  });

  it("does not schedule the next run while paused", () => {
    const schedule = normalizeBrainCoachSchedule({ paused: true });

    expect(computeBrainCoachNextRunAt(schedule, new Date("2026-06-01T08:00:00.000Z"))).toBeNull();
  });

  it("computes the next scheduled Brain Coach run", () => {
    const schedule = normalizeBrainCoachSchedule({
      daysOfWeek: ["MON"],
      timesOfDay: ["11:00"],
      timezone: "Europe/Madrid",
    });

    const nextRun = computeBrainCoachNextRunAt(schedule, new Date("2026-06-01T08:00:00.000Z"));

    expect(nextRun?.toISOString()).toBe("2026-06-01T09:00:00.000Z");
  });
});
