#!/usr/bin/env node
<<<<<<< HEAD

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN !== "false";

const VALID_HOOK_CATEGORIES = new Set([
  "nature",
  "animals",
  "body",
  "weather",
  "food",
  "history",
  "everyday_objects",
  "science",
]);

const VALID_PROMPT_TYPES = new Set(["alternate_uses", "what_if", "connections"]);
const VALID_SOURCES = new Set(["ai_generated", "human_written"]);

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}
=======
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN !== "false";

const VALID_HOOK_CATEGORIES = new Set(["nature","animals","body","weather","food","history","everyday_objects","science"]);
const VALID_PROMPT_TYPES = new Set(["alternate_uses","what_if","connections"]);
const VALID_SOURCES = new Set(["ai_generated","human_written"]);
>>>>>>> f360d79 (Add Curious Minds Spanish import files)

function cleanText(value) {
  return String(value || "").trim();
}

function assertValidLanguage(language) {
  const value = cleanText(language);
<<<<<<< HEAD
  if (!["es", "de", "en"].includes(value)) {
    throw new Error(`Unsupported language "${language}". Expected es, de, or en.`);
  }
=======
  if (!["es", "de", "en"].includes(value)) throw new Error(`Unsupported language "${language}".`);
>>>>>>> f360d79 (Add Curious Minds Spanish import files)
  return value;
}

function normalizeHook(item, index) {
  const category = cleanText(item.category);
<<<<<<< HEAD
  if (!VALID_HOOK_CATEGORIES.has(category)) {
    throw new Error(`hooks[${index}] has invalid category "${item.category}".`);
  }

=======
  if (!VALID_HOOK_CATEGORIES.has(category)) throw new Error(`hooks[${index}] invalid category "${item.category}".`);
>>>>>>> f360d79 (Add Curious Minds Spanish import files)
  const row = {
    fact_prompt: cleanText(item.fact_prompt),
    fact_answer: cleanText(item.fact_answer),
    category,
    language: assertValidLanguage(item.language),
    source: VALID_SOURCES.has(item.source) ? item.source : "ai_generated",
    is_active: false,
  };
<<<<<<< HEAD

  if (!row.fact_prompt || !row.fact_answer) {
    throw new Error(`hooks[${index}] needs fact_prompt and fact_answer.`);
  }

=======
  if (!row.fact_prompt || !row.fact_answer) throw new Error(`hooks[${index}] needs fact_prompt and fact_answer.`);
>>>>>>> f360d79 (Add Curious Minds Spanish import files)
  return row;
}

function normalizePrompt(item, index) {
<<<<<<< HEAD
  const promptType = cleanText(item.prompt_type);
  if (!VALID_PROMPT_TYPES.has(promptType)) {
    throw new Error(`prompts[${index}] has invalid prompt_type "${item.prompt_type}".`);
  }

  const row = {
    prompt_type: promptType,
=======
  const prompt_type = cleanText(item.prompt_type);
  if (!VALID_PROMPT_TYPES.has(prompt_type)) throw new Error(`prompts[${index}] invalid prompt_type "${item.prompt_type}".`);
  const row = {
    prompt_type,
>>>>>>> f360d79 (Add Curious Minds Spanish import files)
    prompt_text: cleanText(item.prompt_text),
    topic: cleanText(item.topic),
    language: assertValidLanguage(item.language),
    source: VALID_SOURCES.has(item.source) ? item.source : "ai_generated",
    is_active: false,
  };
<<<<<<< HEAD

  if (!row.prompt_text || !row.topic) {
    throw new Error(`prompts[${index}] needs prompt_text and topic.`);
  }

=======
  if (!row.prompt_text || !row.topic) throw new Error(`prompts[${index}] needs prompt_text and topic.`);
>>>>>>> f360d79 (Add Curious Minds Spanish import files)
  return row;
}

async function insertRows(table, rows) {
  if (!rows.length) return;
  if (DRY_RUN) {
    console.log(`[dry-run] ${table}: ${rows.length} rows`);
    console.log(JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }
<<<<<<< HEAD

=======
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
>>>>>>> f360d79 (Add Curious Minds Spanish import files)
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
<<<<<<< HEAD

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase insert failed for ${table}: ${response.status} ${text}`);
  }
=======
  if (!response.ok) throw new Error(`Supabase insert failed for ${table}: ${response.status} ${await response.text()}`);
>>>>>>> f360d79 (Add Curious Minds Spanish import files)
}

async function main() {
  const inputPath = process.argv[2];
<<<<<<< HEAD
  if (!inputPath) {
    throw new Error("Usage: node scripts/import-curious-minds-content.js <content-json-file>");
  }

  if (!DRY_RUN) {
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
  }

  const filePath = resolve(process.cwd(), inputPath);
  const parsed = JSON.parse(await readFile(filePath, "utf8"));
  const hooks = Array.isArray(parsed.hooks) ? parsed.hooks.map(normalizeHook) : [];
  const prompts = Array.isArray(parsed.prompts) ? parsed.prompts.map(normalizePrompt) : [];

  await insertRows("curious_minds_hooks", hooks);
  await insertRows("curious_minds_prompts", prompts);

=======
  if (!inputPath) throw new Error("Usage: node scripts/import-curious-minds-content.js <content-json-file>");
  const parsed = JSON.parse(await readFile(resolve(process.cwd(), inputPath), "utf8"));
  const hooks = Array.isArray(parsed.hooks) ? parsed.hooks.map(normalizeHook) : [];
  const prompts = Array.isArray(parsed.prompts) ? parsed.prompts.map(normalizePrompt) : [];
  await insertRows("curious_minds_hooks", hooks);
  await insertRows("curious_minds_prompts", prompts);
>>>>>>> f360d79 (Add Curious Minds Spanish import files)
  console.log(`Curious Minds draft import complete. Hooks: ${hooks.length}. Prompts: ${prompts.length}.`);
  console.log("Rows remain inactive until approved in /admin/curious-minds.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
