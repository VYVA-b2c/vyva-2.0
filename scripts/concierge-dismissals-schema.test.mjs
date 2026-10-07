import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("./apply-concierge-dismissals-schema.mjs", import.meta.url), "utf8");
const sql = readFileSync(new URL("../migrations/0104_concierge_reminder_dismissals.sql", import.meta.url), "utf8");
async function run(fail = false) {
  const queries = [];
  let closed = false;
  class Client {
    async connect() {}
    async end() { closed = true; }
    async query(value) {
      queries.push(value);
      if (fail && value.includes("limit 0")) throw new Error("missing column");
    }
  }
  const executable = source.replace(/^import .*;\r?\n/gm, "").replace("import.meta.url", '"file:///test/scripts/setup.mjs"');
  let error;
  try {
    await vm.runInNewContext(`(async () => { ${executable} })()`, {
      pg: { Client }, URL, readFileSync: () => sql,
      process: { env: { DATABASE_URL: "unused" } }, console: { log() {} },
    });
  } catch (caught) { error = caught; }
  return { queries, closed, error };
}
test("development startup ensures the same non-destructive reminder table as production", async () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts["predev:replit"], "npm run db:concierge-dismissals");
  assert.match(sql, /create table if not exists/i);
  assert.doesNotMatch(sql, /\b(drop|truncate|delete from)\b/i);
  const result = await run();
  assert.equal(result.error, undefined);
  assert.equal(result.queries.at(-1), "commit");
  assert.equal(result.closed, true);
});
test("schema validation failure rolls back and stops startup", async () => {
  const result = await run(true);
  assert.match(result.error.message, /missing column/);
  assert.equal(result.queries.at(-1), "rollback");
  assert.ok(!result.queries.includes("commit"));
  assert.equal(result.closed, true);
});
