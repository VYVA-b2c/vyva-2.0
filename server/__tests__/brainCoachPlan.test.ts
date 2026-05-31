import { describe, expect, it } from "vitest";
import { buildBrainCoachDailyPlan, extractBrainCoachPreferences, type BrainCoachPlanSession } from "../lib/brainCoachPlan.js";

const NOW = new Date("2026-05-31T12:00:00.000Z");

function session(overrides: Partial<BrainCoachPlanSession>): BrainCoachPlanSession {
  return {
    activityType: "memory_match",
    domain: "visual_memory",
    completed: true,
    score: 700,
    accuracyPct: 75,
    durationSeconds: 180,
    playedAt: "2026-05-30T12:00:00.000Z",
    ...overrides,
  };
}

describe("Brain Coach daily plan", () => {
  it("creates a short balanced plan for a new user", () => {
    const plan = buildBrainCoachDailyPlan({
      sessions: [],
      preferences: { sessionLengthMins: 10, variety: "variety" },
      now: NOW,
    });

    expect(plan.estimatedDurationMinutes).toBeGreaterThanOrEqual(5);
    expect(plan.estimatedDurationMinutes).toBeLessThanOrEqual(10);
    expect(plan.activities.map((activity) => activity.activityType)).toContain("sequence_memory");
    expect(plan.recommendedDomains).toContain("attention");
    expect(plan.rationale[0]).toContain("no Brain Coach history");
  });

  it("uses open domains and avoids repeating the same game for an active user", () => {
    const plan = buildBrainCoachDailyPlan({
      sessions: [
        session({ activityType: "memory_match", domain: "visual_memory", playedAt: "2026-05-31T08:00:00.000Z" }),
        session({ activityType: "memory_match", domain: "visual_memory", playedAt: "2026-05-30T08:00:00.000Z" }),
        session({ activityType: "sequence_memory", domain: "attention", playedAt: "2026-05-29T08:00:00.000Z" }),
      ],
      preferences: { sessionLengthMins: 10, variety: "variety" },
      now: NOW,
      streakDays: 3,
    });

    expect(plan.activities.some((activity) => activity.activityType === "memory_match")).toBe(false);
    expect(plan.activities.some((activity) => !["visual_memory", "attention"].includes(activity.domain))).toBe(true);
    expect(plan.rationale).toContain("Avoids repeating the same game continuously.");
  });

  it("keeps the plan short when the user is lapsed", () => {
    const plan = buildBrainCoachDailyPlan({
      sessions: [
        session({ activityType: "word_recall", domain: "episodic_memory", playedAt: "2026-05-18T08:00:00.000Z" }),
      ],
      preferences: { sessionLengthMins: 20 },
      now: NOW,
      streakDays: 0,
    });

    expect(plan.estimatedDurationMinutes).toBeGreaterThanOrEqual(5);
    expect(plan.estimatedDurationMinutes).toBeLessThanOrEqual(10);
    expect(plan.rationale[0]).toContain("restart after a gap");
  });

  it("prioritizes attention when memory is strong but attention is weak", () => {
    const plan = buildBrainCoachDailyPlan({
      sessions: [
        session({ activityType: "memory_match", domain: "visual_memory", score: 930, accuracyPct: 95, playedAt: "2026-05-30T08:00:00.000Z" }),
        session({ activityType: "word_recall", domain: "episodic_memory", score: 880, accuracyPct: 90, playedAt: "2026-05-29T08:00:00.000Z" }),
        session({ activityType: "sequence_memory", domain: "attention", score: 420, accuracyPct: 52, playedAt: "2026-05-28T08:00:00.000Z" }),
        session({ activityType: "dual_task_walk", domain: "attention", score: 390, accuracyPct: 48, playedAt: "2026-05-27T08:00:00.000Z" }),
      ],
      preferences: { sessionLengthMins: 10, variety: "variety" },
      now: NOW,
    });

    expect(plan.activities[0].domain).toBe("attention");
    expect(plan.activities[0].rationale).toContain("needs gentle practice");
  });

  it("handles empty history and missing preferences", () => {
    const plan = buildBrainCoachDailyPlan({ now: NOW });

    expect(plan.activities.length).toBeGreaterThan(0);
    expect(plan.completion).toMatchObject({
      completedCount: 0,
      totalCount: plan.activities.length,
      allComplete: false,
    });
  });

  it("extracts onboarding cognitive preferences from profile consent data", () => {
    const preferences = extractBrainCoachPreferences({
      cognitive: {
        session_length_mins: 5,
        training_time: "morning",
        variety: "repeating",
        pace: "slower",
        memory_difficulties: "mild",
      },
      hobbies: {
        hobbies: ["Reading", "Puzzles"],
        personality: { time_of_day: "Morning person" },
      },
    });

    expect(preferences).toMatchObject({
      sessionLengthMins: 5,
      trainingTime: "morning",
      variety: "repeating",
      pace: "slower",
      memoryDifficulties: "mild",
      hobbies: ["Reading", "Puzzles"],
      personality: { time_of_day: "Morning person" },
    });
  });
});
