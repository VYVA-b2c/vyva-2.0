// Copy Care Finder's place data from Development to Production.
//
// Only two tables are touched, both public reference data with no member
// information: care_register_places (REGCESS register, with coordinates) and
// care_health_zone_municipalities (Castilla y León health map). Production gets
// an exact copy of Development's, so it needs no download or geocoding of its own.
//
// Development (DATABASE_URL) is opened read-only. Production (PROD_DATABASE_URL
// Secret) is written in one transaction: both tables are emptied and refilled, so
// readers see the old data until the commit and the new data after it. Dry run by
// default: the transaction is rolled back unless --apply is passed.
//
// Run from the Replit Shell, after the tables exist in Production (publish first):
//   node scripts/copy-care-register-dev-to-prod.mjs            # dry run, prints the plan
//   node scripts/copy-care-register-dev-to-prod.mjs --apply    # commits to Production
import "dotenv/config";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const TABLES = [
  { name: "care_register_places", key: "ccn", minRows: 100_000 },
  { name: "care_health_zone_municipalities", key: "municipality_code, zone_name, centre_name", minRows: 1_000 },
];
const BATCH = 2_000;

function fail(message) {
  console.error(`ABORT: ${message}`);
  process.exit(1);
}

const sourceUrl = process.env.DATABASE_URL;
const targetUrl = process.env.PROD_DATABASE_URL;

if (process.env.REPLIT_DEPLOYMENT) fail("running inside a deployment. Run from the workspace Shell.");
if (!sourceUrl) fail("DATABASE_URL (Development) is not set.");
if (!targetUrl) fail("PROD_DATABASE_URL is not set. Add the Production connection string as a Secret.");

function endpoint(url) {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port || "5432"}/${parsed.pathname.replace(/^\//, "")}`;
}
if (endpoint(sourceUrl) === endpoint(targetUrl)) fail("DATABASE_URL and PROD_DATABASE_URL point at the same database.");

// Dates and timestamps travel as the database wrote them: no time-zone shifts.
for (const oid of [1082, 1114, 1184]) pg.types.setTypeParser(oid, (value) => value);

const source = new pg.Client({ connectionString: sourceUrl, options: "-c default_transaction_read_only=on" });
const target = new pg.Client({ connectionString: targetUrl });

async function columnsOf(client, table) {
  const { rows } = await client.query(
    `select column_name, data_type from information_schema.columns
     where table_schema = 'public' and table_name = $1 order by ordinal_position`,
    [table],
  );
  return rows.map((row) => `${row.column_name}:${row.data_type}`);
}

async function count(client, table) {
  return (await client.query(`select count(*)::int as n from public.${table}`)).rows[0].n;
}

async function summary(client) {
  const { rows } = await client.query(`
    select count(*)::int as places,
           count(*) filter (where withdrawn_at is null)::int as active,
           count(*) filter (where lat is not null)::int as placed,
           max(source_updated_on)::text as register_date
    from public.care_register_places`);
  return rows[0];
}

async function copyTable(table) {
  const sourceRows = await count(source, table.name);
  if (sourceRows < table.minRows) fail(`${table.name}: Development has only ${sourceRows} rows (expected at least ${table.minRows}). Run the import there first.`);
  const before = await count(target, table.name);
  await target.query(`delete from public.${table.name}`);
  let copied = 0;
  // Page through Development in key order so only one batch is in memory.
  let after = null;
  const keyColumns = table.key.split(",").map((column) => column.trim());
  for (;;) {
    const where = after ? `where (${keyColumns.join(", ")}) > (${keyColumns.map((_, index) => `$${index + 1}`).join(", ")})` : "";
    const { rows } = await source.query(
      `select * from public.${table.name} ${where} order by ${table.key} limit ${BATCH}`,
      after ?? [],
    );
    if (rows.length === 0) break;
    await target.query(
      `insert into public.${table.name} select * from json_populate_recordset(null::public.${table.name}, $1::json)`,
      [JSON.stringify(rows)],
    );
    copied += rows.length;
    after = keyColumns.map((column) => rows[rows.length - 1][column]);
    if (copied % 20_000 < BATCH) console.log(`  ${table.name}: ${copied}/${sourceRows}`);
  }
  if (copied !== sourceRows) fail(`${table.name}: copied ${copied} rows but Development has ${sourceRows}.`);
  console.log(`${table.name}: Production ${before} → ${copied} rows.`);
}

async function main() {
  console.log(APPLY ? "APPLY: Production will be changed." : "DRY RUN: nothing will be committed. Pass --apply to write Production.");
  await source.connect();
  await target.connect();
  try {
    for (const table of TABLES) {
      const [from, to] = await Promise.all([columnsOf(source, table.name), columnsOf(target, table.name)]);
      if (to.length === 0) fail(`${table.name} does not exist in Production. Publish the app first so its migrations run.`);
      if (from.join("|") !== to.join("|")) fail(`${table.name} has different columns in Development and Production.\n  Development: ${from.join(", ")}\n  Production:  ${to.join(", ")}`);
    }
    console.log("Development:", await summary(source));
    await target.query("begin");
    for (const table of TABLES) await copyTable(table);
    console.log("Production after copy:", await summary(target));
    if (APPLY) {
      await target.query("commit");
      console.log("Committed.");
    } else {
      await target.query("rollback");
      console.log("Rolled back (dry run).");
    }
  } catch (error) {
    await target.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
