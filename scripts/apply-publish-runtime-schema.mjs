import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set; publish runtime schema cannot be applied.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const migrationPath = path.join(
  repoRoot,
  "migrations",
  "0083_replit_publish_runtime_schema.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const requiredTables = [
  "home_fast_help_impressions",
  "home_fast_help_journeys",
  "home_fast_help_journey_events",
  "cross_pillar_execution_attempts",
];

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query("select pg_advisory_lock($1)", [83920083]);
  await client.query("begin");
  await client.query(migrationSql);
  await client.query("commit");

  const verification = await client.query(
    `select
       array_agg(required.name order by required.name)
         filter (where tables.table_name is null) as missing_tables,
       bool_and(
         case when required.name = 'user_providers.is_trusted'
           then columns.column_name is not null
           else true
         end
       ) as provider_column_ready
     from unnest($1::text[]) as required(name)
     left join information_schema.tables as tables
       on required.name = tables.table_name
      and tables.table_schema = 'public'
     left join information_schema.columns as columns
       on required.name = 'user_providers.is_trusted'
      and columns.table_schema = 'public'
      and columns.table_name = 'user_providers'
      and columns.column_name = 'is_trusted'`,
    [[...requiredTables, "user_providers.is_trusted"]],
  );
  const missingTables = (verification.rows[0]?.missing_tables ?? [])
    .filter((name) => name !== "user_providers.is_trusted");
  const providerColumnReady = verification.rows[0]?.provider_column_ready === true;
  if (missingTables.length > 0 || !providerColumnReady) {
    throw new Error(
      `schema verification failed (missing tables: ${missingTables.join(", ") || "none"}; `
      + `user_providers.is_trusted: ${providerColumnReady ? "ready" : "missing"})`,
    );
  }

  console.log("Publish runtime schema ready.");
} catch (error) {
  try {
    await client.query("rollback");
  } catch (_) {
    // Preserve the original migration or verification error.
  }
  console.error(
    `Publish runtime schema failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  try {
    await client.query("select pg_advisory_unlock($1)", [83920083]);
  } catch (_) {
    // Closing the connection releases the lock too.
  }
  await client.end();
}
