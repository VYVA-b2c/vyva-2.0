// Read-only export of Cognitive Compass item-bank content for human review.
// Run from the Replit Shell (needs the injected DATABASE_URL):
//   node scripts/export-cc-content-audit.mjs en
// Writes docs/audits/cc-content-export-<lang>.json and prints automated checks.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const language = (process.argv[2] ?? "en").toLowerCase();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run this from the Replit Shell.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("begin read only");

  const provenance = await client.query(`
    select task_definition_id, language, source, is_active, rejected,
           (reviewed_at is not null) as has_reviewed_at,
           coalesce(reviewed_by, '(null)') as reviewed_by,
           count(*)::int as rows
    from public.cc_item_bank
    group by 1,2,3,4,5,6,7
    order by 1,2,3,4,5,6,7
  `);

  const items = await client.query(`
    select id::text, task_definition_id, difficulty_tier, source, is_active,
           reviewed_at, reviewed_by, item_family_id, content, created_at
    from public.cc_item_bank
    where language = $1
    order by task_definition_id, difficulty_tier, created_at
  `, [language]);

  const forms = await client.query(`
    select task_definition_id, form_number, content
    from public.cc_rotation_forms
    where language = $1
    order by task_definition_id, form_number
  `, [language]);

  const definitions = await client.query(`
    select id, display_order, content_source, content_static, scoring_config, supports_voice
    from public.cc_task_definitions
    order by display_order
  `);

  const exposure = await client.query(`
    select r.task_definition_id, count(*)::int as responses,
           count(distinct r.item_bank_id)::int as distinct_items
    from public.cc_task_responses r
    group by 1 order by 1
  `);

  await client.query("rollback");

  const stories = items.rows.filter((row) => row.task_definition_id === "story_recall_immediate");
  const similarities = items.rows.filter((row) => row.task_definition_id === "similarities");

  const tally = (values) => Object.entries(values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  const firstWords = (text, n) => String(text ?? "").trim().split(/\s+/).slice(0, n).join(" ").toLowerCase();
  const leadingName = (text) => (String(text ?? "").match(/^[A-Z][a-z]+/) ?? [""])[0];
  const pairKey = (pair) => [...(pair ?? [])].map((word) => String(word).toLowerCase().trim()).sort().join(" + ");

  const checks = {
    stories: {
      count: stories.length,
      opening_three_words_top: tally(stories.map((row) => firstWords(row.content?.body, 3))).slice(0, 15),
      leading_names_top: tally(stories.map((row) => leadingName(row.content?.body))).slice(0, 20),
      duplicate_titles: tally(stories.map((row) => String(row.content?.title ?? "").toLowerCase())).filter(([, n]) => n > 1),
      word_count_range: [
        Math.min(...stories.map((row) => Number(row.content?.word_count ?? 0))),
        Math.max(...stories.map((row) => Number(row.content?.word_count ?? 0))),
      ],
      idea_unit_counts: tally(stories.map((row) => (row.content?.idea_units ?? []).length)),
      tiers: tally(stories.map((row) => row.difficulty_tier)),
    },
    similarities: {
      count: similarities.length,
      tiers: tally(similarities.map((row) => row.difficulty_tier)),
      duplicate_pairs: tally(similarities.map((row) => pairKey(row.content?.pair))).filter(([, n]) => n > 1),
      repeated_words: tally(similarities.flatMap((row) => (row.content?.pair ?? []).map((word) => String(word).toLowerCase()))).filter(([, n]) => n > 1),
    },
  };

  const outDir = path.resolve("docs/audits");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `cc-content-export-${language}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    exported_at: new Date().toISOString(),
    language,
    provenance: provenance.rows,
    exposure: exposure.rows,
    checks,
    task_definitions: definitions.rows,
    rotation_forms: forms.rows,
    items: items.rows,
  }, null, 2));

  console.log("Provenance (all languages):");
  console.table(provenance.rows);
  console.log("Automated checks:");
  console.log(JSON.stringify(checks, null, 2));
  console.log(`\nWrote ${outFile} (${items.rows.length} item rows). Commit it or paste it back for the item-level review.`);
} finally {
  await client.end();
}
