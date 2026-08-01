import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));

vi.mock("../db.js", () => ({
  pool: {
    query: mocks.query,
    connect: vi.fn().mockResolvedValue({ query: mocks.clientQuery, release: mocks.release }),
  },
}));

import { homeFastHelpOutcomeAggregate, syncHomeFastHelpJourneys } from "./homeFastHelpSync";

describe("homeFastHelpOutcomeAggregate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts attributed funnels and completed journeys resumed from a recovery nudge", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        action_id: "book-ride",
        shown: 12,
        attributed_opened: 3,
        attributed_completed: 2,
        attributed_blocked: 1,
        opened: 3,
        completed: 2,
        dismissed: 0,
        abandoned: 1,
        blocked: 0,
        resumed: 2,
        recovered: 1,
      }],
    }).mockResolvedValueOnce({
      rows: [{
        ranking_version: "personalized-v1",
        impressions: 4,
        version_shown: 12,
        action_id: "book-ride",
        action_shown: 4,
        opened: 3,
        completed: 2,
        blocked: 1,
      }],
    });

    const result = await homeFastHelpOutcomeAggregate(30);

    expect(String(mocks.query.mock.calls[0]?.[0])).toContain("reference_id = 'recovery_nudge'");
    expect(String(mocks.query.mock.calls[0]?.[0])).toContain("home_fast_help_impressions");
    expect(result.totals.recovered).toBe(1);
    expect(result.actions.find((row) => row.actionId === "book-ride")).toMatchObject({
      shown: 12,
      attributedOpened: 3,
      attributedCompleted: 2,
      attributedBlocked: 1,
      resumed: 2,
      recovered: 1,
    });
    expect(result.rankingVersions).toEqual([{
      rankingVersion: "personalized-v1",
      impressions: 4,
      shown: 12,
      opened: 3,
      completed: 2,
      blocked: 1,
      actions: [{
        actionId: "book-ride",
        shown: 4,
        opened: 3,
        completed: 2,
        blocked: 1,
      }],
    }]);
  });

  it("stores impressions before journeys and links only the authenticated user's impression", async () => {
    const event = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "opened" as const,
      occurredAt: "2026-07-17T10:00:00.000Z",
      referenceId: null,
    };
    const journey = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actionId: "book-ride" as const,
      impressionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      status: "opened" as const,
      startedAt: event.occurredAt,
      updatedAt: event.occurredAt,
      referenceId: null,
      events: [event],
    };
    const impression = {
      id: journey.impressionId,
      actionIds: ["book-ride", "safe-home", "stay-well"] as const,
      rankingVersion: "personalized-v1",
      shownAt: "2026-07-17T09:59:00.000Z",
    };

    mocks.clientQuery.mockImplementation(async (query: string) => {
      if (query.includes("select id\n        from public.home_fast_help_journeys")) return { rows: [{ id: journey.id }] };
      if (query.includes("select id, journey_id, status")) return {
        rows: [{
          id: event.id,
          journey_id: journey.id,
          status: event.status,
          occurred_at: event.occurredAt,
          reference_id: null,
        }],
      };
      if (query.includes("select id, action_id, impression_id")) return {
        rows: [{
          id: journey.id,
          action_id: journey.actionId,
          impression_id: journey.impressionId,
          status: journey.status,
          started_at: journey.startedAt,
          updated_at: journey.updatedAt,
          reference_id: null,
        }],
      };
      return { rows: [] };
    });

    await syncHomeFastHelpJourneys(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      [journey],
      [impression],
    );

    const sqlCalls = mocks.clientQuery.mock.calls.map(([query]) => String(query));
    const impressionInsert = sqlCalls.findIndex((query) => query.includes("insert into public.home_fast_help_impressions"));
    const journeyInsert = sqlCalls.findIndex((query) => query.includes("insert into public.home_fast_help_journeys"));
    expect(impressionInsert).toBeGreaterThanOrEqual(0);
    expect(journeyInsert).toBeGreaterThan(impressionInsert);
    expect(sqlCalls[journeyInsert]).toContain("user_id = $2::uuid");
    expect(mocks.clientQuery.mock.calls[journeyInsert]?.[1]).toContain(journey.impressionId);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
