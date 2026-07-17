import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  homeFastHelpHistoryStorageKey,
  rankContextualHomeFastHelp,
  readHomeFastHelpHistory,
  recordHomeFastHelpUse,
  writeHomeFastHelpHistory,
  type HomeFastHelpActivity,
} from "./contextualHomeFastHelp";

describe("contextual Home Fast Help ranking", () => {
  it("changes the default choices with the time of day while keeping a safety option", () => {
    expect(rankContextualHomeFastHelp({ hour: 8 }).map((action) => action.id)).toEqual([
      "stay-well",
      "feel-better",
      "safe-home",
    ]);
    expect(rankContextualHomeFastHelp({ hour: 20 }).map((action) => action.id)).toEqual([
      "safe-home",
      "feel-better",
      "stay-well",
    ]);
  });

  it("prioritizes health attention and explains why", () => {
    const [first] = rankContextualHomeFastHelp({
      hour: 14,
      signals: { alertSeverity: "high", recommendedAction: "Seek care today" },
    });

    expect(first).toMatchObject({ id: "feel-better", reason: "healthAttention" });
  });

  it("uses saved readiness details to surface care, transport, and coverage help", () => {
    const ranked = rankContextualHomeFastHelp({
      hour: 14,
      profile: {
        hasCoverageInfo: false,
        hasSavedDoctor: true,
        hasSavedTransportProvider: true,
      },
    });

    expect(ranked.map((action) => action.id)).toEqual(expect.arrayContaining([
      "find-care",
      "book-ride",
      "feel-better",
    ]));
    expect(ranked.find((action) => action.id === "find-care")?.reason).toBe("careReady");
    expect(ranked.find((action) => action.id === "book-ride")?.reason).toBe("transportReady");
  });

  it("does not repeat the generic action represented by an open task", () => {
    const ranked = rankContextualHomeFastHelp({
      activeTaskActionId: "book-ride",
      hour: 14,
      profile: { hasSavedTransportProvider: true },
    });

    expect(ranked.map((action) => action.id)).not.toContain("book-ride");
  });

  it("avoids recently used, completed, and dismissed actions when alternatives exist", () => {
    const nowMs = new Date("2026-07-17T12:00:00.000Z").getTime();
    const activity: HomeFastHelpActivity[] = [
      { actionId: "feel-better", status: "used", occurredAt: "2026-07-17T11:00:00.000Z" },
      { actionId: "stay-well", status: "completed", occurredAt: "2026-07-16T12:00:00.000Z" },
      { actionId: "find-care", status: "dismissed", occurredAt: "2026-07-17T09:00:00.000Z" },
    ];

    const ranked = rankContextualHomeFastHelp({ activity, hour: 14, nowMs });

    expect(ranked.map((action) => action.id)).toEqual(expect.arrayContaining([
      "safe-home",
      "book-ride",
      "paperwork-help",
    ]));
    expect(ranked.map((action) => action.id)).not.toEqual(expect.arrayContaining([
      "feel-better",
      "stay-well",
      "find-care",
    ]));
  });

  it("preserves a safety fallback when profile signals favor service actions", () => {
    const ranked = rankContextualHomeFastHelp({
      hour: 14,
      profile: {
        hasCoverageInfo: false,
        hasSavedDoctor: true,
        hasSavedTransportProvider: true,
      },
    });

    expect(ranked.some((action) => action.id === "feel-better" || action.id === "safe-home")).toBe(true);
  });
});

describe("contextual Home Fast Help history", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("stores recent use per profile and replaces an older use of the same action", () => {
    const key = homeFastHelpHistoryStorageKey("profile-1");
    const first = recordHomeFastHelpUse([], "book-ride", new Date("2026-07-17T09:00:00.000Z").getTime());
    const second = recordHomeFastHelpUse(first, "book-ride", new Date("2026-07-17T10:00:00.000Z").getTime());
    writeHomeFastHelpHistory(key, second);

    expect(readHomeFastHelpHistory(key)).toEqual([{
      actionId: "book-ride",
      status: "used",
      occurredAt: "2026-07-17T10:00:00.000Z",
    }]);
    expect(readHomeFastHelpHistory(homeFastHelpHistoryStorageKey("profile-2"))).toEqual([]);
  });

  it("ignores malformed stored history", () => {
    const key = homeFastHelpHistoryStorageKey(null);
    window.localStorage.setItem(key, "not-json");

    expect(readHomeFastHelpHistory(key)).toEqual([]);
  });
});
