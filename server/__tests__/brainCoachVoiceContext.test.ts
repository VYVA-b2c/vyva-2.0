import { describe, expect, it } from "vitest";
import { buildBrainCoachVoiceContext } from "../lib/brainCoachVoiceContext.js";
import type { BrainCoachPlanSession } from "../lib/brainCoachPlan.js";

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

describe("Brain Coach voice context", () => {
  it("creates a first-session prompt for a new user", () => {
    const context = buildBrainCoachVoiceContext({
      sessions: [],
      preferences: { sessionLengthMins: 10, variety: "variety" },
      now: NOW,
    });

    expect(context.state).toBe("new_user");
    expect(context.missedSessionAwareness).toContain("do not mention missed sessions");
    expect(context.recommendedActivityPrompt).toContain("Rhythm Tap");
    expect(context.recommendedActivityPrompt).toContain("/attention-boosters/rhythm-tap");
  });

  it("mentions completed activity yesterday without treating it as lapsed", () => {
    const context = buildBrainCoachVoiceContext({
      sessions: [
        session({ activityType: "memory_match", domain: "visual_memory", playedAt: "2026-05-30T09:00:00.000Z" }),
      ],
      preferences: { sessionLengthMins: 8 },
      now: NOW,
    });

    expect(context.state).toBe("completed_yesterday");
    expect(context.completedYesterday).toContain("Memory Match");
    expect(context.missedSessionAwareness).toContain("completed yesterday");
    expect(context.streakAwareness).toContain("1 day");
  });

  it("builds low-pressure language for a lapsed user", () => {
    const context = buildBrainCoachVoiceContext({
      sessions: [
        session({ activityType: "word_recall", domain: "episodic_memory", playedAt: "2026-05-18T09:00:00.000Z" }),
      ],
      preferences: { sessionLengthMins: 20 },
      now: NOW,
    });

    expect(context.state).toBe("lapsed");
    expect(context.missedSessionAwareness).toContain("13 days ago");
    expect(context.missedSessionAwareness).toContain("low-pressure");
    expect(context.plan.estimatedDurationMinutes).toBeGreaterThanOrEqual(5);
    expect(context.plan.estimatedDurationMinutes).toBeLessThanOrEqual(10);
  });

  it("surfaces active streak momentum", () => {
    const context = buildBrainCoachVoiceContext({
      sessions: [
        session({ activityType: "memory_match", domain: "visual_memory", playedAt: "2026-05-31T09:00:00.000Z" }),
        session({ activityType: "sequence_memory", domain: "attention", playedAt: "2026-05-30T09:00:00.000Z" }),
        session({ activityType: "word_recall", domain: "episodic_memory", playedAt: "2026-05-29T09:00:00.000Z" }),
      ],
      preferences: { sessionLengthMins: 10, variety: "variety" },
      now: NOW,
    });

    expect(context.state).toBe("completed_today");
    expect(context.streakAwareness).toContain("3 days");
    expect(context.summary).toContain("Completed activities in the last 30 days: 3");
  });

  it("includes persisted plan and item IDs in the recommended voice prompt", () => {
    const context = buildBrainCoachVoiceContext({
      sessions: [],
      now: NOW,
      plan: {
        planId: "00000000-0000-4000-8000-000000000001",
        status: "active",
        planDate: "2026-05-31",
        generatedAt: NOW.toISOString(),
        estimatedDurationMinutes: 4,
        recommendedDomains: ["attention"],
        rationale: ["Starts with a short plan."],
        activities: [{
          planItemId: "00000000-0000-4000-8000-000000000010",
          activityType: "sequence_memory",
          title: "Rhythm Tap",
          domain: "attention",
          route: "/attention-boosters/rhythm-tap",
          estimatedDurationMinutes: 4,
          rationale: "new area for variety",
          completedToday: false,
        }],
        completion: {
          completedCount: 0,
          totalCount: 1,
          allComplete: false,
          completedActivityTypes: [],
        },
      },
    });

    expect(context.planId).toBe("00000000-0000-4000-8000-000000000001");
    expect(context.firstRecommendedPlanItemId).toBe("00000000-0000-4000-8000-000000000010");
    expect(context.recommendedActivityPrompt).toContain("plan_id=00000000-0000-4000-8000-000000000001");
    expect(context.recommendedActivityPrompt).toContain("plan_item_id=00000000-0000-4000-8000-000000000010");
  });

  it("does not recommend another activity after today's persisted plan is complete", () => {
    const context = buildBrainCoachVoiceContext({
      sessions: [session({ activityType: "sequence_memory", domain: "attention", playedAt: "2026-05-31T09:00:00.000Z" })],
      now: NOW,
      plan: {
        planId: "00000000-0000-4000-8000-000000000001",
        status: "completed",
        planDate: "2026-05-31",
        generatedAt: NOW.toISOString(),
        estimatedDurationMinutes: 4,
        recommendedDomains: ["attention"],
        rationale: ["Starts with a short plan."],
        activities: [{
          planItemId: "00000000-0000-4000-8000-000000000010",
          activityType: "sequence_memory",
          title: "Rhythm Tap",
          domain: "attention",
          route: "/attention-boosters/rhythm-tap",
          estimatedDurationMinutes: 4,
          rationale: "new area for variety",
          completedToday: true,
        }],
        completion: {
          completedCount: 1,
          totalCount: 1,
          allComplete: true,
          completedActivityTypes: ["sequence_memory"],
        },
      },
    });

    expect(context.planComplete).toBe(true);
    expect(context.missedSessionAwareness).toContain("plan is complete today");
    expect(context.recommendedActivityPrompt).toContain("do not recommend another Brain Coach activity");
  });
});
