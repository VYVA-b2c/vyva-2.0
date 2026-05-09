/**
 * db-sync.mjs — Non-interactive database schema synchronisation
 *
 * Two-phase approach:
 *
 * Phase 1 – Bootstrap (first run only)
 *   When the migration tracking table does not yet exist, the database was
 *   previously managed with `db:push`.  We apply every migration file with
 *   strict error handling: only "already exists" / duplicate-object errors are
 *   silently ignored (they are expected when re-applying idempotent SQL).
 *   Any other error causes the migration NOT to be marked as applied, so the
 *   problem is surfaced on the next run.
 *
 * Phase 2 – Drift detection (every run)
 *   After the tracking table is initialised, `drizzle-kit generate` compares
 *   `shared/schema.ts` against the current migration state and creates a new
 *   migration file for any columns / tables that were added to the schema
 *   without a corresponding migration.  `drizzle-kit migrate` then applies
 *   every untracked migration using its own tracking table – no custom SQL
 *   runner is used for new migrations.
 */

import "dotenv/config";
import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function hashMigration(sql) {
  return crypto.createHash("sha256").update(sql).digest("hex");
}

function splitMigration(sql) {
  if (sql.includes("--> statement-breakpoint")) {
    return sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [sql.trim()];
}

function isIdempotentError(message) {
  const lower = message.toLowerCase();
  return (
    lower.includes("already exists") ||
    lower.includes("duplicate_object") ||
    lower.includes("duplicate key value violates unique constraint")
  );
}

async function trackingTableExists(client) {
  const { rows } = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'drizzle'
    AND table_name = '__drizzle_migrations'
  `);
  return rows.length > 0;
}

async function ensureTrackingTable(client) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS drizzle;
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id       SERIAL  PRIMARY KEY,
      hash     TEXT    NOT NULL UNIQUE,
      created_at BIGINT
    );
  `);
}

async function getAppliedHashes(client) {
  const { rows } = await client.query(
    "SELECT hash FROM drizzle.__drizzle_migrations"
  );
  return new Set(rows.map((r) => r.hash));
}

async function markApplied(client, hash) {
  await client.query(
    `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
     VALUES ($1, $2)
     ON CONFLICT (hash) DO NOTHING`,
    [hash, Date.now()]
  );
}

/**
 * Bootstrap phase: apply a migration that was previously run via db:push and
 * has no tracking record.  Only idempotent errors are ignored; any unexpected
 * error prevents the migration from being marked as applied.
 */
async function bootstrapMigration(client, sql, filename) {
  const chunks = splitMigration(sql);
  let hasUnexpectedError = false;

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    try {
      await client.query(trimmed);
    } catch (err) {
      if (isIdempotentError(err.message)) {
        // Expected: the statement was already applied via db:push
      } else {
        // Unexpected: surface it clearly but continue with other chunks so
        // we can apply as much as possible.  The migration will NOT be marked
        // as applied so the issue is retried on the next run.
        console.error(
          `  ERROR [bootstrap] ${filename}: ${err.message.split("\n")[0]}`
        );
        hasUnexpectedError = true;
      }
    }
  }

  return !hasUnexpectedError;
}

async function runBootstrap(client) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(
    `Bootstrap: initialising tracking from ${files.length} existing migration files...`
  );

  let ok = 0;
  let warned = 0;

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = readFileSync(filePath, "utf-8");
    const hash = hashMigration(sql);

    const success = await bootstrapMigration(client, sql, file);
    if (success) {
      await markApplied(client, hash);
      ok++;
    } else {
      // Migration had unexpected errors: do NOT mark as applied so it is
      // retried on the next run.  Errors were already logged above.
      warned++;
    }
  }

  console.log(
    `Bootstrap complete: ${ok} clean, ${warned} with pre-existing warnings.`
  );
}

async function detectAndApplyDrift() {
  const beforeFiles = new Set(
    readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"))
  );

  console.log("Running drizzle-kit generate to detect schema drift...");
  try {
    execSync(
      `npx drizzle-kit generate --name=auto-sync-${Date.now()}`,
      { stdio: "pipe" }
    );
  } catch (err) {
    const stderr = err.stderr?.toString() || "";
    const stdout = err.stdout?.toString() || "";
    const combined = (stderr + stdout).toLowerCase();
    // drizzle-kit exits 0 for "no changes"; any non-zero exit is a real failure
    if (!combined.includes("no schema changes") && !combined.includes("nothing to migrate")) {
      console.error("  drizzle-kit generate FAILED:", (stderr || err.message).split("\n")[0]);
      throw new Error("drizzle-kit generate failed. See error above.");
    }
  }

  const afterFiles = readdirSync(MIGRATIONS_DIR).filter((f) =>
    f.endsWith(".sql")
  );
  const newFiles = afterFiles.filter((f) => !beforeFiles.has(f));

  if (newFiles.length === 0) {
    console.log("  No schema drift detected.");
    return;
  }

  console.log(
    `  Generated ${newFiles.length} migration file(s). Running drizzle-kit migrate...`
  );

  try {
    const output = execSync("npx drizzle-kit migrate", { stdio: "pipe" });
    console.log("  drizzle-kit migrate:", output.toString().trim() || "done");
  } catch (err) {
    const stderr = err.stderr?.toString() || err.message || "";
    console.error("  drizzle-kit migrate FAILED:", stderr.split("\n")[0]);
    throw new Error("Schema drift migration failed. See error above.");
  }
}

const client = await pool.connect();
try {
  const needsBootstrap = !(await trackingTableExists(client));
  await ensureTrackingTable(client);

  if (needsBootstrap) {
    await runBootstrap(client);
  } else {
    const count = (await getAppliedHashes(client)).size;
    console.log(`Tracking table up to date (${count} migrations recorded).`);
  }

  client.release();
  await pool.end();

  // Phase 2: detect schema.ts drift and apply via drizzle-kit migrate
  await detectAndApplyDrift();

  console.log("\nSchema sync complete!");
} catch (err) {
  console.error("\nSchema sync FAILED:", err.message);
  try {
    client.release();
  } catch (_) {}
  await pool.end();
  process.exit(1);
}
