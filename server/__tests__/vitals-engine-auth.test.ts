import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import vitalsEngineRouter from "../routes/vitalsEngine.js";
import { authMiddleware } from "../middleware/auth.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use("/api/vitals-engine", vitalsEngineRouter);
  return app;
}

const app = buildApp();

describe("Vitals engine auth boundaries", () => {
  it("requires authentication for the latest safety check", async () => {
    const res = await request(app)
      .get("/api/vitals-engine/latest")
      .expect(401);

    expect(res.body.error).toMatch(/not authenticated/i);
  });

  it("rejects writes for a different user id", async () => {
    const currentUserId = randomUUID();
    const otherUserId = randomUUID();

    const res = await request(app)
      .post("/api/vitals-engine/reading")
      .set("x-user-id", currentUserId)
      .send({
        user_id: otherUserId,
        signal_type: "resting_hr_bpm",
        value: 72,
      })
      .expect(403);

    expect(res.body.error).toMatch(/another user/i);
  });
});
