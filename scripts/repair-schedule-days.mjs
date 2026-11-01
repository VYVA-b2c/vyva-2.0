// Run only from Replit Development Shell. Dry-run by default.
import pg from "pg";
import { computeBrainCoachNextRunAt } from "../server/lib/brainCoachScheduleSync.ts";
import { parseDays } from "../shared/dayOfWeek.ts";
if (!process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT)
  throw new Error("Run from Replit Development Shell only");
if (!process.env.DATABASE_URL)
  throw new Error("Development DATABASE_URL is required");
if (
  process.env.PROD_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.PROD_DATABASE_URL
)
  throw new Error("Refusing Production URL");
const apply = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  const { rows } = await client.query(
    `select id,days_of_week,frequency_value,user_description,frequency_type,times_of_day,timezone,is_paused from scheduled_interactions where status='ACTIVE' and frequency_type in ('WEEKLY','CUSTOM') and (coalesce(cardinality(days_of_week),0)=0 or next_run_at is null) for update`,
  );
  let repairable = 0;
  for (const row of rows) {
    const fv = row.frequency_value ?? {};
    const explicit = fv.days_of_week ?? fv.days;
    const candidates = Array.isArray(explicit)
      ? explicit
      : typeof explicit === "string"
        ? [explicit]
        : [];
    // Only parse a complete day expression; never infer intent from arbitrary prose.
    if (typeof row.user_description === "string")
      candidates.push(row.user_description);
    const days = parseDays(
      [...(row.days_of_week ?? []), ...candidates].filter(
        (x) => typeof x === "string",
      ),
    ).days;
    console.log(
      JSON.stringify({
        id: row.id,
        days,
        action: days.length
          ? "repair days and next run"
          : "manual review; no days inferred",
      }),
    );
    if (days.length) {
      repairable++;
      if (apply)
        await client.query(
          `update scheduled_interactions set days_of_week=$2,next_run_at=$3,updated_at=now() where id=$1`,
          [
            row.id,
            days,
            computeBrainCoachNextRunAt({
              status: "ACTIVE",
              isPaused: row.is_paused,
              frequencyType: row.frequency_type,
              daysOfWeek: days,
              timesOfDay: row.times_of_day ?? [],
              timezone: row.timezone ?? "Europe/Madrid",
            }),
          ],
        );
    }
  }
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      affected: rows.length,
      repairable,
      manualReview: rows.length - repairable,
    }),
  );
  await client.query(apply ? "commit" : "rollback");
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  client.release();
  await pool.end();
}
