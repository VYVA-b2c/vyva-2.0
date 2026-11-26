import pg from "pg";

const { Client } = pg;

const sourceUrl = process.env.SOURCE_DATABASE_URL?.trim();
const targetUrl = process.env.TARGET_DATABASE_URL?.trim();
const schema = process.env.CUTOVER_SCHEMA?.trim() || "public";

if (!sourceUrl || !targetUrl) {
  console.error("Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL before running the cutover comparison.");
  process.exit(2);
}
if (sourceUrl === targetUrl) {
  console.error("SOURCE_DATABASE_URL and TARGET_DATABASE_URL must identify different databases.");
  process.exit(2);
}
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
  console.error("CUTOVER_SCHEMA must be a plain PostgreSQL identifier.");
  process.exit(2);
}

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

async function inspectDatabase(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const tablesResult = await client.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
      [schema],
    );
    const columnsResult = await client.query(
      `SELECT table_name, column_name, ordinal_position, data_type, udt_name, is_nullable
         FROM information_schema.columns
        WHERE table_schema = $1
        ORDER BY table_name, ordinal_position`,
      [schema],
    );

    const counts = new Map();
    for (const { table_name: tableName } of tablesResult.rows) {
      const result = await client.query(
        `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`,
      );
      counts.set(tableName, result.rows[0].count);
    }

    await client.query("COMMIT");
    return {
      tables: tablesResult.rows.map((row) => row.table_name),
      columns: columnsResult.rows,
      counts,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

function columnSignature(column) {
  return [
    column.table_name,
    column.column_name,
    column.ordinal_position,
    column.data_type,
    column.udt_name,
    column.is_nullable,
  ].join("|");
}

const [source, target] = await Promise.all([
  inspectDatabase(sourceUrl),
  inspectDatabase(targetUrl),
]);

const sourceTables = new Set(source.tables);
const targetTables = new Set(target.tables);
const missingTables = source.tables.filter((table) => !targetTables.has(table));
const unexpectedTables = target.tables.filter((table) => !sourceTables.has(table));

const sourceColumns = new Set(source.columns.map(columnSignature));
const targetColumns = new Set(target.columns.map(columnSignature));
const missingColumns = [...sourceColumns].filter((column) => !targetColumns.has(column));
const unexpectedColumns = [...targetColumns].filter((column) => !sourceColumns.has(column));

const countMismatches = source.tables
  .filter((table) => targetTables.has(table))
  .map((table) => ({
    table,
    source: source.counts.get(table),
    target: target.counts.get(table),
  }))
  .filter(({ source: sourceCount, target: targetCount }) => sourceCount !== targetCount);

console.log(`Compared schema ${schema}: ${source.tables.length} source tables, ${target.tables.length} target tables.`);
if (missingTables.length) console.error(`Missing target tables: ${missingTables.join(", ")}`);
if (unexpectedTables.length) console.error(`Unexpected target tables: ${unexpectedTables.join(", ")}`);
if (missingColumns.length) console.error(`Missing target columns: ${missingColumns.join(", ")}`);
if (unexpectedColumns.length) console.error(`Unexpected target columns: ${unexpectedColumns.join(", ")}`);
for (const mismatch of countMismatches) {
  console.error(`${mismatch.table}: source=${mismatch.source}, target=${mismatch.target}`);
}

if (missingTables.length || unexpectedTables.length || missingColumns.length || unexpectedColumns.length || countMismatches.length) {
  console.error("Database cutover comparison failed.");
  process.exitCode = 1;
} else {
  console.log("Database cutover comparison passed: table structure and row counts match.");
}
