import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import type { Request } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { isLocalDevelopmentRequest } from "../lib/requestEnvironment.js";

const originalNodeEnv = process.env.NODE_ENV;

function reqWithHeaders(headers: Request["headers"]): Request {
  return { headers } as Request;
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("request environment detection", () => {
  it("allows local development hosts to use dev-only fallbacks", () => {
    process.env.NODE_ENV = "test";

    expect(isLocalDevelopmentRequest(reqWithHeaders({ host: "localhost:3001" }))).toBe(true);
    expect(isLocalDevelopmentRequest(reqWithHeaders({ host: "127.0.0.1:3001" }))).toBe(true);
    expect(isLocalDevelopmentRequest(reqWithHeaders({ host: "[::1]:3001" }))).toBe(true);
  });

  it("does not treat public hosts as local development when NODE_ENV is missing", () => {
    delete process.env.NODE_ENV;

    expect(isLocalDevelopmentRequest(reqWithHeaders({ host: "v2.vyva.life" }))).toBe(false);
    expect(isLocalDevelopmentRequest(reqWithHeaders({
      host: "127.0.0.1:3001",
      "x-forwarded-host": "v2.vyva.life",
    }))).toBe(false);
  });

  it("does not allow development fallbacks when NODE_ENV is production", () => {
    process.env.NODE_ENV = "production";

    expect(isLocalDevelopmentRequest(reqWithHeaders({ host: "localhost:3001" }))).toBe(false);
  });
});

describe("auth middleware development fallback", () => {
  function buildApp() {
    const app = express();
    app.use(authMiddleware, (req, res) => {
      res.json({ userId: req.user?.id ?? null });
    });
    return app;
  }

  it("accepts x-user-id only on local development hosts", async () => {
    process.env.NODE_ENV = "test";

    await request(buildApp())
      .get("/")
      .set("Host", "localhost:3001")
      .set("x-user-id", "local-user")
      .expect(200, { userId: "local-user" });
  });

  it("ignores x-user-id on public hosts even when NODE_ENV is missing", async () => {
    delete process.env.NODE_ENV;

    await request(buildApp())
      .get("/")
      .set("Host", "v2.vyva.life")
      .set("x-user-id", "public-user")
      .expect(200, { userId: null });
  });
});
