import { conciergeTaskInboxItemPath } from "./conciergeTaskLinks.js";

export type ConciergeTaskNotificationEventType = "provider_reply" | "information_needed";

export type ConciergeTaskNotificationDraft = {
  eventType: ConciergeTaskNotificationEventType;
  title: string;
  body: string;
  taskPath: string;
  dedupeKey: string;
};

export function buildConciergeTaskNotificationDraft(input: {
  pendingId: string;
  inboundMessageId: string;
  channel?: string;
  providerName?: string | null;
  summary?: string | null;
  actionNeeded: boolean;
}): ConciergeTaskNotificationDraft {
  const providerName = input.providerName?.trim() || "Your provider";
  const eventType: ConciergeTaskNotificationEventType = input.actionNeeded
    ? "information_needed"
    : "provider_reply";

  return {
    eventType,
    title: input.actionNeeded ? `${providerName} needs information` : `${providerName} replied`,
    body: input.summary?.trim() || (input.actionNeeded
      ? "Open the task to review what they need."
      : "Open the task to read their reply."),
    taskPath: conciergeTaskInboxItemPath("pending", input.pendingId),
    dedupeKey: `provider-reply:${input.channel?.trim() || "email"}:${input.inboundMessageId}`,
  };
}
