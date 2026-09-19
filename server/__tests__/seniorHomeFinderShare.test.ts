import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
}));

vi.mock("../db.js", () => ({
  pool: { query: mocks.poolQuery },
}));

import {
  createSeniorHomeFinderShareHandler,
  sharedSeniorHomeFinderReportHandler,
} from "../routes/seniorHomeFinderShare.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/api/advisors/sabio/share", (req, res, next) => {
    (req as unknown as { user?: { id: string } }).user = { id: "user-1" };
    next();
  }, createSeniorHomeFinderShareHandler);
  app.get("/api/senior-home-finder/shared/:token", sharedSeniorHomeFinderReportHandler);
  return app;
}

// ensureSeniorHomeFinderShareTable() memoizes its promise at module scope, so
// it only actually calls pool.query once across this whole file. Route on SQL
// text instead of call order so tests don't depend on which one runs first.
function mockPoolQuery(realResponse: (sql: string, params: unknown[]) => unknown) {
  mocks.poolQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("create table")) return undefined;
    return realResponse(sql, params);
  });
}

describe("senior home finder share", () => {
  beforeEach(() => {
    mocks.poolQuery.mockReset();
  });

  it("creates a share only from an explicit summary, and only for its own table", async () => {
    let insertCall: { sql: string; params: unknown[] } | null = null;
    mockPoolQuery((sql, params) => {
      insertCall = { sql, params };
      return undefined;
    });

    const res = await request(buildApp())
      .post("/api/advisors/sabio/share")
      .send({ name: "Rosa", language: "en", summary: "Shortlist: Willow Court and Oak Gardens, both accept visits this week." })
      .expect(200);

    expect(res.body.token).toEqual(expect.any(String));
    expect(insertCall).not.toBeNull();
    expect(insertCall!.sql).toContain("insert into senior_home_finder_report_shares");
    expect(insertCall!.sql).not.toContain("checkin_report_shares");
    expect(insertCall!.sql).not.toContain("benefits_programs");
    const [token, userId, language, name, payloadJson] = insertCall!.params;
    expect(token).toBe(res.body.token);
    expect(userId).toBe("user-1");
    expect(language).toBe("en");
    expect(name).toBe("Rosa");
    expect(JSON.parse(payloadJson as string)).toMatchObject({
      name: "Rosa",
      language: "en",
      summary: "Shortlist: Willow Court and Oak Gardens, both accept visits this week.",
    });
  });

  it("rejects a share request with no summary", async () => {
    mockPoolQuery(() => undefined);

    await request(buildApp())
      .post("/api/advisors/sabio/share")
      .send({ name: "Rosa" })
      .expect(400);

    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it("serves an unexpired shared report without authentication", async () => {
    mockPoolQuery((sql) => {
      if (sql.includes("select report_payload")) {
        return {
          rows: [{
            report_payload: { name: "Rosa", language: "en", summary: "Two options worth visiting." },
            created_at: "2026-09-17T10:00:00.000Z",
            expires_at: "2026-10-17T10:00:00.000Z",
          }],
        };
      }
      return { rows: [] };
    });

    const res = await request(buildApp())
      .get("/api/senior-home-finder/shared/some-token")
      .expect(200);

    expect(res.body.report).toMatchObject({ name: "Rosa", summary: "Two options worth visiting." });
  });

  it("404s an expired or unknown token", async () => {
    mockPoolQuery(() => ({ rows: [] }));

    await request(buildApp())
      .get("/api/senior-home-finder/shared/expired-token")
      .expect(404);
  });
});
