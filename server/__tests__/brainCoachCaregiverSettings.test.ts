import { describe, expect, it } from "vitest";
import {
  mergeCaregiverSettingsIntoPreferences,
  normalizeBrainCoachCaregiverSettings,
} from "../lib/brainCoachCaregiverSettings.js";

describe("Brain Coach caregiver settings", () => {
  it("normalizes domains, activities, times, goals, and session length", () => {
    const settings = normalizeBrainCoachCaregiverSettings({
      preferredDomains: ["Attention", "bad value!", "attention"],
      excludedActivityTypes: ["memory_match", "x"],
      preferredTrainingTimes: ["09:30", "25:00", "09:30"],
      weeklyTargetDays: 12,
      sessionLengthMinutes: 20,
      paused: true,
    });

    expect(settings).toEqual({
      preferredDomains: ["attention"],
      excludedActivityTypes: ["memory_match"],
      preferredTrainingTimes: ["09:30"],
      weeklyTargetDays: 7,
      sessionLengthMinutes: 10,
      paused: true,
    });
  });

  it("merges caregiver settings into planner preferences", () => {
    const preferences = mergeCaregiverSettingsIntoPreferences(
      { sessionLengthMins: 5, trainingTime: "morning", variety: "variety" },
      {
        preferredDomains: ["attention"],
        excludedActivityTypes: ["memory_match"],
        preferredTrainingTimes: ["11:00"],
        weeklyTargetDays: 4,
        sessionLengthMinutes: 8,
      },
    );

    expect(preferences).toMatchObject({
      sessionLengthMins: 8,
      trainingTime: "11:00",
      preferredDomains: ["attention"],
      excludedActivityTypes: ["memory_match"],
      weeklyTargetDays: 4,
    });
  });
});
