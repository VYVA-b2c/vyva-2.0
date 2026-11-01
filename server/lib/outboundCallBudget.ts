import { pool } from "../db.js";
import { localDayWindow } from "./dailyCheckinSchedule.js";
export async function countOutboundCallsToday(
  userId: string,
  timezone: string,
  now = new Date(),
  client: Pick<typeof pool, "query"> = pool,
): Promise<number> {
  const day = localDayWindow(now, timezone);
  const result = await client.query(
    `select (select count(*) from outbound_contact_ledger where user_id=$1 and local_date=$2 and decided_channel='voice_outbound' and reason in ('allowed','urgent')) + (select count(*) from preventive_outbound_call_attempts where user_id=$1 and provider_attempt_started_at >= $3 and provider_attempt_started_at < $4) as calls`,
    [userId, day.date_key, day.start, day.end],
  );
  return Number(result.rows[0].calls);
}
