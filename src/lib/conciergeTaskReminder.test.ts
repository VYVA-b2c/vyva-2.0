import { describe, expect, it } from "vitest";
import { conciergeTaskReminder } from "./conciergeTaskReminder";
import type { ConciergeTaskInboxItem } from "./conciergeTaskInbox";

const item = {
  key: "draft:one", source: "draft", title: "Plumber", savedResults: true,
  resumePath: "/concierge/task/one", detailPath: "/concierge/tasks/draft%3Aone",
  continuation: { state: "draft", stale: false }, reply: null, missingInformation: [],
} as ConciergeTaskInboxItem;

describe("shared Concierge task reminder", () => {
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
    expect(conciergeTaskReminder({ ...item, savedResults: false }, "en").revision).not.toBe(initial);
    const reply = { ...item, source: "pending" as const, reply: "Please confirm the time" };
    expect(conciergeTaskReminder(reply, "en")).toMatchObject({ action: "Review reply", path: item.detailPath });
    expect(conciergeTaskReminder(reply, "en").revision).not.toBe(initial);
  });
});
