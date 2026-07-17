import { beforeEach, describe, expect, it } from "vitest";
import {
  abandonOpenedHomeFastHelpJourneys,
  homeFastHelpActivityFromJourneys,
  homeFastHelpContextFromState,
  latestBlockedHomeFastHelpJourney,
  latestResumableHomeFastHelpJourney,
  markHomeFastHelpJourney,
  mergeSyncedHomeFastHelpJourneys,
  readHomeFastHelpJourneys,
  reconcileHomeFastHelpJourneys,
  resumeHomeFastHelpJourney,
  startHomeFastHelpJourney,
  syncedHomeFastHelpJourneys,
  withHomeFastHelpContextState,
} from "./homeFastHelpOutcome";

describe("Home Fast Help outcome journeys", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores the opened destination and passes a recoverable route context", () => {
    const started = startHomeFastHelpJourney({
      actionId: "find-care",
      destinationPath: "/concierge",
      destinationState: { conciergePrefill: { useCase: "find_provider" } },
      profileId: "profile-1",
      occurredAtMs: Date.parse("2026-07-17T10:00:00.000Z"),
    });
    const state = withHomeFastHelpContextState(started.context, { focusRightNow: true });

    expect(homeFastHelpContextFromState(state)).toEqual(started.context);
    expect(readHomeFastHelpJourneys(started.storageKey)[0]).toMatchObject({
      actionId: "find-care",
      destinationPath: "/concierge",
      destinationState: { conciergePrefill: { useCase: "find_provider" } },
      status: "opened",
    });
  });

  it("records completion and keeps the journey terminal", () => {
    const started = startHomeFastHelpJourney({
      actionId: "feel-better",
      destinationPath: "/health/symptom-check",
      occurredAtMs: Date.parse("2026-07-17T10:00:00.000Z"),
    });

    markHomeFastHelpJourney(started.context, "completed", {
      occurredAtMs: Date.parse("2026-07-17T10:05:00.000Z"),
      reason: "symptom_report_saved",
      referenceId: "report-1",
    });
    markHomeFastHelpJourney(started.context, "abandoned", { reason: "returned_home" });

    const [journey] = readHomeFastHelpJourneys(started.storageKey);
    expect(journey.status).toBe("completed");
    expect(journey.events.at(-1)).toMatchObject({
      status: "completed",
      reason: "symptom_report_saved",
      referenceId: "report-1",
    });
  });

  it("turns an unfinished action into a resumable journey on return Home", () => {
    const started = startHomeFastHelpJourney({
      actionId: "stay-well",
      destinationPath: "/health/prevention",
      occurredAtMs: Date.parse("2026-07-17T10:00:00.000Z"),
    });

    const abandoned = abandonOpenedHomeFastHelpJourneys(
      started.storageKey,
      Date.parse("2026-07-17T10:02:00.000Z"),
    );
    const resumable = latestResumableHomeFastHelpJourney(abandoned);

    expect(resumable?.status).toBe("abandoned");
    const resumed = resumeHomeFastHelpJourney(resumable!, started.storageKey);
    expect(resumed.id).toBe(started.journey.id);
    expect(resumed.status).toBe("opened");
    expect(resumed.events.at(-1)).toMatchObject({ status: "opened", reason: "resumed" });
  });

  it("reconciles an existing Concierge outcome after the user returns", () => {
    const started = startHomeFastHelpJourney({
      actionId: "book-ride",
      destinationPath: "/concierge",
      occurredAtMs: Date.parse("2026-07-17T10:00:00.000Z"),
    });

    const reconciled = reconcileHomeFastHelpJourneys(started.storageKey, [{
      actionId: "book-ride",
      status: "completed",
      occurredAt: "2026-07-17T10:10:00.000Z",
    }]);

    expect(reconciled[0].status).toBe("completed");
    expect(homeFastHelpActivityFromJourneys(reconciled)).toEqual([{
      actionId: "book-ride",
      status: "completed",
      occurredAt: "2026-07-17T10:10:00.000Z",
    }]);
  });

  it("only offers a recent blocked journey as alternative context", () => {
    const now = Date.parse("2026-07-17T12:00:00.000Z");
    const started = startHomeFastHelpJourney({
      actionId: "safe-home",
      destinationPath: "/safe-home",
      occurredAtMs: now - 60_000,
    });
    markHomeFastHelpJourney(started.context, "blocked", {
      occurredAtMs: now - 30_000,
      reason: "home_scan_failed",
    });
    const journeys = readHomeFastHelpJourneys(started.storageKey);

    expect(latestBlockedHomeFastHelpJourney(journeys, now)?.actionId).toBe("safe-home");
    expect(latestBlockedHomeFastHelpJourney(journeys, now + 25 * 60 * 60 * 1000)).toBeNull();
  });

  it("syncs only opaque outcome data and never sends route state or reasons", () => {
    const started = startHomeFastHelpJourney({
      actionId: "feel-better",
      destinationPath: "/health/symptom-check",
      destinationState: { symptom: "private symptom text" },
      occurredAtMs: Date.parse("2026-07-17T10:00:00.000Z"),
    });
    markHomeFastHelpJourney(started.context, "blocked", {
      reason: "private explanation",
      referenceId: "unsafe reference with spaces",
    });

    const serialized = JSON.stringify(syncedHomeFastHelpJourneys(started.storageKey));
    expect(serialized).not.toContain("private symptom text");
    expect(serialized).not.toContain("private explanation");
    expect(serialized).not.toContain("unsafe reference");
    expect(serialized).not.toContain("destinationPath");
  });

  it("merges a remote completion and derives a safe local resume destination", () => {
    const storageKey = "vyva:home-fast-help-journeys:v1:profile-remote";
    const merged = mergeSyncedHomeFastHelpJourneys(storageKey, [{
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actionId: "book-ride",
      status: "completed",
      startedAt: "2026-07-17T10:00:00.000Z",
      updatedAt: "2026-07-17T10:05:00.000Z",
      referenceId: "ride-42",
      events: [{
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "completed",
        occurredAt: "2026-07-17T10:05:00.000Z",
        referenceId: "ride-42",
      }],
    }]);

    expect(merged[0]).toMatchObject({
      status: "completed",
      destinationPath: "/concierge",
      destinationState: null,
    });
    expect(homeFastHelpActivityFromJourneys(merged)[0]?.status).toBe("completed");
  });
});
