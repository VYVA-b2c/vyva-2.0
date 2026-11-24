import { describe, expect, it } from "vitest";
import { getHealthInsightsCronActions } from "./healthInsightsCronSchedule.js";

describe("getHealthInsightsCronActions", () => {
  it("runs weekly and monthly jobs at the first Monday 03:00 in Madrid during winter", () => {
    expect(getHealthInsightsCronActions(new Date("2026-01-05T02:00:00Z"))).toEqual(["weekly", "monthly"]);
  });

  it("preserves 03:00 Madrid when daylight saving time is active", () => {
    expect(getHealthInsightsCronActions(new Date("2026-07-06T01:00:00Z"))).toEqual(["weekly", "monthly"]);
  });

  it("runs only the weekly job on later Mondays", () => {
    expect(getHealthInsightsCronActions(new Date("2026-01-12T02:00:00Z"))).toEqual(["weekly"]);
  });

  it("runs the outcome follow-up at 04:00 Madrid in winter and summer", () => {
    expect(getHealthInsightsCronActions(new Date("2026-01-06T03:00:00Z"))).toEqual(["outcomes"]);
    expect(getHealthInsightsCronActions(new Date("2026-07-07T02:00:00Z"))).toEqual(["outcomes"]);
  });

  it("does nothing outside the scheduled local hours", () => {
    expect(getHealthInsightsCronActions(new Date("2026-01-06T04:00:00Z"))).toEqual([]);
  });
});
