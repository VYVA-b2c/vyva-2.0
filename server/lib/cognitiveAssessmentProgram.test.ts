import { describe, expect, it } from "vitest";
import {
  computeNextAssessmentRunAt,
  scheduledInteractionDaysOfWeek,
  scheduledInteractionFrequencyType,
} from "./cognitiveAssessmentProgram.js";

describe("cognitive assessment program scheduling", () => {
  it("uses weekly scheduled interactions for weekly cadence", () => {
    expect(scheduledInteractionFrequencyType("weekly")).toBe("WEEKLY");
    expect(scheduledInteractionDaysOfWeek("2026-07-06")).toEqual(["MON"]);
  });

  it("uses custom scheduled interactions for longer cadences", () => {
    expect(scheduledInteractionFrequencyType("monthly")).toBe("CUSTOM");
    expect(scheduledInteractionFrequencyType("every_2_weeks")).toBe("CUSTOM");
  });

  it("computes a future monthly next run from a past start date", () => {
    const nextRun = computeNextAssessmentRunAt({
      startDate: "2026-01-07",
      reminderTime: "10:00",
      timezone: "UTC",
      frequency: "monthly",
      now: new Date("2026-07-07T09:00:00.000Z"),
    });

    expect(nextRun?.toISOString()).toBe("2026-07-07T10:00:00.000Z");
  });

  it("advances monthly reminders when today's reminder already passed", () => {
    const nextRun = computeNextAssessmentRunAt({
      startDate: "2026-01-07",
      reminderTime: "10:00",
      timezone: "UTC",
      frequency: "monthly",
      now: new Date("2026-07-07T11:00:00.000Z"),
    });

    expect(nextRun?.toISOString()).toBe("2026-08-07T10:00:00.000Z");
  });
});
