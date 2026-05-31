import { describe, expect, it } from "vitest";
import { buildBrainCoachRetentionNudges } from "./brainCoachRetentionNudges";

const NOW = new Date("2026-06-01T12:00:00.000Z");

describe("Brain Coach retention nudges", () => {
  it("encourages a new user to start with one short activity", () => {
    const nudges = buildBrainCoachRetentionNudges({ now: NOW });

    expect(nudges[0]).toMatchObject({
      id: "new_user",
      tone: "gentle",
    });
  });

  it("recognizes when yesterday was missed", () => {
    const nudges = buildBrainCoachRetentionNudges({
      now: NOW,
      lastPlayedAt: "2026-05-30T09:00:00.000Z",
    });

    expect(nudges[0]).toMatchObject({
      id: "missed_yesterday",
      tone: "restart",
    });
  });

  it("uses a lapsed restart message after seven or more days", () => {
    const nudges = buildBrainCoachRetentionNudges({
      now: NOW,
      lastPlayedAt: "2026-05-24T09:00:00.000Z",
    });

    expect(nudges[0]).toMatchObject({
      id: "lapsed",
      tone: "restart",
    });
  });

  it("celebrates completed-today state without pushing another plan", () => {
    const nudges = buildBrainCoachRetentionNudges({
      now: NOW,
      completedTodayCount: 1,
      planCompletedCount: 2,
      planTotalCount: 2,
    });

    expect(nudges).toHaveLength(1);
    expect(nudges[0]).toMatchObject({
      id: "completed_today",
      tone: "success",
    });
  });

  it("adds preferred training time when a plan remains available", () => {
    const nudges = buildBrainCoachRetentionNudges({
      now: NOW,
      lastPlayedAt: "2026-05-31T09:00:00.000Z",
      preferredTrainingTime: "after breakfast",
    });

    expect(nudges.map((nudge) => nudge.id)).toEqual(["preferred_time"]);
    expect(nudges[0].title).toContain("after breakfast");
  });
});
