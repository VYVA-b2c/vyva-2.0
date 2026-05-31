import { describe, expect, it } from "vitest";
import { buildBrainCoachDailyPlan, type BrainCoachPlanSession } from "../lib/brainCoachPlan.js";
import {
  applyPlanItemEvent,
  buildBrainCoachPlanRows,
  buildPersistedBrainCoachPlan,
  completionSyncForPlan,
  type StoredBrainCoachPlan,
  type StoredBrainCoachPlanItem,
} from "../lib/brainCoachPlanLifecycle.js";

const NOW = new Date("2026-05-31T12:00:00.000Z");

function session(overrides: Partial<BrainCoachPlanSession>): BrainCoachPlanSession {
  return {
    activityType: "memory_match",
    domain: "visual_memory",
    completed: true,
    score: 700,
    accuracyPct: 75,
    durationSeconds: 180,
    playedAt: "2026-05-31T09:00:00.000Z",
    ...overrides,
  };
}

function storedPlan(overrides: Partial<StoredBrainCoachPlan> = {}): StoredBrainCoachPlan {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    userId: "user-1",
    planDate: "2026-05-31",
    status: "active",
    estimatedDurationMinutes: 8,
    recommendedDomains: ["attention", "visual_memory"],
    rationale: ["Starts with a short balanced plan because there is no Brain Coach history yet."],
    generationVersion: "brain_coach_plan_v1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function storedItem(overrides: Partial<StoredBrainCoachPlanItem>): StoredBrainCoachPlanItem {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    planId: "00000000-0000-4000-8000-000000000001",
    userId: "user-1",
    planDate: "2026-05-31",
    activityType: "sequence_memory",
    title: "Rhythm Tap",
    domain: "attention",
    route: "/attention-boosters/rhythm-tap",
    estimatedDurationMinutes: 4,
    rationale: "new area for variety",
    status: "recommended",
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Brain Coach plan lifecycle", () => {
  it("creates stable insert rows from a generated daily plan", () => {
    const generated = buildBrainCoachDailyPlan({
      sessions: [],
      preferences: { sessionLengthMins: 10, variety: "variety" },
      now: NOW,
    });
    const rows = buildBrainCoachPlanRows({ userId: "user-1", generatedPlan: generated });

    expect(rows.plan).toMatchObject({
      userId: "user-1",
      planDate: "2026-05-31",
      status: "active",
      generationVersion: "brain_coach_plan_v1",
    });
    expect(rows.items.map((item) => item.status)).toEqual(["recommended", "recommended"]);
    expect(rows.items.map((item) => item.activityType)).toEqual(["sequence_memory", "memory_match"]);
  });

  it("formats a persisted plan without recalculating activities", () => {
    const plan = buildPersistedBrainCoachPlan(storedPlan(), [
      storedItem({ activityType: "sequence_memory", title: "Rhythm Tap", sortOrder: 0 }),
      storedItem({ id: "00000000-0000-4000-8000-000000000011", activityType: "memory_match", title: "Memory Match", domain: "visual_memory", route: "/memory-games/memory_match", sortOrder: 1 }),
    ]);

    expect(plan.planId).toBe("00000000-0000-4000-8000-000000000001");
    expect(plan.activities.map((activity) => activity.title)).toEqual(["Rhythm Tap", "Memory Match"]);
    expect(plan.completion).toMatchObject({ completedCount: 0, totalCount: 2, allComplete: false });
  });

  it("syncs completion only for matching recommended activities on the plan date", () => {
    const sync = completionSyncForPlan({
      planDate: "2026-05-31",
      items: [
        storedItem({ activityType: "sequence_memory" }),
        storedItem({ id: "00000000-0000-4000-8000-000000000011", activityType: "memory_match", title: "Memory Match", domain: "visual_memory", route: "/memory-games/memory_match", sortOrder: 1 }),
      ],
      sessions: [
        session({ activityType: "sequence_memory", playedAt: "2026-05-31T09:00:00.000Z" }),
        session({ activityType: "story_recall", domain: "language", playedAt: "2026-05-31T10:00:00.000Z" }),
      ],
    });

    expect(sync.completedActivityTypes).toEqual(["sequence_memory"]);
    expect(sync.allComplete).toBe(false);
  });

  it("marks all complete when every persisted plan item has a matching completed session", () => {
    const sync = completionSyncForPlan({
      planDate: "2026-05-31",
      items: [
        storedItem({ activityType: "sequence_memory" }),
        storedItem({ id: "00000000-0000-4000-8000-000000000011", activityType: "memory_match", title: "Memory Match", domain: "visual_memory", route: "/memory-games/memory_match", sortOrder: 1 }),
      ],
      sessions: [
        session({ activityType: "sequence_memory", playedAt: "2026-05-31T09:00:00.000Z" }),
        session({ activityType: "memory_match", playedAt: "2026-05-31T10:00:00.000Z" }),
      ],
    });

    expect(sync.completedActivityTypes).toEqual(["sequence_memory", "memory_match"]);
    expect(sync.allComplete).toBe(true);
  });

  it("applies accepted, started, and skipped lifecycle events", () => {
    const at = new Date("2026-05-31T13:00:00.000Z");
    expect(applyPlanItemEvent(storedItem({}), "accepted", at)).toMatchObject({
      status: "accepted",
      acceptedAt: at,
    });
    expect(applyPlanItemEvent(storedItem({ status: "accepted", acceptedAt: at }), "started", at)).toMatchObject({
      status: "started",
      startedAt: at,
    });
    expect(applyPlanItemEvent(storedItem({ status: "started" }), "skipped", at)).toMatchObject({
      status: "skipped",
      skippedAt: at,
    });
  });
});
