import type { ConciergeTaskInboxItem } from "./conciergeTaskInbox";
import { homeServiceText } from "../../shared/homeServiceText";

function revisionHash(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}

export function conciergeTaskReminder(item: ConciergeTaskInboxItem, language: string) {
  const state = item.continuation.state;
  const action = item.reply ? "Review reply"
    : item.source === "draft" ? (item.savedResults ? "View saved results" : "Continue request")
    : state === "needs_info" ? "Add information"
    : state === "ready_to_confirm" ? "Review request"
    : state === "waiting" ? "View status" : "Review request";
  // Ignore autosave timestamps and language changes; only meaningful task updates resurface a reminder.
  const content = JSON.stringify(item.actionPayload?.provider_reply_received_at || item.reply || null);
  return {
    hasUpdate: Boolean(item.reply || item.actionPayload?.provider_reply_received_at),
    taskKey: item.draftId ? `draft:${item.draftId}` : item.key,
    aliases: [...new Set([item.key, ...(item.draftId ? [`draft:${item.draftId}`] : []), ...(item.pendingId ? [`pending:${item.pendingId}`] : [])])],
    revision: item.reply || item.actionPayload?.provider_reply_received_at ? `reply:${revisionHash(content)}` : "saved-request",
    legacyRevision: revisionHash(JSON.stringify([state, item.savedResults, item.reply, item.missingInformation, item.actionPayload?.provider_reply_received_at, item.actionPayload?.provider_reply_resolution])),
    title: homeServiceText(language, item.title),
    action: homeServiceText(language, action),
    path: item.source === "draft" && !item.continuation.stale ? item.resumePath : item.detailPath,
  };
}

export function visibleConciergeReminders(items: ConciergeTaskInboxItem[], language: string, hidden: (key: string, revision: string) => boolean) {
  const seen = new Set<string>();
  return items.filter(item => item.group !== "completed").map(item => ({ item, reminder: conciergeTaskReminder(item, language) }))
    .filter(({ reminder }) => {
      if (reminder.aliases.some(key => seen.has(key))) return false;
      reminder.aliases.forEach(key => seen.add(key));
      return !reminder.aliases.some(key => hidden(key, reminder.revision) || hidden(key, reminder.legacyRevision));
    })
    .sort((a, b) => Number(Boolean(b.item.reply)) - Number(Boolean(a.item.reply))
      || Number(b.item.continuation.state === "needs_info") - Number(a.item.continuation.state === "needs_info"))
    .map(({ reminder }) => reminder);
}
