import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const migrationPath = path.join(repoRoot, "migrations", "0049_lifecycle_contact_cleanup.sql");
const migrationSql = readFileSync(migrationPath, "utf8");
const emailPhoneWhere = "btrim(phone) ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'";

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  const before = await client.query(
    `select count(*)::int as count from public.user_intakes where ${emailPhoneWhere}`,
  );

  await client.query("begin");
  await client.query(migrationSql);
  await client.query("commit");

  const after = await client.query(
    `select count(*)::int as count from public.user_intakes where ${emailPhoneWhere}`,
  );

  console.log(
    `Lifecycle contact cleanup complete: ${before.rows[0].count} before, ${after.rows[0].count} after.`,
  );
} catch (error) {
  try {
    await client.query("rollback");
  } catch (_) {
    // The original error is more useful.
  }
  console.error(
    `Lifecycle contact cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
