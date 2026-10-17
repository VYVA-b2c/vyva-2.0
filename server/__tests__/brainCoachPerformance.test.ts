import { describe, expect, it } from "vitest";
import { DOMAIN_TO_AREA, areaForDomain } from "../../shared/brainCoachAreas.js";
import { getBrainCoachActivityCatalog } from "../lib/brainCoachPlan.js";
import { buildBrainCoachPerformance, type BrainCoachPerformanceRow } from "../lib/brainCoachPerformance.js";

const NOW = new Date("2026-06-30T12:00:00.000Z");

function row(overrides: Partial<BrainCoachPerformanceRow> = {}): BrainCoachPerformanceRow {
  return {
    activityType: "memory_match",
    domain: "visual_memory",
    difficulty: 1,
    difficultyScale: "level",
    completed: true,
    accuracyPct: 80,
    durationSeconds: 120,
    playedAt: "2026-06-29T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildBrainCoachPerformance", () => {
  it("compares performance only with the same activity and difficulty band", () => {
    const sessions = [
      row({ difficulty: 1, accuracyPct: 90, playedAt: "2026-06-10T12:00:00.000Z" }),
      row({ difficulty: 2, accuracyPct: 90, playedAt: "2026-06-11T12:00:00.000Z" }),
      row({ difficulty: 4, accuracyPct: 90, playedAt: "2026-06-12T12:00:00.000Z" }),
      row({ difficulty: 6, accuracyPct: 65, playedAt: "2026-06-13T12:00:00.000Z" }),
      row({ difficulty: 7, accuracyPct: 65, playedAt: "2026-06-14T12:00:00.000Z" }),
      row({ difficulty: 9, accuracyPct: 65, playedAt: "2026-06-15T12:00:00.000Z" }),
      row({ difficulty: 6, accuracyPct: 65, playedAt: "2026-06-25T12:00:00.000Z" }),
      row({ difficulty: 8, accuracyPct: 65, playedAt: "2026-06-27T12:00:00.000Z" }),
      row({ difficulty: 10, accuracyPct: 65, playedAt: "2026-06-29T12:00:00.000Z" }),
    ];

    expect(buildBrainCoachPerformance(sessions, NOW).areas[0]).toMatchObject({
      area: "memory",
      status: "usual",
      sessionsInWindow: 3,
    });
  });

  it("stays in building state until three comparable recent sessions exist", () => {
    const sessions = [
      row({ playedAt: "2026-06-10T12:00:00.000Z" }),
      row({ playedAt: "2026-06-11T12:00:00.000Z" }),
      row({ playedAt: "2026-06-12T12:00:00.000Z" }),
      row({ playedAt: "2026-06-29T12:00:00.000Z" }),
    ];
    expect(buildBrainCoachPerformance(sessions, NOW).areas[0]).toMatchObject({ status: "building", sessionsInWindow: 1 });
  });

  it("excludes participation-only accuracy and reports breathing separately", () => {
    const result = buildBrainCoachPerformance([
      row({ activityType: "scent_memory", domain: "episodic_memory", accuracyPct: 100 }),
      row({ activityType: "curious_minds", domain: "divergent_thinking", accuracyPct: 100 }),
      row({ activityType: "breath_garden", domain: "arousal_regulation", accuracyPct: 100, durationSeconds: 150 }),
      row({ activityType: "unknown", domain: "unknown_domain", accuracyPct: 100 }),
    ], NOW);

    expect(result.areas).toEqual([]);
    expect(result.relaxationMinutes).toBe(3);
  });
});

describe("brain coach area taxonomy", () => {
  it("has an explicit mapping decision for every activity catalogue domain", () => {
    const domains = getBrainCoachActivityCatalog().flatMap((activity) => [activity.domain, activity.secondaryDomain]).filter(Boolean) as string[];
    expect([...new Set(domains)].filter((domain) => !(domain in DOMAIN_TO_AREA))).toEqual([]);
    expect(areaForDomain("arousal_regulation")).toBeNull();
    expect(areaForDomain("not_in_catalogue")).toBeNull();
  });
});
