import fs from "node:fs";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing.");
}

const data = JSON.parse(fs.readFileSync("scripts/curious-minds-es-draft-current.json", "utf8"));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

try {
  await client.query("begin");

  const schema = [
    "create extension if not exists pgcrypto",
    "create table if not exists curious_minds_hooks (id uuid primary key default gen_random_uuid(), fact_prompt text not null, fact_answer text not null, category text not null check (category in ('nature','animals','body','weather','food','history','everyday_objects','science')), language text not null default 'es', source text not null default 'ai_generated' check (source in ('ai_generated','human_written')), reviewed_at timestamptz, reviewed_by text, is_active boolean not null default false, created_at timestamptz default now())",
    "create table if not exists curious_minds_prompts (id uuid primary key default gen_random_uuid(), prompt_type text not null check (prompt_type in ('alternate_uses','what_if','connections')), prompt_text text not null, topic text not null, language text not null default 'es', source text not null default 'ai_generated' check (source in ('ai_generated','human_written')), reviewed_at timestamptz, reviewed_by text, is_active boolean not null default false, created_at timestamptz default now())",
    "create table if not exists curious_minds_sessions (id uuid primary key default gen_random_uuid(), user_id text not null, played_at timestamptz default now(), hook_id uuid references curious_minds_hooks(id), hook_guess_text text, hook_guess_input_method text check (hook_guess_input_method in ('voice','typed')), prompt_id uuid references curious_minds_prompts(id), ideas_generated jsonb not null default '[]'::jsonb, ideas_count integer not null default 0, callback_attempted boolean not null default false, callback_response_text text, callback_input_method text check (callback_input_method in ('voice','typed')), completed boolean not null default false, abandoned boolean not null default false, duration_seconds integer)",
    "create table if not exists curious_minds_user_state (user_id text primary key, total_sessions integer not null default 0, last_played_at timestamptz, streak_days integer not null default 0, last_streak_date date, updated_at timestamptz default now())",
    "create index if not exists curious_minds_sessions_user_played_idx on curious_minds_sessions (user_id, played_at desc)",
    "create index if not exists curious_minds_hooks_language_active_idx on curious_minds_hooks (language, is_active)",
    "create index if not exists curious_minds_prompts_language_active_idx on curious_minds_prompts (language, is_active)"
  ];

  for (const sql of schema) {
    await client.query(sql);
  }

  let hooksInserted = 0;
  for (const h of data.hooks || []) {
    const result = await client.query(
      "insert into curious_minds_hooks (fact_prompt, fact_answer, category, language, source, is_active) select $1,$2,$3,$4,$5,false where not exists (select 1 from curious_minds_hooks where fact_prompt = $1 and language = $4)",
      [h.fact_prompt, h.fact_answer, h.category, h.language, h.source || "ai_generated"]
    );
    hooksInserted += result.rowCount;
  }

  let promptsInserted = 0;
  for (const p of data.prompts || []) {
    const result = await client.query(
      "insert into curious_minds_prompts (prompt_type, prompt_text, topic, language, source, is_active) select $1,$2,$3,$4,$5,false where not exists (select 1 from curious_minds_prompts where prompt_text = $2 and language = $4)",
      [p.prompt_type, p.prompt_text, p.topic, p.language, p.source || "ai_generated"]
    );
    promptsInserted += result.rowCount;
  }

  await client.query("commit");

  console.log(`Inserted ${hooksInserted} new hooks and ${promptsInserted} new prompts.`);

  const hooks = await client.query("select language, is_active, count(*)::int as count from curious_minds_hooks group by language, is_active order by language, is_active");
  const prompts = await client.query("select language, is_active, prompt_type, count(*)::int as count from curious_minds_prompts group by language, is_active, prompt_type order by language, is_active, prompt_type");

  console.log("hooks");
  console.table(hooks.rows);
  console.log("prompts");
  console.table(prompts.rows);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
