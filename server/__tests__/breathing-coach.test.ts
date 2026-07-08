import { describe, expect, it } from "vitest";
import {
  DEFAULT_BREATHING_EXERCISES,
  buildBreathingPlan,
  recommendBreathingExercises,
} from "../lib/breathingCoach.js";

describe("breathing coach recommendations", () => {
  it("matches the user's purpose and returns an executable plan", () => {
    const recommendation = recommendBreathingExercises({
      intent: {
        mood: "restless",
        purpose: "sleep",
        difficulty: "easy",
        durationMinutes: 5,
      },
    });

    expect(recommendation.safetyBlock).toBe(false);
    expect(recommendation.recommended).toMatchObject({
      exerciseSlug: "sleep-soft-breath",
      durationMinutes: 5,
    });
    expect(recommendation.recommended?.plan.phases.length).toBeGreaterThan(1);
    expect(recommendation.recommended?.plan.voicePrompt).toContain("The user may interrupt");
  });

  it("blocks breathing practice when the user reports warning symptoms", () => {
    const recommendation = recommendBreathingExercises({
      intent: {
        freeText: "I feel dizzy and breathing feels painful",
        purpose: "calm",
      },
    });

    expect(recommendation.safetyBlock).toBe(true);
    expect(recommendation.options).toEqual([]);
    expect(recommendation.safetyMessage).toContain("Stop and seek help");
  });

  it("uses saved preferences while avoiding disliked exercises", () => {
    const recommendation = recommendBreathingExercises({
      intent: {
        purpose: "focus",
      },
      preferences: {
        preferred_difficulty: 3,
        preferred_duration_minutes: 3,
        disliked_exercises: ["focus-reset-breath"],
      },
    });

    expect(recommendation.recommended?.exerciseSlug).toBe("steady-box-breath");
  });

  it("scales phase timing to the chosen duration", () => {
    const exercise = DEFAULT_BREATHING_EXERCISES.find((item) => item.slug === "gentle-calm-breath");
    expect(exercise).toBeDefined();

    const plan = buildBreathingPlan(exercise!, { durationMinutes: 5, purpose: "calm" });
    const totalSeconds = plan.phases.reduce((sum, phase) => sum + phase.seconds, 0);

    expect(plan.durationMinutes).toBe(5);
    expect(totalSeconds).toBeGreaterThanOrEqual(285);
    expect(totalSeconds).toBeLessThanOrEqual(315);
  });
});
