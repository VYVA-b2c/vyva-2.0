import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for reminder schema setup.");
const sql = readFileSync(new URL("../migrations/0104_concierge_reminder_dismissals.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock($1)", [83920104]);
  await client.query(sql);
  // Validate the columns without reading or modifying saved dismissals.
  await client.query("select user_id, task_key, revision, dismissed_at from public.concierge_reminder_dismissals limit 0");
  await client.query("commit");
  console.log("Reminder dismissal schema ready; existing records preserved.");
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
