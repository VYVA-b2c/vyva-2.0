import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/queryClient", () => ({ apiFetch: mocks.apiFetch }));

import { recordHomeFastHelpImpression, homeFastHelpImpressionStorageKey } from "./homeFastHelpInsights";
import { homeFastHelpJourneyStorageKey, startHomeFastHelpJourney } from "./homeFastHelpOutcome";
import { syncHomeFastHelpOutcomes } from "./homeFastHelpSyncClient";

describe("Home Fast Help insights sync client", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("uploads the strict impression before linking it through the journey payload", async () => {
    const impression = recordHomeFastHelpImpression({
      actionIds: ["find-care", "safe-home", "stay-well"],
      rankingVersion: "personalized-v1",
      profileId: "profile-a",
      shownAtMs: Date.parse("2026-07-17T10:00:00.000Z"),
    });
    const started = startHomeFastHelpJourney({
      actionId: "find-care",
      destinationPath: "/concierge",
      profileId: "profile-a",
      impressionId: impression?.id,
      occurredAtMs: Date.parse("2026-07-17T10:01:00.000Z"),
    });
    mocks.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        syncAvailable: true,
        syncedAt: "2026-07-17T10:01:01.000Z",
        journeys: [{
          id: started.journey.id,
          actionId: started.journey.actionId,
          impressionId: impression?.id,
          status: "opened",
          startedAt: started.journey.startedAt,
          updatedAt: started.journey.updatedAt,
          referenceId: null,
          events: started.journey.events.map((event) => ({
            id: event.id,
            status: event.status,
            occurredAt: event.occurredAt,
            referenceId: null,
          })),
        }],
      }),
    });

    await syncHomeFastHelpOutcomes(
      homeFastHelpJourneyStorageKey("profile-a"),
      homeFastHelpImpressionStorageKey("profile-a"),
    );

    const request = mocks.apiFetch.mock.calls[0]?.[1] as { body: string };
    const payload = JSON.parse(request.body);
    expect(payload.impressions).toEqual([impression]);
    expect(payload.journeys[0]).toMatchObject({
      actionId: "find-care",
      impressionId: impression?.id,
    });
    expect(JSON.stringify(payload)).not.toMatch(/diagnos|cognitive|symptom|condition|score/i);
  });
});
