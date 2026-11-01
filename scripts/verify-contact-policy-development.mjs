// Replit Development Shell only. No Production connections are opened.
import pg from "pg";
import { readFileSync } from "node:fs";
if (!process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT)
  throw new Error("Run only in Replit Development Shell");
if (!process.env.DATABASE_URL)
  throw new Error("Development DATABASE_URL required");
if (
  process.env.PROD_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.PROD_DATABASE_URL
)
  throw new Error("Refusing Production URL");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  console.log(
    "UID audit:",
    JSON.stringify(
      (
        await client.query(
          "select to_regclass('auth.users') as auth_users_exists",
        )
      ).rows,
    ),
  );
  console.log(
    "Legacy auth FKs:",
    JSON.stringify(
      (
        await client.query(
          "select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as fk from pg_constraint where contype='f' and pg_get_constraintdef(oid) ilike '%auth.users%'",
        )
      ).rows,
    ),
  );
  if (process.argv.includes("--apply")) {
    await client.query("begin");
    await client.query(
      readFileSync(
        new URL(
          "../migrations/0115_deployment_contact_policy.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await client.query("commit");
    console.log("Migration 0115 applied to Replit Development");
  }
  console.log(
    "Policy deployment counts:",
    JSON.stringify(
      (
        await client.query(
          `select count(*) as policy_rows,(select count(distinct deployment) from public.profiles) as profile_deployments from public.deployment_contact_policies`,
        )
      ).rows,
    ),
  );
  await client.query("begin");
  const cases = [
    ["max_outbound_calls_per_day", 0],
    ["max_outbound_calls_per_day", 7],
    ["quiet_hours_start", "25:00"],
    ["checkin_retry_interval_minutes", 12],
  ];
  for (const [field, value] of cases) {
    await client.query("savepoint invalid_policy");
    let rejected = false;
    try {
      await client.query(
        `insert into public.deployment_contact_policies(deployment,${field}) values($1,$2)`,
        ["__contact_policy_constraint_probe__", value],
      );
    } catch (e) {
      if (e.code !== "23514") throw e;
      rejected = true;
    }
    await client.query("rollback to savepoint invalid_policy");
    if (!rejected) throw new Error(`Constraint accepted invalid ${field}`);
    console.log(`Constraint rejected ${field}=${value}`);
  }
  const standard = await client.query(
    "select deployment from public.deployment_contact_policies where deployment='standard'",
  );
  if (!standard.rows.length) throw new Error("standard deployment missing");
  await client.query("rollback");
  console.log("Development policy verification passed");
} catch (e) {
  await client.query("rollback").catch(() => {});
  throw e;
} finally {
  client.release();
  await pool.end();
}
