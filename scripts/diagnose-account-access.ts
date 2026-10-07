import "dotenv/config";
import type { PoolClient } from "pg";
import { pool } from "../server/db.js";
import { runtimeIdentity } from "../server/lib/runtimeIdentity.js";

const email = process.argv[2]?.trim();
if (!email || !email.includes("@")) {
  console.error('Usage: npx tsx scripts/diagnose-account-access.ts "login email"');
  process.exitCode = 1;
} else {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    // Do not call profile resolution or entitlement sync: both can repair data on reads.
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '10s'");
    const accounts = await client.query(`
      SELECT u.id AS account_id, u.active_profile_id,
        p.id AS profile_id, p.subscription_tier, p.subscription_status,
        p.trial_ends_at, p.created_at, p.updated_at,
        (p.stripe_subscription_id IS NOT NULL) AS has_stripe_subscription
      FROM users u
      LEFT JOIN profiles p ON p.id = u.id OR p.id = u.active_profile_id
      WHERE lower(u.email) = lower($1)`, [email]);
    const memberships = await client.query(`
      SELECT m.profile_id, m.role, m.status
      FROM profile_memberships m JOIN users u ON u.id = m.user_id
      WHERE lower(u.email) = lower($1)`, [email]);
    const lifecycle = await client.query(`
      SELECT i.tier, i.status, i.updated_at
      FROM user_intakes i
      WHERE lower(i.email) = lower($1) OR EXISTS (
        SELECT 1 FROM users u WHERE lower(u.email) = lower($1)
          AND (i.user_id IN (u.id, u.active_profile_id)
            OR i.elder_user_id IN (u.id, u.active_profile_id)
            OR i.family_user_id IN (u.id, u.active_profile_id)))
      ORDER BY i.updated_at DESC LIMIT 12`, [email]);
    const audit = await client.query(`
      SELECT e.event_type, e.from_status, e.to_status, e.channel, e.created_at
      FROM lifecycle_events e
      WHERE EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower($1)
        AND e.user_id IN (u.id, u.active_profile_id))
      ORDER BY e.created_at DESC LIMIT 20`, [email]);
    console.log(JSON.stringify({
      runtime: runtimeIdentity(), checkedAt: new Date().toISOString(),
      accounts: accounts.rows, memberships: memberships.rows,
      lifecycle: lifecycle.rows, audit: audit.rows,
      note: "Read-only snapshot, not an entitlement decision. Compare the same runtime and profile before changing access. Missing audit does not establish historical cause.",
    }, null, 2));
  } catch {
    console.error("Account diagnostic failed. Check database connectivity and schema; no account changes were made.");
    process.exitCode = 1;
  } finally {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    }
  }
}
await pool.end();
