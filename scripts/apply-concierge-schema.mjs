import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const layerOneSql = await readFile(new URL("../schema/concierge_layer1.sql", import.meta.url), "utf8");
const shoppingSql = await readFile(new URL("../schema/concierge_shopping.sql", import.meta.url), "utf8");

function stripSupabaseRls(input) {
  return input
    .replace(/ALTER TABLE user_providers\s+ENABLE ROW LEVEL SECURITY;\n?/g, "")
    .replace(/ALTER TABLE concierge_pending\s+ENABLE ROW LEVEL SECURITY;\n?/g, "")
    .replace(/ALTER TABLE concierge_sessions\s+ENABLE ROW LEVEL SECURITY;\n?/g, "")
    .replace(/ALTER TABLE concierge_reminders\s+ENABLE ROW LEVEL SECURITY;\n?/g, "")
    .replace(/CREATE POLICY "user_own_providers"[\s\S]*?USING \(auth\.uid\(\)::text = user_id\);\n?/g, "")
    .replace(/CREATE POLICY "user_own_pending"[\s\S]*?USING \(auth\.uid\(\)::text = user_id\);\n?/g, "")
    .replace(/CREATE POLICY "user_own_sessions"[\s\S]*?USING \(auth\.uid\(\)::text = user_id\);\n?/g, "")
    .replace(/CREATE POLICY "user_own_reminders"[\s\S]*?USING \(auth\.uid\(\)::text = user_id\);\n?/g, "");
}

try {
  await client.connect();
  try {
    await client.query(layerOneSql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('schema "auth" does not exist')) throw error;

    await client.query(stripSupabaseRls(layerOneSql));
    console.log("Applied concierge layer without Supabase RLS policies because the local database has no auth schema.");
  }
  await client.query(shoppingSql);
  console.log("Concierge schema applied successfully.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Failed to apply concierge schema.");
  console.error(message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
