import { describe, expect, it } from "vitest";
import {
  buildBrainCoachCaregiverSummary,
  type BrainCoachCaregiverPlan,
  type BrainCoachCaregiverPlanEvent,
  type BrainCoachCaregiverPlanItem,
  type BrainCoachCaregiverSession,
} from "../lib/brainCoachCaregiverSummary.js";

const NOW = new Date("2026-06-01T12:00:00.000Z");

function plan(overrides: Partial<BrainCoachCaregiverPlan> = {}) {
  return {
    id: "plan-1",
    planDate: "2026-06-01",
    status: "active",
    estimatedDurationMinutes: 8,
    completedAt: null,
    ...overrides,
  };
}

function item(overrides: Partial<BrainCoachCaregiverPlanItem> = {}) {
  return {
    id: "item-1",
    planId: "plan-1",
    activityType: "memory_match",
    title: "Memory Match",
    domain: "visual_memory",
    status: "recommended",
    completedAt: null,
    planDate: "2026-06-01",
    ...overrides,
  };
}

function session(overrides: Partial<BrainCoachCaregiverSession> = {}) {
  return {
    id: "session-1",
    activityType: "memory_match",
    domain: "visual_memory",
    completed: true,
    score: 820,
    durationSeconds: 120,
    playedAt: "2026-06-01T09:00:00.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<BrainCoachCaregiverPlanEvent> = {}) {
  return {
    id: "event-1",
    planId: "plan-1",
    eventType: "caregiver_nudge",
    metadata: {
      message_type: "today_plan",
      title: "Your Brain Coach plan is ready",
      body: "Your caregiver suggested starting with one short recommended activity.",
      sent_by: "caregiver-1",
    },
    createdAt: "2026-06-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("Brain Coach caregiver summary", () => {
  it("returns an empty read-only summary when no Brain Coach history exists", () => {
    const summary = buildBrainCoachCaregiverSummary({ now: NOW });

    expect(summary.status).toBe("no_history");
    expect(summary.currentStreakDays).toBe(0);
    expect(summary.todayPlan).toMatchObject({
      status: "not_planned",
      completedItems: 0,
      totalItems: 0,
      completionPct: 0,
    });
    expect(summary.latestNudge).toBeNull();
    expect(summary.recentActivities).toEqual([]);
  });

  it("summarizes partial plan completion", () => {
    const summary = buildBrainCoachCaregiverSummary({
      now: NOW,
      plans: [plan()],
      planItems: [
        item({ id: "item-1", status: "completed", completedAt: "2026-06-01T09:03:00.000Z" }),
        item({ id: "item-2", activityType: "number_trails", domain: "processing_speed" }),
      ],
      sessions: [session()],
    });

    expect(summary.todayPlan).toMatchObject({
      completedItems: 1,
      totalItems: 2,
      completionPct: 50,
    });
    expect(summary.adherence7d.completedPlanDays).toBe(0);
  });

  it("marks full plan completion in the seven-day adherence model", () => {
    const summary = buildBrainCoachCaregiverSummary({
      now: NOW,
      plans: [plan({ status: "completed", completedAt: "2026-06-01T09:10:00.000Z" })],
      planItems: [
        item({ id: "item-1", status: "completed", completedAt: "2026-06-01T09:03:00.000Z" }),
        item({
          id: "item-2",
          activityType: "number_trails",
          domain: "processing_speed",
          status: "completed",
          completedAt: "2026-06-01T09:09:00.000Z",
        }),
      ],
      sessions: [
        session(),
        session({
          id: "session-2",
          activityType: "number_trails",
          domain: "processing_speed",
          playedAt: "2026-06-01T09:07:00.000Z",
        }),
      ],
    });

    expect(summary.todayPlan.completionPct).toBe(100);
    expect(summary.adherence7d).toMatchObject({
      plannedDays: 1,
      completedPlanDays: 1,
      completionPct: 100,
    });
  });

  it("labels users as lapsed after seven or more days without completed Brain Coach activity", () => {
    const summary = buildBrainCoachCaregiverSummary({
      now: NOW,
      sessions: [session({ playedAt: "2026-05-24T09:00:00.000Z" })],
    });

    expect(summary.status).toBe("lapsed");
    expect(summary.currentStreakDays).toBe(0);
    expect(summary.lapsedDays).toBe(8);
  });

  it("orders mixed recent domains by completed sessions", () => {
    const summary = buildBrainCoachCaregiverSummary({
      now: NOW,
      sessions: [
        session({ id: "memory-1", domain: "visual_memory", playedAt: "2026-06-01T09:00:00.000Z" }),
        session({ id: "memory-2", domain: "visual_memory", playedAt: "2026-05-31T09:00:00.000Z" }),
        session({ id: "attention-1", activityType: "rhythm_tap", domain: "attention", playedAt: "2026-05-30T09:00:00.000Z" }),
      ],
    });

    expect(summary.recentDomains.map((domain) => domain.domain)).toEqual(["visual_memory", "attention"]);
    expect(summary.recentDomains[0].completedSessions).toBe(2);
  });

  it("shows sent caregiver nudge outcome when the latest nudge has not been seen", () => {
    const summary = buildBrainCoachCaregiverSummary({
      now: NOW,
      plans: [plan()],
      planItems: [item()],
      planEvents: [event()],
    });

    expect(summary.latestNudge).toMatchObject({
      id: "event-1",
      planId: "plan-1",
      title: "Your Brain Coach plan is ready",
      status: "sent",
      sentAt: "2026-06-01T08:00:00.000Z",
      seenAt: null,
      dismissedAt: null,
      planCompletedAfterNudge: false,
    });
  });

  it("shows seen caregiver nudge outcome when the senior app records a read event", () => {
    const summary = buildBrainCoachCaregiverSummary({
      now: NOW,
      plans: [plan()],
      planItems: [item()],
      planEvents: [
        event(),
        event({
          id: "event-read",
          eventType: "caregiver_nudge_read",
          metadata: { nudge_event_id: "event-1" },
          createdAt: "2026-06-01T08:05:00.000Z",
        }),
      ],
    });

    expect(summary.latestNudge).toMatchObject({
      status: "seen",
      seenAt: "2026-06-01T08:05:00.000Z",
      dismissedAt: null,
    });
  });

  it("shows dismissed caregiver nudge outcome when the senior dismisses the nudge", () => {
    const summary = buildBrainCoachCaregiverSummary({
      now: NOW,
      plans: [plan()],
      planItems: [item()],
      planEvents: [
        event(),
        event({
          id: "event-dismissed",
          eventType: "caregiver_nudge_dismissed",
          metadata: { nudge_event_id: "event-1" },
          createdAt: "2026-06-01T08:06:00.000Z",
        }),
      ],
    });

    expect(summary.latestNudge).toMatchObject({
      status: "dismissed",
      seenAt: null,
      dismissedAt: "2026-06-01T08:06:00.000Z",
    });
  });

  it("marks plan completion after the latest caregiver nudge", () => {
    const summary = buildBrainCoachCaregiverSummary({
      now: NOW,
      plans: [plan({ status: "completed", completedAt: "2026-06-01T08:20:00.000Z" })],
      planItems: [item({ status: "completed", completedAt: "2026-06-01T08:19:00.000Z" })],
      planEvents: [event({ createdAt: "2026-06-01T08:00:00.000Z" })],
    });

    expect(summary.latestNudge).toMatchObject({
      status: "sent",
      planCompletedAfterNudge: true,
      planCompletedAt: "2026-06-01T08:20:00.000Z",
    });
  });
});
