import { describe, expect, it } from "vitest";
import {
  buildMotivationMilestoneCandidates,
  parseMotivationMilestoneId,
  prioritizeMotivationMilestones,
} from "./motivationMilestones.js";

describe("motivation milestones", () => {
  it("returns supported thresholds once the achieved value reaches them", () => {
    const candidates = buildMotivationMilestoneCandidates({
      domain: "brain_coach",
      achievedValue: 8,
    });

    expect(candidates.map((candidate) => candidate.threshold)).toEqual([3, 5, 7, 8]);
    expect(candidates[0]).toMatchObject({
      id: "brain_coach:streak_days:3",
      metric: "streak_days",
      achieved_value: 8,
    });
  });

  it("does not return future thresholds", () => {
    expect(buildMotivationMilestoneCandidates({
      domain: "daily_checkin",
      achievedValue: 2,
    })).toEqual([]);
  });

  it("prioritizes daily check-ins before Brain Coach, then higher thresholds", () => {
    const candidates = [
      ...buildMotivationMilestoneCandidates({ domain: "brain_coach", achievedValue: 14 }),
      ...buildMotivationMilestoneCandidates({ domain: "daily_checkin", achievedValue: 7 }),
    ];

    const sorted = prioritizeMotivationMilestones(candidates);

    expect(sorted.slice(0, 2).map((candidate) => candidate.id)).toEqual([
      "daily_checkin:streak_days:7",
      "daily_checkin:streak_days:5",
    ]);
    expect(sorted[sorted.length - 1].id).toBe("brain_coach:streak_days:3");
  });

  it("parses only known milestone ids", () => {
    expect(parseMotivationMilestoneId("daily_checkin:streak_days:5")).toEqual({
      domain: "daily_checkin",
      metric: "streak_days",
      threshold: 5,
    });
    expect(parseMotivationMilestoneId("daily_checkin:streak_days:4")).toBeNull();
    expect(parseMotivationMilestoneId("unknown:streak_days:5")).toBeNull();
  });
});
