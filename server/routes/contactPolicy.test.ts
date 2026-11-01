import express from "express";
import request from "supertest";
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  decision: vi.fn(),
  report: vi.fn(),
  count: vi.fn(),
}));
vi.mock("../lib/contactPolicyStore.js", () => ({
  getContactPolicyForUser: mocks.context,
}));
vi.mock("../lib/contactPolicyDecisionStore.js", () => ({
  recordOutboundDecision: mocks.decision,
}));
vi.mock("../lib/outboundCallBudget.js", () => ({
  countOutboundCallsToday: mocks.count,
}));
vi.mock("../services/dailyCheckinMonitor.js", () => ({
  reportCheckinNoAnswer: mocks.report,
}));
vi.mock("../db.js", () => ({ db: {} }));
import router from "./contactPolicy";
const app = express();
app.use(express.json());
app.use("/api/contact-policy", router);
const path = "/api/contact-policy/users/resident/outbound-decision";
describe("telephony contact policy auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VYVA_TELEPHONY_POLICY_SECRET;
  });
  it("fails closed when unset", async () => {
    expect((await request(app).post(path).send({})).status).toBe(503);
    expect(mocks.decision).not.toHaveBeenCalled();
  });
  it.each([undefined, "wrong", "same-length-secret!"])(
    "rejects invalid secrets %s",
    async (secret) => {
      process.env.VYVA_TELEPHONY_POLICY_SECRET = "correct-secret";
      let r = request(app).post(path);
      if (secret) r = r.set("x-vyva-telephony-secret", secret);
      expect((await r.send({})).status).toBe(401);
    },
  );
  it("validates request before dispatch", async () => {
    process.env.VYVA_TELEPHONY_POLICY_SECRET = "secret";
    expect(
      (
        await request(app)
          .post(path)
          .set("x-vyva-telephony-secret", "secret")
          .send({ purpose: "invalid" })
      ).status,
    ).toBe(400);
  });
  it("returns a recorded decision", async () => {
    process.env.VYVA_TELEPHONY_POLICY_SECRET = "secret";
    mocks.decision.mockResolvedValue({
      decided_channel: "whatsapp_outbound",
      reason: "over_daily_limit",
      calls_today: 3,
      limit: 3,
    });
    const r = await request(app)
      .post(path)
      .set("x-vyva-telephony-secret", "secret")
      .send({ purpose: "medication", requested_channel: "voice_outbound" });
    expect(r.status).toBe(200);
    expect(r.body.reason).toBe("over_daily_limit");
  });
  it("forwards final no-answer reports to the existing alert path", async () => {
    process.env.VYVA_TELEPHONY_POLICY_SECRET = "secret";
    mocks.report.mockResolvedValue({ alert: { id: "same-alert" } });
    const send = () =>
      request(app)
        .post("/api/contact-policy/users/resident/checkin-no-answer")
        .set("x-vyva-telephony-secret", "secret")
        .send({ scheduled_for: "2026-11-01T10:00:00Z", attempts: 4 });
    expect((await send()).body).toEqual((await send()).body);
    expect(mocks.report).toHaveBeenCalledTimes(2);
  });
});
