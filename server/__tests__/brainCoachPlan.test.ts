import { describe, expect, it } from "vitest";
import {
  buildBrainCoachDailyPlan,
  extractBrainCoachPreferences,
  getBrainCoachActivityCatalog,
  type BrainCoachPlanEvent,
  type BrainCoachPlanSession,
} from "../lib/brainCoachPlan.js";

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

function event(overrides: Partial<BrainCoachPlanEvent>): BrainCoachPlanEvent {
  return {
    activityType: "memory_match",
    eventType: "accepted",
    createdAt: "2026-05-30T12:00:00.000Z",
    ...overrides,
  };
}

describe("Brain Coach daily plan", () => {
  it("includes Remember Later in the activity catalog", () => {
    expect(getBrainCoachActivityCatalog()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        activityType: "remember_later",
        domain: "prospective_memory",
        secondaryDomain: "attention",
        route: "/memory-games/remember-later",
      }),
    ]));
  });

  it("includes Curious Minds in the activity catalog", () => {
    expect(getBrainCoachActivityCatalog()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        activityType: "curious_minds",
        domain: "divergent_thinking",
        secondaryDomain: "attention",
        route: "/memory-games/curious-minds",
      }),
    ]));
  });

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

  it("downranks activities that were skipped repeatedly", () => {
    const plan = buildBrainCoachDailyPlan({
      sessions: [],
      events: [
        event({ activityType: "sequence_memory", eventType: "skipped", createdAt: "2026-05-30T09:00:00.000Z" }),
        event({ activityType: "sequence_memory", eventType: "skipped", createdAt: "2026-05-29T09:00:00.000Z" }),
      ],
      preferences: { sessionLengthMins: 10, variety: "variety" },
      now: NOW,
    });

    expect(plan.activities[0].activityType).not.toBe("sequence_memory");
    expect(plan.activities.map((activity) => activity.rationale)).toContain("new area for variety");
  });

  it("keeps accepted and completed activities eligible later while avoiding continuous repetition", () => {
    const eligibleLater = buildBrainCoachDailyPlan({
      sessions: [
        session({ activityType: "memory_match", domain: "visual_memory", score: 420, accuracyPct: 52, playedAt: "2026-05-26T08:00:00.000Z" }),
        session({ activityType: "memory_match", domain: "visual_memory", score: 460, accuracyPct: 58, playedAt: "2026-05-25T08:00:00.000Z" }),
      ],
      events: [
        event({ activityType: "memory_match", eventType: "accepted", createdAt: "2026-05-26T08:01:00.000Z" }),
        event({ activityType: "memory_match", eventType: "completed", createdAt: "2026-05-26T08:05:00.000Z" }),
      ],
      preferences: { sessionLengthMins: 10, variety: "variety" },
      now: NOW,
    });

    expect(eligibleLater.activities.some((activity) => activity.activityType === "memory_match")).toBe(true);

    const avoidRepeat = buildBrainCoachDailyPlan({
      sessions: [
        session({ activityType: "memory_match", domain: "visual_memory", playedAt: "2026-05-31T08:00:00.000Z" }),
      ],
      events: [
        event({ activityType: "memory_match", eventType: "accepted", createdAt: "2026-05-31T08:01:00.000Z" }),
        event({ activityType: "memory_match", eventType: "completed", createdAt: "2026-05-31T08:05:00.000Z" }),
      ],
      preferences: { sessionLengthMins: 10, variety: "variety" },
      now: NOW,
    });

    expect(avoidRepeat.activities[0].activityType).not.toBe("memory_match");
  });

  it("uses caregiver-approved focus domains when ranking activities", () => {
    const plan = buildBrainCoachDailyPlan({
      sessions: [],
      preferences: {
        sessionLengthMins: 10,
        variety: "variety",
        preferredDomains: ["spatial_navigation"],
        weeklyTargetDays: 4,
      },
      now: NOW,
    });

    expect(plan.activities[0].domain).toBe("spatial_navigation");
    expect(plan.activities[0].rationale).toContain("caregiver-approved focus domains");
    expect(plan.rationale).toContain("Supports the caregiver-approved weekly goal of 4 Brain Coach days.");
  });

  it("excludes caregiver-blocked activities without changing scoring", () => {
    const plan = buildBrainCoachDailyPlan({
      sessions: [],
      preferences: {
        sessionLengthMins: 10,
        variety: "variety",
        excludedActivityTypes: ["sequence_memory"],
      },
      now: NOW,
    });

    expect(plan.activities.map((activity) => activity.activityType)).not.toContain("sequence_memory");
  });

  it("pauses recommended plans when caregiver-approved settings are paused", () => {
    const plan = buildBrainCoachDailyPlan({
      sessions: [],
      preferences: { caregiverPaused: true },
      now: NOW,
    });

    expect(plan.activities).toEqual([]);
    expect(plan.estimatedDurationMinutes).toBe(0);
    expect(plan.rationale[0]).toContain("paused");
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
