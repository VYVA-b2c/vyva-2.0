import type { Request, Response } from "express";
import { pool } from "../db.js";

export const DB_HEALTH_REQUIRED_TABLES = [
  "users",
  "profiles",
  "profile_memberships",
  "user_medications",
  "medication_adherence",
  "checkin_sessions",
  "checkin_trend_state",
  "voice_timeline_events",
  "voice_qa_session_reviews",
  "curious_minds_sessions",
  "curious_minds_hooks",
  "curious_minds_prompts",
  "curious_minds_user_state",
  "cognitive_session_index",
  "cognitive_daily_plans",
  "cognitive_daily_plan_items",
  "cognitive_daily_plan_events",
  "category_sort_cards",
  "category_sort_sequences",
  "category_sort_sessions",
  "category_sort_user_state",
  "dual_task_sequences",
  "dual_task_sessions",
  "dual_task_user_state",
  "face_name_personas",
  "face_name_sets",
  "face_name_sessions",
  "face_name_user_state",
  "listen_closely_soundscapes",
  "listen_closely_sessions",
  "listen_closely_user_state",
  "number_trails_configs",
  "number_trails_sessions",
  "number_trails_user_state",
  "remember_later_rounds",
  "remember_later_sessions",
  "remember_later_user_state",
  "spatial_nav_maps",
  "spatial_nav_sessions",
  "spatial_nav_user_state",
  "scent_memory_prompts",
  "scent_memory_sessions",
  "scent_memory_user_state",
  "breath_garden_sessions",
  "breath_garden_user_state",
  "learning_categories",
  "learning_lessons",
  "learning_programs",
  "learning_program_items",
  "learning_program_events",
] as const;

export const DB_HEALTH_REQUIRED_LEARNING_COLUMNS = {
  learning_categories: [
    "id",
    "slug",
    "label",
    "description",
    "color",
    "icon",
    "sort_order",
    "is_active",
    "created_at",
    "updated_at",
  ],
  learning_lessons: [
    "id",
    "external_id",
    "category_slug",
    "language",
    "title",
    "hook",
    "body",
    "reflection_prompt",
    "source_notes",
    "estimated_minutes",
    "difficulty",
    "tags",
    "status",
    "is_active",
    "reviewed_at",
    "reviewed_by",
    "published_at",
    "published_by",
    "archived_at",
    "archived_by",
    "created_at",
    "updated_at",
  ],
  learning_programs: [
    "id",
    "user_id",
    "status",
    "interests",
    "pace",
    "daily_time",
    "lesson_length_minutes",
    "language",
    "start_date",
    "end_date",
    "completed_at",
    "created_at",
    "updated_at",
  ],
  learning_program_items: [
    "id",
    "program_id",
    "user_id",
    "lesson_id",
    "program_day",
    "scheduled_date",
    "status",
    "completed_at",
    "saved_at",
    "skipped_at",
    "created_at",
    "updated_at",
  ],
  learning_program_events: [
    "id",
    "program_id",
    "program_item_id",
    "lesson_id",
    "user_id",
    "event_type",
    "source",
    "metadata",
    "created_at",
  ],
} as const;

export const DB_HEALTH_REQUIRED_LEARNING_UNIQUE_KEYS = [
  { table: "learning_categories", columns: ["slug"] },
  { table: "learning_lessons", columns: ["external_id"] },
] as const;

function hasDirectSupabaseConfig() {
  return Boolean(
    process.env.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_ANON_KEY,
  );
}

function requiredLearningColumnNames() {
  return Object.entries(DB_HEALTH_REQUIRED_LEARNING_COLUMNS).flatMap(([table, columns]) =>
    columns.map((column) => `${table}.${column}`),
  );
}

function requiredLearningTableNames() {
  return Object.keys(DB_HEALTH_REQUIRED_LEARNING_COLUMNS);
}

function normalizeIndexColumns(indexdef: unknown) {
  if (typeof indexdef !== "string") return [];
  const match = indexdef.match(/using\s+\w+\s*\(([^)]+)\)/i) ?? indexdef.match(/\(([^)]+)\)/);
  if (!match?.[1]) return [];
  return match[1]
    .split(",")
    .map((column) => column.trim().replace(/"/g, "").toLowerCase())
    .filter(Boolean);
}

function learningUniqueKeySignature(table: string, columns: readonly string[]) {
  return `${table}.${columns.join("+")}`;
}

export async function loadDbHealth() {
  const learningTables = requiredLearningTableNames();
  const [pingResult, tableResult, columnResult, indexResult] = await Promise.all([
    pool.query("select now() as checked_at"),
    pool.query(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = any($1::text[])
      `,
      [DB_HEALTH_REQUIRED_TABLES],
    ),
    pool.query(
      `
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = any($1::text[])
      `,
      [learningTables],
    ),
    pool.query(
      `
        select tablename as table_name, indexname as index_name, indexdef
        from pg_indexes
        where schemaname = 'public'
          and tablename = any($1::text[])
      `,
      [learningTables],
    ),
  ]);

  const existing = new Set(tableResult.rows.map((row) => String(row.table_name)));
  const missingTables = DB_HEALTH_REQUIRED_TABLES.filter((table) => !existing.has(table));
  const existingLearningColumns = new Set(
    columnResult.rows.map((row) => `${String(row.table_name)}.${String(row.column_name)}`),
  );
  const missingLearningColumns = requiredLearningColumnNames().filter((column) => !existingLearningColumns.has(column));
  const uniqueLearningKeys = new Set(
    indexResult.rows
      .filter((row) => typeof row.indexdef === "string" && /\bunique\b/i.test(row.indexdef))
      .map((row) => learningUniqueKeySignature(String(row.table_name), normalizeIndexColumns(row.indexdef))),
  );
  const missingLearningUniqueKeys = DB_HEALTH_REQUIRED_LEARNING_UNIQUE_KEYS
    .filter((key) => !uniqueLearningKeys.has(learningUniqueKeySignature(key.table, key.columns)))
    .map((key) => learningUniqueKeySignature(key.table, key.columns));
  const missingLearningMigrationPieces = missingLearningColumns.length + missingLearningUniqueKeys.length;

  return {
    ok: missingTables.length === 0 && missingLearningMigrationPieces === 0,
    database: {
      connected: true,
      checkedAt: pingResult.rows[0]?.checked_at ?? null,
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    },
    supabaseDirectConfigPresent: hasDirectSupabaseConfig(),
    requiredTableCount: DB_HEALTH_REQUIRED_TABLES.length,
    missingTableCount: missingTables.length,
    missingTables,
    requiredLearningColumnCount: requiredLearningColumnNames().length,
    missingLearningColumnCount: missingLearningColumns.length,
    missingLearningColumns,
    requiredLearningUniqueKeyCount: DB_HEALTH_REQUIRED_LEARNING_UNIQUE_KEYS.length,
    missingLearningUniqueKeyCount: missingLearningUniqueKeys.length,
    missingLearningUniqueKeys,
  };
}

export async function dbHealthHandler(_req: Request, res: Response) {
  try {
    return res.json(await loadDbHealth());
  } catch (error) {
    console.error("[health/db] database health check failed:", error);
    return res.status(503).json({
      ok: false,
      database: {
        connected: false,
        databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
      },
      supabaseDirectConfigPresent: hasDirectSupabaseConfig(),
      error: "Database health check failed.",
    });
  }
}
