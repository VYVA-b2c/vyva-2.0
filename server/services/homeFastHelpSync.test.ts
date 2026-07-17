import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../db.js", () => ({
  pool: { query: mocks.query },
}));

import { homeFastHelpOutcomeAggregate } from "./homeFastHelpSync";

describe("homeFastHelpOutcomeAggregate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts completed journeys that resumed from a recovery nudge", async () => {
    mocks.query.mockResolvedValue({
      rows: [{
        action_id: "book-ride",
        opened: 3,
        completed: 2,
        dismissed: 0,
        abandoned: 1,
        blocked: 0,
        resumed: 2,
        recovered: 1,
      }],
    });

    const result = await homeFastHelpOutcomeAggregate(30);

    expect(String(mocks.query.mock.calls[0]?.[0])).toContain("reference_id = 'recovery_nudge'");
    expect(result.totals.recovered).toBe(1);
    expect(result.actions.find((row) => row.actionId === "book-ride")).toMatchObject({
      resumed: 2,
      recovered: 1,
    });
  });
});
