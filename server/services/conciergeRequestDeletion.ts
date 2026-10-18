import { pool } from "../db.js";
import { ConciergeRequestBusyError, withConciergeRequestLock } from "./conciergeRequestLock.js";

export function requestWasExecuted(status: string, payload: Record<string, unknown>) {
  const adapter = payload.execution_adapter as Record<string, unknown> | undefined;
  return status === "completed" || payload.live_handoff_status === "sent_or_called"
    || (adapter?.mode === "live" && adapter.status === "sent");
}

export async function deleteConciergeRequest(kind: "draft" | "pending", id: string, userId: string): Promise<void> {
  if (kind === "pending") {
    const linked = (await pool.query("select id from concierge_task_drafts where linked_pending_id = $1::uuid and user_id = $2", [id, userId])).rows[0];
    if (linked) return deleteConciergeRequest("draft", linked.id, userId);
  }
  await withConciergeRequestLock(`${kind}:${id}`, async () => {
    const draft = kind === "draft" ? (await pool.query(
      "select id, linked_pending_id from concierge_task_drafts where id = $1::uuid and user_id = $2", [id, userId],
    )).rows[0] : null;
    if (kind === "draft" && !draft) throw new Error("Concierge task not found");
    const pendingId = kind === "pending" ? id : draft?.linked_pending_id;
    const remove = async () => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        if (pendingId) {
          const pending = (await client.query(
            "select status, action_payload from concierge_pending where id = $1::uuid and user_id = $2 for update", [pendingId, userId],
          )).rows[0];
          if (!pending) throw new Error("Concierge task not found");
          if (pending.status === "calling") throw new ConciergeRequestBusyError();
          const payload = pending.action_payload ?? {};
          const executed = requestWasExecuted(pending.status, payload);
          await client.query(`update concierge_pending
            set status = $3, action_payload = coalesce(action_payload, '{}'::jsonb) || jsonb_build_object('request_deleted_at', now()), updated_at = now()
            where id = $1::uuid and user_id = $2`, [pendingId, userId, executed ? pending.status : "cancelled"]);
          await client.query(`update concierge_task_notifications set delivery_status = 'suppressed', read_at = coalesce(read_at, now()), updated_at = now()
            where pending_id = $1::uuid and user_id = $2`, [pendingId, userId]);
        }
        await client.query(`update concierge_task_drafts set status = 'deleted', deleted_at = now(), updated_at = now()
          where user_id = $2 and (id = $1::uuid or linked_pending_id = $3::uuid)`, [kind === "draft" ? id : null, userId, pendingId ?? null]);
        await client.query("commit");
      } catch (error) { await client.query("rollback"); throw error; }
      finally { client.release(); }
    };
    if (kind === "draft" && pendingId) await withConciergeRequestLock(`pending:${pendingId}`, remove);
    else await remove();
  });
}
