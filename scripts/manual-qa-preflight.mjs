import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const checks = [];

function addCheck(name, status, detail) {
  checks.push({ name, status, detail });
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function checkDatabase() {
  if (!hasValue(process.env.DATABASE_URL)) {
    addCheck(
      "DATABASE_URL",
      "fail",
      "Missing. Create .env from .env.example and point DATABASE_URL at a reachable PostgreSQL database.",
    );
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query("select 1");
    addCheck("Database connection", "pass", "PostgreSQL connection succeeded.");

    const { rows } = await client.query(`
      select
        to_regclass('public.users') as users_table,
        to_regclass('public.profiles') as profiles_table
    `);
    const row = rows[0] ?? {};
    addCheck(
      "Auth tables",
      row.users_table && row.profiles_table ? "pass" : "fail",
      row.users_table && row.profiles_table
        ? "users and profiles tables exist."
        : "Missing users and/or profiles table; run reviewed migrations before QA.",
    );
  } catch (error) {
    addCheck(
      "Database connection",
      "fail",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

function checkLocalFiles() {
  const envFileExists = existsSync(resolve(repoRoot, ".env"));
  const databaseUrlInjected = hasValue(process.env.DATABASE_URL);

  addCheck(
    "Environment source",
    envFileExists || databaseUrlInjected ? "pass" : "fail",
    envFileExists
      ? ".env exists."
      : databaseUrlInjected
        ? "DATABASE_URL is available from the runtime environment, such as Replit Secrets."
        : "No .env file or injected DATABASE_URL found in this process.",
  );
}

function checkQaAccounts() {
  addCheck(
    "Senior QA account",
    hasValue(process.env.QA_USER_EMAIL) || hasValue(process.env.QA_USER_ID) ? "pass" : "needs_review",
    "Set QA_USER_EMAIL/QA_USER_PASSWORD or QA_USER_ID so the manual pass uses a known senior profile.",
  );
  addCheck(
    "Admin QA account",
    hasValue(process.env.QA_ADMIN_EMAIL) ? "pass" : "needs_review",
    "Set QA_ADMIN_EMAIL/QA_ADMIN_PASSWORD so /admin/workflows can record runner status.",
  );
}

function printSummary() {
  const failCount = checks.filter((check) => check.status === "fail").length;
  const reviewCount = checks.filter((check) => check.status === "needs_review").length;

  for (const check of checks) {
    const icon = check.status === "pass" ? "OK" : check.status === "fail" ? "FAIL" : "REVIEW";
    console.log(`${icon} ${check.name}: ${check.detail}`);
  }

  console.log("");
  console.log(`Manual QA preflight: ${failCount} failed, ${reviewCount} needs review.`);

  if (failCount > 0) process.exitCode = 1;
}

checkLocalFiles();
checkQaAccounts();
await checkDatabase();
printSummary();
