import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";
import { buildConciergeTaskNotificationDraft } from "../../shared/conciergeTaskNotifications.js";

export type ConciergeTaskNotificationItem = {
  id: string;
  eventType: "provider_reply" | "information_needed";
  title: string;
  body: string;
  taskPath: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  event_type: "provider_reply" | "information_needed";
  title: string;
  body: string;
  task_path: string;
  read_at: Date | string | null;
  created_at: Date | string;
};

function dateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function notificationItem(row: NotificationRow): ConciergeTaskNotificationItem {
  return {
    id: row.id,
    eventType: row.event_type,
    title: row.title,
    body: row.body,
    taskPath: row.task_path,
    readAt: row.read_at ? dateString(row.read_at) : null,
    createdAt: dateString(row.created_at),
  };
}

export async function createConciergeTaskNotificationWithClient(
  client: Pick<PoolClient, "query">,
  input: {
    userId: string;
    pendingId: string;
    inboundMessageId: string;
    channel?: string;
    providerName?: string | null;
    summary?: string | null;
    actionNeeded: boolean;
  },
): Promise<{ created: boolean; deliveryStatus: "ready" | "suppressed" }> {
  const preferenceResult = await client.query<{ concierge_task_notifications_enabled: boolean }>(`
    select concierge_task_notifications_enabled
    from user_channel_preferences
    where user_id = $1
    limit 1
  `, [input.userId]);
  const deliveryStatus = preferenceResult.rows[0]?.concierge_task_notifications_enabled === false
    ? "suppressed"
    : "ready";
  const draft = buildConciergeTaskNotificationDraft(input);
  const inserted = await client.query<{ id: string }>(`
    insert into concierge_task_notifications (
      user_id, pending_id, inbound_message_id, event_type, title, body,
      task_path, delivery_status, dedupe_key
    ) values ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9)
    on conflict (dedupe_key) do nothing
    returning id::text
  `, [
    input.userId,
    input.pendingId,
    input.inboundMessageId,
    draft.eventType,
    draft.title,
    draft.body,
    draft.taskPath,
    deliveryStatus,
    draft.dedupeKey,
  ]);
  return { created: Boolean(inserted.rows[0]), deliveryStatus };
}

export async function listConciergeTaskNotifications(
  userId: string,
  database: Pool = pool,
): Promise<{ items: ConciergeTaskNotificationItem[]; unreadCount: number }> {
  const [itemsResult, unreadResult] = await Promise.all([
    database.query<NotificationRow>(`
      select id::text, event_type, title, body, task_path, read_at, created_at
      from concierge_task_notifications
      where user_id = $1 and delivery_status = 'ready'
      order by created_at desc
      limit 20
    `, [userId]),
    database.query<{ unread_count: number }>(`
      select count(*)::int as unread_count
      from concierge_task_notifications
      where user_id = $1 and delivery_status = 'ready' and read_at is null
    `, [userId]),
  ]);
  return {
    items: itemsResult.rows.map(notificationItem),
    unreadCount: unreadResult.rows[0]?.unread_count ?? 0,
  };
}

export async function markConciergeTaskNotificationRead(
  input: { id: string; userId: string },
  database: Pool = pool,
): Promise<boolean> {
  const result = await database.query(`
    update concierge_task_notifications
    set read_at = coalesce(read_at, now()), updated_at = now()
    where id = $1::uuid and user_id = $2 and delivery_status = 'ready'
    returning id
  `, [input.id, input.userId]);
  return (result.rowCount ?? 0) > 0;
}
