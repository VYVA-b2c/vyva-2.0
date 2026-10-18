import { describe, expect, it } from "vitest";
import { memberOutcomeAdjustment, outcomeIsDue, providerOutcomeAnswerSchema } from "./providerOutcomes.js";

const hour = 60 * 60 * 1000;
const contactedAt = new Date("2026-10-01T10:00:00Z");

describe("job outcome check-in", () => {
  it("asks two days after contact, or the day after a booked visit, and stops after a month", () => {
    const base = contactedAt.getTime();
    expect(outcomeIsDue({ status: "contacted", contactedAt }, base + 47 * hour)).toBe(false);
    expect(outcomeIsDue({ status: "contacted", contactedAt }, base + 48 * hour)).toBe(true);
    const visitAt = new Date(base + 5 * 24 * hour);
    expect(outcomeIsDue({ status: "booked", contactedAt, visitAt }, base + 48 * hour)).toBe(false);
    expect(outcomeIsDue({ status: "booked", contactedAt, visitAt }, visitAt.getTime() + 24 * hour)).toBe(true);
    expect(outcomeIsDue({ status: "contacted", contactedAt }, base + 48 * hour + 30 * 24 * hour)).toBe(false);
    expect(outcomeIsDue({ status: "options_ready", contactedAt }, base + 72 * hour)).toBe(false);
  });

  it("accepts complete answers or an explicit skip only", () => {
    expect(providerOutcomeAnswerSchema.safeParse({ arrived: "yes", price: "as_quoted", wouldUseAgain: "yes" }).success).toBe(true);
    expect(providerOutcomeAnswerSchema.safeParse({ skipped: true }).success).toBe(true);
    expect(providerOutcomeAnswerSchema.safeParse({ arrived: "yes" }).success).toBe(false);
    expect(providerOutcomeAnswerSchema.safeParse({ skipped: true, arrived: "no" }).success).toBe(false);
    expect(providerOutcomeAnswerSchema.safeParse({ arrived: "maybe", price: "as_quoted", wouldUseAgain: "yes" }).success).toBe(false);
  });

  it("ignores a single member and weighs pooled experience", () => {
    expect(memberOutcomeAdjustment({ jobs: 1, noShows: 1, aboveQuote: 1, wouldUseAgain: 0, wouldNotUseAgain: 1 }).score).toBe(0);
    const good = memberOutcomeAdjustment({ jobs: 4, noShows: 0, aboveQuote: 0, wouldUseAgain: 4, wouldNotUseAgain: 0 });
    expect(good.score).toBe(20);
    expect(good.reasons).toEqual(["Other VYVA members would use this provider again"]);
    const bad = memberOutcomeAdjustment({ jobs: 2, noShows: 1, aboveQuote: 1, wouldUseAgain: 0, wouldNotUseAgain: 2 });
    expect(bad.score).toBeLessThan(-30);
    expect(bad.uncertainties).toEqual(["Other VYVA members report missed visits", "Other VYVA members report bills above the agreed price"]);
  });
});
