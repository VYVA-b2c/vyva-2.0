import { describe, expect, it } from "vitest";
import {
  BRAIN_COACH_MAX_LEVEL,
  clampBrainCoachLevel,
  getBrainCoachLevelBand,
  getBrainCoachLevelBandProgress,
  getBrainCoachMilestoneLabel,
  getBrainCoachProgressLabel,
  getBrainCoachSupportiveProgressCopy,
} from "./brainCoachProgression";

describe("Brain Coach progression", () => {
  it("uses a 20-level cap", () => {
    expect(BRAIN_COACH_MAX_LEVEL).toBe(20);
    expect(clampBrainCoachLevel(21)).toBe(20);
  });

  it("clamps low, high, and invalid levels", () => {
    expect(clampBrainCoachLevel(-4)).toBe(1);
    expect(clampBrainCoachLevel(12.6)).toBe(13);
    expect(clampBrainCoachLevel(Number.NaN, 7)).toBe(7);
  });

  it.each([
    [1, "Foundation"],
    [5, "Foundation"],
    [6, "Build"],
    [10, "Build"],
    [11, "Challenge"],
    [15, "Challenge"],
    [16, "Mastery"],
    [20, "Mastery"],
  ])("labels level %s as %s", (level, label) => {
    expect(getBrainCoachLevelBand(level).label).toBe(label);
    expect(getBrainCoachProgressLabel(level)).toBe(`Level ${level} - ${label}`);
  });

  it("reports progress inside the active five-level band", () => {
    expect(getBrainCoachLevelBandProgress(1)).toEqual({ current: 1, total: 5, percent: 20 });
    expect(getBrainCoachLevelBandProgress(12)).toEqual({ current: 2, total: 5, percent: 40 });
    expect(getBrainCoachLevelBandProgress(20)).toEqual({ current: 5, total: 5, percent: 100 });
  });

  it("returns milestone labels only for milestone levels", () => {
    expect(getBrainCoachMilestoneLabel(5)).toBe("Foundation complete");
    expect(getBrainCoachMilestoneLabel(10)).toBe("Building confidence");
    expect(getBrainCoachMilestoneLabel(15)).toBe("Challenge ready");
    expect(getBrainCoachMilestoneLabel(20)).toBe("Mastery round");
    expect(getBrainCoachMilestoneLabel(14)).toBeNull();
  });

  it("uses supportive copy when the player stays on the same level", () => {
    expect(getBrainCoachSupportiveProgressCopy({ advanced: false, level: 9 })).toContain("Stay here");
    expect(getBrainCoachSupportiveProgressCopy({ advanced: true, level: 10 })).toContain("Building confidence");
  });
});
