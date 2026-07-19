export const NEW_CONCIERGE_TASK_ID = "new";

export type ConciergeTaskInboxSource = "draft" | "pending" | "completed";

export function conciergeTaskResumePath(taskId = NEW_CONCIERGE_TASK_ID): string {
  const normalizedId = taskId.trim() || NEW_CONCIERGE_TASK_ID;
  return `/concierge/task/${encodeURIComponent(normalizedId)}`;
}

export function conciergeTaskNotificationPath(taskId: string): string {
  return conciergeTaskResumePath(taskId);
}

export function conciergeTaskInboxPath(): string {
  return "/concierge/tasks";
}

export function conciergeTaskInboxKey(source: ConciergeTaskInboxSource, id: string): string {
  return `${source}:${id.trim()}`;
}

export function conciergeTaskInboxItemPath(source: ConciergeTaskInboxSource, id: string): string {
  return `${conciergeTaskInboxPath()}/${encodeURIComponent(conciergeTaskInboxKey(source, id))}`;
}

export function parseConciergeTaskInboxKey(value: string | null | undefined): {
  source: ConciergeTaskInboxSource;
  id: string;
} | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator <= 0) return null;
  const source = value.slice(0, separator) as ConciergeTaskInboxSource;
  const id = value.slice(separator + 1).trim();
  if (!["draft", "pending", "completed"].includes(source) || !id) return null;
  return { source, id };
}
