import { describe, expect, it } from "vitest";
import {
  followUpExpiresAt,
  isFollowUpExpired,
  isFollowUpVisible,
  normalizeSnoozeHours,
  snoozedUntilFrom,
} from "./healthFollowUpLifecycle.js";

const now = new Date("2026-07-09T10:00:00.000Z");

describe("health follow-up lifecycle", () => {
  it("expires symptom follow-ups after the active window", () => {
    expect(followUpExpiresAt("2026-07-02T10:00:00.000Z")?.toISOString()).toBe("2026-07-09T10:00:00.000Z");
    expect(isFollowUpExpired("2026-07-02T09:59:59.000Z", now)).toBe(true);
    expect(isFollowUpExpired("2026-07-02T10:00:01.000Z", now)).toBe(false);
  });

  it("hides handled, expired, and still-snoozed follow-ups", () => {
    expect(isFollowUpVisible({ status: "handled" }, "2026-07-08T10:00:00.000Z", now)).toBe(false);
    expect(isFollowUpVisible({ status: "expired" }, "2026-07-08T10:00:00.000Z", now)).toBe(false);
    expect(isFollowUpVisible({ status: "snoozed", snoozedUntil: "2026-07-09T11:00:00.000Z" }, "2026-07-08T10:00:00.000Z", now)).toBe(false);
    expect(isFollowUpVisible({ status: "snoozed", snoozedUntil: "2026-07-09T09:00:00.000Z" }, "2026-07-08T10:00:00.000Z", now)).toBe(true);
    expect(isFollowUpVisible(null, "2026-07-08T10:00:00.000Z", now)).toBe(true);
  });

  it("bounds snooze durations", () => {
    expect(normalizeSnoozeHours("bad")).toBe(48);
    expect(normalizeSnoozeHours(0)).toBe(1);
    expect(normalizeSnoozeHours(500)).toBe(168);
    expect(snoozedUntilFrom(now, 2).toISOString()).toBe("2026-07-09T12:00:00.000Z");
  });
});
