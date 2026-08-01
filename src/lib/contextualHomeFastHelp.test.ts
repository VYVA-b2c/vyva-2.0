import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  homeFastHelpHistoryStorageKey,
  rankContextualHomeFastHelp,
  readHomeFastHelpHistory,
  recordHomeFastHelpUse,
  writeHomeFastHelpHistory,
  type ContextualHomeFastHelpProfile,
  type HomeFastHelpActivity,
} from "./contextualHomeFastHelp";

describe("contextual Home Fast Help ranking", () => {
  it("keeps the same choices all day for one profile", () => {
    const morning = rankContextualHomeFastHelp({
      hour: 8,
      nowMs: Date.parse("2026-07-17T08:00:00.000Z"),
      rotationKey: "profile-1",
    });
    const evening = rankContextualHomeFastHelp({
      hour: 20,
      nowMs: Date.parse("2026-07-17T20:00:00.000Z"),
      rotationKey: "profile-1",
    });

    expect(evening).toEqual(morning);
    expect(morning.some((action) => action.id === "feel-better" || action.id === "safe-home")).toBe(true);
  });

  it("rotates lower-priority choices across days without auto-rotating during a day", () => {
    const dailyChoices = Array.from({ length: 8 }, (_value, offset) => {
      const nowMs = Date.parse(`2026-07-${String(17 + offset).padStart(2, "0")}T12:00:00.000Z`);
      return rankContextualHomeFastHelp({ nowMs, rotationKey: "profile-1" })
        .map((action) => action.id)
        .join(",");
    });

    expect(new Set(dailyChoices).size).toBeGreaterThan(1);
    dailyChoices.forEach((choices) => {
      expect(choices.includes("feel-better") || choices.includes("safe-home")).toBe(true);
    });
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

  it("never restores the active resume action just to fill three places", () => {
    const nowMs = Date.parse("2026-07-17T12:00:00.000Z");
    const recentlyUsed = [
      "feel-better",
      "stay-well",
      "find-care",
      "paperwork-help",
      "safe-home",
    ].map((actionId) => ({
      actionId: actionId as HomeFastHelpActivity["actionId"],
      status: "used" as const,
      occurredAt: "2026-07-17T11:00:00.000Z",
    }));

    const ranked = rankContextualHomeFastHelp({
      activeTaskActionId: "book-ride",
      activity: recentlyUsed,
      nowMs,
      rotationKey: "profile-1",
    });

    expect(ranked).toHaveLength(3);
    expect(ranked.map((action) => action.id)).not.toContain("book-ride");
  });

  it("deprioritizes another unfinished task instead of presenting it as a new shortcut", () => {
    const nowMs = Date.parse("2026-07-21T12:00:00.000Z");
    const baseline = rankContextualHomeFastHelp({ nowMs, rotationKey: "profile-home" });
    const withUnfinishedRide = rankContextualHomeFastHelp({
      nowMs,
      rotationKey: "profile-home",
      unfinishedTaskActionIds: ["book-ride"],
    });

    expect(baseline.map((action) => action.id)).toContain("book-ride");
    expect(withUnfinishedRide.map((action) => action.id)).not.toContain("book-ride");
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

  it("suppresses a blocked action but restores an unfinished action as the first choice", () => {
    const nowMs = Date.parse("2026-07-17T12:00:00.000Z");
    const blocked = rankContextualHomeFastHelp({
      activity: [{
        actionId: "find-care",
        status: "blocked",
        occurredAt: "2026-07-17T11:55:00.000Z",
      }],
      hour: 14,
      nowMs,
    });
    expect(blocked.map((action) => action.id)).not.toContain("find-care");

    const resumed = rankContextualHomeFastHelp({
      activity: [{
        actionId: "book-ride",
        status: "used",
        occurredAt: "2026-07-17T11:55:00.000Z",
      }],
      hour: 14,
      nowMs,
      resumeActionId: "book-ride",
    });
    expect(resumed[0].id).toBe("book-ride");
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

  it("does not infer Fast Help needs from diagnoses or other unsupported profile fields", () => {
    const input = {
      nowMs: Date.parse("2026-07-17T12:00:00.000Z"),
      rotationKey: "profile-1",
    };
    const baseline = rankContextualHomeFastHelp(input);
    const withSensitiveFields = rankContextualHomeFastHelp({
      ...input,
      profile: {
        conditions: ["diabetes"],
        cognitiveScore: "low",
      } as ContextualHomeFastHelpProfile,
    });

    expect(withSensitiveFields).toEqual(baseline);
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
