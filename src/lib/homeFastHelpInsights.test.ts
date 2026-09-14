import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  homeFastHelpImpressionStorageKey,
  readHomeFastHelpImpressions,
  recordHomeFastHelpImpression,
} from "./homeFastHelpInsights";

describe("Home Fast Help ranking impressions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores only three ordered action IDs, the ranking version, and shown time", () => {
    const impression = recordHomeFastHelpImpression({
      actionIds: ["safe-home", "book-ride", "stay-well"],
      rankingVersion: "personalized-v1",
      profileId: "profile-a",
      shownAtMs: Date.parse("2026-07-17T09:00:00.000Z"),
    });

    expect(impression).toMatchObject({
      actionIds: ["safe-home", "book-ride", "stay-well"],
      rankingVersion: "personalized-v1",
      shownAt: "2026-07-17T09:00:00.000Z",
    });
    expect(Object.keys(impression ?? {}).sort()).toEqual(["actionIds", "id", "rankingVersion", "shownAt"]);
    expect(readHomeFastHelpImpressions(homeFastHelpImpressionStorageKey("profile-a"))).toEqual([impression]);
  });

  it("rejects malformed, duplicate, extra, and sensitive impression content", () => {
    const storageKey = homeFastHelpImpressionStorageKey("profile-a");
    expect(recordHomeFastHelpImpression({
      actionIds: ["safe-home", "safe-home", "book-ride"],
      rankingVersion: "personalized-v1",
      profileId: "profile-a",
    })).toBeNull();

    window.localStorage.setItem(storageKey, JSON.stringify([{
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actionIds: ["safe-home", "book-ride", "stay-well"],
      rankingVersion: "personalized-v1",
      shownAt: "2026-07-17T09:00:00.000Z",
      diagnosis: "must not survive",
    }]));

    expect(readHomeFastHelpImpressions(storageKey)).toEqual([]);
  });
});
