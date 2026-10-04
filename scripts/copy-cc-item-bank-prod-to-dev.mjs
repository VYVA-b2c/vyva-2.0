// Copy cc_item_bank from Production to Development, fixing provenance on the way.
//
// Production is opened read-only (session default + READ ONLY transaction, verified).
// Only Development (DATABASE_URL) is written. Dry run by default: every Development
// change runs inside a transaction that is rolled back unless --apply is passed.
//
// Run from the Replit Shell, with the Production connection string stored as the
// Secret PROD_DATABASE_URL (DATABASE_URL is the workspace's Development database):
//   node scripts/copy-cc-item-bank-prod-to-dev.mjs            # dry run, prints the plan
//   node scripts/copy-cc-item-bank-prod-to-dev.mjs --apply    # commits to Development
//
// Steps (all in one Development transaction):
//   1. Collapse duplicate fluency rows in Development (same task + language + content),
//      repointing any cc_task_responses to the kept row.
//   2. Upsert every Production row by id. Story/similarity rows labelled 'human_written'
//      came from the admin bulk upload with "Skip admin review" (the only writer of that
//      label) and are LLM-generated: relabel to 'ai_generated', clear reviewed_at/by.
//      is_active is copied as-is so the runner keeps working.
//   3. Development rows that are not in Production but match a Production row on
//      task + language + content are folded into it (responses repointed, row deleted).
//   4. Report provenance in Development.
import "dotenv/config";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const UPLOAD_TASKS = ["story_recall_immediate", "similarities"];
const FLUENCY_TASKS = ["fluency_semantic", "fluency_phonemic"];

function fail(message) {
  console.error(`ABORT: ${message}`);
  process.exit(1);
}

const sourceUrl = process.env.PROD_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;

if (process.env.REPLIT_DEPLOYMENT) fail("running inside a deployment. Run from the workspace Shell.");
if (!sourceUrl) fail("PROD_DATABASE_URL is not set. Add the Production connection string as a Secret.");
if (!targetUrl) fail("DATABASE_URL (Development) is not set.");

