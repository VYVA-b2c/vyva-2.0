import { pool } from "../db.js";
import { getContactPolicyForUser } from "./contactPolicyStore.js";
import { countOutboundCallsToday } from "./outboundCallBudget.js";
import { localDayWindow } from "./dailyCheckinSchedule.js";
import { outboundDecision } from "./outboundDecision.js";
export function residentLocalTime(now: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}
export async function recordOutboundDecision(
  userId: string,
  input: {
    purpose: string;
    requested_channel: "voice_outbound" | "whatsapp_outbound";
    urgent?: boolean;
    source_ref?: string;
    local_time?: string;
  },
  now = new Date(),
) {
  const context = await getContactPolicyForUser(userId);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      "contact-budget:" + userId,
    ]);
    const calls = await countOutboundCallsToday(
      userId,
      context.timezone,
      now,
      client,
    );
    // Server time is authoritative: a caller cannot bypass quiet hours or midnight budgets.
    const decision = outboundDecision({
      ...input,
      ...context,
      calls_today: calls,
      local_time: residentLocalTime(now, context.timezone),
    });
    await client.query(
      `insert into outbound_contact_ledger(user_id,purpose,requested_channel,decided_channel,reason,local_date,source_ref) values($1,$2,$3,$4,$5,$6,$7)`,
      [
        userId,
        input.purpose,
        input.requested_channel,
        decision.decided_channel,
        decision.reason,
        localDayWindow(now, context.timezone).date_key,
        input.source_ref ?? null,
      ],
    );
    await client.query("commit");
    return {
      ...decision,
      calls_today:
        calls +
        (decision.decided_channel === "voice_outbound" &&
        ["allowed", "urgent"].includes(decision.reason)
          ? 1
          : 0),
    };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
