import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("./apply-publish-runtime-schema.mjs", import.meta.url), "utf8");
const executable = source.replace(/^import .*;\r?\n/gm, "");

async function run(missingEnrollment = false, missingSnapshot = false) {
  const queries = [];
  const migrations = [];
  const process = { env: { DATABASE_URL: "unused-test-connection" }, exitCode: 0 };
  class Client {
    async connect() {}
    async end() {}
    async query(sql, params) {
      queries.push(sql);
      if (sql.includes("information_schema.tables")) {
        return { rows: params[0].filter((name) => !missingEnrollment || name !== "cc_program_enrollments").map((table_name) => ({ table_name })) };
      }
      if (sql.includes("information_schema.columns")) {
        return { rows: params[0].filter((name) => !missingSnapshot || name !== "triage_reports.vitals_snapshot").map((name) => ({ name })) };
      }
      return { rows: [] };
    }
  }
  // Execute the real orchestration with a fake database; never read local credentials.
  await vm.runInNewContext(`(async () => { ${executable.replace("import.meta.url", '"file:///test/scripts/apply-publish-runtime-schema.mjs"')} })()`, {
    pg: { Client }, process,
    console: { log() {}, error() {} },
    fileURLToPath: () => "/test/scripts/apply-publish-runtime-schema.mjs",
    path: { dirname: () => "/test/scripts", resolve: () => "/test", join: (...parts) => parts.join("/") },
    readFileSync: (path) => { migrations.push(path); return "-- test migration"; },
  });
  return { queries, migrations, process };
}

test("publishes scheduled support before enrollments and verifies before commit", async () => {
  const { queries, migrations, process } = await run();
  assert.match(migrations[0], /0019_scheduled_support.sql$/);
  assert.match(migrations[1], /0060_cognitive_assessment_program_enrollments.sql$/);
  assert.ok(migrations.some((name) => name.endsWith("0085_publish_triage_report_columns.sql")));
  for (const migration of migrations) {
    assert.ok(readFileSync(new URL(`../migrations/${migration.split("/").at(-1)}`, import.meta.url), "utf8").length);
  }
  assert.ok(queries.indexOf("commit") > queries.findIndex((sql) => sql.includes("information_schema.columns")));
  assert.equal(process.exitCode, 0);
});

test("rolls back and fails publishing when the enrollment table is missing", async () => {
  const { queries, process } = await run(true);
  assert.ok(queries.includes("rollback"));
  assert.ok(!queries.includes("commit"));
  assert.equal(process.exitCode, 1);
});

test("rolls back when the Vitals snapshot column is still missing", async () => {
  const { queries, process } = await run(false, true);
  assert.ok(queries.includes("rollback"));
  assert.ok(!queries.includes("commit"));
  assert.equal(process.exitCode, 1);
});