function endpoint(url) {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port || "5432"}/${parsed.pathname.replace(/^\//, "")}`;
}
if (endpoint(sourceUrl) === endpoint(targetUrl)) fail("PROD_DATABASE_URL and DATABASE_URL point at the same database.");

const source = new pg.Client({
  connectionString: sourceUrl,
  options: "-c default_transaction_read_only=on",
});
const target = new pg.Client({ connectionString: targetUrl });

// Cluster system identifier + database name. Null when the role cannot read
// pg_control_system(); the URL check above is then the only same-database guard.
async function serverIdentity(client) {
  const db = (await client.query("select current_database() as db")).rows[0].db;
  try {
    const { rows } = await client.query("select system_identifier::text as id from pg_control_system()");
    return `${rows[0].id}/${db}`;
  } catch {
    return null;
  }
}

async function columnsOf(client) {
  const { rows } = await client.query(`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'cc_item_bank'
    order by ordinal_position
  `);
  return rows.map((row) => row.column_name);
}

async function provenance(client) {
  const { rows } = await client.query(`
    select task_definition_id as task, language, source, is_active,
           (reviewed_at is not null) as reviewed, count(*)::int as rows
    from public.cc_item_bank
    group by 1,2,3,4,5 order by 1,2,3,4,5
  `);
  return rows;
}

// Repoint responses from each duplicate row to its keeper, then delete the duplicates.
async function foldRows(pairs) {
  if (pairs.length === 0) return { repointed: 0, deleted: 0 };
  const dupIds = pairs.map((pair) => pair.dup_id);
  const keepIds = pairs.map((pair) => pair.keep_id);
  const repointed = await target.query(`
    update public.cc_task_responses r
    set item_bank_id = m.keep_id
    from unnest($1::uuid[], $2::uuid[]) as m(dup_id, keep_id)
    where r.item_bank_id = m.dup_id
  `, [dupIds, keepIds]);
  const deleted = await target.query("delete from public.cc_item_bank where id = any($1::uuid[])", [dupIds]);
  return { repointed: repointed.rowCount, deleted: deleted.rowCount };
}

await source.connect();
await target.connect();

try {
  const [sourceId, targetId] = await Promise.all([serverIdentity(source), serverIdentity(target)]);
  if (sourceId && sourceId === targetId) fail(`both connections reach ${sourceId}.`);

  // ---- Production: read-only ----
  await source.query("begin transaction read only");
  const readOnly = await source.query("show transaction_read_only");
  if (readOnly.rows[0].transaction_read_only !== "on") fail("could not put the Production session into read-only mode.");
  const sourceColumns = await columnsOf(source);
  const sourceRows = (await source.query("select * from public.cc_item_bank order by created_at, id")).rows;
  const sourceProvenance = await provenance(source);
  await source.query("rollback");

  if (sourceRows.length === 0) fail("Production cc_item_bank is empty. Nothing copied.");

  // ---- Development: single transaction ----
  await target.query("begin");
  const targetColumns = await columnsOf(target);
  const columns = sourceColumns.filter((column) => targetColumns.includes(column));
  const droppedColumns = sourceColumns.filter((column) => !targetColumns.includes(column));
  if (!columns.includes("id")) fail("cc_item_bank has no id column in one of the databases.");

  const definitions = (await target.query("select id from public.cc_task_definitions")).rows.map((row) => row.id);
  const missingDefinitions = [...new Set(sourceRows.map((row) => row.task_definition_id))]
    .filter((id) => !definitions.includes(id));
  if (missingDefinitions.length) fail(`Development is missing task definitions: ${missingDefinitions.join(", ")}. Run migrations on Development first.`);

  const beforeCount = (await target.query("select count(*)::int as n from public.cc_item_bank")).rows[0].n;

  // 1. Collapse duplicate fluency rows already in Development.
  const fluencyDuplicates = (await target.query(`
    with ranked as (
      select b.id,
             first_value(b.id) over w as keep_id,
             row_number() over w as rn
      from public.cc_item_bank b
      where b.task_definition_id = any($1::text[])
      window w as (
        partition by b.task_definition_id, b.language, b.content
        order by exists (select 1 from public.cc_task_responses r where r.item_bank_id = b.id) desc,
                 b.created_at asc nulls last, b.id
      )
    )
    select id as dup_id, keep_id from ranked where rn > 1
  `, [FLUENCY_TASKS])).rows;
  const fluencyResult = await foldRows(fluencyDuplicates);

  // 2. Upsert Production rows with corrected provenance.
  const reviewerTally = {};
  let relabelled = 0;
  const rows = sourceRows.map((row) => {
    const copy = Object.fromEntries(columns.map((column) => [column, row[column]]));
    if (UPLOAD_TASKS.includes(row.task_definition_id) && row.source === "human_written") {
      const reviewer = row.reviewed_by ?? "(null)";
      reviewerTally[reviewer] = (reviewerTally[reviewer] ?? 0) + 1;
      copy.source = "ai_generated";
      if ("reviewed_at" in copy) copy.reviewed_at = null;
      if ("reviewed_by" in copy) copy.reviewed_by = null;
      relabelled += 1;
    }
    return copy;
  });

  const columnList = columns.map((column) => `"${column}"`).join(", ");
  const updateList = columns.filter((column) => column !== "id").map((column) => `"${column}" = excluded."${column}"`).join(", ");
  let upserted = 0;
  for (let index = 0; index < rows.length; index += 200) {
    const batch = rows.slice(index, index + 200);
    const result = await target.query(`
      insert into public.cc_item_bank (${columnList})
      select ${columnList} from jsonb_populate_recordset(null::public.cc_item_bank, $1::jsonb)
      on conflict (id) do update set ${updateList}
    `, [JSON.stringify(batch)]);
    upserted += result.rowCount;
  }

  // 3. Fold Development-only rows into their Production equivalents.
  const sourceIds = sourceRows.map((row) => row.id);
  const devOnlyMatches = (await target.query(`
    select d.id as dup_id, min(p.id::text)::uuid as keep_id
    from public.cc_item_bank d
    join public.cc_item_bank p
      on p.task_definition_id = d.task_definition_id
     and p.language = d.language
     and p.content = d.content
     and p.id = any($1::uuid[])
    where not (d.id = any($1::uuid[]))
    group by d.id
  `, [sourceIds])).rows;
  const devOnlyResult = await foldRows(devOnlyMatches);
  const unmatchedDevOnly = (await target.query(`
    select id::text, task_definition_id, language,
           exists (select 1 from public.cc_task_responses r where r.item_bank_id = b.id) as referenced
    from public.cc_item_bank b
    where not (b.id = any($1::uuid[]))
  `, [sourceIds])).rows;

  // 4. Report.
  const afterCount = (await target.query("select count(*)::int as n from public.cc_item_bank")).rows[0].n;
  const honesty = (await target.query(`
    select
      count(*)::int as total,
      count(*) filter (where task_definition_id = any($1::text[]) and source = 'human_written')::int as upload_rows_still_human_written,
      count(*) filter (where task_definition_id = any($1::text[]) and source = 'ai_generated' and reviewed_at is null)::int as upload_rows_ai_generated_unreviewed,
      count(*) filter (where reviewed_at is not null)::int as rows_marked_reviewed,
      count(*) filter (where reviewed_by = 'seed')::int as seed_rows,
      count(*) filter (where is_active)::int as active
    from public.cc_item_bank
  `, [UPLOAD_TASKS])).rows[0];
  const targetProvenance = await provenance(target);

  console.log(`Production ${endpoint(sourceUrl)} (read-only) -> Development ${endpoint(targetUrl)}`);
  if (droppedColumns.length) console.log(`Columns only in Production, not copied: ${droppedColumns.join(", ")}`);
  console.log("\nProduction provenance (unchanged):");
  console.table(sourceProvenance);
  console.log("\nSummary:");
  console.table({
    "Development rows before": beforeCount,
    "Duplicate fluency rows removed": fluencyResult.deleted,
    "Responses repointed (fluency dedupe)": fluencyResult.repointed,
    "Production rows upserted": upserted,
    "Relabelled human_written -> ai_generated": relabelled,
    "Dev-only rows folded into Production equivalents": devOnlyResult.deleted,
    "Responses repointed (fold)": devOnlyResult.repointed,
    "Dev-only rows kept (no Production equivalent)": unmatchedDevOnly.length,
    "Development rows after": afterCount,
  });
  if (Object.keys(reviewerTally).length) {
    console.log("\nreviewed_by values cleared on relabelled rows:");
    console.table(reviewerTally);
  }
  if (unmatchedDevOnly.length) {
    console.log("\nDev-only rows left in place:");
    console.table(unmatchedDevOnly);
  }
  console.log("\nDevelopment provenance after copy:");
  console.table(targetProvenance);
  console.log("\nProvenance check:");
  console.table(honesty);

  if (APPLY) {
    await target.query("commit");
    console.log("\nCOMMITTED to Development. Next: node scripts/export-cc-content-audit.mjs en");
  } else {
    await target.query("rollback");
    console.log("\nDRY RUN: Development rolled back. Re-run with --apply to commit.");
  }
} catch (error) {
  await target.query("rollback").catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await source.end();
  await target.end();
}
