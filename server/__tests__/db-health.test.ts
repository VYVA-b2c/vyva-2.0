import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock("../db.js", () => dbMock);

import {
  DB_HEALTH_REQUIRED_LEARNING_COLUMNS,
  DB_HEALTH_REQUIRED_LEARNING_COLUMN_TYPES,
  DB_HEALTH_REQUIRED_TABLES,
  dbHealthHandler,
} from "../routes/dbHealth.js";

function buildApp() {
  const app = express();
  app.get("/api/health/db", dbHealthHandler);
  return app;
}

const app = buildApp();
const originalEnv = { ...process.env };

function learningColumnRows(skipColumn?: string, typeOverrides: Record<string, string> = {}) {
  return Object.entries(DB_HEALTH_REQUIRED_LEARNING_COLUMNS).flatMap(([table_name, columns]) =>
    columns
      .map((column_name) => ({
        table_name,
        column_name,
        udt_name:
          typeOverrides[`${table_name}.${column_name}`] ??
          DB_HEALTH_REQUIRED_LEARNING_COLUMN_TYPES[table_name as keyof typeof DB_HEALTH_REQUIRED_LEARNING_COLUMN_TYPES][column_name as never],
      }))
      .filter((row) => `${row.table_name}.${row.column_name}` !== skipColumn),
  );
}

function learningUniqueIndexRows(omitExternalId = false) {
  return [
    {
      table_name: "learning_categories",
      index_name: "learning_categories_slug_key",
      indexdef: "CREATE UNIQUE INDEX learning_categories_slug_key ON public.learning_categories USING btree (slug)",
    },
    ...(omitExternalId ? [] : [{
      table_name: "learning_lessons",
      index_name: "idx_learning_lessons_external_id_unique",
      indexdef: "CREATE UNIQUE INDEX idx_learning_lessons_external_id_unique ON public.learning_lessons USING btree (external_id)",
    }]),
  ];
}

describe("database health route", () => {
  beforeEach(() => {
    process.env = { ...originalEnv, DATABASE_URL: "postgres://example" };
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    dbMock.pool.query.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reports required table coverage without exposing connection details", async () => {
    dbMock.pool.query.mockImplementation(async (sql: string) => {
      if (sql.includes("select now()")) return { rows: [{ checked_at: "2026-06-28T10:00:00.000Z" }] };
      if (sql.includes("information_schema.tables")) {
        return { rows: DB_HEALTH_REQUIRED_TABLES.map((table_name) => ({ table_name })) };
      }
      if (sql.includes("information_schema.columns")) {
        return { rows: learningColumnRows() };
      }
      if (sql.includes("pg_indexes")) {
        return { rows: learningUniqueIndexRows() };
      }
      return { rows: [] };
    });

    const res = await request(app).get("/api/health/db").expect(200);

    expect(res.body).toMatchObject({
      ok: true,
      database: {
        connected: true,
        databaseUrlConfigured: true,
      },
      supabaseDirectConfigPresent: false,
      missingTableCount: 0,
      missingTables: [],
      missingLearningColumnCount: 0,
      missingLearningColumns: [],
      wrongLearningColumnTypeCount: 0,
      wrongLearningColumnTypes: [],
      missingLearningUniqueKeyCount: 0,
      missingLearningUniqueKeys: [],
    });
    expect(JSON.stringify(res.body)).not.toContain("postgres://example");
  });

  it("reports missing learning columns and unique keys", async () => {
    dbMock.pool.query.mockImplementation(async (sql: string) => {
      if (sql.includes("select now()")) return { rows: [{ checked_at: "2026-06-28T10:00:00.000Z" }] };
      if (sql.includes("information_schema.tables")) {
        return { rows: DB_HEALTH_REQUIRED_TABLES.map((table_name) => ({ table_name })) };
      }
      if (sql.includes("information_schema.columns")) {
        return { rows: learningColumnRows("learning_lessons.external_id") };
      }
      if (sql.includes("pg_indexes")) {
        return { rows: learningUniqueIndexRows(true) };
      }
      return { rows: [] };
    });

    const res = await request(app).get("/api/health/db").expect(200);

    expect(res.body).toMatchObject({
      ok: false,
      missingTableCount: 0,
      missingLearningColumnCount: 1,
      missingLearningColumns: ["learning_lessons.external_id"],
      missingLearningUniqueKeyCount: 1,
      missingLearningUniqueKeys: ["learning_lessons.external_id"],
    });
  });

  it("reports drifted learning column types", async () => {
    dbMock.pool.query.mockImplementation(async (sql: string) => {
      if (sql.includes("select now()")) return { rows: [{ checked_at: "2026-06-28T10:00:00.000Z" }] };
      if (sql.includes("information_schema.tables")) {
        return { rows: DB_HEALTH_REQUIRED_TABLES.map((table_name) => ({ table_name })) };
      }
      if (sql.includes("information_schema.columns")) {
        return { rows: learningColumnRows(undefined, { "learning_categories.description": "jsonb" }) };
      }
      if (sql.includes("pg_indexes")) {
        return { rows: learningUniqueIndexRows() };
      }
      return { rows: [] };
    });

    const res = await request(app).get("/api/health/db").expect(200);

    expect(res.body).toMatchObject({
      ok: false,
      missingLearningColumnCount: 0,
      wrongLearningColumnTypeCount: 1,
      wrongLearningColumnTypes: ["learning_categories.description expected text, found jsonb"],
    });
  });

  it("returns a clear unhealthy response when the database query fails", async () => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    dbMock.pool.query.mockRejectedValue(new Error("connection refused"));

    const res = await request(app).get("/api/health/db").expect(503);

    expect(res.body).toMatchObject({
      ok: false,
      database: {
        connected: false,
        databaseUrlConfigured: true,
      },
      supabaseDirectConfigPresent: true,
      error: "Database health check failed.",
    });
  });
});
