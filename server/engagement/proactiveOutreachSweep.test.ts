import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  detectWellnessSilenceCandidates: vi.fn(),
  detectScamSignalCandidates: vi.fn(),
  buildProactiveOutreachRuntimeInput: vi.fn(),
  runPreventiveOutboundCallEntry: vi.fn(),
}));

vi.mock("./proactiveOutreachDetectors.js", () => ({
  detectWellnessSilenceCandidates: mocks.detectWellnessSilenceCandidates,
  detectScamSignalCandidates: mocks.detectScamSignalCandidates,
}));

vi.mock("./proactiveOutreachContext.js", () => ({
  buildProactiveOutreachRuntimeInput: mocks.buildProactiveOutreachRuntimeInput,
}));

vi.mock("./preventiveOutboundCallRuntime.js", () => ({
  runPreventiveOutboundCallEntry: mocks.runPreventiveOutboundCallEntry,
}));

import { runProactiveOutreachSweep } from "./proactiveOutreachSweep.js";

const now = new Date("2026-09-18T12:00:00.000Z");

function candidate(userId: string) {
  return {
    userId,
    profileId: userId,
    reasonSummary: `reason for ${userId}`,
    scheduleOccurrenceId: `occurrence.${userId}`,
    scheduleId: "schedule.test",
    source: "scheduled_interaction" as const,
  };
}

describe("runProactiveOutreachSweep", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.buildProactiveOutreachRuntimeInput.mockImplementation(async (c: ReturnType<typeof candidate>) => ({
      userId: c.userId,
      profileId: c.profileId,
      evaluationInput: { fake: true },
      reasonSummary: c.reasonSummary,
    }));
  });

  it("evaluates every candidate from both detectors through the unchanged runtime and tallies outcomes", async () => {
    mocks.detectWellnessSilenceCandidates.mockResolvedValue([candidate("user.silent")]);
    mocks.detectScamSignalCandidates.mockResolvedValue([candidate("user.scam")]);
    mocks.runPreventiveOutboundCallEntry
      .mockResolvedValueOnce({ outcome: "provider_started" })
      .mockResolvedValueOnce({ outcome: "policy_blocked" });

    const result = await runProactiveOutreachSweep(now);

    expect(result.candidatesConsidered).toBe(2);
    expect(result.outcomes).toEqual({ provider_started: 1, policy_blocked: 1 });
    expect(mocks.runPreventiveOutboundCallEntry).toHaveBeenCalledTimes(2);
  });

  it("keeps going when one detector throws, and still evaluates the other's candidates", async () => {
    mocks.detectWellnessSilenceCandidates.mockRejectedValue(new Error("db down"));
    mocks.detectScamSignalCandidates.mockResolvedValue([candidate("user.scam")]);
    mocks.runPreventiveOutboundCallEntry.mockResolvedValueOnce({ outcome: "provider_started" });

    const result = await runProactiveOutreachSweep(now);

    expect(result.candidatesConsidered).toBe(1);
    expect(result.outcomes).toEqual({ provider_started: 1 });
  });

  it("counts a failure evaluating one candidate without losing the others", async () => {
    mocks.detectWellnessSilenceCandidates.mockResolvedValue([candidate("user.a"), candidate("user.b")]);
    mocks.detectScamSignalCandidates.mockResolvedValue([]);
    mocks.runPreventiveOutboundCallEntry
      .mockRejectedValueOnce(new Error("provider exploded"))
      .mockResolvedValueOnce({ outcome: "provider_started" });

    const result = await runProactiveOutreachSweep(now);

    expect(result.candidatesConsidered).toBe(2);
    expect(result.outcomes).toEqual({ invalid_input: 1, provider_started: 1 });
  });
});
