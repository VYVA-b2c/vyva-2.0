import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock("../db.js", () => dbMock);

import { DB_HEALTH_REQUIRED_TABLES, dbHealthHandler } from "../routes/dbHealth.js";

function buildApp() {
  const app = express();
  app.get("/api/health/db", dbHealthHandler);
  return app;
}

const app = buildApp();
const originalEnv = { ...process.env };

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
      return { rows: DB_HEALTH_REQUIRED_TABLES.map((table_name) => ({ table_name })) };
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
    });
    expect(JSON.stringify(res.body)).not.toContain("postgres://example");
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
