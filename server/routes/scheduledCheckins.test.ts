import express from "express";
import request from "supertest";
import { afterEach, expect, test, vi } from "vitest";
import { scheduledCheckinsRouter } from "./scheduledCheckins.js";

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: "linked-user", ...(req.headers.authorization ? { authProvider: "supabase" as const } : {}) };
    next();
  },
  requireUser: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("the app proxies replies for the verified subject and ignores caller-supplied identity", async () => {
  vi.stubEnv("TELECARE_APP_CHECKIN_SIMULATION", "true");
  vi.stubEnv("VYVA_ENVIRONMENT", "test");
  vi.stubEnv("TELECARE_BRIDGE_URL", "http://localhost:4320");
  vi.stubEnv("TELECARE_BRIDGE_ACCOUNT_ID", "synthetic-account");
  vi.stubEnv("CONSUMER_BRIDGE_JWT_SECRET", "fixture-telecare-bridge-secret-for-tests");
  const upstream = vi.fn(async (_url: URL, _options: RequestInit) =>
    Response.json({ recorded: true }));
  vi.stubGlobal("fetch", upstream);
  const app = express();
  app.use(express.json());
  app.use("/api/health/scheduled-checkins", scheduledCheckinsRouter);
  const path = "/api/health/scheduled-checkins";
  await request(app).post(path).set("x-user-id", "unverified").send({ promptId: "app_ab" }).expect(401);
  expect(upstream).not.toHaveBeenCalled();
  await request(app).post(path).set("Authorization", "Bearer fixture")
    .send({ promptId: "app_ab", subject: "other", accountId: "other" }).expect(200, { recorded: true });
  const [url, options] = upstream.mock.calls[0];
  expect(url.pathname).toBe("/api/v1/bridge/person/linked-user/scheduled-checkins");
  expect(options.body).toBe(JSON.stringify({ promptId: "app_ab" }));
  const token = (options.headers as Record<string, string>).Authorization.split(" ")[1];
  expect(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).account_id).toBe("synthetic-account");
});
