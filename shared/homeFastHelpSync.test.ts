import { describe, expect, it } from "vitest";
import {
  homeFastHelpEventWinner,
  homeFastHelpSyncRequestSchema,
  mergeHomeFastHelpSyncedJourneys,
  type HomeFastHelpSyncedJourney,
} from "./homeFastHelpSync";

const baseJourney: HomeFastHelpSyncedJourney = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  actionId: "book-ride",
  impressionId: "99999999-9999-4999-8999-999999999999",
  status: "opened",
  startedAt: "2026-07-17T10:00:00.000Z",
  updatedAt: "2026-07-17T10:00:00.000Z",
  referenceId: null,
  events: [{
    id: "11111111-1111-4111-8111-111111111111",
    status: "opened",
    occurredAt: "2026-07-17T10:00:00.000Z",
    referenceId: null,
  }],
};

describe("Home Fast Help sync contract", () => {
  it("deduplicates events and keeps a completed journey terminal", () => {
    const completed: HomeFastHelpSyncedJourney = {
      ...baseJourney,
      status: "completed",
      updatedAt: "2026-07-17T10:05:00.000Z",
      referenceId: "ride-42",
      events: [
        ...baseJourney.events,
        {
          id: "22222222-2222-4222-8222-222222222222",
          status: "completed",
          occurredAt: "2026-07-17T10:05:00.000Z",
          referenceId: "ride-42",
        },
      ],
    };
    const staleReopen: HomeFastHelpSyncedJourney = {
      ...baseJourney,
      updatedAt: "2026-07-17T10:01:00.000Z",
      events: [...baseJourney.events, baseJourney.events[0]],
    };

    const merged = mergeHomeFastHelpSyncedJourneys(staleReopen, completed);

    expect(merged.status).toBe("completed");
    expect(merged.impressionId).toBe(baseJourney.impressionId);
    expect(merged.referenceId).toBe("ride-42");
    expect(merged.events).toHaveLength(2);
  });

  it("uses the newest non-terminal event while making dismissal terminal", () => {
    const events = [
      baseJourney.events[0],
      {
        id: "33333333-3333-4333-8333-333333333333",
        status: "abandoned" as const,
        occurredAt: "2026-07-17T10:02:00.000Z",
        referenceId: null,
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        status: "opened" as const,
        occurredAt: "2026-07-17T10:03:00.000Z",
        referenceId: null,
      },
    ];
    expect(homeFastHelpEventWinner(events)?.status).toBe("opened");
    expect(homeFastHelpEventWinner([
      ...events,
      {
        id: "55555555-5555-4555-8555-555555555555",
        status: "dismissed",
        occurredAt: "2026-07-17T10:01:00.000Z",
        referenceId: null,
      },
    ])?.status).toBe("dismissed");
  });

  it("rejects destination state, free text, and unsafe reference values", () => {
    expect(homeFastHelpSyncRequestSchema.safeParse({
      journeys: [{ ...baseJourney, destinationState: { symptom: "private" } }],
    }).success).toBe(false);
    expect(homeFastHelpSyncRequestSchema.safeParse({
      journeys: [{ ...baseJourney, referenceId: "free text is not allowed" }],
    }).success).toBe(false);
  });

  it("accepts only three unique ranked actions and rejects sensitive impression fields", () => {
    const impression = {
      id: baseJourney.impressionId,
      actionIds: ["safe-home", "book-ride", "stay-well"],
      rankingVersion: "personalized-v1",
      shownAt: "2026-07-17T09:59:00.000Z",
    };
    expect(homeFastHelpSyncRequestSchema.safeParse({
      journeys: [baseJourney],
      impressions: [impression],
    }).success).toBe(true);
    expect(homeFastHelpSyncRequestSchema.safeParse({
      journeys: [baseJourney],
      impressions: [{ ...impression, actionIds: ["safe-home", "safe-home", "stay-well"] }],
    }).success).toBe(false);
    expect(homeFastHelpSyncRequestSchema.safeParse({
      journeys: [baseJourney],
      impressions: [{ ...impression, diagnosis: "private" }],
    }).success).toBe(false);
  });
});
