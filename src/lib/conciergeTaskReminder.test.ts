import { describe, expect, it } from "vitest";
import { conciergeTaskReminder, visibleConciergeReminders } from "./conciergeTaskReminder";
import type { ConciergeTaskInboxItem } from "./conciergeTaskInbox";

const item = {
  key: "draft:one", source: "draft", title: "Plumber", savedResults: true,
  resumePath: "/concierge/task/one", detailPath: "/concierge/tasks/draft%3Aone",
  continuation: { state: "draft", stale: false }, reply: null, missingInformation: [],
} as ConciergeTaskInboxItem;

describe("shared Concierge task reminder", () => {
  it("keeps dismissal across draft promotion and internal state changes", () => {
    const draft = { ...item, draftId: "one" };
    const pending = { ...draft, key: "pending:two", source: "pending" as const, pendingId: "two", continuation: { ...draft.continuation, state: "ready_to_confirm" as const } };
    const original = conciergeTaskReminder(draft, "en");
    expect(conciergeTaskReminder(pending, "fr").taskKey).toBe(original.taskKey);
    expect(conciergeTaskReminder(pending, "fr").revision).toBe(original.revision);
    expect(visibleConciergeReminders([pending], "en", key => key === original.taskKey)).toEqual([]);
  });
  it("counts requests once and ignores translated reply text when an event timestamp exists", () => {
    const pending = { ...item, draftId: "one", pendingId: "two", key: "pending:two", reply: "New time", actionPayload: { provider_reply_received_at: "2026-10-02T10:00:00Z" } };
    expect(visibleConciergeReminders([pending, pending], "en", () => false)).toHaveLength(1);
    expect(conciergeTaskReminder({ ...pending, reply: "Nouvelle heure" }, "fr").revision).toBe(conciergeTaskReminder(pending, "en").revision);
    expect(conciergeTaskReminder({ ...pending, actionPayload: { provider_reply_received_at: "2026-10-03T10:00:00Z" } }, "en").revision).not.toBe(conciergeTaskReminder(pending, "en").revision);
  });
  it("opens saved results directly without implying a booking or confirmation", () => {
    expect(conciergeTaskReminder(item, "en")).toMatchObject({ title: "Plumber", action: "View saved results", path: item.resumePath });
    expect(conciergeTaskReminder({ ...item, savedResults: false }, "en").action).toBe("Continue request");
  });
  it.each(["es", "fr", "de", "it", "pt"])("localizes %s without resurfacing a dismissed reminder", language => {
    const translated = conciergeTaskReminder(item, language);
    expect(translated.title).not.toBe("Plumber");
    expect(translated.action).not.toBe("View saved results");
    expect(translated.revision).toBe(conciergeTaskReminder(item, "en").revision);
  });
  it("ignores autosaves but resurfaces a changed task or provider reply", () => {
    const initial = conciergeTaskReminder(item, "en").revision;
    expect(conciergeTaskReminder({ ...item, updatedAt: "2030-01-01" }, "en").revision).toBe(initial);
    expect(conciergeTaskReminder({ ...item, savedResults: false }, "en").revision).toBe(initial);
    const reply = { ...item, source: "pending" as const, reply: "Please confirm the time" };
    expect(conciergeTaskReminder(reply, "en")).toMatchObject({ action: "Review reply", path: item.detailPath });
    expect(conciergeTaskReminder(reply, "en").revision).not.toBe(initial);
  });
});
