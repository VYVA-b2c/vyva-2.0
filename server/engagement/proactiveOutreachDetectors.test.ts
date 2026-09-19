import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: { select: dbMocks.select },
}));

import {
  detectScamSignalCandidates,
  detectWellnessSilenceCandidates,
} from "./proactiveOutreachDetectors.js";

function queryResolving(rows: unknown[]) {
  return { from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(rows) })) };
}

const now = new Date("2026-09-18T12:00:00.000Z");

describe("detectWellnessSilenceCandidates", () => {
  beforeEach(() => dbMocks.select.mockReset());

  it("flags a user who previously talked to the Wellness Coach and has gone quiet", async () => {
    dbMocks.select.mockReturnValueOnce(queryResolving([
      { userId: "user.silent", lastMessageAt: new Date("2026-09-01T00:00:00.000Z") },
    ]));

    const candidates = await detectWellnessSilenceCandidates(now);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      userId: "user.silent",
      profileId: "user.silent",
      scheduleId: "proactive_outreach.wellness_silence",
      source: "scheduled_interaction",
    });
    expect(candidates[0]?.reasonSummary).toMatch(/Wellness Coach/);
    expect(candidates[0]?.scheduleOccurrenceId).toBe("proactive_outreach.wellness_silence.user.silent.2026-09-18");
  });

  it("never flags a user who has no prior message (never used it, not gone quiet)", async () => {
    dbMocks.select.mockReturnValueOnce(queryResolving([
      { userId: "user.new", lastMessageAt: null },
    ]));

    const candidates = await detectWellnessSilenceCandidates(now);
    expect(candidates).toHaveLength(0);
  });
});

describe("detectScamSignalCandidates", () => {
  beforeEach(() => dbMocks.select.mockReset());

  it("names the risk level honestly in the reason for a Scam result", async () => {
    dbMocks.select.mockReturnValueOnce(queryResolving([
      { id: "check-1", userId: "user.scammed", riskLevel: "Scam" },
    ]));

    const candidates = await detectScamSignalCandidates(now);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      userId: "user.scammed",
      profileId: "user.scammed",
      scheduleOccurrenceId: "proactive_outreach.scam_signal.check-1",
      scheduleId: "proactive_outreach.scam_signal",
      source: "communication_log",
    });
    expect(candidates[0]?.reasonSummary).toMatch(/likely scam/);
  });

  it("uses softer wording for a Suspicious result", async () => {
    dbMocks.select.mockReturnValueOnce(queryResolving([
      { id: "check-2", userId: "user.suspicious", riskLevel: "Suspicious" },
    ]));

    const candidates = await detectScamSignalCandidates(now);
    expect(candidates[0]?.reasonSummary).toMatch(/worth a second look/);
    expect(candidates[0]?.reasonSummary).not.toMatch(/likely scam/);
  });
});
