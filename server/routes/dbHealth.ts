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

function hasDirectSupabaseConfig() {
  return Boolean(
    process.env.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_ANON_KEY,
  );
}

export async function loadDbHealth() {
  const [pingResult, tableResult] = await Promise.all([
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
  ]);

  const existing = new Set(tableResult.rows.map((row) => String(row.table_name)));
  const missingTables = DB_HEALTH_REQUIRED_TABLES.filter((table) => !existing.has(table));

  return {
    ok: missingTables.length === 0,
    database: {
      connected: true,
      checkedAt: pingResult.rows[0]?.checked_at ?? null,
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    },
    supabaseDirectConfigPresent: hasDirectSupabaseConfig(),
    requiredTableCount: DB_HEALTH_REQUIRED_TABLES.length,
    missingTableCount: missingTables.length,
    missingTables,
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
