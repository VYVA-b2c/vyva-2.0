import { describe, expect, it } from "vitest";
import type { BrainCoachProgress } from "@/lib/brainCoachReport";
import { brainCoachSessionBadge, latestCompletedSessionForModule } from "./brainCoachModuleProgress";

const progress: BrainCoachProgress = {
  history: [
    { activityType: "memory_match", domain: "memory", completed: true, score: 720, difficulty: 4, playedAt: "2026-09-23T10:00:00.000Z" },
    { activityType: "word_recall", domain: "memory", completed: true, score: 840, difficulty: 6, playedAt: "2026-09-24T10:00:00.000Z" },
    { activityType: "sequence_memory", domain: "attention", completed: true, score: 610, difficulty: 3, playedAt: "2026-09-24T09:00:00.000Z" },
    { activityType: "number_trails", domain: "executive_function", completed: false, score: 900, difficulty: 8, playedAt: "2026-09-24T11:00:00.000Z" },
    { activityType: "breath_garden", domain: "sensory", completed: true, score: 300, difficulty: 2, playedAt: "2026-09-22T10:00:00.000Z" },
  ],
};

describe("Brain Coach module progress", () => {
  it("uses the latest completed game within each module", () => {
    expect(latestCompletedSessionForModule(progress, "memory")?.activityType).toBe("word_recall");
    expect(latestCompletedSessionForModule(progress, "reflexes")?.activityType).toBe("sequence_memory");
    expect(latestCompletedSessionForModule(progress, "thinking")).toBeNull();
    expect(latestCompletedSessionForModule(progress, "senses")?.activityType).toBe("breath_garden");
  });

  it("formats the latest score and achieved level for a compact card badge", () => {
    expect(brainCoachSessionBadge(progress.history![1])).toEqual({
      compact: "Score 840 · L6",
      accessible: "Last score 840. Level 6 achieved.",
    });
  });
});
