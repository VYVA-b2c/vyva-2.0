import type { ConciergeTaskInboxItem } from "./conciergeTaskInbox";
import { homeServiceText } from "../../shared/homeServiceText";

export function conciergeTaskReminder(item: ConciergeTaskInboxItem, language: string) {
  const state = item.continuation.state;
  const action = item.reply ? "Review reply"
    : item.source === "draft" ? (item.savedResults ? "View saved results" : "Continue request")
    : state === "needs_info" ? "Add information"
    : state === "ready_to_confirm" ? "Review request"
    : state === "waiting" ? "View status" : "Review request";
  // Ignore autosave timestamps and language changes; only meaningful task updates resurface a reminder.
  const content = JSON.stringify([state, item.savedResults, item.reply, item.missingInformation, item.actionPayload?.provider_reply_received_at, item.actionPayload?.provider_reply_resolution]);
  let hash = 2166136261;
  for (const character of content) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return {
    taskKey: item.key,
    revision: (hash >>> 0).toString(16),
    title: homeServiceText(language, item.title),
    action: homeServiceText(language, action),
    path: item.source === "draft" && !item.continuation.stale ? item.resumePath : item.detailPath,
  };
}
